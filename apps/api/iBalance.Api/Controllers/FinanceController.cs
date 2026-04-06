using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/finance/accounts")]
public sealed class FinanceController : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> CreateLedgerAccount(
        [FromBody] CreateLedgerAccountRequest request,
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

        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(new { Message = "Code is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Name is required." });
        }

        if (request.IsHeader && request.IsPostingAllowed)
        {
            return BadRequest(new
            {
                Message = "Header accounts cannot allow posting."
            });
        }

        LedgerAccount? parentLedgerAccount = null;

        if (request.ParentLedgerAccountId.HasValue)
        {
            parentLedgerAccount = await dbContext.LedgerAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    x => x.Id == request.ParentLedgerAccountId.Value,
                    cancellationToken);

            if (parentLedgerAccount is null)
            {
                return BadRequest(new
                {
                    Message = "Parent ledger account was not found for the current tenant.",
                    ParentLedgerAccountId = request.ParentLedgerAccountId
                });
            }

            if (!parentLedgerAccount.IsHeader)
            {
                return BadRequest(new
                {
                    Message = "Parent ledger account must be a header account.",
                    ParentLedgerAccountId = request.ParentLedgerAccountId
                });
            }
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();
        var normalizedName = request.Name.Trim();

        var codeExists = await dbContext.LedgerAccounts
            .AsNoTracking()
            .AnyAsync(x => x.Code == normalizedCode, cancellationToken);

        if (codeExists)
        {
            return Conflict(new
            {
                Message = "A ledger account with the same code already exists for the current tenant.",
                Code = normalizedCode
            });
        }

        var ledgerAccount = new LedgerAccount(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedCode,
            normalizedName,
            request.Category,
            request.NormalBalance,
            request.IsHeader,
            request.IsPostingAllowed,
            true,
            request.ParentLedgerAccountId);

        dbContext.LedgerAccounts.Add(ledgerAccount);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Ledger account created successfully.",
            ledgerAccount.Id,
            ledgerAccount.TenantId,
            ledgerAccount.Code,
            ledgerAccount.Name,
            ledgerAccount.Category,
            ledgerAccount.NormalBalance,
            ledgerAccount.IsHeader,
            ledgerAccount.IsPostingAllowed,
            ledgerAccount.IsActive,
            ledgerAccount.ParentLedgerAccountId
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetLedgerAccounts(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.LedgerAccounts
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Code,
                x.Name,
                x.Category,
                x.NormalBalance,
                x.IsHeader,
                x.IsPostingAllowed,
                x.IsActive,
                x.ParentLedgerAccountId,
                ParentCode = x.ParentLedgerAccount != null ? x.ParentLedgerAccount.Code : null,
                ParentName = x.ParentLedgerAccount != null ? x.ParentLedgerAccount.Name : null
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = items.Count,
            Items = items
        });
    }

    public sealed record CreateLedgerAccountRequest(
        string Code,
        string Name,
        AccountCategory Category,
        AccountNature NormalBalance,
        bool IsHeader,
        bool IsPostingAllowed,
        Guid? ParentLedgerAccountId);
}