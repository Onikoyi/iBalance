using System.Security.Claims;
using iBalance.Api.Security;
using iBalance.Api.Services;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/billing/invoices")]
[Authorize(Policy = AuthorizationPolicies.BillingView)]
public sealed class BillingInvoicesController : ControllerBase
{
    private const int Draft = 0;
    private const int Submitted = 1;
    private const int Approved = 2;
    private const int Rejected = 3;
    private const int Posted = 4;
    private const int Cancelled = 5;
    private const int PartiallyPaid = 6;
    private const int Paid = 7;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromQuery] int? status,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var query = dbContext.BillingInvoices
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId);

        if (status.HasValue)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        var items = await query
            .OrderByDescending(x => x.InvoiceDateUtc)
            .ThenByDescending(x => x.CreatedAtUtc)
            .Take(500)
            .Select(x => ToSummaryDto(x))
            .ToListAsync(cancellationToken);

        return Ok(new { count = items.Count, items });
    }

    [HttpGet("{invoiceId:guid}")]
    public async Task<IActionResult> Get(
        Guid invoiceId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var invoice = await dbContext.BillingInvoices
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        var lines = await dbContext.BillingInvoiceLines
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.BillingInvoiceId == invoiceId)
            .OrderBy(x => x.LineNumber)
            .Select(x => ToLineDto(x))
            .ToListAsync(cancellationToken);

        return Ok(new { item = ToDetailDto(invoice, lines) });
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoiceCreate)]
    public async Task<IActionResult> Create(
        [FromBody] SaveBillingInvoiceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var validation = ValidateInvoiceRequest(request);
        if (validation is not null)
        {
            return BadRequest(new { message = validation });
        }

        var policy = await GetOrCreatePolicyAsync(dbContext, tenantId, cancellationToken);
        var invoiceNumber = await GetNextInvoiceNumberAsync(dbContext, tenantId, policy, cancellationToken);

        var invoice = new BillingInvoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InvoiceNumber = invoiceNumber,
            CustomerId = request.CustomerId,
            CustomerName = request.CustomerName.Trim(),
            CustomerEmail = string.IsNullOrWhiteSpace(request.CustomerEmail) ? null : request.CustomerEmail.Trim(),
            InvoiceDateUtc = request.InvoiceDateUtc ?? DateTime.UtcNow,
            DueDateUtc = request.DueDateUtc ?? DateTime.UtcNow.AddDays(policy.DefaultDueDays),
            CurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? policy.CurrencyCode : request.CurrencyCode.Trim().ToUpperInvariant(),
            Status = Draft,
            ReceivableControlAccountId = request.ReceivableControlAccountId ?? policy.ReceivableControlAccountId,
            RevenueAccountId = request.RevenueAccountId ?? policy.DefaultRevenueAccountId,
            TaxLiabilityAccountId = request.TaxLiabilityAccountId ?? policy.TaxLiabilityAccountId,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = GetCurrentUserId()
        };

        dbContext.BillingInvoices.Add(invoice);
        AddLines(dbContext, tenantId, invoice.Id, request.Lines);
        await RecalculateInvoiceAsync(dbContext, invoice, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Billing invoice created.",
            item = ToSummaryDto(invoice)
        });
    }

    [HttpPut("{invoiceId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoiceUpdate)]
    public async Task<IActionResult> Update(
        Guid invoiceId,
        [FromBody] SaveBillingInvoiceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var validation = ValidateInvoiceRequest(request);
        if (validation is not null)
        {
            return BadRequest(new { message = validation });
        }

        var invoice = await dbContext.BillingInvoices
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (invoice.Status is not (Draft or Rejected))
        {
            return BadRequest(new { message = "Only draft or rejected invoices can be updated." });
        }

        invoice.CustomerId = request.CustomerId;
        invoice.CustomerName = request.CustomerName.Trim();
        invoice.CustomerEmail = string.IsNullOrWhiteSpace(request.CustomerEmail) ? null : request.CustomerEmail.Trim();
        invoice.InvoiceDateUtc = request.InvoiceDateUtc ?? invoice.InvoiceDateUtc;
        invoice.DueDateUtc = request.DueDateUtc ?? invoice.DueDateUtc;
        invoice.CurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? invoice.CurrencyCode : request.CurrencyCode.Trim().ToUpperInvariant();
        invoice.ReceivableControlAccountId = request.ReceivableControlAccountId ?? invoice.ReceivableControlAccountId;
        invoice.RevenueAccountId = request.RevenueAccountId ?? invoice.RevenueAccountId;
        invoice.TaxLiabilityAccountId = request.TaxLiabilityAccountId ?? invoice.TaxLiabilityAccountId;
        invoice.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        invoice.RejectionReason = null;
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        invoice.UpdatedByUserId = GetCurrentUserId();

        var existingLines = await dbContext.BillingInvoiceLines
            .Where(x => x.TenantId == tenantId && x.BillingInvoiceId == invoiceId)
            .ToListAsync(cancellationToken);

        dbContext.BillingInvoiceLines.RemoveRange(existingLines);
        AddLines(dbContext, tenantId, invoice.Id, request.Lines);
        await RecalculateInvoiceAsync(dbContext, invoice, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Billing invoice updated.",
            item = ToSummaryDto(invoice)
        });
    }

    [HttpPost("{invoiceId:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoiceSubmit)]
    public async Task<IActionResult> Submit(
        Guid invoiceId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
        => await ChangeStatusAsync(dbContext, tenantContextAccessor, invoiceId, [Draft, Rejected], Submitted, "Billing invoice submitted.", cancellationToken);

    [HttpPost("{invoiceId:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoiceApprove)]
    public async Task<IActionResult> Approve(
        Guid invoiceId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
        => await ChangeStatusAsync(dbContext, tenantContextAccessor, invoiceId, [Submitted], Approved, "Billing invoice approved.", cancellationToken);

    [HttpPost("{invoiceId:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoiceReject)]
    public async Task<IActionResult> Reject(
        Guid invoiceId,
        [FromBody] RejectBillingInvoiceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var invoice = await dbContext.BillingInvoices
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (invoice.Status != Submitted)
        {
            return BadRequest(new { message = "Only submitted invoices can be rejected." });
        }

        invoice.Status = Rejected;
        invoice.RejectionReason = string.IsNullOrWhiteSpace(request.Reason) ? "Rejected." : request.Reason.Trim();
        invoice.RejectedAtUtc = DateTime.UtcNow;
        invoice.RejectedByUserId = GetCurrentUserId();
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        invoice.UpdatedByUserId = GetCurrentUserId();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Billing invoice rejected.", item = ToSummaryDto(invoice) });
    }

    [HttpPost("{invoiceId:guid}/post")]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoicePost)]
    public async Task<IActionResult> Post(
        Guid invoiceId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var invoice = await dbContext.BillingInvoices
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (invoice.Status != Approved)
        {
            return BadRequest(new { message = "Only approved billing invoices can be posted." });
        }

        var lines = await dbContext.BillingInvoiceLines
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.BillingInvoiceId == invoice.Id)
            .OrderBy(x => x.LineNumber)
            .ToListAsync(cancellationToken);

        if (lines.Count == 0)
        {
            return BadRequest(new { message = "Billing invoice must contain at least one line before posting." });
        }

        var policy = await GetOrCreatePolicyAsync(dbContext, tenantId, cancellationToken);

        var receivableAccountId = invoice.ReceivableControlAccountId ?? policy.ReceivableControlAccountId;
        var defaultRevenueAccountId = invoice.RevenueAccountId ?? policy.DefaultRevenueAccountId;
        var taxLiabilityAccountId = invoice.TaxLiabilityAccountId ?? policy.TaxLiabilityAccountId;
        var discountAccountId = policy.DiscountAccountId;

        if (receivableAccountId is null || receivableAccountId == Guid.Empty)
        {
            return BadRequest(new { message = "Receivable control account must be configured before billing invoice posting." });
        }

        if (defaultRevenueAccountId is null || defaultRevenueAccountId == Guid.Empty)
        {
            return BadRequest(new { message = "Default revenue account must be configured before billing invoice posting." });
        }

        if (invoice.TaxAmount > 0m && (taxLiabilityAccountId is null || taxLiabilityAccountId == Guid.Empty))
        {
            return BadRequest(new { message = "Tax liability account must be configured before posting taxable billing invoices." });
        }

        if (invoice.DiscountAmount > 0m && (discountAccountId is null || discountAccountId == Guid.Empty))
        {
            return BadRequest(new { message = "Discount account must be configured before posting discounted billing invoices." });
        }

        var postingGuard = await FiscalPeriodPostingGuard.EnsureOpenPeriodAsync(
            dbContext,
            invoice.InvoiceDateUtc,
            "Billing Invoice Posting",
            cancellationToken);

        if (!postingGuard.Allowed)
        {
            return Conflict(postingGuard.ToProblem());
        }

        var requestedLedgerAccountIds = new List<Guid>
        {
            receivableAccountId.Value,
            defaultRevenueAccountId.Value
        };

        if (taxLiabilityAccountId.HasValue)
        {
            requestedLedgerAccountIds.Add(taxLiabilityAccountId.Value);
        }

        if (discountAccountId.HasValue)
        {
            requestedLedgerAccountIds.Add(discountAccountId.Value);
        }

        requestedLedgerAccountIds.AddRange(
            lines
                .Where(x => x.RevenueAccountId.HasValue && x.RevenueAccountId.Value != Guid.Empty)
                .Select(x => x.RevenueAccountId!.Value));

        requestedLedgerAccountIds = requestedLedgerAccountIds
            .Distinct()
            .ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .Where(x => requestedLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedLedgerAccountIds.Count)
        {
            return BadRequest(new { message = "One or more billing posting ledger accounts were not found for the current tenant." });
        }

        foreach (var account in ledgerAccounts.Values)
        {
            if (!IsPostingReady(account))
            {
                return BadRequest(new
                {
                    message = "All billing posting ledger accounts must be active, non-header, and posting-enabled.",
                    account.Id,
                    account.Code
                });
            }
        }

        var reference = $"BILL-{invoice.InvoiceNumber}";

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == reference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new
            {
                message = "A journal entry with the generated billing invoice posting reference already exists.",
                reference
            });
        }

        var journalLines = new List<JournalEntryLine>
        {
            new(
                Guid.NewGuid(),
                receivableAccountId.Value,
                $"Billing receivable - {invoice.InvoiceNumber}",
                invoice.TotalAmount,
                0m)
        };

        var revenueGroups = lines
            .GroupBy(x => x.RevenueAccountId ?? defaultRevenueAccountId.Value)
            .Select(x => new
            {
                RevenueAccountId = x.Key,
                Amount = x.Sum(line => line.LineSubtotal)
            })
            .Where(x => x.Amount > 0m)
            .ToList();

        foreach (var revenueGroup in revenueGroups)
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                revenueGroup.RevenueAccountId,
                $"Billing revenue - {invoice.InvoiceNumber}",
                0m,
                revenueGroup.Amount));
        }

        if (invoice.TaxAmount > 0m && taxLiabilityAccountId.HasValue)
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                taxLiabilityAccountId.Value,
                $"Billing tax liability - {invoice.InvoiceNumber}",
                0m,
                invoice.TaxAmount));
        }

        if (invoice.DiscountAmount > 0m && discountAccountId.HasValue)
        {
            journalLines.Add(new JournalEntryLine(
                Guid.NewGuid(),
                discountAccountId.Value,
                $"Billing discount - {invoice.InvoiceNumber}",
                invoice.DiscountAmount,
                0m));
        }

        var totalDebit = journalLines.Sum(x => x.DebitAmount);
        var totalCredit = journalLines.Sum(x => x.CreditAmount);

        if (totalDebit != totalCredit)
        {
            return Conflict(new
            {
                message = "Billing invoice posting is not balanced. Review receivable, revenue, tax, and discount configuration.",
                totalDebit,
                totalCredit
            });
        }

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantId,
            invoice.InvoiceDateUtc,
            reference,
            $"Billing invoice posting - {invoice.InvoiceNumber} - {invoice.CustomerName}",
            JournalEntryStatus.Approved,
            JournalEntryType.Normal,
            journalLines);

        var postedAtUtc = DateTime.UtcNow;
        journalEntry.MarkPosted(postedAtUtc);

        var movements = journalEntry.Lines
            .Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount))
            .ToList();

        invoice.Status = Posted;
        invoice.PostedJournalEntryId = journalEntry.Id;
        invoice.PostedAtUtc = postedAtUtc;
        invoice.PostedByUserId = GetCurrentUserId();
        invoice.UpdatedAtUtc = postedAtUtc;
        invoice.UpdatedByUserId = GetCurrentUserId();

        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Billing invoice posted successfully.",
            item = ToSummaryDto(invoice),
            journalEntry = new
            {
                journalEntry.Id,
                journalEntry.Reference,
                journalEntry.Description,
                journalEntry.Status,
                journalEntry.Type,
                journalEntry.PostedAtUtc,
                journalEntry.TotalDebit,
                journalEntry.TotalCredit,
                MovementCount = movements.Count
            }
        });
    }

    [HttpPost("{invoiceId:guid}/cancel")]
    [Authorize(Policy = AuthorizationPolicies.BillingInvoiceCancel)]
    public async Task<IActionResult> Cancel(
        Guid invoiceId,
        [FromBody] CancelBillingInvoiceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var invoice = await dbContext.BillingInvoices
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (invoice.Status is Posted or Paid or PartiallyPaid)
        {
            return BadRequest(new { message = "Posted or settled invoices cannot be cancelled. Use credit notes or adjustments." });
        }

        invoice.Status = Cancelled;
        invoice.CancelReason = string.IsNullOrWhiteSpace(request.Reason) ? "Cancelled." : request.Reason.Trim();
        invoice.CancelledAtUtc = DateTime.UtcNow;
        invoice.CancelledByUserId = GetCurrentUserId();
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        invoice.UpdatedByUserId = GetCurrentUserId();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Billing invoice cancelled.", item = ToSummaryDto(invoice) });
    }

    private async Task<IActionResult> ChangeStatusAsync(
        ApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        Guid invoiceId,
        int[] allowedStatuses,
        int nextStatus,
        string message,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var invoice = await dbContext.BillingInvoices
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == invoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (!allowedStatuses.Contains(invoice.Status))
        {
            return BadRequest(new { message = "Invoice is not in a valid state for this action." });
        }

        invoice.Status = nextStatus;
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        invoice.UpdatedByUserId = GetCurrentUserId();

        if (nextStatus == Submitted)
        {
            invoice.SubmittedAtUtc = DateTime.UtcNow;
            invoice.SubmittedByUserId = GetCurrentUserId();
        }

        if (nextStatus == Approved)
        {
            invoice.ApprovedAtUtc = DateTime.UtcNow;
            invoice.ApprovedByUserId = GetCurrentUserId();
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message, item = ToSummaryDto(invoice) });
    }


    private static bool IsPostingReady(LedgerAccount account)
        => account.IsActive && !account.IsHeader && account.IsPostingAllowed;

    private static string? ValidateInvoiceRequest(SaveBillingInvoiceRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CustomerName))
        {
            return "Customer name is required.";
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            return "At least one invoice line is required.";
        }

        if (request.Lines.Any(x => string.IsNullOrWhiteSpace(x.Description)))
        {
            return "Every invoice line requires a description.";
        }

        if (request.Lines.Any(x => x.Quantity <= 0))
        {
            return "Every invoice line quantity must be greater than zero.";
        }

        if (request.Lines.Any(x => x.UnitPrice < 0 || x.TaxRate < 0))
        {
            return "Invoice line amount and tax rate values cannot be negative.";
        }

        return null;
    }

    private static void AddLines(ApplicationDbContext dbContext, Guid tenantId, Guid invoiceId, IReadOnlyCollection<SaveBillingInvoiceLineRequest> lines)
    {
        var lineNumber = 1;
        foreach (var line in lines)
        {
            var subtotal = Math.Round(line.Quantity * line.UnitPrice, 2);
            var tax = Math.Round(subtotal * (line.TaxRate / 100m), 2);
            dbContext.BillingInvoiceLines.Add(new BillingInvoiceLine
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                BillingInvoiceId = invoiceId,
                LineNumber = lineNumber++,
                Description = line.Description.Trim(),
                Quantity = line.Quantity,
                UnitPrice = line.UnitPrice,
                TaxRate = line.TaxRate,
                LineSubtotal = subtotal,
                LineTax = tax,
                LineTotal = subtotal + tax,
                RevenueAccountId = line.RevenueAccountId
            });
        }
    }

    private static async Task RecalculateInvoiceAsync(ApplicationDbContext dbContext, BillingInvoice invoice, CancellationToken cancellationToken)
    {
        var lines = await dbContext.BillingInvoiceLines
            .Where(x => x.TenantId == invoice.TenantId && x.BillingInvoiceId == invoice.Id)
            .ToListAsync(cancellationToken);

        invoice.SubtotalAmount = lines.Sum(x => x.LineSubtotal);
        invoice.TaxAmount = lines.Sum(x => x.LineTax);
        invoice.TotalAmount = invoice.SubtotalAmount + invoice.TaxAmount - invoice.DiscountAmount;
    }

    private static async Task<BillingPolicy> GetOrCreatePolicyAsync(ApplicationDbContext dbContext, Guid tenantId, CancellationToken cancellationToken)
    {
        var policy = await dbContext.BillingPolicies
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);

        if (policy is not null)
        {
            return policy;
        }

        policy = new BillingPolicy
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            InvoicePrefix = "INV",
            NextInvoiceNumber = 1,
            CurrencyCode = "NGN",
            CreatedAtUtc = DateTime.UtcNow
        };

        dbContext.BillingPolicies.Add(policy);
        await dbContext.SaveChangesAsync(cancellationToken);
        return policy;
    }

    private static async Task<string> GetNextInvoiceNumberAsync(ApplicationDbContext dbContext, Guid tenantId, BillingPolicy policy, CancellationToken cancellationToken)
    {
        var sequence = await dbContext.BillingNumberSequences
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.SequenceCode == "BILLING_INVOICE", cancellationToken);

        if (sequence is null)
        {
            sequence = new BillingNumberSequence
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SequenceCode = "BILLING_INVOICE",
                NextNumber = Math.Max(policy.NextInvoiceNumber, 1)
            };
            dbContext.BillingNumberSequences.Add(sequence);
        }

        var number = sequence.NextNumber;
        sequence.NextNumber += 1;
        policy.NextInvoiceNumber = sequence.NextNumber;

        return $"{policy.InvoicePrefix}-{number:000000}";
    }

    private static object ToSummaryDto(BillingInvoice x) => new
    {
        x.Id,
        x.InvoiceNumber,
        x.CustomerId,
        x.CustomerName,
        x.CustomerEmail,
        x.InvoiceDateUtc,
        x.DueDateUtc,
        x.CurrencyCode,
        x.Status,
        StatusName = StatusName(x.Status),
        x.SubtotalAmount,
        x.TaxAmount,
        x.DiscountAmount,
        x.TotalAmount,
        x.AmountPaid,
        OutstandingAmount = Math.Max(0m, x.TotalAmount - x.AmountPaid),
        x.Notes,
        x.RejectionReason,
        x.CancelReason,
        x.CreatedAtUtc,
        x.PostedAtUtc
    };

    private static object ToDetailDto(BillingInvoice invoice, IReadOnlyCollection<object> lines) => new
    {
        item = ToSummaryDto(invoice),
        lines
    };

    private static object ToLineDto(BillingInvoiceLine x) => new
    {
        x.Id,
        x.LineNumber,
        x.Description,
        x.Quantity,
        x.UnitPrice,
        x.TaxRate,
        x.LineSubtotal,
        x.LineTax,
        x.LineTotal,
        x.RevenueAccountId
    };

    private static string StatusName(int status) => status switch
    {
        Draft => "Draft",
        Submitted => "Submitted",
        Approved => "Approved",
        Rejected => "Rejected",
        Posted => "Posted",
        Cancelled => "Cancelled",
        PartiallyPaid => "Partially Paid",
        Paid => "Paid",
        _ => "Unknown"
    };

    private static Guid RequireTenantId(ITenantContextAccessor tenantContextAccessor)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable)
        {
            throw new InvalidOperationException("Tenant context is required.");
        }

        return tenant.TenantId;
    }

    private string? GetCurrentUserId()
        => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

    public sealed record SaveBillingInvoiceRequest(
        Guid? CustomerId,
        string CustomerName,
        string? CustomerEmail,
        DateTime? InvoiceDateUtc,
        DateTime? DueDateUtc,
        string? CurrencyCode,
        Guid? ReceivableControlAccountId,
        Guid? RevenueAccountId,
        Guid? TaxLiabilityAccountId,
        string? Notes,
        IReadOnlyCollection<SaveBillingInvoiceLineRequest> Lines);

    public sealed record SaveBillingInvoiceLineRequest(
        string Description,
        decimal Quantity,
        decimal UnitPrice,
        decimal TaxRate,
        Guid? RevenueAccountId);

    public sealed record RejectBillingInvoiceRequest(string? Reason);

    public sealed record CancelBillingInvoiceRequest(string? Reason);
}
