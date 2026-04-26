using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/bank-accounts")]
public sealed class BankAccountsController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetBankAccounts(
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

        var items = await dbContext.BankAccounts
            .AsNoTracking()
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                bankAccount => bankAccount.LedgerAccountId,
                ledgerAccount => ledgerAccount.Id,
                (bankAccount, ledgerAccount) => new
                {
                    bankAccount.Id,
                    bankAccount.TenantId,
                    bankAccount.Name,
                    bankAccount.BankName,
                    bankAccount.AccountNumber,
                    bankAccount.Branch,
                    bankAccount.CurrencyCode,
                    bankAccount.LedgerAccountId,
                    LedgerAccountCode = ledgerAccount.Code,
                    LedgerAccountName = ledgerAccount.Name,
                    ledgerAccount.IsCashOrBankAccount,
                    ledgerAccount.IsPostingAllowed,
                    LedgerAccountIsActive = ledgerAccount.IsActive,
                    bankAccount.IsActive,
                    bankAccount.Notes,
                    bankAccount.CreatedOnUtc,
                    bankAccount.LastModifiedOnUtc
                })
            .OrderBy(x => x.BankName)
            .ThenBy(x => x.Name)
            .ThenBy(x => x.AccountNumber)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateBankAccount(
        [FromBody] CreateBankAccountRequest request,
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

        var validation = await ValidateBankAccountRequestAsync(
            dbContext,
            request.Name,
            request.BankName,
            request.AccountNumber,
            request.CurrencyCode,
            request.LedgerAccountId,
            null,
            cancellationToken);

        if (validation is not null) return validation;

        try
        {
            var bankAccount = new BankAccount(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.Name,
                request.BankName,
                request.AccountNumber,
                request.CurrencyCode,
                request.LedgerAccountId,
                request.Branch,
                request.Notes);

            dbContext.BankAccounts.Add(bankAccount);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Bank account created successfully.",
                BankAccount = new
                {
                    bankAccount.Id,
                    bankAccount.TenantId,
                    bankAccount.Name,
                    bankAccount.BankName,
                    bankAccount.AccountNumber,
                    bankAccount.Branch,
                    bankAccount.CurrencyCode,
                    bankAccount.LedgerAccountId,
                    bankAccount.IsActive,
                    bankAccount.Notes
                }
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPut("{bankAccountId:guid}")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> UpdateBankAccount(
        Guid bankAccountId,
        [FromBody] UpdateBankAccountRequest request,
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

        var bankAccount = await dbContext.BankAccounts
            .FirstOrDefaultAsync(x => x.Id == bankAccountId, cancellationToken);

        if (bankAccount is null)
        {
            return NotFound(new
            {
                Message = "Bank account was not found for the current tenant.",
                BankAccountId = bankAccountId
            });
        }

        var validation = await ValidateBankAccountRequestAsync(
            dbContext,
            request.Name,
            request.BankName,
            request.AccountNumber,
            request.CurrencyCode,
            request.LedgerAccountId,
            bankAccountId,
            cancellationToken);

        if (validation is not null) return validation;

        try
        {
            bankAccount.Update(
                request.Name,
                request.BankName,
                request.AccountNumber,
                request.CurrencyCode,
                request.LedgerAccountId,
                request.Branch,
                request.Notes);

            if (request.IsActive)
            {
                bankAccount.Activate();
            }
            else
            {
                bankAccount.Deactivate();
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Bank account updated successfully.",
                BankAccount = new
                {
                    bankAccount.Id,
                    bankAccount.TenantId,
                    bankAccount.Name,
                    bankAccount.BankName,
                    bankAccount.AccountNumber,
                    bankAccount.Branch,
                    bankAccount.CurrencyCode,
                    bankAccount.LedgerAccountId,
                    bankAccount.IsActive,
                    bankAccount.Notes
                }
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("{bankAccountId:guid}/activate")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> ActivateBankAccount(
        Guid bankAccountId,
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

        var bankAccount = await dbContext.BankAccounts.FirstOrDefaultAsync(x => x.Id == bankAccountId, cancellationToken);
        if (bankAccount is null) return NotFound(new { Message = "Bank account was not found for the current tenant.", BankAccountId = bankAccountId });

        bankAccount.Activate();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Bank account activated successfully.", bankAccount.Id, bankAccount.IsActive });
    }

    [HttpPost("{bankAccountId:guid}/deactivate")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> DeactivateBankAccount(
        Guid bankAccountId,
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

        var bankAccount = await dbContext.BankAccounts.FirstOrDefaultAsync(x => x.Id == bankAccountId, cancellationToken);
        if (bankAccount is null) return NotFound(new { Message = "Bank account was not found for the current tenant.", BankAccountId = bankAccountId });

        bankAccount.Deactivate();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Bank account deactivated successfully.", bankAccount.Id, bankAccount.IsActive });
    }

    private static async Task<IActionResult?> ValidateBankAccountRequestAsync(
        ApplicationDbContext dbContext,
        string name,
        string bankName,
        string accountNumber,
        string currencyCode,
        Guid ledgerAccountId,
        Guid? existingBankAccountId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name)) return new BadRequestObjectResult(new { Message = "Bank account name is required." });
        if (string.IsNullOrWhiteSpace(bankName)) return new BadRequestObjectResult(new { Message = "Bank name is required." });
        if (string.IsNullOrWhiteSpace(accountNumber)) return new BadRequestObjectResult(new { Message = "Account number is required." });
        if (string.IsNullOrWhiteSpace(currencyCode)) return new BadRequestObjectResult(new { Message = "Currency code is required." });
        if (ledgerAccountId == Guid.Empty) return new BadRequestObjectResult(new { Message = "Linked ledger account is required." });

        var normalizedAccountNumber = accountNumber.Trim();
        var duplicateAccountNumberExists = await dbContext.BankAccounts
            .AsNoTracking()
            .AnyAsync(x => x.AccountNumber == normalizedAccountNumber && (!existingBankAccountId.HasValue || x.Id != existingBankAccountId.Value), cancellationToken);

        if (duplicateAccountNumberExists)
        {
            return new ConflictObjectResult(new { Message = "A bank account with the same account number already exists for the current tenant.", AccountNumber = normalizedAccountNumber });
        }

        var duplicateLedgerExists = await dbContext.BankAccounts
            .AsNoTracking()
            .AnyAsync(x => x.LedgerAccountId == ledgerAccountId && (!existingBankAccountId.HasValue || x.Id != existingBankAccountId.Value), cancellationToken);

        if (duplicateLedgerExists)
        {
            return new ConflictObjectResult(new { Message = "The selected ledger account is already linked to another bank account.", LedgerAccountId = ledgerAccountId });
        }

        var ledgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == ledgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return new BadRequestObjectResult(new { Message = "Linked ledger account was not found for the current tenant.", LedgerAccountId = ledgerAccountId });
        }

        if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed || !ledgerAccount.IsCashOrBankAccount)
        {
            return new BadRequestObjectResult(new
            {
                Message = "Linked ledger account must be active, non-header, posting-enabled, and marked as cash or bank.",
                LedgerAccountId = ledgerAccountId,
                ledgerAccount.Code,
                ledgerAccount.Name,
                ledgerAccount.IsActive,
                ledgerAccount.IsHeader,
                ledgerAccount.IsPostingAllowed,
                ledgerAccount.IsCashOrBankAccount
            });
        }

        return null;
    }
}

public sealed record CreateBankAccountRequest(
    string Name,
    string BankName,
    string AccountNumber,
    string CurrencyCode,
    Guid LedgerAccountId,
    string? Branch,
    string? Notes);

public sealed record UpdateBankAccountRequest(
    string Name,
    string BankName,
    string AccountNumber,
    string CurrencyCode,
    Guid LedgerAccountId,
    bool IsActive,
    string? Branch,
    string? Notes);
