using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/inventory/reports")]
public sealed class InventoryReportsController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.InventoryView)]
    [HttpGet("valuation")]
    public async Task<IActionResult> GetInventoryValuationReport(
        [FromQuery] DateTime? asOfUtc,
        [FromQuery] Guid? inventoryItemId,
        [FromQuery] Guid? itemId,
        [FromQuery] Guid? warehouseId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;
        var effectiveItemId = inventoryItemId ?? itemId;

        var query = dbContext.StockLedgerEntries.AsNoTracking()
            .Where(x => x.MovementDateUtc <= effectiveAsOfUtc);

        if (effectiveItemId.HasValue) query = query.Where(x => x.InventoryItemId == effectiveItemId.Value);
        if (warehouseId.HasValue) query = query.Where(x => x.WarehouseId == warehouseId.Value);

        var entries = await query.ToListAsync(cancellationToken);
        var itemIds = entries.Select(x => x.InventoryItemId).Distinct().ToList();
        var warehouseIds = entries.Select(x => x.WarehouseId).Distinct().ToList();

        var items = await dbContext.InventoryItems.AsNoTracking()
            .Where(x => itemIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var warehouses = await dbContext.Warehouses.AsNoTracking()
            .Where(x => warehouseIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var rows = entries
            .GroupBy(x => new { x.InventoryItemId, x.WarehouseId })
            .Select(group =>
            {
                items.TryGetValue(group.Key.InventoryItemId, out var item);
                warehouses.TryGetValue(group.Key.WarehouseId, out var warehouse);

                var quantityIn = group.Sum(x => x.QuantityIn);
                var quantityOut = group.Sum(x => x.QuantityOut);
                var quantityOnHand = quantityIn - quantityOut;

                var valueIn = group.Sum(x => x.QuantityIn * x.UnitCost);
                var valueOut = group.Sum(x => x.QuantityOut * x.UnitCost);
                var inventoryValue = valueIn - valueOut;

                return new
                {
                    group.Key.InventoryItemId,
                    ItemId = group.Key.InventoryItemId,
                    ItemCode = item?.ItemCode ?? string.Empty,
                    ItemName = item?.ItemName ?? string.Empty,
                    UnitOfMeasure = item?.UnitOfMeasure ?? string.Empty,
                    ValuationMethod = item?.ValuationMethod,
                    group.Key.WarehouseId,
                    WarehouseCode = warehouse?.WarehouseCode ?? string.Empty,
                    WarehouseName = warehouse?.WarehouseName ?? string.Empty,
                    WarehouseLocation = warehouse?.Location,
                    QuantityIn = quantityIn,
                    QuantityOut = quantityOut,
                    QuantityOnHand = quantityOnHand,
                    ValueIn = valueIn,
                    ValueOut = valueOut,
                    InventoryValue = inventoryValue,
                    AverageUnitCost = quantityOnHand > 0m ? inventoryValue / quantityOnHand : 0m,
                    MovementCount = group.Count()
                };
            })
            .Where(x => Math.Abs(x.QuantityOnHand) > 0.0001m || Math.Abs(x.InventoryValue) > 0.0001m)
            .OrderBy(x => x.ItemCode)
            .ThenBy(x => x.WarehouseCode)
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            Count = rows.Count,
            TotalQuantityOnHand = rows.Sum(x => x.QuantityOnHand),
            TotalInventoryValue = rows.Sum(x => x.InventoryValue),
            Items = rows
        });
    }

    [Authorize(Policy = AuthorizationPolicies.InventoryView)]
    [HttpGet("stock-gl-reconciliation")]
    public async Task<IActionResult> GetStockGlReconciliation(
        [FromQuery] Guid inventoryLedgerAccountId,
        [FromQuery] DateTime? asOfUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        if (inventoryLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Inventory control ledger account is required." });
        }

        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var ledgerAccount = await dbContext.LedgerAccounts.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == inventoryLedgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return BadRequest(new { Message = "Inventory control ledger account was not found.", inventoryLedgerAccountId });
        }

        if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
        {
            return BadRequest(new
            {
                Message = "Inventory control ledger account must be active, non-header, and posting-enabled.",
                ledgerAccount.Id,
                ledgerAccount.Code,
                ledgerAccount.Name
            });
        }

        var stockEntries = await dbContext.StockLedgerEntries.AsNoTracking()
            .Where(x => x.MovementDateUtc <= effectiveAsOfUtc)
            .Select(x => new { x.QuantityIn, x.QuantityOut, x.UnitCost })
            .ToListAsync(cancellationToken);

        var stockValue = stockEntries.Sum(x => x.QuantityIn * x.UnitCost) -
                         stockEntries.Sum(x => x.QuantityOut * x.UnitCost);

        var movements = await dbContext.LedgerMovements.AsNoTracking()
            .Where(x => x.LedgerAccountId == inventoryLedgerAccountId && x.MovementDateUtc <= effectiveAsOfUtc)
            .Select(x => new { x.DebitAmount, x.CreditAmount })
            .ToListAsync(cancellationToken);

        var glDebit = movements.Sum(x => x.DebitAmount);
        var glCredit = movements.Sum(x => x.CreditAmount);
        var glBalance = glDebit - glCredit;
        var difference = stockValue - glBalance;

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            AsOfUtc = effectiveAsOfUtc,
            InventoryLedgerAccount = new
            {
                ledgerAccount.Id,
                ledgerAccount.Code,
                ledgerAccount.Name,
                ledgerAccount.Category,
                ledgerAccount.NormalBalance
            },
            StockValue = stockValue,
            GlDebit = glDebit,
            GlCredit = glCredit,
            GlBalance = glBalance,
            Difference = difference,
            IsReconciled = Math.Abs(difference) < 0.01m,
            StockMovementCount = stockEntries.Count,
            LedgerMovementCount = movements.Count
        });
    }

    [Authorize(Policy = AuthorizationPolicies.InventoryView)]
    [HttpGet("audit-trace")]
    public async Task<IActionResult> GetInventoryAuditTrace(
        [FromQuery] Guid? inventoryTransactionId,
        [FromQuery] Guid? journalEntryId,
        [FromQuery] string? reference,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var transactionQuery = dbContext.InventoryTransactions.AsNoTracking().AsQueryable();

        if (inventoryTransactionId.HasValue) transactionQuery = transactionQuery.Where(x => x.Id == inventoryTransactionId.Value);
        if (journalEntryId.HasValue) transactionQuery = transactionQuery.Where(x => x.JournalEntryId == journalEntryId.Value);
        if (!string.IsNullOrWhiteSpace(reference))
        {
            var normalizedReference = reference.Trim().ToUpperInvariant();
            transactionQuery = transactionQuery.Where(x =>
                x.TransactionNumber.Contains(normalizedReference) ||
                (x.Reference != null && x.Reference.Contains(normalizedReference)));
        }
        if (fromUtc.HasValue) transactionQuery = transactionQuery.Where(x => x.TransactionDateUtc >= fromUtc.Value);
        if (toUtc.HasValue) transactionQuery = transactionQuery.Where(x => x.TransactionDateUtc <= toUtc.Value);

        var transactions = await transactionQuery
            .OrderByDescending(x => x.TransactionDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Take(100)
            .Select(x => new
            {
                x.Id,
                x.TransactionNumber,
                x.TransactionType,
                x.TransactionDateUtc,
                x.Description,
                x.Reference,
                x.Status,
                x.JournalEntryId,
                x.CreatedOnUtc
            })
            .ToListAsync(cancellationToken);

        var transactionIds = transactions.Select(x => x.Id).ToList();
        var journalIds = transactions.Where(x => x.JournalEntryId.HasValue).Select(x => x.JournalEntryId!.Value).Distinct().ToList();

        var stockEntries = await dbContext.StockLedgerEntries.AsNoTracking()
            .Where(x => transactionIds.Contains(x.InventoryTransactionId))
            .Join(dbContext.InventoryItems.AsNoTracking(), ledger => ledger.InventoryItemId, item => item.Id, (ledger, item) => new { ledger, item })
            .Join(dbContext.Warehouses.AsNoTracking(), joined => joined.ledger.WarehouseId, warehouse => warehouse.Id, (joined, warehouse) => new
            {
                joined.ledger.Id,
                joined.ledger.InventoryTransactionId,
                joined.ledger.InventoryTransactionLineId,
                joined.ledger.MovementType,
                joined.ledger.MovementDateUtc,
                joined.ledger.QuantityIn,
                joined.ledger.QuantityOut,
                Quantity = joined.ledger.QuantityIn > 0m ? joined.ledger.QuantityIn : -joined.ledger.QuantityOut,
                joined.ledger.UnitCost,
                TotalCost = joined.ledger.QuantityIn > 0m ? joined.ledger.TotalCost : -joined.ledger.TotalCost,
                joined.ledger.Reference,
                joined.ledger.Description,
                InventoryItemId = joined.item.Id,
                joined.item.ItemCode,
                joined.item.ItemName,
                WarehouseId = warehouse.Id,
                warehouse.WarehouseCode,
                warehouse.WarehouseName
            })
            .OrderBy(x => x.MovementDateUtc)
            .ToListAsync(cancellationToken);

        var journals = await dbContext.JournalEntries.AsNoTracking()
            .Where(x => journalIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.EntryDateUtc,
                x.Reference,
                x.Description,
                x.Status,
                x.Type,
                x.TotalDebit,
                x.TotalCredit,
                x.PostedAtUtc
            })
            .ToListAsync(cancellationToken);

        var ledgerMovements = await dbContext.LedgerMovements.AsNoTracking()
            .Where(x => journalIds.Contains(x.JournalEntryId))
            .Join(dbContext.LedgerAccounts.AsNoTracking(), movement => movement.LedgerAccountId, account => account.Id, (movement, account) => new
            {
                movement.Id,
                movement.JournalEntryId,
                movement.JournalEntryLineId,
                movement.MovementDateUtc,
                movement.Reference,
                movement.Description,
                movement.DebitAmount,
                movement.CreditAmount,
                LedgerAccountId = account.Id,
                LedgerAccountCode = account.Code,
                LedgerAccountName = account.Name
            })
            .OrderBy(x => x.MovementDateUtc)
            .ToListAsync(cancellationToken);

        var items = transactions.Select(transaction => new
        {
            Transaction = transaction,
            StockLedgerEntries = stockEntries.Where(x => x.InventoryTransactionId == transaction.Id).ToList(),
            JournalEntry = transaction.JournalEntryId.HasValue
                ? journals.FirstOrDefault(x => x.Id == transaction.JournalEntryId.Value)
                : null,
            LedgerMovements = transaction.JournalEntryId.HasValue
                ? ledgerMovements.Where(x => x.JournalEntryId == transaction.JournalEntryId.Value).ToList()
                : []
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    private static IActionResult TenantRequired() =>
        new BadRequestObjectResult(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
}
