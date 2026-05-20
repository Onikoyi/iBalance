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
[Route("api/billing/setup")]
[Authorize(Policy = AuthorizationPolicies.BillingView)]
public sealed class BillingSetupController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var policy = await dbContext.BillingPolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);

        if (policy is null)
        {
            return Ok(new
            {
                item = new
                {
                    id = Guid.Empty,
                    tenantId,
                    invoicePrefix = "INV",
                    nextInvoiceNumber = 1,
                    currencyCode = "NGN",
                    receivableControlAccountId = (Guid?)null,
                    defaultRevenueAccountId = (Guid?)null,
                    taxLiabilityAccountId = (Guid?)null,
                    discountAccountId = (Guid?)null,
                    writeOffAccountId = (Guid?)null,
                    requireApprovalBeforePosting = true,
                    enableMakerChecker = true,
                    autoPostApprovedInvoices = false,
                    defaultTaxRate = 0m,
                    defaultDueDays = 30,
                    notes = (string?)null
                }
            });
        }

        return Ok(new { item = ToDto(policy) });
    }


    [HttpGet("posting-accounts")]
    public async Task<IActionResult> GetPostingAccounts(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);

        var items = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.IsActive && !x.IsHeader && x.IsPostingAllowed)
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.IsActive,
                x.IsPostingAllowed,
                x.IsHeader
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            count = items.Count,
            items
        });
    }

    [HttpPut]
    [Authorize(Policy = AuthorizationPolicies.BillingSetupManage)]
    public async Task<IActionResult> Save(
        [FromBody] SaveBillingPolicyRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantId = RequireTenantId(tenantContextAccessor);
        var userId = GetCurrentUserId();

        if (string.IsNullOrWhiteSpace(request.InvoicePrefix))
        {
            return BadRequest(new { message = "Invoice prefix is required." });
        }

        if (request.NextInvoiceNumber < 1)
        {
            return BadRequest(new { message = "Next invoice number must be greater than zero." });
        }

        if (request.DefaultDueDays < 0)
        {
            return BadRequest(new { message = "Default due days cannot be negative." });
        }

        if (request.DefaultTaxRate < 0)
        {
            return BadRequest(new { message = "Default tax rate cannot be negative." });
        }


        var accountValidation = await ValidatePostingAccountsAsync(
            dbContext,
            request.ReceivableControlAccountId,
            request.DefaultRevenueAccountId,
            request.TaxLiabilityAccountId,
            request.DiscountAccountId,
            request.WriteOffAccountId,
            cancellationToken);

        if (accountValidation is not null)
        {
            return BadRequest(accountValidation);
        }

        var policy = await dbContext.BillingPolicies
            .FirstOrDefaultAsync(x => x.TenantId == tenantId, cancellationToken);

        if (policy is null)
        {
            policy = new BillingPolicy
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                CreatedAtUtc = DateTime.UtcNow,
                CreatedByUserId = userId
            };
            dbContext.BillingPolicies.Add(policy);
        }

        policy.InvoicePrefix = request.InvoicePrefix.Trim().ToUpperInvariant();
        policy.NextInvoiceNumber = request.NextInvoiceNumber;
        policy.CurrencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? "NGN" : request.CurrencyCode.Trim().ToUpperInvariant();
        policy.ReceivableControlAccountId = request.ReceivableControlAccountId;
        policy.DefaultRevenueAccountId = request.DefaultRevenueAccountId;
        policy.TaxLiabilityAccountId = request.TaxLiabilityAccountId;
        policy.DiscountAccountId = request.DiscountAccountId;
        policy.WriteOffAccountId = request.WriteOffAccountId;
        policy.RequireApprovalBeforePosting = request.RequireApprovalBeforePosting;
        policy.EnableMakerChecker = request.EnableMakerChecker;
        policy.AutoPostApprovedInvoices = request.AutoPostApprovedInvoices;
        policy.DefaultTaxRate = request.DefaultTaxRate;
        policy.DefaultDueDays = request.DefaultDueDays;
        policy.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        policy.UpdatedAtUtc = DateTime.UtcNow;
        policy.UpdatedByUserId = userId;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = "Billing setup saved.",
            item = ToDto(policy)
        });
    }

    private static object ToDto(BillingPolicy policy) => new
    {
        policy.Id,
        policy.TenantId,
        policy.InvoicePrefix,
        policy.NextInvoiceNumber,
        policy.CurrencyCode,
        policy.ReceivableControlAccountId,
        policy.DefaultRevenueAccountId,
        policy.TaxLiabilityAccountId,
        policy.DiscountAccountId,
        policy.WriteOffAccountId,
        policy.RequireApprovalBeforePosting,
        policy.EnableMakerChecker,
        policy.AutoPostApprovedInvoices,
        policy.DefaultTaxRate,
        policy.DefaultDueDays,
        policy.Notes
    };


    private static async Task<object?> ValidatePostingAccountsAsync(
        ApplicationDbContext dbContext,
        Guid? receivableControlAccountId,
        Guid? defaultRevenueAccountId,
        Guid? taxLiabilityAccountId,
        Guid? discountAccountId,
        Guid? writeOffAccountId,
        CancellationToken cancellationToken)
    {
        var requestedIds = new[]
            {
                receivableControlAccountId,
                defaultRevenueAccountId,
                taxLiabilityAccountId,
                discountAccountId,
                writeOffAccountId
            }
            .Where(x => x.HasValue && x.Value != Guid.Empty)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        if (requestedIds.Count == 0)
        {
            return null;
        }

        var accounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (accounts.Count != requestedIds.Count)
        {
            return new { message = "One or more selected billing posting accounts were not found for the current tenant." };
        }

        foreach (var account in accounts.Values)
        {
            if (!IsPostingReady(account))
            {
                return new
                {
                    message = "All selected billing posting accounts must be active, non-header, and posting-enabled.",
                    account.Id,
                    account.Code
                };
            }
        }

        return null;
    }

    private static bool IsPostingReady(LedgerAccount account)
        => account.IsActive && !account.IsHeader && account.IsPostingAllowed;

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

    public sealed record SaveBillingPolicyRequest(
        string InvoicePrefix,
        int NextInvoiceNumber,
        string CurrencyCode,
        Guid? ReceivableControlAccountId,
        Guid? DefaultRevenueAccountId,
        Guid? TaxLiabilityAccountId,
        Guid? DiscountAccountId,
        Guid? WriteOffAccountId,
        bool RequireApprovalBeforePosting,
        bool EnableMakerChecker,
        bool AutoPostApprovedInvoices,
        decimal DefaultTaxRate,
        int DefaultDueDays,
        string? Notes);
}
