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
[Route("api/billing/credit-notes")]
[Authorize(Policy = AuthorizationPolicies.BillingView)]
public sealed class BillingCreditNotesController : ControllerBase
{
    private const int Draft = 0;
    private const int Approved = 1;

    [HttpGet]
    public async Task<IActionResult> List(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var items = await dbContext.BillingCreditNotes
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(500)
            .Select(x => new
            {
                x.Id,
                x.BillingInvoiceId,
                x.CreditNoteNumber,
                x.Amount,
                x.Reason,
                x.Status,
                statusName = x.Status == Approved ? "Approved" : "Draft",
                x.CreatedAtUtc,
                x.ApprovedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new { count = items.Count, items });
    }

    [HttpPost]
    [Authorize(Policy = AuthorizationPolicies.BillingCreditNoteCreate)]
    public async Task<IActionResult> Create(
        [FromBody] CreateBillingCreditNoteRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        if (request.Amount <= 0)
        {
            return BadRequest(new { message = "Credit note amount must be greater than zero." });
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "Credit note reason is required." });
        }

        var invoice = await dbContext.BillingInvoices
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == request.BillingInvoiceId, cancellationToken);

        if (invoice is null)
        {
            return NotFound(new { message = "Billing invoice was not found." });
        }

        if (request.Amount > invoice.TotalAmount)
        {
            return BadRequest(new { message = "Credit note amount cannot exceed the invoice total." });
        }

        var creditNote = new BillingCreditNote
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            BillingInvoiceId = invoice.Id,
            CreditNoteNumber = $"CN-{DateTime.UtcNow:yyyyMMddHHmmss}",
            Amount = request.Amount,
            Reason = request.Reason.Trim(),
            Status = Draft,
            CreatedAtUtc = DateTime.UtcNow,
            CreatedByUserId = GetCurrentUserId()
        };

        dbContext.BillingCreditNotes.Add(creditNote);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Credit note created.", item = creditNote });
    }

    [HttpPost("{creditNoteId:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.BillingCreditNoteApprove)]
    public async Task<IActionResult> Approve(
        Guid creditNoteId,
        [FromBody] ApproveBillingCreditNoteRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var creditNote = await dbContext.BillingCreditNotes
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Id == creditNoteId, cancellationToken);

        if (creditNote is null)
        {
            return NotFound(new { message = "Credit note was not found." });
        }

        if (creditNote.Status == Approved)
        {
            return BadRequest(new { message = "Credit note has already been approved." });
        }

        creditNote.Status = Approved;
        creditNote.ApprovalComment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        creditNote.ApprovedAtUtc = DateTime.UtcNow;
        creditNote.ApprovedByUserId = GetCurrentUserId();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Credit note approved.", item = creditNote });
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

    public sealed record CreateBillingCreditNoteRequest(Guid BillingInvoiceId, decimal Amount, string Reason);
    public sealed record ApproveBillingCreditNoteRequest(string? Comment);
}
