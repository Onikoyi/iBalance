using System.Security.Claims;
using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/billing/payments")]
[Authorize(Policy = AuthorizationPolicies.BillingView)]
public sealed class BillingCollectionsController : ControllerBase
{
    private const int Posted = 4;
    private const int PartiallyPaid = 6;
    private const int Paid = 7;

    [HttpPost("allocate")]
    [Authorize(Policy = AuthorizationPolicies.BillingPaymentAllocate)]
    public async Task<IActionResult> Allocate(
        [FromBody] AllocateBillingPaymentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Allocation amount must be greater than zero." });
        }

        if (string.IsNullOrWhiteSpace(request.PaymentReference))
        {
            return BadRequest(new { message = "Payment reference is required." });
        }

        var invoice = await dbContext.BillingInvoices
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.BillingInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (invoice.Status != Posted && invoice.Status != PartiallyPaid)
        {
            return BadRequest(new { message = "Only posted invoices can receive payment allocation." });
        }

        var outstanding = Math.Max(0m, invoice.TotalAmount - invoice.AmountPaid);
        if (request.Amount > outstanding)
        {
            return BadRequest(new { message = "Allocation amount cannot exceed outstanding invoice amount." });
        }

        var allocation = new BillingPaymentAllocation
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BillingInvoiceId = invoice.Id,
            PaymentReference = request.PaymentReference.Trim(),
            Amount = request.Amount,
            PaymentDateUtc = request.PaymentDateUtc ?? DateTime.UtcNow,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = GetCurrentUserId()
        };

        dbContext.BillingPaymentAllocations.Add(allocation);

        invoice.AmountPaid += request.Amount;
        invoice.Status = invoice.AmountPaid >= invoice.TotalAmount ? Paid : PartiallyPaid;
        invoice.UpdatedAtUtc = DateTime.UtcNow;
        invoice.UpdatedByUserId = GetCurrentUserId();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Payment allocated.",
            item = new
            {
                allocation.Id,
                allocation.BillingInvoiceId,
                allocation.PaymentReference,
                allocation.Amount,
                allocation.PaymentDateUtc,
                invoice.Status,
                outstandingAmount = Math.Max(0m, invoice.TotalAmount - invoice.AmountPaid)
            }
        });
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

    private string? GetCurrentUserId()
        => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");

    public sealed record AllocateBillingPaymentRequest(
        Guid BillingInvoiceId,
        string PaymentReference,
        decimal Amount,
        DateTime? PaymentDateUtc,
        string? Notes);
}
