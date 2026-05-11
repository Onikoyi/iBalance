using iBalance.Api.Security;
using iBalance.Api.Services;
using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/inventory")]
public sealed class InventoryIntegrationController : ControllerBase
{
    [HttpPost("purchase-invoice-receipts")]
    [Authorize(Policy = AuthorizationPolicies.InventoryManage)]
    public async Task<IActionResult> ReceivePurchaseInvoiceIntoInventory(
        [FromBody] ReceivePurchaseInvoiceIntoInventoryRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        if (request.PurchaseInvoiceId == Guid.Empty) return BadRequest(new { Message = "Purchase invoice is required." });
        if (request.WarehouseId == Guid.Empty) return BadRequest(new { Message = "Warehouse is required." });
        if (request.InventoryLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Inventory control ledger account is required." });
        if (request.CreditLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Credit ledger account is required." });
        if (request.Lines is null || request.Lines.Count == 0) return BadRequest(new { Message = "At least one inventory receipt line is required." });

        var invoice = await dbContext.PurchaseInvoices
            .Include(x => x.Lines)
            .Include(x => x.Vendor)
            .FirstOrDefaultAsync(x => x.Id == request.PurchaseInvoiceId, cancellationToken);

        if (invoice is null) return NotFound(new { Message = "Purchase invoice was not found.", request.PurchaseInvoiceId });

        if (invoice.Status != PurchaseInvoiceStatus.Posted &&
            invoice.Status != PurchaseInvoiceStatus.PartPaid &&
            invoice.Status != PurchaseInvoiceStatus.Paid)
        {
            return Conflict(new { Message = "Only posted purchase invoices can be received into inventory.", invoice.Id, invoice.InvoiceNumber, invoice.Status });
        }

        var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == request.WarehouseId, cancellationToken);
        if (warehouse is null) return BadRequest(new { Message = "Warehouse was not found.", request.WarehouseId });
        if (!warehouse.IsActive) return BadRequest(new { Message = "Only active warehouses can receive inventory.", warehouse.WarehouseCode });

        var transactionDateUtc = request.TransactionDateUtc == default ? DateTime.UtcNow : request.TransactionDateUtc;

        var postingGuard = await FiscalPeriodPostingGuard.EnsureOpenPeriodAsync(
            dbContext,
            transactionDateUtc,
            "Inventory Receipt",
            cancellationToken);

        if (!postingGuard.Allowed)
        {
            return Conflict(postingGuard.ToProblem());
        }

        var postingPeriod = postingGuard.FiscalPeriod!;

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(dbContext, new[] { request.InventoryLedgerAccountId, request.CreditLedgerAccountId }, cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var transactionNumber = await ResolveTransactionNumberAsync(dbContext, tenantContext.TenantId, request.TransactionNumber, "PI-REC", cancellationToken);
        var duplicateTransaction = await dbContext.InventoryTransactions.AsNoTracking().AnyAsync(x => x.TransactionNumber == transactionNumber, cancellationToken);
        if (duplicateTransaction) return Conflict(new { Message = "An inventory transaction with the same number already exists.", TransactionNumber = transactionNumber });

        var journalReference = string.IsNullOrWhiteSpace(request.JournalReference)
            ? $"INV-PI-REC-{invoice.InvoiceNumber}"
            : request.JournalReference.Trim().ToUpperInvariant();

        var duplicateJournal = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == journalReference, cancellationToken);
        if (duplicateJournal) return Conflict(new { Message = "A journal entry with the same inventory receipt reference already exists.", Reference = journalReference });

        var receiptDescription = string.IsNullOrWhiteSpace(request.Description)
            ? $"Inventory receipt from purchase invoice {invoice.InvoiceNumber}"
            : request.Description.Trim();

        var transaction = new InventoryTransaction(Guid.NewGuid(), tenantContext.TenantId, transactionNumber, InventoryTransactionType.StockIn, transactionDateUtc, receiptDescription, invoice.InvoiceNumber, request.Notes);

        var transactionLines = new List<InventoryTransactionLine>();
        var stockLedgerEntries = new List<StockLedgerEntry>();
        var journalLines = new List<JournalEntryLine>();
        var invoiceLineMap = invoice.Lines.ToDictionary(x => x.Id, x => x);

        foreach (var line in request.Lines)
        {
            if (line.InventoryItemId == Guid.Empty) return BadRequest(new { Message = "Inventory item is required on every receipt line." });
            if (line.Quantity <= 0m) return BadRequest(new { Message = "Receipt quantity must be greater than zero.", line.InventoryItemId });
            if (line.UnitCost < 0m) return BadRequest(new { Message = "Receipt unit cost cannot be negative.", line.InventoryItemId });

            var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == line.InventoryItemId, cancellationToken);
            if (item is null) return BadRequest(new { Message = "Inventory item was not found.", line.InventoryItemId });
            if (!item.IsActive || item.ItemType != InventoryItemType.StockItem) return BadRequest(new { Message = "Only active stock items can be received into inventory.", item.ItemCode });

            if (line.PurchaseInvoiceLineId.HasValue && !invoiceLineMap.ContainsKey(line.PurchaseInvoiceLineId.Value))
            {
                return BadRequest(new { Message = "One receipt line references a purchase invoice line that does not belong to this invoice.", line.PurchaseInvoiceLineId });
            }

            var unitCost = line.UnitCost;
            if (unitCost == 0m && line.PurchaseInvoiceLineId.HasValue)
            {
                unitCost = invoiceLineMap[line.PurchaseInvoiceLineId.Value].UnitPrice;
            }

            var lineDescription = string.IsNullOrWhiteSpace(line.Description)
                ? $"Inventory receipt - {invoice.InvoiceNumber} - {item.ItemCode}"
                : line.Description.Trim();

            var transactionLine = new InventoryTransactionLine(Guid.NewGuid(), tenantContext.TenantId, transaction.Id, item.Id, warehouse.Id, line.Quantity, unitCost, lineDescription);
            transactionLines.Add(transactionLine);

            stockLedgerEntries.Add(new StockLedgerEntry(Guid.NewGuid(), tenantContext.TenantId, item.Id, warehouse.Id, transaction.Id, transactionLine.Id, StockMovementType.StockIn, transactionDateUtc, line.Quantity, 0m, unitCost, transaction.TransactionNumber, lineDescription));

            var lineValue = line.Quantity * unitCost;
            if (lineValue > 0m)
            {
                journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.InventoryLedgerAccountId, $"Inventory receipt - {invoice.InvoiceNumber} - {item.ItemCode}", lineValue, 0m));
                journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.CreditLedgerAccountId, $"Inventory receipt offset - {invoice.InvoiceNumber} - {item.ItemCode}", 0m, lineValue));
            }
        }

        if (journalLines.Count == 0) return BadRequest(new { Message = "Inventory receipt total value must be greater than zero for GL posting." });

        foreach (var line in transactionLines) transaction.Lines.Add(line);

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            transactionDateUtc,
            journalReference,
            $"Inventory receipt posting - {invoice.InvoiceNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            journalLines,
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);
        transaction.LinkJournal(journalEntry.Id);

        var movements = journalEntry.Lines.Select(line => new LedgerMovement(Guid.NewGuid(), tenantContext.TenantId, journalEntry.Id, line.Id, line.LedgerAccountId, journalEntry.EntryDateUtc, journalEntry.Reference, line.Description, line.DebitAmount, line.CreditAmount)).ToList();

        dbContext.InventoryTransactions.Add(transaction);
        dbContext.InventoryTransactionLines.AddRange(transactionLines);
        dbContext.StockLedgerEntries.AddRange(stockLedgerEntries);
        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "inventory",
            "InventoryTransaction",
            "PurchaseInvoiceReceivedIntoInventory",
            transaction.Id,
            transaction.TransactionNumber,
            $"Purchase invoice '{invoice.InvoiceNumber}' received into inventory.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { invoice.InvoiceNumber, transaction.TransactionNumber, LineCount = transactionLines.Count, JournalEntryId = journalEntry.Id },
            cancellationToken);

        return Ok(new
        {
            Message = "Purchase invoice received into inventory successfully.",
            PurchaseInvoiceId = invoice.Id,
            invoice.InvoiceNumber,
            TransactionId = transaction.Id,
            transaction.TransactionNumber,
            transaction.JournalEntryId,
            LineCount = transactionLines.Count,
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name,
            JournalEntry = new { journalEntry.Id, journalEntry.Reference, journalEntry.TotalDebit, journalEntry.TotalCredit }
        });
    }

    [HttpPost("sales-invoice-issues")]
    [Authorize(Policy = AuthorizationPolicies.InventoryManage)]
    public async Task<IActionResult> IssueInventoryForSalesInvoice(
        [FromBody] IssueInventoryForSalesInvoiceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        if (request.SalesInvoiceId == Guid.Empty) return BadRequest(new { Message = "Sales invoice is required." });
        if (request.WarehouseId == Guid.Empty) return BadRequest(new { Message = "Warehouse is required." });
        if (request.InventoryLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Inventory control ledger account is required." });
        if (request.CogsLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "COGS ledger account is required." });
        if (request.Lines is null || request.Lines.Count == 0) return BadRequest(new { Message = "At least one inventory issue line is required." });

        var invoice = await dbContext.SalesInvoices
            .Include(x => x.Lines)
            .Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == request.SalesInvoiceId, cancellationToken);

        if (invoice is null) return NotFound(new { Message = "Sales invoice was not found.", request.SalesInvoiceId });

        if (invoice.Status != SalesInvoiceStatus.Posted &&
            invoice.Status != SalesInvoiceStatus.PartPaid &&
            invoice.Status != SalesInvoiceStatus.Paid)
        {
            return Conflict(new { Message = "Only posted sales invoices can issue inventory to COGS.", invoice.Id, invoice.InvoiceNumber, invoice.Status });
        }

        var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == request.WarehouseId, cancellationToken);
        if (warehouse is null) return BadRequest(new { Message = "Warehouse was not found.", request.WarehouseId });
        if (!warehouse.IsActive) return BadRequest(new { Message = "Only active warehouses can issue inventory.", warehouse.WarehouseCode });

        var transactionDateUtc = request.TransactionDateUtc == default ? DateTime.UtcNow : request.TransactionDateUtc;

        var postingGuard = await FiscalPeriodPostingGuard.EnsureOpenPeriodAsync(
            dbContext,
            transactionDateUtc,
            "Inventory Receipt",
            cancellationToken);

        if (!postingGuard.Allowed)
        {
            return Conflict(postingGuard.ToProblem());
        }

        var postingPeriod = postingGuard.FiscalPeriod!;

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(dbContext, new[] { request.InventoryLedgerAccountId, request.CogsLedgerAccountId }, cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var transactionNumber = await ResolveTransactionNumberAsync(dbContext, tenantContext.TenantId, request.TransactionNumber, "SI-ISS", cancellationToken);
        var duplicateTransaction = await dbContext.InventoryTransactions.AsNoTracking().AnyAsync(x => x.TransactionNumber == transactionNumber, cancellationToken);
        if (duplicateTransaction) return Conflict(new { Message = "An inventory transaction with the same number already exists.", TransactionNumber = transactionNumber });

        var journalReference = string.IsNullOrWhiteSpace(request.JournalReference)
            ? $"INV-SI-ISS-{invoice.InvoiceNumber}"
            : request.JournalReference.Trim().ToUpperInvariant();

        var duplicateJournal = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == journalReference, cancellationToken);
        if (duplicateJournal) return Conflict(new { Message = "A journal entry with the same inventory issue reference already exists.", Reference = journalReference });

        var issueDescription = string.IsNullOrWhiteSpace(request.Description)
            ? $"Inventory issue for sales invoice {invoice.InvoiceNumber}"
            : request.Description.Trim();

        var transaction = new InventoryTransaction(Guid.NewGuid(), tenantContext.TenantId, transactionNumber, InventoryTransactionType.Adjustment, transactionDateUtc, issueDescription, invoice.InvoiceNumber, request.Notes);

        var transactionLines = new List<InventoryTransactionLine>();
        var stockLedgerEntries = new List<StockLedgerEntry>();
        var journalLines = new List<JournalEntryLine>();
        var invoiceLineMap = invoice.Lines.ToDictionary(x => x.Id, x => x);

        foreach (var line in request.Lines)
        {
            if (line.InventoryItemId == Guid.Empty) return BadRequest(new { Message = "Inventory item is required on every issue line." });
            if (line.Quantity <= 0m) return BadRequest(new { Message = "Issue quantity must be greater than zero.", line.InventoryItemId });

            var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == line.InventoryItemId, cancellationToken);
            if (item is null) return BadRequest(new { Message = "Inventory item was not found.", line.InventoryItemId });
            if (!item.IsActive || item.ItemType != InventoryItemType.StockItem) return BadRequest(new { Message = "Only active stock items can be issued from inventory.", item.ItemCode });

            if (line.SalesInvoiceLineId.HasValue && !invoiceLineMap.ContainsKey(line.SalesInvoiceLineId.Value))
            {
                return BadRequest(new { Message = "One issue line references a sales invoice line that does not belong to this invoice.", line.SalesInvoiceLineId });
            }

            var onHand = await GetQuantityOnHandAsync(dbContext, item.Id, warehouse.Id, cancellationToken);
            if (onHand < line.Quantity)
            {
                return Conflict(new { Message = "Inventory issue would create negative stock.", item.ItemCode, warehouse.WarehouseCode, QuantityOnHand = onHand, RequestedIssue = line.Quantity });
            }

            var unitCost = line.UnitCost > 0m ? line.UnitCost : await GetAverageUnitCostAsync(dbContext, item.Id, warehouse.Id, cancellationToken);
            if (unitCost <= 0m)
            {
                return Conflict(new { Message = "Unable to determine COGS unit cost. Enter unit cost explicitly or receive inventory with cost first.", item.ItemCode, warehouse.WarehouseCode });
            }

            var lineDescription = string.IsNullOrWhiteSpace(line.Description)
                ? $"Inventory issue - {invoice.InvoiceNumber} - {item.ItemCode}"
                : line.Description.Trim();

            var transactionLine = new InventoryTransactionLine(Guid.NewGuid(), tenantContext.TenantId, transaction.Id, item.Id, warehouse.Id, line.Quantity, unitCost, lineDescription);
            transactionLines.Add(transactionLine);

            stockLedgerEntries.Add(new StockLedgerEntry(Guid.NewGuid(), tenantContext.TenantId, item.Id, warehouse.Id, transaction.Id, transactionLine.Id, StockMovementType.AdjustmentOut, transactionDateUtc, 0m, line.Quantity, unitCost, transaction.TransactionNumber, lineDescription));

            var lineValue = line.Quantity * unitCost;
            journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.CogsLedgerAccountId, $"COGS - {invoice.InvoiceNumber} - {item.ItemCode}", lineValue, 0m));
            journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.InventoryLedgerAccountId, $"Inventory issue - {invoice.InvoiceNumber} - {item.ItemCode}", 0m, lineValue));
        }

        foreach (var line in transactionLines) transaction.Lines.Add(line);

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            transactionDateUtc,
            journalReference,
            $"Inventory COGS posting - {invoice.InvoiceNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            journalLines,
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);
        transaction.LinkJournal(journalEntry.Id);

        var movements = journalEntry.Lines.Select(line => new LedgerMovement(Guid.NewGuid(), tenantContext.TenantId, journalEntry.Id, line.Id, line.LedgerAccountId, journalEntry.EntryDateUtc, journalEntry.Reference, line.Description, line.DebitAmount, line.CreditAmount)).ToList();

        dbContext.InventoryTransactions.Add(transaction);
        dbContext.InventoryTransactionLines.AddRange(transactionLines);
        dbContext.StockLedgerEntries.AddRange(stockLedgerEntries);
        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "inventory",
            "InventoryTransaction",
            "SalesInvoiceIssuedToCogs",
            transaction.Id,
            transaction.TransactionNumber,
            $"Inventory issued to COGS for sales invoice '{invoice.InvoiceNumber}'.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { invoice.InvoiceNumber, transaction.TransactionNumber, LineCount = transactionLines.Count, JournalEntryId = journalEntry.Id },
            cancellationToken);

        return Ok(new
        {
            Message = "Sales invoice inventory issue and COGS posting completed successfully.",
            SalesInvoiceId = invoice.Id,
            invoice.InvoiceNumber,
            TransactionId = transaction.Id,
            transaction.TransactionNumber,
            transaction.JournalEntryId,
            LineCount = transactionLines.Count,
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name,
            JournalEntry = new { journalEntry.Id, journalEntry.Reference, journalEntry.TotalDebit, journalEntry.TotalCredit }
        });
    }

    private static async Task<FiscalPeriod?> GetOpenFiscalPeriodForDateAsync(ApplicationDbContext dbContext, DateTime postingDateUtc, CancellationToken cancellationToken)
    {
        var postingDate = DateOnly.FromDateTime(postingDateUtc.Date);
        return await dbContext.FiscalPeriods.AsNoTracking()
            .Where(x => x.Status == FiscalPeriodStatus.Open && x.StartDate <= postingDate && x.EndDate >= postingDate)
            .OrderBy(x => x.StartDate)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<IActionResult?> ValidatePostingLedgerAccountsAsync(ApplicationDbContext dbContext, IEnumerable<Guid> ledgerAccountIds, CancellationToken cancellationToken)
    {
        var requestedIds = ledgerAccountIds.Where(x => x != Guid.Empty).Distinct().ToList();
        var ledgerAccounts = await dbContext.LedgerAccounts.AsNoTracking()
            .Where(x => requestedIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var ledgerAccountId in requestedIds)
        {
            if (!ledgerAccounts.TryGetValue(ledgerAccountId, out var ledgerAccount))
            {
                return new BadRequestObjectResult(new { Message = "One or more selected ledger accounts were not found.", LedgerAccountId = ledgerAccountId });
            }

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return new BadRequestObjectResult(new { Message = "Inventory integration GL accounts must be active, non-header, posting-enabled ledger accounts.", LedgerAccountId = ledgerAccount.Id, ledgerAccount.Code, ledgerAccount.Name });
            }
        }

        return null;
    }

    private static async Task<string> ResolveTransactionNumberAsync(ApplicationDbContext dbContext, Guid tenantId, string? requestedNumber, string prefix, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requestedNumber)) return requestedNumber.Trim().ToUpperInvariant();

        var count = await dbContext.InventoryTransactions.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenantId, cancellationToken);
        return $"{prefix}-{DateTime.UtcNow:yyyyMMdd}-{count + 1:0000}";
    }

    private static async Task<decimal> GetQuantityOnHandAsync(ApplicationDbContext dbContext, Guid itemId, Guid warehouseId, CancellationToken cancellationToken)
    {
        var entries = await dbContext.StockLedgerEntries.AsNoTracking()
            .Where(x => x.InventoryItemId == itemId && x.WarehouseId == warehouseId)
            .Select(x => new { x.QuantityIn, x.QuantityOut })
            .ToListAsync(cancellationToken);

        return entries.Sum(x => x.QuantityIn) - entries.Sum(x => x.QuantityOut);
    }

    private static async Task<decimal> GetAverageUnitCostAsync(ApplicationDbContext dbContext, Guid itemId, Guid warehouseId, CancellationToken cancellationToken)
    {
        var entries = await dbContext.StockLedgerEntries.AsNoTracking()
            .Where(x => x.InventoryItemId == itemId && x.WarehouseId == warehouseId)
            .Select(x => new { x.QuantityIn, x.QuantityOut, x.UnitCost })
            .ToListAsync(cancellationToken);

        var quantity = entries.Sum(x => x.QuantityIn) - entries.Sum(x => x.QuantityOut);
        if (quantity <= 0m) return 0m;

        var value = entries.Sum(x => x.QuantityIn * x.UnitCost) - entries.Sum(x => x.QuantityOut * x.UnitCost);
        return value <= 0m ? 0m : value / quantity;
    }

    private static IActionResult TenantRequired() => new BadRequestObjectResult(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
}

public sealed class ReceivePurchaseInvoiceIntoInventoryRequest
{
    public Guid PurchaseInvoiceId { get; set; }
    public Guid WarehouseId { get; set; }
    public Guid InventoryLedgerAccountId { get; set; }
    public Guid CreditLedgerAccountId { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
    public string? TransactionNumber { get; set; }
    public string? JournalReference { get; set; }
    public string? Description { get; set; }
    public string? Notes { get; set; }
    public List<ReceivePurchaseInvoiceInventoryLineRequest> Lines { get; set; } = [];
}

public sealed class ReceivePurchaseInvoiceInventoryLineRequest
{
    public Guid? PurchaseInvoiceLineId { get; set; }
    public Guid InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Description { get; set; }
}

public sealed class IssueInventoryForSalesInvoiceRequest
{
    public Guid SalesInvoiceId { get; set; }
    public Guid WarehouseId { get; set; }
    public Guid InventoryLedgerAccountId { get; set; }
    public Guid CogsLedgerAccountId { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
    public string? TransactionNumber { get; set; }
    public string? JournalReference { get; set; }
    public string? Description { get; set; }
    public string? Notes { get; set; }
    public List<IssueInventoryForSalesInvoiceLineRequest> Lines { get; set; } = [];
}

public sealed class IssueInventoryForSalesInvoiceLineRequest
{
    public Guid? SalesInvoiceLineId { get; set; }
    public Guid InventoryItemId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Description { get; set; }
}
