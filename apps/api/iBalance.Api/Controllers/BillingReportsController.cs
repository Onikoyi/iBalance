using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/billing/reports")]
[Authorize(Policy = AuthorizationPolicies.BillingReportsView)]
public sealed class BillingReportsController : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var invoices = await dbContext.BillingInvoices
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            item = new
            {
                invoiceCount = invoices.Count,
                draftCount = invoices.Count(x => x.Status == 0),
                submittedCount = invoices.Count(x => x.Status == 1),
                approvedCount = invoices.Count(x => x.Status == 2),
                postedCount = invoices.Count(x => x.Status == 4 || x.Status == 6 || x.Status == 7),
                rejectedCount = invoices.Count(x => x.Status == 3),
                totalBilled = invoices.Where(x => (x.Status == 4 || x.Status == 6 || x.Status == 7)).Sum(x => x.TotalAmount),
                totalOutstanding = invoices.Where(x => (x.Status == 4 || x.Status == 6)).Sum(x => Math.Max(0m, x.TotalAmount - x.AmountPaid))
            }
        });
    }

    [HttpGet("register")]
    public async Task<IActionResult> Register(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var items = await dbContext.BillingInvoices
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.InvoiceDateUtc)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.CustomerName,
                x.InvoiceDateUtc,
                x.DueDateUtc,
                x.CurrencyCode,
                x.Status,
                x.TotalAmount,
                x.AmountPaid,
                outstandingAmount = Math.Max(0m, x.TotalAmount - x.AmountPaid)
            })
            .ToListAsync(cancellationToken);

        return Ok(new { count = items.Count, items });
    }

    [HttpGet("outstanding")]
    public async Task<IActionResult> Outstanding(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var invoices = await dbContext.BillingInvoices
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.Status == 4 || x.Status == 6) && x.AmountPaid < x.TotalAmount)
            .OrderBy(x => x.DueDateUtc)
            .ToListAsync(cancellationToken);

        var items = invoices.Select(x => new
        {
            x.Id,
            x.InvoiceNumber,
            x.CustomerName,
            x.DueDateUtc,
            x.CurrencyCode,
            x.TotalAmount,
            x.AmountPaid,
            outstandingAmount = Math.Max(0m, x.TotalAmount - x.AmountPaid),
            daysOverdue = DateTime.UtcNow.Date > x.DueDateUtc.Date
                ? (DateTime.UtcNow.Date - x.DueDateUtc.Date).Days
                : 0
        }).ToList();

        return Ok(new { count = items.Count, items });
    }

    [HttpGet("ageing")]
    public async Task<IActionResult> Ageing(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var today = DateTime.UtcNow.Date;

        var invoices = await dbContext.BillingInvoices
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && (x.Status == 4 || x.Status == 6) && x.AmountPaid < x.TotalAmount)
            .ToListAsync(cancellationToken);

        var buckets = invoices
            .Select(x =>
            {
                var days = today > x.DueDateUtc.Date ? (today - x.DueDateUtc.Date).Days : 0;
                var bucket = days switch
                {
                    <= 0 => "Current",
                    <= 30 => "1-30",
                    <= 60 => "31-60",
                    <= 90 => "61-90",
                    _ => "90+"
                };

                return new
                {
                    bucket,
                    outstanding = Math.Max(0m, x.TotalAmount - x.AmountPaid)
                };
            })
            .GroupBy(x => x.bucket)
            .Select(g => new
            {
                bucket = g.Key,
                count = g.Count(),
                amount = g.Sum(x => x.outstanding)
            })
            .OrderBy(x => x.bucket)
            .ToList();

        return Ok(new { count = buckets.Count, items = buckets });
    }

    private static Guid RequireTenantId(ITenantContextAccessor tenantContextAccessor)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable)
        {
            throw new InvalidOperationException("Tenant context is required.");
        }

        return tenant.TenantId;
    }
}
