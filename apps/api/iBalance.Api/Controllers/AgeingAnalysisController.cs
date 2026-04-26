using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/ageing-analysis")]
public sealed class AgeingAnalysisController : ControllerBase
{
    [HttpGet("ar")]
    public async Task<IActionResult> GetAccountsReceivableAgeing(
        [FromQuery] DateTime? asOfUtc,
        [FromQuery] Guid? customerId,
        [FromQuery] bool includeZeroBalances,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new
            {
                Message = "Tenant context is required.",
                RequiredHeader = "X-Tenant-Key"
            });
        }

        var asOf = NormalizeAsOf(asOfUtc);

        var invoiceQuery = dbContext.SalesInvoices
            .AsNoTracking()
            .Include(x => x.Customer)
            .Where(x =>
                x.InvoiceDateUtc <= asOf &&
                x.Status != SalesInvoiceStatus.Draft &&
                x.Status != SalesInvoiceStatus.SubmittedForApproval &&
                x.Status != SalesInvoiceStatus.Approved &&
                x.Status != SalesInvoiceStatus.Rejected &&
                x.Status != SalesInvoiceStatus.Cancelled &&
                x.PostedOnUtc != null &&
                x.PostedOnUtc <= asOf);

        if (customerId.HasValue && customerId.Value != Guid.Empty)
        {
            invoiceQuery = invoiceQuery.Where(x => x.CustomerId == customerId.Value);
        }

        var invoices = await invoiceQuery
            .OrderBy(x => x.Customer!.CustomerName)
            .ThenBy(x => x.InvoiceDateUtc)
            .ThenBy(x => x.InvoiceNumber)
            .Select(x => new
            {
                x.Id,
                x.CustomerId,
                CustomerCode = x.Customer != null ? x.Customer.CustomerCode : string.Empty,
                CustomerName = x.Customer != null ? x.Customer.CustomerName : string.Empty,
                x.InvoiceDateUtc,
                x.InvoiceNumber,
                x.Description,
                InvoiceAmount = x.NetReceivableAmount > 0m ? x.NetReceivableAmount : x.TotalAmount,
                x.TotalAmount,
                x.NetReceivableAmount,
                x.AmountPaid,
                x.BalanceAmount,
                x.Status,
                x.PostedOnUtc,
                x.JournalEntryId
            })
            .ToListAsync(cancellationToken);

        var invoiceIds = invoices.Select(x => x.Id).ToList();

        var receiptsByInvoiceId = await dbContext.CustomerReceipts
            .AsNoTracking()
            .Where(x =>
                invoiceIds.Contains(x.SalesInvoiceId) &&
                x.Status == CustomerReceiptStatus.Posted &&
                x.PostedOnUtc != null &&
                x.PostedOnUtc <= asOf &&
                x.ReceiptDateUtc <= asOf)
            .GroupBy(x => x.SalesInvoiceId)
            .Select(x => new
            {
                SalesInvoiceId = x.Key,
                Amount = x.Sum(y => y.Amount)
            })
            .ToDictionaryAsync(x => x.SalesInvoiceId, x => x.Amount, cancellationToken);

        var detailRows = invoices
            .Select(x =>
            {
                receiptsByInvoiceId.TryGetValue(x.Id, out var receiptsToDate);
                var outstandingAmount = Math.Max(0m, x.InvoiceAmount - receiptsToDate);
                var daysOutstanding = Math.Max(0, (asOf.Date - x.InvoiceDateUtc.Date).Days);
                var bucket = ResolveBucket(daysOutstanding, outstandingAmount);

                return new AgeingAnalysisDetailRow(
                    x.Id,
                    x.CustomerId,
                    x.CustomerCode,
                    x.CustomerName,
                    x.InvoiceDateUtc,
                    x.InvoiceNumber,
                    x.Description,
                    x.InvoiceAmount,
                    receiptsToDate,
                    outstandingAmount,
                    daysOutstanding,
                    bucket.Name,
                    bucket.CurrentAmount,
                    bucket.Days1To30Amount,
                    bucket.Days31To60Amount,
                    bucket.Days61To90Amount,
                    bucket.Days91To120Amount,
                    bucket.Over120Amount,
                    (int)x.Status,
                    x.PostedOnUtc,
                    x.JournalEntryId);
            })
            .Where(x => includeZeroBalances || x.OutstandingAmount > 0m)
            .ToList();

        var summaryRows = detailRows
            .GroupBy(x => new { PartyId = x.PartyId, x.PartyCode, x.PartyName })
            .Select(x => new AgeingAnalysisSummaryRow(
                x.Key.PartyId,
                x.Key.PartyCode,
                x.Key.PartyName,
                x.Count(),
                x.Sum(y => y.InvoiceAmount),
                x.Sum(y => y.PaidAmount),
                x.Sum(y => y.OutstandingAmount),
                x.Sum(y => y.CurrentAmount),
                x.Sum(y => y.Days1To30Amount),
                x.Sum(y => y.Days31To60Amount),
                x.Sum(y => y.Days61To90Amount),
                x.Sum(y => y.Days91To120Amount),
                x.Sum(y => y.Over120Amount)))
            .OrderBy(x => x.PartyName)
            .ThenBy(x => x.PartyCode)
            .ToList();

        return Ok(BuildResponse(
            tenantContext.TenantId,
            tenantContext.TenantKey,
            "AR",
            "Accounts Receivable Ageing Analysis",
            asOf,
            customerId,
            includeZeroBalances,
            summaryRows,
            detailRows));
    }

    [HttpGet("ap")]
    public async Task<IActionResult> GetAccountsPayableAgeing(
        [FromQuery] DateTime? asOfUtc,
        [FromQuery] Guid? vendorId,
        [FromQuery] bool includeZeroBalances,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new
            {
                Message = "Tenant context is required.",
                RequiredHeader = "X-Tenant-Key"
            });
        }

        var asOf = NormalizeAsOf(asOfUtc);

        var invoiceQuery = dbContext.PurchaseInvoices
            .AsNoTracking()
            .Include(x => x.Vendor)
            .Where(x =>
                x.InvoiceDateUtc <= asOf &&
                x.Status != PurchaseInvoiceStatus.Draft &&
                x.Status != PurchaseInvoiceStatus.SubmittedForApproval &&
                x.Status != PurchaseInvoiceStatus.Approved &&
                x.Status != PurchaseInvoiceStatus.Rejected &&
                x.Status != PurchaseInvoiceStatus.Cancelled &&
                x.PostedOnUtc != null &&
                x.PostedOnUtc <= asOf);

        if (vendorId.HasValue && vendorId.Value != Guid.Empty)
        {
            invoiceQuery = invoiceQuery.Where(x => x.VendorId == vendorId.Value);
        }

        var invoices = await invoiceQuery
            .OrderBy(x => x.Vendor!.VendorName)
            .ThenBy(x => x.InvoiceDateUtc)
            .ThenBy(x => x.InvoiceNumber)
            .Select(x => new
            {
                x.Id,
                x.VendorId,
                VendorCode = x.Vendor != null ? x.Vendor.VendorCode : string.Empty,
                VendorName = x.Vendor != null ? x.Vendor.VendorName : string.Empty,
                x.InvoiceDateUtc,
                x.InvoiceNumber,
                x.Description,
                InvoiceAmount = x.NetPayableAmount > 0m ? x.NetPayableAmount : x.TotalAmount,
                x.TotalAmount,
                x.NetPayableAmount,
                x.AmountPaid,
                x.BalanceAmount,
                x.Status,
                x.PostedOnUtc,
                x.JournalEntryId
            })
            .ToListAsync(cancellationToken);

        var invoiceIds = invoices.Select(x => x.Id).ToList();

        var paymentsByInvoiceId = await dbContext.VendorPayments
            .AsNoTracking()
            .Where(x =>
                invoiceIds.Contains(x.PurchaseInvoiceId) &&
                x.Status == VendorPaymentStatus.Posted &&
                x.PostedOnUtc != null &&
                x.PostedOnUtc <= asOf &&
                x.PaymentDateUtc <= asOf)
            .GroupBy(x => x.PurchaseInvoiceId)
            .Select(x => new
            {
                PurchaseInvoiceId = x.Key,
                Amount = x.Sum(y => y.Amount)
            })
            .ToDictionaryAsync(x => x.PurchaseInvoiceId, x => x.Amount, cancellationToken);

        var detailRows = invoices
            .Select(x =>
            {
                paymentsByInvoiceId.TryGetValue(x.Id, out var paymentsToDate);
                var outstandingAmount = Math.Max(0m, x.InvoiceAmount - paymentsToDate);
                var daysOutstanding = Math.Max(0, (asOf.Date - x.InvoiceDateUtc.Date).Days);
                var bucket = ResolveBucket(daysOutstanding, outstandingAmount);

                return new AgeingAnalysisDetailRow(
                    x.Id,
                    x.VendorId,
                    x.VendorCode,
                    x.VendorName,
                    x.InvoiceDateUtc,
                    x.InvoiceNumber,
                    x.Description,
                    x.InvoiceAmount,
                    paymentsToDate,
                    outstandingAmount,
                    daysOutstanding,
                    bucket.Name,
                    bucket.CurrentAmount,
                    bucket.Days1To30Amount,
                    bucket.Days31To60Amount,
                    bucket.Days61To90Amount,
                    bucket.Days91To120Amount,
                    bucket.Over120Amount,
                    (int)x.Status,
                    x.PostedOnUtc,
                    x.JournalEntryId);
            })
            .Where(x => includeZeroBalances || x.OutstandingAmount > 0m)
            .ToList();

        var summaryRows = detailRows
            .GroupBy(x => new { PartyId = x.PartyId, x.PartyCode, x.PartyName })
            .Select(x => new AgeingAnalysisSummaryRow(
                x.Key.PartyId,
                x.Key.PartyCode,
                x.Key.PartyName,
                x.Count(),
                x.Sum(y => y.InvoiceAmount),
                x.Sum(y => y.PaidAmount),
                x.Sum(y => y.OutstandingAmount),
                x.Sum(y => y.CurrentAmount),
                x.Sum(y => y.Days1To30Amount),
                x.Sum(y => y.Days31To60Amount),
                x.Sum(y => y.Days61To90Amount),
                x.Sum(y => y.Days91To120Amount),
                x.Sum(y => y.Over120Amount)))
            .OrderBy(x => x.PartyName)
            .ThenBy(x => x.PartyCode)
            .ToList();

        return Ok(BuildResponse(
            tenantContext.TenantId,
            tenantContext.TenantKey,
            "AP",
            "Accounts Payable Ageing Analysis",
            asOf,
            vendorId,
            includeZeroBalances,
            summaryRows,
            detailRows));
    }

    private static DateTime NormalizeAsOf(DateTime? asOfUtc)
    {
        var date = asOfUtc ?? DateTime.UtcNow;
        return DateTime.SpecifyKind(date.Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);
    }

    private static AgeingBucketAmounts ResolveBucket(int daysOutstanding, decimal amount)
    {
        if (amount <= 0m)
        {
            return new AgeingBucketAmounts("Settled", 0m, 0m, 0m, 0m, 0m, 0m);
        }

        if (daysOutstanding <= 0)
        {
            return new AgeingBucketAmounts("Current", amount, 0m, 0m, 0m, 0m, 0m);
        }

        if (daysOutstanding <= 30)
        {
            return new AgeingBucketAmounts("1-30", 0m, amount, 0m, 0m, 0m, 0m);
        }

        if (daysOutstanding <= 60)
        {
            return new AgeingBucketAmounts("31-60", 0m, 0m, amount, 0m, 0m, 0m);
        }

        if (daysOutstanding <= 90)
        {
            return new AgeingBucketAmounts("61-90", 0m, 0m, 0m, amount, 0m, 0m);
        }

        if (daysOutstanding <= 120)
        {
            return new AgeingBucketAmounts("91-120", 0m, 0m, 0m, 0m, amount, 0m);
        }

        return new AgeingBucketAmounts("120+", 0m, 0m, 0m, 0m, 0m, amount);
    }

    private static object BuildResponse(
        Guid tenantId,
        string? tenantKey,
        string scope,
        string title,
        DateTime asOfUtc,
        Guid? partyFilterId,
        bool includeZeroBalances,
        IReadOnlyCollection<AgeingAnalysisSummaryRow> summaryRows,
        IReadOnlyCollection<AgeingAnalysisDetailRow> detailRows)
    {
        return new
        {
            TenantContextAvailable = true,
            TenantId = tenantId,
            TenantKey = tenantKey,
            Scope = scope,
            Title = title,
            AsOfUtc = asOfUtc,
            PartyFilterId = partyFilterId,
            IncludeZeroBalances = includeZeroBalances,
            SummaryCount = summaryRows.Count,
            DetailCount = detailRows.Count,
            TotalInvoiceAmount = detailRows.Sum(x => x.InvoiceAmount),
            TotalPaidAmount = detailRows.Sum(x => x.PaidAmount),
            TotalOutstandingAmount = detailRows.Sum(x => x.OutstandingAmount),
            TotalCurrentAmount = detailRows.Sum(x => x.CurrentAmount),
            TotalDays1To30Amount = detailRows.Sum(x => x.Days1To30Amount),
            TotalDays31To60Amount = detailRows.Sum(x => x.Days31To60Amount),
            TotalDays61To90Amount = detailRows.Sum(x => x.Days61To90Amount),
            TotalDays91To120Amount = detailRows.Sum(x => x.Days91To120Amount),
            TotalOver120Amount = detailRows.Sum(x => x.Over120Amount),
            SummaryItems = summaryRows,
            DetailItems = detailRows
        };
    }

    private sealed record AgeingBucketAmounts(
        string Name,
        decimal CurrentAmount,
        decimal Days1To30Amount,
        decimal Days31To60Amount,
        decimal Days61To90Amount,
        decimal Days91To120Amount,
        decimal Over120Amount);

    private sealed record AgeingAnalysisSummaryRow(
        Guid PartyId,
        string PartyCode,
        string PartyName,
        int InvoiceCount,
        decimal InvoiceAmount,
        decimal PaidAmount,
        decimal OutstandingAmount,
        decimal CurrentAmount,
        decimal Days1To30Amount,
        decimal Days31To60Amount,
        decimal Days61To90Amount,
        decimal Days91To120Amount,
        decimal Over120Amount);

    private sealed record AgeingAnalysisDetailRow(
        Guid InvoiceId,
        Guid PartyId,
        string PartyCode,
        string PartyName,
        DateTime InvoiceDateUtc,
        string InvoiceNumber,
        string Description,
        decimal InvoiceAmount,
        decimal PaidAmount,
        decimal OutstandingAmount,
        int DaysOutstanding,
        string AgeBucket,
        decimal CurrentAmount,
        decimal Days1To30Amount,
        decimal Days31To60Amount,
        decimal Days61To90Amount,
        decimal Days91To120Amount,
        decimal Over120Amount,
        int Status,
        DateTime? PostedOnUtc,
        Guid? JournalEntryId);
}
