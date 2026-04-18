using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Security;
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
[Route("api/finance")]
public sealed class FinanceController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsCreate)]
    [HttpPost("opening-balances")]
    public async Task<IActionResult> CreateOpeningBalanceJournal(
        [FromBody] CreateOpeningBalanceRequest request,
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

        if (request.Lines is null || request.Lines.Count < 2)
        {
            return BadRequest(new
            {
                Message = "An opening balance journal must contain at least two lines."
            });
        }

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(
            dbContext,
            request.EntryDateUtc,
            cancellationToken);

        if (postingPeriod is null)
        {
            return Conflict(new
            {
                Message = "No open fiscal period exists for the opening balance date.",
                request.EntryDateUtc
            });
        }

        var effectiveReference = request.Reference?.Trim();

        if (string.IsNullOrWhiteSpace(effectiveReference))
        {
            var activeSequence = await dbContext.JournalNumberSequences
                .FirstOrDefaultAsync(x => x.IsActive, cancellationToken);

            if (activeSequence is null)
            {
                return BadRequest(new
                {
                    Message = "Reference is required when no active journal number sequence exists."
                });
            }

            effectiveReference = activeSequence.ConsumeNextReference();
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Description is required." });
        }

        var duplicateReferenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == effectiveReference, cancellationToken);

        if (duplicateReferenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the same reference already exists for the current tenant.",
                Reference = effectiveReference
            });
        }

        var requestedLedgerAccountIds = request.Lines
            .Select(x => x.LedgerAccountId)
            .Distinct()
            .ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedLedgerAccountIds.Count)
        {
            return BadRequest(new
            {
                Message = "One or more ledger accounts were not found for the current tenant."
            });
        }

        foreach (var line in request.Lines)
        {
            var ledgerAccount = ledgerAccounts[line.LedgerAccountId];

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return BadRequest(new
                {
                    Message = "All opening balance lines must use active, non-header, posting-enabled ledger accounts.",
                    line.LedgerAccountId,
                    ledgerAccount.Code
                });
            }
        }

        try
        {
            var openingJournal = new JournalEntry(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.EntryDateUtc,
                effectiveReference,
                request.Description.Trim(),
                JournalEntryStatus.Draft,
                JournalEntryType.OpeningBalance,
                request.Lines.Select(x => new JournalEntryLine(
                    Guid.NewGuid(),
                    x.LedgerAccountId,
                    x.Description,
                    x.DebitAmount,
                    x.CreditAmount)),
                postingRequiresApproval: false);

            var postedAtUtc = DateTime.UtcNow;
            openingJournal.MarkPosted(postedAtUtc);

            var movements = openingJournal.Lines
                .Select(line => new LedgerMovement(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    openingJournal.Id,
                    line.Id,
                    line.LedgerAccountId,
                    openingJournal.EntryDateUtc,
                    openingJournal.Reference,
                    line.Description,
                    line.DebitAmount,
                    line.CreditAmount))
                .ToList();

            dbContext.JournalEntries.Add(openingJournal);
            dbContext.LedgerMovements.AddRange(movements);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Opening balance journal created and posted successfully.",
                openingJournal.Id,
                openingJournal.TenantId,
                openingJournal.EntryDateUtc,
                openingJournal.Reference,
                openingJournal.Description,
                openingJournal.Status,
                openingJournal.Type,
                openingJournal.PostedAtUtc,
                openingJournal.PostingRequiresApproval,
                FiscalPeriodId = postingPeriod.Id,
                FiscalPeriodName = postingPeriod.Name,
                openingJournal.TotalDebit,
                openingJournal.TotalCredit,
                LineCount = openingJournal.Lines.Count,
                MovementCount = movements.Count
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPost("journal-number-sequences")]
    public async Task<IActionResult> CreateJournalNumberSequence(
        [FromBody] CreateJournalNumberSequenceRequest request,
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

        if (string.IsNullOrWhiteSpace(request.Prefix))
        {
            return BadRequest(new { Message = "Prefix is required." });
        }

        var normalizedPrefix = request.Prefix.Trim().ToUpperInvariant();

        var exists = await dbContext.JournalNumberSequences
            .AsNoTracking()
            .AnyAsync(x => x.Prefix == normalizedPrefix, cancellationToken);

        if (exists)
        {
            return Conflict(new
            {
                Message = "A journal number sequence with the same prefix already exists for the current tenant.",
                Prefix = normalizedPrefix
            });
        }

        var sequence = new JournalNumberSequence(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedPrefix,
            request.NextNumber,
            request.Padding,
            request.IsActive);

        dbContext.JournalNumberSequences.Add(sequence);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Journal number sequence created successfully.",
            sequence.Id,
            sequence.TenantId,
            sequence.Prefix,
            sequence.NextNumber,
            sequence.Padding,
            sequence.IsActive,
            NextReferencePreview = sequence.PeekNextReference()
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpGet("journal-number-sequences")]
    public async Task<IActionResult> GetJournalNumberSequences(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.JournalNumberSequences
            .AsNoTracking()
            .OrderBy(x => x.Prefix)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Prefix,
                x.NextNumber,
                x.Padding,
                x.IsActive,
                NextReferencePreview = x.PeekNextReference()
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

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpGet("dashboard-summary")]
    public async Task<IActionResult> GetDashboardSummary(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var todayUtc = DateTime.UtcNow;
        var todayDateOnly = DateOnly.FromDateTime(todayUtc.Date);

        var totalAccounts = await dbContext.LedgerAccounts.CountAsync(cancellationToken);
        var totalPostedJournals = await dbContext.JournalEntries.CountAsync(x => x.Status == JournalEntryStatus.Posted, cancellationToken);
        var totalDraftJournals = await dbContext.JournalEntries.CountAsync(x => x.Status == JournalEntryStatus.Draft, cancellationToken);
        var totalVoidedJournals = await dbContext.JournalEntries.CountAsync(x => x.Status == JournalEntryStatus.Voided, cancellationToken);
        var totalReversedJournals = await dbContext.JournalEntries.CountAsync(x => x.Status == JournalEntryStatus.Reversed, cancellationToken);
        var totalOpeningBalanceJournals = await dbContext.JournalEntries.CountAsync(x => x.Type == JournalEntryType.OpeningBalance, cancellationToken);
        var totalLedgerMovements = await dbContext.LedgerMovements.CountAsync(cancellationToken);

        var openFiscalPeriod = await dbContext.FiscalPeriods
            .AsNoTracking()
            .Where(x => x.Status == FiscalPeriodStatus.Open && x.StartDate <= todayDateOnly && x.EndDate >= todayDateOnly)
            .OrderBy(x => x.StartDate)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.StartDate,
                x.EndDate,
                x.Status
            })
            .FirstOrDefaultAsync(cancellationToken);

        var trialBalanceRows = await dbContext.LedgerMovements
            .AsNoTracking()
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                movement => movement.LedgerAccountId,
                account => account.Id,
                (movement, account) => new
                {
                    account.Id,
                    movement.DebitAmount,
                    movement.CreditAmount
                })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            SnapshotUtc = todayUtc,
            TotalAccounts = totalAccounts,
            TotalPostedJournals = totalPostedJournals,
            TotalDraftJournals = totalDraftJournals,
            TotalVoidedJournals = totalVoidedJournals,
            TotalReversedJournals = totalReversedJournals,
            TotalOpeningBalanceJournals = totalOpeningBalanceJournals,
            TotalLedgerMovements = totalLedgerMovements,
            TotalDebit = trialBalanceRows.Sum(x => x.DebitAmount),
            TotalCredit = trialBalanceRows.Sum(x => x.CreditAmount),
            OpenFiscalPeriod = openFiscalPeriod
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsCreate)]
    [HttpPut("journal-entries/{journalEntryId:guid}")]
    public async Task<IActionResult> UpdateDraftJournalEntry(
        Guid journalEntryId,
        [FromBody] UpdateJournalEntryRequest request,
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

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        if (journalEntry.Status != JournalEntryStatus.Draft && journalEntry.Status != JournalEntryStatus.Rejected)
        {
            return Conflict(new
            {
                Message = "Only draft or rejected journal entries can be edited.",
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }

        if (string.IsNullOrWhiteSpace(request.Reference))
        {
            return BadRequest(new { Message = "Reference is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Description is required." });
        }

        if (request.Lines is null || request.Lines.Count < 2)
        {
            return BadRequest(new
            {
                Message = "A journal entry must contain at least two lines."
            });
        }

        var normalizedReference = request.Reference.Trim();

        var duplicateReferenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Id != journalEntryId && x.Reference == normalizedReference, cancellationToken);

        if (duplicateReferenceExists)
        {
            return Conflict(new
            {
                Message = "Another journal entry with the same reference already exists for the current tenant.",
                Reference = normalizedReference
            });
        }

        var requestedLedgerAccountIds = request.Lines
            .Select(x => x.LedgerAccountId)
            .Distinct()
            .ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedLedgerAccountIds.Count)
        {
            return BadRequest(new
            {
                Message = "One or more ledger accounts were not found for the current tenant."
            });
        }

        foreach (var line in request.Lines)
        {
            var ledgerAccount = ledgerAccounts[line.LedgerAccountId];

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return BadRequest(new
                {
                    Message = "All journal lines must use active, non-header, posting-enabled ledger accounts.",
                    line.LedgerAccountId,
                    ledgerAccount.Code
                });
            }
        }

        var replacementJournal = new JournalEntry(
            journalEntry.Id,
            tenantContext.TenantId,
            request.EntryDateUtc,
            normalizedReference,
            request.Description.Trim(),
            JournalEntryStatus.Draft,
            journalEntry.Type,
            request.Lines.Select(x => new JournalEntryLine(
                Guid.NewGuid(),
                x.LedgerAccountId,
                x.Description,
                x.DebitAmount,
                x.CreditAmount)),
            journalEntry.ReversedJournalEntryId,
            journalEntry.PostingRequiresApproval);

        dbContext.JournalEntryLines.RemoveRange(journalEntry.Lines);
        dbContext.Entry(journalEntry).CurrentValues.SetValues(replacementJournal);
        await dbContext.JournalEntryLines.AddRangeAsync(replacementJournal.Lines, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Draft journal entry updated successfully.",
            replacementJournal.Id,
            replacementJournal.Reference,
            replacementJournal.Description,
            replacementJournal.EntryDateUtc,
            replacementJournal.Status,
            replacementJournal.Type,
            replacementJournal.PostingRequiresApproval,
            replacementJournal.TotalDebit,
            replacementJournal.TotalCredit,
            LineCount = replacementJournal.Lines.Count
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceFiscalPeriodsManage)]
    [HttpPost("fiscal-periods")]
    public async Task<IActionResult> CreateFiscalPeriod(
        [FromBody] CreateFiscalPeriodRequest request,
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

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Name is required." });
        }

        if (request.EndDate < request.StartDate)
        {
            return BadRequest(new { Message = "EndDate cannot be earlier than StartDate." });
        }

        var normalizedName = request.Name.Trim();

        var nameExists = await dbContext.FiscalPeriods
            .AsNoTracking()
            .AnyAsync(x => x.Name == normalizedName, cancellationToken);

        if (nameExists)
        {
            return Conflict(new
            {
                Message = "A fiscal period with the same name already exists for the current tenant.",
                Name = normalizedName
            });
        }

        var overlaps = await dbContext.FiscalPeriods
            .AsNoTracking()
            .AnyAsync(x => request.StartDate <= x.EndDate && request.EndDate >= x.StartDate, cancellationToken);

        if (overlaps)
        {
            return Conflict(new
            {
                Message = "The fiscal period overlaps an existing fiscal period for the current tenant."
            });
        }

        var fiscalPeriod = new FiscalPeriod(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedName,
            request.StartDate,
            request.EndDate,
            request.IsOpen ? FiscalPeriodStatus.Open : FiscalPeriodStatus.Closed);

        dbContext.FiscalPeriods.Add(fiscalPeriod);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Fiscal period created successfully.",
            fiscalPeriod.Id,
            fiscalPeriod.TenantId,
            fiscalPeriod.Name,
            fiscalPeriod.StartDate,
            fiscalPeriod.EndDate,
            fiscalPeriod.Status
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpGet("fiscal-periods")]
    public async Task<IActionResult> GetFiscalPeriods(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.FiscalPeriods
            .AsNoTracking()
            .OrderBy(x => x.StartDate)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Name,
                x.StartDate,
                x.EndDate,
                x.Status
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

    [Authorize(Policy = AuthorizationPolicies.FinanceFiscalPeriodsManage)]
    [HttpPost("fiscal-periods/{fiscalPeriodId:guid}/open")]
    public async Task<IActionResult> OpenFiscalPeriod(
        Guid fiscalPeriodId,
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

        var fiscalPeriod = await dbContext.FiscalPeriods
            .FirstOrDefaultAsync(x => x.Id == fiscalPeriodId, cancellationToken);

        if (fiscalPeriod is null)
        {
            return NotFound(new
            {
                Message = "Fiscal period was not found for the current tenant.",
                FiscalPeriodId = fiscalPeriodId
            });
        }

        fiscalPeriod.Open();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Fiscal period opened successfully.",
            fiscalPeriod.Id,
            fiscalPeriod.Name,
            fiscalPeriod.StartDate,
            fiscalPeriod.EndDate,
            fiscalPeriod.Status
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceFiscalPeriodsManage)]
    [HttpPost("fiscal-periods/{fiscalPeriodId:guid}/close")]
    public async Task<IActionResult> CloseFiscalPeriod(
        Guid fiscalPeriodId,
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

        var fiscalPeriod = await dbContext.FiscalPeriods
            .FirstOrDefaultAsync(x => x.Id == fiscalPeriodId, cancellationToken);

        if (fiscalPeriod is null)
        {
            return NotFound(new
            {
                Message = "Fiscal period was not found for the current tenant.",
                FiscalPeriodId = fiscalPeriodId
            });
        }

        fiscalPeriod.Close();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Fiscal period closed successfully.",
            fiscalPeriod.Id,
            fiscalPeriod.Name,
            fiscalPeriod.StartDate,
            fiscalPeriod.EndDate,
            fiscalPeriod.Status
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPost("accounts")]
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
            return BadRequest(new { Message = "Header accounts cannot allow posting." });
        }

        if (request.IsHeader && request.IsCashOrBankAccount)
        {
            return BadRequest(new { Message = "Header accounts cannot be marked as cash or bank accounts." });
        }

        LedgerAccount? parentLedgerAccount = null;

        if (request.ParentLedgerAccountId.HasValue)
        {
            parentLedgerAccount = await dbContext.LedgerAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.ParentLedgerAccountId.Value, cancellationToken);

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
        var normalizedPurpose = string.IsNullOrWhiteSpace(request.Purpose) ? null : request.Purpose.Trim();

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
            request.ParentLedgerAccountId,
            normalizedPurpose,
            request.IsCashOrBankAccount);

        dbContext.LedgerAccounts.Add(ledgerAccount);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Ledger account created successfully.",
            ledgerAccount.Id,
            ledgerAccount.TenantId,
            ledgerAccount.Code,
            ledgerAccount.Name,
            ledgerAccount.Purpose,
            ledgerAccount.Category,
            ledgerAccount.NormalBalance,
            ledgerAccount.IsHeader,
            ledgerAccount.IsPostingAllowed,
            ledgerAccount.IsActive,
            ledgerAccount.IsCashOrBankAccount,
            ledgerAccount.ParentLedgerAccountId
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPut("accounts/{ledgerAccountId:guid}")]
    public async Task<IActionResult> UpdateLedgerAccount(
        Guid ledgerAccountId,
        [FromBody] UpdateLedgerAccountRequest request,
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

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Name is required." });
        }

        var ledgerAccount = await dbContext.LedgerAccounts
            .FirstOrDefaultAsync(x => x.Id == ledgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return NotFound(new
            {
                Message = "Ledger account was not found for the current tenant.",
                LedgerAccountId = ledgerAccountId
            });
        }

        if (ledgerAccount.IsHeader && request.IsCashOrBankAccount)
        {
            return BadRequest(new
            {
                Message = "Header accounts cannot be marked as cash or bank accounts.",
                LedgerAccountId = ledgerAccountId
            });
        }

        try
        {
            ledgerAccount.Rename(request.Name.Trim());
            ledgerAccount.SetPurpose(request.Purpose);
            ledgerAccount.SetCashOrBankAccount(request.IsCashOrBankAccount);

            if (request.IsActive)
            {
                ledgerAccount.Activate();
            }
            else
            {
                ledgerAccount.Deactivate();
            }

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Ledger account updated successfully.",
                ledgerAccount.Id,
                ledgerAccount.TenantId,
                ledgerAccount.Code,
                ledgerAccount.Name,
                ledgerAccount.Purpose,
                ledgerAccount.Category,
                ledgerAccount.NormalBalance,
                ledgerAccount.IsHeader,
                ledgerAccount.IsPostingAllowed,
                ledgerAccount.IsActive,
                ledgerAccount.IsCashOrBankAccount,
                ledgerAccount.ParentLedgerAccountId
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }


    [Authorize(Policy = AuthorizationPolicies.FinanceSetupManage)]
    [HttpPost("tax-codes")]
    public async Task<IActionResult> CreateTaxCode(
        [FromBody] CreateTaxCodeRequest request,
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
            return BadRequest(new { Message = "Tax code is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Tax code name is required." });
        }

        if (request.RatePercent < 0m || request.RatePercent > 100m)
        {
            return BadRequest(new { Message = "Tax rate must be between 0 and 100 percent." });
        }

        if (request.TaxLedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Tax ledger account is required." });
        }

        if (request.EffectiveToUtc.HasValue && request.EffectiveToUtc.Value < request.EffectiveFromUtc)
        {
            return BadRequest(new { Message = "Effective end date cannot be earlier than effective start date." });
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        var duplicateExists = await dbContext.TaxCodes
            .AsNoTracking()
            .AnyAsync(x => x.Code == normalizedCode, cancellationToken);

        if (duplicateExists)
        {
            return Conflict(new
            {
                Message = "A tax code with the same code already exists for the current tenant.",
                Code = normalizedCode
            });
        }

        var taxLedgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.TaxLedgerAccountId, cancellationToken);

        if (taxLedgerAccount is null)
        {
            return BadRequest(new
            {
                Message = "Tax ledger account was not found for the current tenant.",
                request.TaxLedgerAccountId
            });
        }

        if (!taxLedgerAccount.IsActive || taxLedgerAccount.IsHeader || !taxLedgerAccount.IsPostingAllowed)
        {
            return BadRequest(new
            {
                Message = "Tax ledger account must be an active, non-header, posting-enabled account.",
                request.TaxLedgerAccountId,
                taxLedgerAccount.Code
            });
        }

        try
        {
            var taxCode = new TaxCode(
                Guid.NewGuid(),
                tenantContext.TenantId,
                normalizedCode,
                request.Name,
                request.ComponentKind,
                request.ApplicationMode,
                request.TransactionScope,
                request.RatePercent,
                request.TaxLedgerAccountId,
                request.IsActive,
                request.EffectiveFromUtc,
                request.EffectiveToUtc,
                request.Description);

            dbContext.TaxCodes.Add(taxCode);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Tax code created successfully.",
                taxCode.Id,
                taxCode.TenantId,
                taxCode.Code,
                taxCode.Name,
                taxCode.Description,
                taxCode.ComponentKind,
                taxCode.ApplicationMode,
                taxCode.TransactionScope,
                taxCode.RatePercent,
                taxCode.TaxLedgerAccountId,
                TaxLedgerAccountCode = taxLedgerAccount.Code,
                TaxLedgerAccountName = taxLedgerAccount.Name,
                taxCode.IsActive,
                taxCode.EffectiveFromUtc,
                taxCode.EffectiveToUtc
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpGet("tax-codes")]
    public async Task<IActionResult> GetTaxCodes(
        [FromQuery] TaxComponentKind? componentKind,
        [FromQuery] TaxTransactionScope? transactionScope,
        [FromQuery] bool? activeOnly,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        IQueryable<TaxCode> query = dbContext.TaxCodes.AsNoTracking();

        if (componentKind.HasValue)
        {
            query = query.Where(x => x.ComponentKind == componentKind.Value);
        }

        if (transactionScope.HasValue)
        {
            query = query.Where(x =>
                x.TransactionScope == transactionScope.Value ||
                x.TransactionScope == TaxTransactionScope.Both);
        }

        if (activeOnly == true)
        {
            query = query.Where(x => x.IsActive);
        }

        var items = await query
            .OrderBy(x => x.ComponentKind)
            .ThenBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Code,
                x.Name,
                x.Description,
                x.ComponentKind,
                x.ApplicationMode,
                x.TransactionScope,
                x.RatePercent,
                x.TaxLedgerAccountId,
                TaxLedgerAccountCode = x.TaxLedgerAccount != null ? x.TaxLedgerAccount.Code : null,
                TaxLedgerAccountName = x.TaxLedgerAccount != null ? x.TaxLedgerAccount.Name : null,
                x.IsActive,
                x.EffectiveFromUtc,
                x.EffectiveToUtc
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


    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpPost("tax-calculations/preview")]
    public async Task<IActionResult> PreviewTaxCalculation(
        [FromBody] PreviewTaxCalculationRequest request,
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

        if (request.TaxableAmount < 0m)
        {
            return BadRequest(new { Message = "Taxable amount cannot be negative." });
        }

        if (request.TransactionDateUtc == default)
        {
            return BadRequest(new { Message = "Transaction date is required." });
        }

        if (request.TaxCodeIds is null || request.TaxCodeIds.Count == 0)
        {
            return Ok(new
            {
                TenantContextAvailable = tenantContext.IsAvailable,
                TenantId = tenantContext.TenantId,
                TenantKey = tenantContext.TenantKey,
                request.TransactionDateUtc,
                request.TransactionScope,
                request.TaxableAmount,
                TotalAdditions = 0m,
                TotalDeductions = 0m,
                GrossAmount = request.TaxableAmount,
                NetAmount = request.TaxableAmount,
                Count = 0,
                Items = Array.Empty<object>()
            });
        }

        var distinctTaxCodeIds = request.TaxCodeIds
            .Where(x => x != Guid.Empty)
            .Distinct()
            .ToList();

        if (distinctTaxCodeIds.Count != request.TaxCodeIds.Count)
        {
            return BadRequest(new { Message = "One or more tax code ids are invalid." });
        }

        var taxCodes = await dbContext.TaxCodes
            .AsNoTracking()
            .Where(x => distinctTaxCodeIds.Contains(x.Id))
            .OrderBy(x => x.ComponentKind)
            .ThenBy(x => x.Code)
            .ToListAsync(cancellationToken);

        if (taxCodes.Count != distinctTaxCodeIds.Count)
        {
            return BadRequest(new { Message = "One or more tax codes were not found for the current tenant." });
        }

        foreach (var taxCode in taxCodes)
        {
            if (!taxCode.IsActive)
            {
                return BadRequest(new
                {
                    Message = "Only active tax codes can be used for tax calculation.",
                    TaxCodeId = taxCode.Id,
                    taxCode.Code
                });
            }

            if (!taxCode.IsEffectiveOn(request.TransactionDateUtc))
            {
                return BadRequest(new
                {
                    Message = "One or more tax codes are not effective for the transaction date.",
                    TaxCodeId = taxCode.Id,
                    taxCode.Code,
                    taxCode.EffectiveFromUtc,
                    taxCode.EffectiveToUtc,
                    request.TransactionDateUtc
                });
            }

            if (taxCode.TransactionScope != TaxTransactionScope.Both &&
                taxCode.TransactionScope != request.TransactionScope)
            {
                return BadRequest(new
                {
                    Message = "One or more tax codes cannot be used for the selected transaction scope.",
                    TaxCodeId = taxCode.Id,
                    taxCode.Code,
                    taxCode.TransactionScope,
                    RequestedScope = request.TransactionScope
                });
            }
        }

        var items = taxCodes
            .Select(taxCode =>
            {
                var taxAmount = taxCode.CalculateTaxAmount(request.TaxableAmount);

                return new
                {
                    TaxCodeId = taxCode.Id,
                    taxCode.Code,
                    taxCode.Name,
                    taxCode.ComponentKind,
                    taxCode.ApplicationMode,
                    taxCode.TransactionScope,
                    taxCode.RatePercent,
                    taxCode.TaxLedgerAccountId,
                    TaxLedgerAccountCode = taxCode.TaxLedgerAccount != null ? taxCode.TaxLedgerAccount.Code : null,
                    TaxLedgerAccountName = taxCode.TaxLedgerAccount != null ? taxCode.TaxLedgerAccount.Name : null,
                    TaxableAmount = request.TaxableAmount,
                    TaxAmount = taxAmount,
                    IsAddition = taxCode.ApplicationMode == TaxApplicationMode.AddToAmount,
                    IsDeduction = taxCode.ApplicationMode == TaxApplicationMode.DeductFromAmount
                };
            })
            .ToList();

        var totalAdditions = items
            .Where(x => x.IsAddition)
            .Sum(x => x.TaxAmount);

        var totalDeductions = items
            .Where(x => x.IsDeduction)
            .Sum(x => x.TaxAmount);

        var grossAmount = request.TaxableAmount + totalAdditions;
        var netAmount = grossAmount - totalDeductions;

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            request.TransactionDateUtc,
            request.TransactionScope,
            request.TaxableAmount,
            TotalAdditions = totalAdditions,
            TotalDeductions = totalDeductions,
            GrossAmount = grossAmount,
            NetAmount = netAmount,
            Count = items.Count,
            Items = items
        });
    }


        [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reports/taxes")]
    public async Task<IActionResult> GetTaxReport(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] TaxComponentKind? componentKind,
        [FromQuery] TaxTransactionScope? transactionScope,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        IQueryable<TaxTransactionLine> query = dbContext.TaxTransactionLines
            .AsNoTracking();

        if (fromUtc.HasValue)
        {
            query = query.Where(x => x.TransactionDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(x => x.TransactionDateUtc <= toUtc.Value);
        }

        if (componentKind.HasValue)
        {
            query = query.Where(x => x.ComponentKind == componentKind.Value);
        }

        if (transactionScope.HasValue)
        {
            query = query.Where(x => x.TransactionScope == transactionScope.Value);
        }

        var rows = await query
            .OrderByDescending(x => x.TransactionDateUtc)
            .ThenBy(x => x.SourceDocumentNumber)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.TaxCodeId,
                TaxCode = x.TaxCode != null ? x.TaxCode.Code : null,
                TaxCodeName = x.TaxCode != null ? x.TaxCode.Name : null,
                x.TransactionDateUtc,
                x.SourceModule,
                x.SourceDocumentType,
                x.SourceDocumentId,
                x.SourceDocumentNumber,
                x.TaxableAmount,
                x.TaxAmount,
                x.ComponentKind,
                x.ApplicationMode,
                x.TransactionScope,
                x.RatePercent,
                x.TaxLedgerAccountId,
                TaxLedgerAccountCode = x.TaxLedgerAccount != null ? x.TaxLedgerAccount.Code : null,
                TaxLedgerAccountName = x.TaxLedgerAccount != null ? x.TaxLedgerAccount.Name : null,
                x.CounterpartyId,
                x.CounterpartyCode,
                x.CounterpartyName,
                x.Description,
                x.JournalEntryId
            })
            .ToListAsync(cancellationToken);

        var byTaxCode = rows
            .GroupBy(x => new
            {
                x.TaxCodeId,
                x.TaxCode,
                x.TaxCodeName,
                x.ComponentKind,
                x.ApplicationMode,
                x.TransactionScope,
                x.RatePercent,
                x.TaxLedgerAccountId,
                x.TaxLedgerAccountCode,
                x.TaxLedgerAccountName
            })
            .Select(group => new
            {
                group.Key.TaxCodeId,
                group.Key.TaxCode,
                group.Key.TaxCodeName,
                group.Key.ComponentKind,
                group.Key.ApplicationMode,
                group.Key.TransactionScope,
                group.Key.RatePercent,
                group.Key.TaxLedgerAccountId,
                group.Key.TaxLedgerAccountCode,
                group.Key.TaxLedgerAccountName,
                Count = group.Count(),
                TotalTaxableAmount = group.Sum(x => x.TaxableAmount),
                TotalTaxAmount = group.Sum(x => x.TaxAmount)
            })
            .OrderBy(x => x.ComponentKind)
            .ThenBy(x => x.TaxCode)
            .ToList();

        var byComponentKind = rows
            .GroupBy(x => x.ComponentKind)
            .Select(group => new
            {
                ComponentKind = group.Key,
                Count = group.Count(),
                TotalTaxableAmount = group.Sum(x => x.TaxableAmount),
                TotalTaxAmount = group.Sum(x => x.TaxAmount)
            })
            .OrderBy(x => x.ComponentKind)
            .ToList();

        var totalAdditions = rows
            .Where(x => x.ApplicationMode == TaxApplicationMode.AddToAmount)
            .Sum(x => x.TaxAmount);

        var totalDeductions = rows
            .Where(x => x.ApplicationMode == TaxApplicationMode.DeductFromAmount)
            .Sum(x => x.TaxAmount);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            ComponentKind = componentKind,
            TransactionScope = transactionScope,
            Count = rows.Count,
            TotalTaxableAmount = rows.Sum(x => x.TaxableAmount),
            TotalTaxAmount = rows.Sum(x => x.TaxAmount),
            TotalAdditions = totalAdditions,
            TotalDeductions = totalDeductions,
            ByComponentKind = byComponentKind,
            ByTaxCode = byTaxCode,
            Items = rows
        });
    }


    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpGet("accounts")]
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
                x.Purpose,
                x.Category,
                x.NormalBalance,
                x.IsHeader,
                x.IsPostingAllowed,
                x.IsActive,
                x.IsCashOrBankAccount,
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

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsCreate)]
    [HttpPost("journal-entries")]
    public async Task<IActionResult> CreateJournalEntry(
        [FromBody] CreateJournalEntryRequest request,
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

        if (request.Lines is null || request.Lines.Count < 2)
        {
            return BadRequest(new { Message = "A journal entry must contain at least two lines." });
        }

        var effectiveReference = request.Reference?.Trim();

        if (string.IsNullOrWhiteSpace(effectiveReference))
        {
            var activeSequence = await dbContext.JournalNumberSequences
                .FirstOrDefaultAsync(x => x.IsActive, cancellationToken);

            if (activeSequence is null)
            {
                return BadRequest(new
                {
                    Message = "Reference is required when no active journal number sequence exists."
                });
            }

            effectiveReference = activeSequence.ConsumeNextReference();
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Description is required." });
        }

        var duplicateReferenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == effectiveReference, cancellationToken);

        if (duplicateReferenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the same reference already exists for the current tenant.",
                Reference = effectiveReference
            });
        }

        var requestedLedgerAccountIds = request.Lines.Select(x => x.LedgerAccountId).Distinct().ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedLedgerAccountIds.Count)
        {
            return BadRequest(new
            {
                Message = "One or more ledger accounts were not found for the current tenant."
            });
        }

        foreach (var line in request.Lines)
        {
            var ledgerAccount = ledgerAccounts[line.LedgerAccountId];

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return BadRequest(new
                {
                    Message = "All journal lines must use active, non-header, posting-enabled ledger accounts.",
                    line.LedgerAccountId,
                    ledgerAccount.Code
                });
            }
        }

        try
        {
            var journalEntry = new JournalEntry(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.EntryDateUtc,
                effectiveReference,
                request.Description.Trim(),
                JournalEntryStatus.Draft,
                JournalEntryType.Normal,
                request.Lines.Select(x => new JournalEntryLine(
                    Guid.NewGuid(),
                    x.LedgerAccountId,
                    x.Description,
                    x.DebitAmount,
                    x.CreditAmount)));

            dbContext.JournalEntries.Add(journalEntry);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Journal entry created successfully.",
                journalEntry.Id,
                journalEntry.TenantId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                journalEntry.Description,
                journalEntry.Status,
                journalEntry.Type,
                journalEntry.PostingRequiresApproval,
                journalEntry.SubmittedBy,
                journalEntry.SubmittedOnUtc,
                journalEntry.ApprovedBy,
                journalEntry.ApprovedOnUtc,
                journalEntry.RejectedBy,
                journalEntry.RejectedOnUtc,
                journalEntry.RejectionReason,
                journalEntry.PostedAtUtc,
                journalEntry.ReversedAtUtc,
                journalEntry.ReversalJournalEntryId,
                journalEntry.ReversedJournalEntryId,
                journalEntry.TotalDebit,
                journalEntry.TotalCredit,
                LineCount = journalEntry.Lines.Count
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpGet("journal-entries")]
    public async Task<IActionResult> GetJournalEntries(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.JournalEntries
            .AsNoTracking()
            .Include(x => x.Lines)
            .OrderByDescending(x => x.EntryDateUtc)
            .ThenBy(x => x.Reference)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.EntryDateUtc,
                x.Reference,
                x.Description,
                x.Status,
                x.Type,
                x.PostingRequiresApproval,
                x.SubmittedBy,
                x.SubmittedOnUtc,
                x.ApprovedBy,
                x.ApprovedOnUtc,
                x.RejectedBy,
                x.RejectedOnUtc,
                x.RejectionReason,
                x.PostedAtUtc,
                x.ReversedAtUtc,
                x.ReversalJournalEntryId,
                x.ReversedJournalEntryId,
                TotalDebit = x.Lines.Sum(line => line.DebitAmount),
                TotalCredit = x.Lines.Sum(line => line.CreditAmount),
                LineCount = x.Lines.Count,
                Lines = x.Lines.Select(line => new
                {
                    line.Id,
                    line.LedgerAccountId,
                    line.Description,
                    line.DebitAmount,
                    line.CreditAmount
                })
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

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsCreate)]
    [HttpPost("journal-entries/{journalEntryId:guid}/submit")]
    public async Task<IActionResult> SubmitJournalEntryForApproval(
        Guid journalEntryId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        try
        {
            journalEntry.SubmitForApproval(EnsureAuthenticatedUserId(currentUserService));
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Journal entry submitted for approval successfully.",
                journalEntry.Id,
                journalEntry.Reference,
                journalEntry.Status,
                journalEntry.Type,
                journalEntry.SubmittedBy,
                journalEntry.SubmittedOnUtc
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsPost)]
    [HttpPost("journal-entries/{journalEntryId:guid}/approve")]
    public async Task<IActionResult> ApproveJournalEntry(
        Guid journalEntryId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        try
        {
            journalEntry.Approve(EnsureAuthenticatedUserId(currentUserService));
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Journal entry approved successfully.",
                journalEntry.Id,
                journalEntry.Reference,
                journalEntry.Status,
                journalEntry.Type,
                journalEntry.ApprovedBy,
                journalEntry.ApprovedOnUtc
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsPost)]
    [HttpPost("journal-entries/{journalEntryId:guid}/reject")]
    public async Task<IActionResult> RejectJournalEntry(
        Guid journalEntryId,
        [FromBody] RejectJournalEntryRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { Message = "Rejection reason is required." });
        }

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        try
        {
            journalEntry.Reject(EnsureAuthenticatedUserId(currentUserService), request.Reason);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Journal entry rejected successfully.",
                journalEntry.Id,
                journalEntry.Reference,
                journalEntry.Status,
                journalEntry.Type,
                journalEntry.RejectedBy,
                journalEntry.RejectedOnUtc,
                journalEntry.RejectionReason
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsPost)]
    [HttpPost("journal-entries/{journalEntryId:guid}/post")]
    public async Task<IActionResult> PostJournalEntry(
        Guid journalEntryId,
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

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        var requiredPostingStatus = journalEntry.PostingRequiresApproval
            ? JournalEntryStatus.Approved
            : JournalEntryStatus.Draft;

        if (journalEntry.Status != requiredPostingStatus)
        {
            return Conflict(new
            {
                Message = journalEntry.PostingRequiresApproval
                    ? "Only approved journal entries can be posted."
                    : "Only draft journal entries can be posted.",
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, journalEntry.EntryDateUtc, cancellationToken);

        if (postingPeriod is null)
        {
            return Conflict(new
            {
                Message = "No open fiscal period exists for the journal entry posting date.",
                PostingDateUtc = journalEntry.EntryDateUtc
            });
        }

        var existingMovementCount = await dbContext.LedgerMovements
            .AsNoTracking()
            .CountAsync(x => x.JournalEntryId == journalEntryId, cancellationToken);

        if (existingMovementCount > 0)
        {
            return Conflict(new
            {
                Message = "Ledger movements already exist for this journal entry.",
                JournalEntryId = journalEntryId
            });
        }

        var lineLedgerAccountIds = journalEntry.Lines.Select(x => x.LedgerAccountId).Distinct().ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .Where(x => lineLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var line in journalEntry.Lines)
        {
            var ledgerAccount = ledgerAccounts[line.LedgerAccountId];

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return BadRequest(new
                {
                    Message = "All journal lines must use active, non-header, posting-enabled ledger accounts during posting.",
                    line.LedgerAccountId,
                    ledgerAccount.Code
                });
            }
        }

        var postedAtUtc = DateTime.UtcNow;

        var movements = journalEntry.Lines
            .Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount))
            .ToList();

        journalEntry.MarkPosted(postedAtUtc);
        dbContext.LedgerMovements.AddRange(movements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Journal entry posted successfully.",
            journalEntry.Id,
            journalEntry.Reference,
            journalEntry.Status,
            journalEntry.Type,
            journalEntry.PostedAtUtc,
            journalEntry.PostingRequiresApproval,
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name,
            MovementCount = movements.Count,
            TotalDebit = journalEntry.TotalDebit,
            TotalCredit = journalEntry.TotalCredit
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsCreate)]
    [HttpPost("journal-entries/{journalEntryId:guid}/void")]
    public async Task<IActionResult> VoidJournalEntry(
        Guid journalEntryId,
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

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        if (journalEntry.Status != JournalEntryStatus.Draft && journalEntry.Status != JournalEntryStatus.Rejected)
        {
            return Conflict(new
            {
                Message = "Only draft or rejected journal entries can be voided.",
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }

        journalEntry.MarkVoided();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Journal entry voided successfully.",
            journalEntry.Id,
            journalEntry.Reference,
            journalEntry.Status,
            journalEntry.Type
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceJournalsReverse)]
    [HttpPost("journal-entries/{journalEntryId:guid}/reverse")]
    public async Task<IActionResult> ReverseJournalEntry(
        Guid journalEntryId,
        [FromBody] ReverseJournalEntryRequest request,
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

        if (string.IsNullOrWhiteSpace(request.Reference))
        {
            return BadRequest(new { Message = "Reference is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { Message = "Description is required." });
        }

        var reversalPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.ReversalDateUtc, cancellationToken);

        if (reversalPeriod is null)
        {
            return Conflict(new
            {
                Message = "No open fiscal period exists for the requested reversal date.",
                ReversalDateUtc = request.ReversalDateUtc
            });
        }

        var journalEntry = await dbContext.JournalEntries
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == journalEntryId, cancellationToken);

        if (journalEntry is null)
        {
            return NotFound(new
            {
                Message = "Journal entry was not found for the current tenant.",
                JournalEntryId = journalEntryId
            });
        }

        if (journalEntry.Status != JournalEntryStatus.Posted)
        {
            return Conflict(new
            {
                Message = "Only posted journal entries can be reversed.",
                JournalEntryId = journalEntryId,
                journalEntry.Status
            });
        }

        if (journalEntry.ReversalJournalEntryId.HasValue)
        {
            return Conflict(new
            {
                Message = "This journal entry has already been reversed.",
                JournalEntryId = journalEntryId,
                journalEntry.ReversalJournalEntryId
            });
        }

        var normalizedReference = request.Reference.Trim();

        var referenceExists = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == normalizedReference, cancellationToken);

        if (referenceExists)
        {
            return Conflict(new
            {
                Message = "A journal entry with the same reference already exists for the current tenant.",
                Reference = normalizedReference
            });
        }

        var lineLedgerAccountIds = journalEntry.Lines.Select(x => x.LedgerAccountId).Distinct().ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .Where(x => lineLedgerAccountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var line in journalEntry.Lines)
        {
            var ledgerAccount = ledgerAccounts[line.LedgerAccountId];

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return BadRequest(new
                {
                    Message = "All reversal lines must use active, non-header, posting-enabled ledger accounts.",
                    line.LedgerAccountId,
                    ledgerAccount.Code
                });
            }
        }

        var reversalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.ReversalDateUtc,
            normalizedReference,
            request.Description.Trim(),
            JournalEntryStatus.Draft,
            JournalEntryType.Reversal,
            journalEntry.Lines.Select(line => new JournalEntryLine(
                Guid.NewGuid(),
                line.LedgerAccountId,
                $"Reversal - {line.Description}",
                line.CreditAmount,
                line.DebitAmount)),
            journalEntry.Id,
            postingRequiresApproval: false);

        var postedAtUtc = DateTime.UtcNow;
        reversalEntry.MarkPosted(postedAtUtc);

        var reversalMovements = reversalEntry.Lines
            .Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                reversalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                reversalEntry.EntryDateUtc,
                reversalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount))
            .ToList();

        journalEntry.MarkReversed(reversalEntry.Id, postedAtUtc);

        dbContext.JournalEntries.Add(reversalEntry);
        dbContext.LedgerMovements.AddRange(reversalMovements);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Journal entry reversed successfully.",
            OriginalJournalEntryId = journalEntry.Id,
            OriginalReference = journalEntry.Reference,
            OriginalStatus = journalEntry.Status,
            OriginalType = journalEntry.Type,
            OriginalReversedAtUtc = journalEntry.ReversedAtUtc,
            OriginalReversalJournalEntryId = journalEntry.ReversalJournalEntryId,
            ReversalJournalEntryId = reversalEntry.Id,
            ReversalReference = reversalEntry.Reference,
            ReversalStatus = reversalEntry.Status,
            ReversalType = reversalEntry.Type,
            ReversalPostedAtUtc = reversalEntry.PostedAtUtc,
            FiscalPeriodId = reversalPeriod.Id,
            FiscalPeriodName = reversalPeriod.Name,
            MovementCount = reversalMovements.Count,
            TotalDebit = reversalEntry.TotalDebit,
            TotalCredit = reversalEntry.TotalCredit
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceView)]
    [HttpGet("ledger-movements")]
    public async Task<IActionResult> GetLedgerMovements(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var items = await dbContext.LedgerMovements
            .AsNoTracking()
            .OrderByDescending(x => x.MovementDateUtc)
            .ThenBy(x => x.Reference)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.JournalEntryId,
                x.JournalEntryLineId,
                x.LedgerAccountId,
                x.MovementDateUtc,
                x.Reference,
                x.Description,
                x.DebitAmount,
                x.CreditAmount
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

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("trial-balance")]
    public async Task<IActionResult> GetTrialBalance(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        IQueryable<LedgerMovement> movementQuery = dbContext.LedgerMovements.AsNoTracking();

        if (fromUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc <= toUtc.Value);
        }

        var movementRows = await movementQuery
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                movement => movement.LedgerAccountId,
                account => account.Id,
                (movement, account) => new
                {
                    account.Id,
                    account.Code,
                    account.Name,
                    account.Category,
                    account.NormalBalance,
                    movement.DebitAmount,
                    movement.CreditAmount
                })
            .ToListAsync(cancellationToken);

        var items = movementRows
            .GroupBy(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Category,
                x.NormalBalance
            })
            .Select(group =>
            {
                var totalDebit = group.Sum(x => x.DebitAmount);
                var totalCredit = group.Sum(x => x.CreditAmount);
                var net = group.Key.NormalBalance == AccountNature.Debit
                    ? totalDebit - totalCredit
                    : totalCredit - totalDebit;

                return new
                {
                    LedgerAccountId = group.Key.Id,
                    group.Key.Code,
                    group.Key.Name,
                    group.Key.Category,
                    group.Key.NormalBalance,
                    TotalDebit = totalDebit,
                    TotalCredit = totalCredit,
                    BalanceDebit = net > 0m ? net : 0m,
                    BalanceCredit = net < 0m ? Math.Abs(net) : 0m
                };
            })
            .OrderBy(x => x.Code)
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            Count = items.Count,
            TotalDebit = items.Sum(x => x.TotalDebit),
            TotalCredit = items.Sum(x => x.TotalCredit),
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reports/balance-sheet")]
    public async Task<IActionResult> GetBalanceSheet(
        [FromQuery] DateTime? asOfUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        var effectiveAsOfUtc = asOfUtc ?? DateTime.UtcNow;

        var rows = await dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => x.MovementDateUtc <= effectiveAsOfUtc)
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                movement => movement.LedgerAccountId,
                account => account.Id,
                (movement, account) => new
                {
                    account.Id,
                    account.Code,
                    account.Name,
                    account.Category,
                    account.NormalBalance,
                    movement.DebitAmount,
                    movement.CreditAmount
                })
            .ToListAsync(cancellationToken);

        var grouped = rows
            .GroupBy(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Category,
                x.NormalBalance
            })
            .Select(group =>
            {
                var totalDebit = group.Sum(x => x.DebitAmount);
                var totalCredit = group.Sum(x => x.CreditAmount);
                var net = group.Key.NormalBalance == AccountNature.Debit
                    ? totalDebit - totalCredit
                    : totalCredit - totalDebit;

                return new
                {
                    LedgerAccountId = group.Key.Id,
                    group.Key.Code,
                    group.Key.Name,
                    group.Key.Category,
                    group.Key.NormalBalance,
                    TotalDebit = totalDebit,
                    TotalCredit = totalCredit,
                    NetAmount = net
                };
            })
            .Where(x =>
                x.Category == AccountCategory.Asset ||
                x.Category == AccountCategory.Liability ||
                x.Category == AccountCategory.Equity)
            .OrderBy(x => x.Code)
            .ToList();

        var assets = grouped
            .Where(x => x.Category == AccountCategory.Asset)
            .Select(x => new
            {
                x.LedgerAccountId,
                x.Code,
                x.Name,
                x.TotalDebit,
                x.TotalCredit,
                Balance = x.NetAmount
            })
            .ToList();

        var liabilities = grouped
            .Where(x => x.Category == AccountCategory.Liability)
            .Select(x => new
            {
                x.LedgerAccountId,
                x.Code,
                x.Name,
                x.TotalDebit,
                x.TotalCredit,
                Balance = x.NetAmount
            })
            .ToList();

        var equity = grouped
            .Where(x => x.Category == AccountCategory.Equity)
            .Select(x => new
            {
                x.LedgerAccountId,
                x.Code,
                x.Name,
                x.TotalDebit,
                x.TotalCredit,
                Balance = x.NetAmount
            })
            .ToList();

        var totalAssets = assets.Sum(x => x.Balance);
        var totalLiabilities = liabilities.Sum(x => x.Balance);
        var totalEquity = equity.Sum(x => x.Balance);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            AsOfUtc = effectiveAsOfUtc,
            TotalAssets = totalAssets,
            TotalLiabilities = totalLiabilities,
            TotalEquity = totalEquity,
            TotalLiabilitiesAndEquity = totalLiabilities + totalEquity,
            Assets = assets,
            Liabilities = liabilities,
            Equity = equity
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reports/income-statement")]
    public async Task<IActionResult> GetIncomeStatement(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        IQueryable<LedgerMovement> movementQuery = dbContext.LedgerMovements.AsNoTracking();

        if (fromUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc <= toUtc.Value);
        }

        var rows = await movementQuery
            .Join(
                dbContext.LedgerAccounts.AsNoTracking(),
                movement => movement.LedgerAccountId,
                account => account.Id,
                (movement, account) => new
                {
                    account.Id,
                    account.Code,
                    account.Name,
                    account.Category,
                    account.NormalBalance,
                    movement.DebitAmount,
                    movement.CreditAmount
                })
            .ToListAsync(cancellationToken);

        var grouped = rows
            .GroupBy(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Category,
                x.NormalBalance
            })
            .Select(group =>
            {
                var totalDebit = group.Sum(x => x.DebitAmount);
                var totalCredit = group.Sum(x => x.CreditAmount);

                decimal amount = group.Key.Category switch
                {
                    AccountCategory.Income => totalCredit - totalDebit,
                    AccountCategory.Expense => totalDebit - totalCredit,
                    _ => 0m
                };

                return new
                {
                    LedgerAccountId = group.Key.Id,
                    group.Key.Code,
                    group.Key.Name,
                    group.Key.Category,
                    TotalDebit = totalDebit,
                    TotalCredit = totalCredit,
                    Amount = amount
                };
            })
            .Where(x => x.Category == AccountCategory.Income || x.Category == AccountCategory.Expense)
            .OrderBy(x => x.Code)
            .ToList();

        var income = grouped
            .Where(x => x.Category == AccountCategory.Income)
            .Select(x => new
            {
                x.LedgerAccountId,
                x.Code,
                x.Name,
                x.TotalDebit,
                x.TotalCredit,
                x.Amount
            })
            .ToList();

        var expenses = grouped
            .Where(x => x.Category == AccountCategory.Expense)
            .Select(x => new
            {
                x.LedgerAccountId,
                x.Code,
                x.Name,
                x.TotalDebit,
                x.TotalCredit,
                x.Amount
            })
            .ToList();

        var totalIncome = income.Sum(x => x.Amount);
        var totalExpenses = expenses.Sum(x => x.Amount);
        var netIncome = totalIncome - totalExpenses;

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            TotalIncome = totalIncome,
            TotalExpenses = totalExpenses,
            NetIncome = netIncome,
            Income = income,
            Expenses = expenses
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reports/cashbook")]
    public async Task<IActionResult> GetCashbook(
        [FromQuery] Guid? ledgerAccountId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var cashAndBankAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => x.IsCashOrBankAccount && x.IsActive && !x.IsHeader && x.IsPostingAllowed)
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Category,
                x.NormalBalance,
                x.IsCashOrBankAccount
            })
            .ToListAsync(cancellationToken);

        if (!ledgerAccountId.HasValue)
        {
            return Ok(new
            {
                TenantContextAvailable = tenantContext.IsAvailable,
                TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
                TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
                FromUtc = fromUtc,
                ToUtc = toUtc,
                CashOrBankAccounts = cashAndBankAccounts,
                SelectedLedgerAccount = (object?)null,
                OpeningBalanceDebit = 0m,
                OpeningBalanceCredit = 0m,
                TotalDebit = 0m,
                TotalCredit = 0m,
                ClosingBalanceDebit = 0m,
                ClosingBalanceCredit = 0m,
                Count = 0,
                Items = Array.Empty<object>()
            });
        }

        var selectedLedgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == ledgerAccountId.Value, cancellationToken);

        if (selectedLedgerAccount is null)
        {
            return NotFound(new
            {
                Message = "Ledger account was not found for the current tenant.",
                LedgerAccountId = ledgerAccountId
            });
        }

        if (!selectedLedgerAccount.IsCashOrBankAccount || selectedLedgerAccount.IsHeader || !selectedLedgerAccount.IsPostingAllowed || !selectedLedgerAccount.IsActive)
        {
            return BadRequest(new
            {
                Message = "Selected ledger account is not an active posting cash or bank account.",
                LedgerAccountId = ledgerAccountId
            });
        }

        var openingRowsQuery = dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => x.LedgerAccountId == ledgerAccountId.Value);

        if (fromUtc.HasValue)
        {
            openingRowsQuery = openingRowsQuery.Where(x => x.MovementDateUtc < fromUtc.Value);
        }
        else
        {
            openingRowsQuery = openingRowsQuery.Where(x => false);
        }

        var openingRows = await openingRowsQuery
            .Select(x => new { x.DebitAmount, x.CreditAmount })
            .ToListAsync(cancellationToken);

        var runningBalance = 0m;

        foreach (var openingRow in openingRows)
        {
            runningBalance += selectedLedgerAccount.NormalBalance == AccountNature.Debit
                ? openingRow.DebitAmount - openingRow.CreditAmount
                : openingRow.CreditAmount - openingRow.DebitAmount;
        }

        var movementQuery = dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => x.LedgerAccountId == ledgerAccountId.Value);

        if (fromUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc <= toUtc.Value);
        }

        var movementRows = await movementQuery
            .OrderBy(x => x.MovementDateUtc)
            .ThenBy(x => x.Reference)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.JournalEntryId,
                x.JournalEntryLineId,
                x.MovementDateUtc,
                x.Reference,
                x.Description,
                x.DebitAmount,
                x.CreditAmount
            })
            .ToListAsync(cancellationToken);

        var openingBalanceDebit = runningBalance > 0m ? runningBalance : 0m;
        var openingBalanceCredit = runningBalance < 0m ? Math.Abs(runningBalance) : 0m;

        var items = movementRows
            .Select(row =>
            {
                runningBalance += selectedLedgerAccount.NormalBalance == AccountNature.Debit
                    ? row.DebitAmount - row.CreditAmount
                    : row.CreditAmount - row.DebitAmount;

                return new
                {
                    row.Id,
                    row.JournalEntryId,
                    row.JournalEntryLineId,
                    row.MovementDateUtc,
                    row.Reference,
                    row.Description,
                    row.DebitAmount,
                    row.CreditAmount,
                    RunningBalanceDebit = runningBalance > 0m ? runningBalance : 0m,
                    RunningBalanceCredit = runningBalance < 0m ? Math.Abs(runningBalance) : 0m
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            CashOrBankAccounts = cashAndBankAccounts,
            SelectedLedgerAccount = new
            {
                selectedLedgerAccount.Id,
                selectedLedgerAccount.Code,
                selectedLedgerAccount.Name,
                selectedLedgerAccount.Category,
                selectedLedgerAccount.NormalBalance,
                selectedLedgerAccount.IsHeader,
                selectedLedgerAccount.IsPostingAllowed,
                selectedLedgerAccount.IsActive,
                selectedLedgerAccount.IsCashOrBankAccount
            },
            OpeningBalanceDebit = openingBalanceDebit,
            OpeningBalanceCredit = openingBalanceCredit,
            TotalDebit = movementRows.Sum(x => x.DebitAmount),
            TotalCredit = movementRows.Sum(x => x.CreditAmount),
            ClosingBalanceDebit = runningBalance > 0m ? runningBalance : 0m,
            ClosingBalanceCredit = runningBalance < 0m ? Math.Abs(runningBalance) : 0m,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("reconciliations")]
    public async Task<IActionResult> CreateBankReconciliation(
        [FromBody] CreateBankReconciliationRequest request,
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

        if (request.LedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Ledger account id is required." });
        }

        if (request.StatementToUtc < request.StatementFromUtc)
        {
            return BadRequest(new { Message = "Statement end date cannot be earlier than statement start date." });
        }

        var ledgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.LedgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return NotFound(new
            {
                Message = "Ledger account was not found for the current tenant.",
                request.LedgerAccountId
            });
        }

        if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed || !ledgerAccount.IsCashOrBankAccount)
        {
            return BadRequest(new
            {
                Message = "Selected ledger account must be an active posting cash or bank account.",
                request.LedgerAccountId,
                ledgerAccount.Code
            });
        }

        var duplicateExists = await dbContext.BankReconciliations
            .AsNoTracking()
            .AnyAsync(
                x => x.LedgerAccountId == request.LedgerAccountId &&
                     x.StatementFromUtc == request.StatementFromUtc &&
                     x.StatementToUtc == request.StatementToUtc,
                cancellationToken);

        if (duplicateExists)
        {
            return Conflict(new
            {
                Message = "A reconciliation already exists for this treasury account and statement period.",
                request.LedgerAccountId,
                request.StatementFromUtc,
                request.StatementToUtc
            });
        }

        var openingMovementsQuery = dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => x.LedgerAccountId == request.LedgerAccountId && x.MovementDateUtc < request.StatementFromUtc);

        var openingMovements = await openingMovementsQuery
            .Select(x => new
            {
                x.DebitAmount,
                x.CreditAmount
            })
            .ToListAsync(cancellationToken);

        var periodMovements = await dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x =>
                x.LedgerAccountId == request.LedgerAccountId &&
                x.MovementDateUtc >= request.StatementFromUtc &&
                x.MovementDateUtc <= request.StatementToUtc)
            .OrderBy(x => x.MovementDateUtc)
            .ThenBy(x => x.Reference)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.JournalEntryId,
                x.JournalEntryLineId,
                x.MovementDateUtc,
                x.Reference,
                x.Description,
                x.DebitAmount,
                x.CreditAmount
            })
            .ToListAsync(cancellationToken);

        var openingNet = ledgerAccount.NormalBalance == AccountNature.Debit
            ? openingMovements.Sum(x => x.DebitAmount) - openingMovements.Sum(x => x.CreditAmount)
            : openingMovements.Sum(x => x.CreditAmount) - openingMovements.Sum(x => x.DebitAmount);

        var periodNet = ledgerAccount.NormalBalance == AccountNature.Debit
            ? periodMovements.Sum(x => x.DebitAmount) - periodMovements.Sum(x => x.CreditAmount)
            : periodMovements.Sum(x => x.CreditAmount) - periodMovements.Sum(x => x.DebitAmount);

        var bookClosingBalance = openingNet + periodNet;

        var reconciliation = new BankReconciliation(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.LedgerAccountId,
            request.StatementFromUtc,
            request.StatementToUtc,
            request.StatementClosingBalance,
            bookClosingBalance,
            request.Notes);

        var lines = periodMovements
            .Select(x => new BankReconciliationLine(
                Guid.NewGuid(),
                reconciliation.Id,
                x.Id,
                isReconciled: false))
            .ToList();

        dbContext.BankReconciliations.Add(reconciliation);
        dbContext.BankReconciliationLines.AddRange(lines);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Bank reconciliation draft created successfully.",
            reconciliation.Id,
            reconciliation.TenantId,
            reconciliation.LedgerAccountId,
            LedgerAccountCode = ledgerAccount.Code,
            LedgerAccountName = ledgerAccount.Name,
            reconciliation.StatementFromUtc,
            reconciliation.StatementToUtc,
            reconciliation.StatementClosingBalance,
            reconciliation.BookClosingBalance,
            DifferenceAmount = reconciliation.DifferenceAmount,
            reconciliation.Status,
            reconciliation.Notes,
            LineCount = lines.Count
        });
    }


    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reports/cashbook-summary")]
    public async Task<IActionResult> GetCashbookSummary(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var treasuryAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x =>
                x.IsCashOrBankAccount &&
                x.IsActive &&
                !x.IsHeader &&
                x.IsPostingAllowed)
            .OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Category,
                x.NormalBalance,
                x.IsCashOrBankAccount
            })
            .ToListAsync(cancellationToken);

        var treasuryAccountIds = treasuryAccounts
            .Select(x => x.Id)
            .ToList();

        if (treasuryAccountIds.Count == 0)
        {
            return Ok(new
            {
                TenantContextAvailable = tenantContext.IsAvailable,
                TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
                TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
                FromUtc = fromUtc,
                ToUtc = toUtc,
                Count = 0,
                TotalOpeningBalanceDebit = 0m,
                TotalOpeningBalanceCredit = 0m,
                TotalPeriodDebit = 0m,
                TotalPeriodCredit = 0m,
                TotalClosingBalanceDebit = 0m,
                TotalClosingBalanceCredit = 0m,
                Items = Array.Empty<object>()
            });
        }

        var openingMovementsQuery = dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => treasuryAccountIds.Contains(x.LedgerAccountId));

        if (fromUtc.HasValue)
        {
            openingMovementsQuery = openingMovementsQuery.Where(x => x.MovementDateUtc < fromUtc.Value);
        }
        else
        {
            openingMovementsQuery = openingMovementsQuery.Where(x => false);
        }

        var openingMovements = await openingMovementsQuery
            .Select(x => new
            {
                x.LedgerAccountId,
                x.DebitAmount,
                x.CreditAmount
            })
            .ToListAsync(cancellationToken);

        var periodMovementsQuery = dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => treasuryAccountIds.Contains(x.LedgerAccountId));

        if (fromUtc.HasValue)
        {
            periodMovementsQuery = periodMovementsQuery.Where(x => x.MovementDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            periodMovementsQuery = periodMovementsQuery.Where(x => x.MovementDateUtc <= toUtc.Value);
        }

        var periodMovements = await periodMovementsQuery
            .Select(x => new
            {
                x.LedgerAccountId,
                x.DebitAmount,
                x.CreditAmount
            })
            .ToListAsync(cancellationToken);

        var items = treasuryAccounts
            .Select(account =>
            {
                var openingRows = openingMovements.Where(x => x.LedgerAccountId == account.Id).ToList();
                var periodRows = periodMovements.Where(x => x.LedgerAccountId == account.Id).ToList();

                var openingNet = account.NormalBalance == AccountNature.Debit
                    ? openingRows.Sum(x => x.DebitAmount) - openingRows.Sum(x => x.CreditAmount)
                    : openingRows.Sum(x => x.CreditAmount) - openingRows.Sum(x => x.DebitAmount);

                var openingBalanceDebit = openingNet > 0m ? openingNet : 0m;
                var openingBalanceCredit = openingNet < 0m ? Math.Abs(openingNet) : 0m;

                var periodDebit = periodRows.Sum(x => x.DebitAmount);
                var periodCredit = periodRows.Sum(x => x.CreditAmount);

                var closingNet = account.NormalBalance == AccountNature.Debit
                    ? (openingRows.Sum(x => x.DebitAmount) + periodRows.Sum(x => x.DebitAmount))
                        - (openingRows.Sum(x => x.CreditAmount) + periodRows.Sum(x => x.CreditAmount))
                    : (openingRows.Sum(x => x.CreditAmount) + periodRows.Sum(x => x.CreditAmount))
                        - (openingRows.Sum(x => x.DebitAmount) + periodRows.Sum(x => x.DebitAmount));

                var closingBalanceDebit = closingNet > 0m ? closingNet : 0m;
                var closingBalanceCredit = closingNet < 0m ? Math.Abs(closingNet) : 0m;

                return new
                {
                    LedgerAccountId = account.Id,
                    account.Code,
                    account.Name,
                    account.Category,
                    account.NormalBalance,
                    OpeningBalanceDebit = openingBalanceDebit,
                    OpeningBalanceCredit = openingBalanceCredit,
                    PeriodDebit = periodDebit,
                    PeriodCredit = periodCredit,
                    ClosingBalanceDebit = closingBalanceDebit,
                    ClosingBalanceCredit = closingBalanceCredit
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            FromUtc = fromUtc,
            ToUtc = toUtc,
            Count = items.Count,
            TotalOpeningBalanceDebit = items.Sum(x => x.OpeningBalanceDebit),
            TotalOpeningBalanceCredit = items.Sum(x => x.OpeningBalanceCredit),
            TotalPeriodDebit = items.Sum(x => x.PeriodDebit),
            TotalPeriodCredit = items.Sum(x => x.PeriodCredit),
            TotalClosingBalanceDebit = items.Sum(x => x.ClosingBalanceDebit),
            TotalClosingBalanceCredit = items.Sum(x => x.ClosingBalanceCredit),
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reconciliations")]
    public async Task<IActionResult> GetBankReconciliations(
        [FromQuery] Guid? ledgerAccountId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        IQueryable<BankReconciliation> query = dbContext.BankReconciliations
            .AsNoTracking();

        if (ledgerAccountId.HasValue)
        {
            query = query.Where(x => x.LedgerAccountId == ledgerAccountId.Value);
        }

        var items = await query
            .OrderByDescending(x => x.StatementToUtc)
            .ThenByDescending(x => x.StatementFromUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.LedgerAccountId,
                LedgerAccountCode = x.LedgerAccount != null ? x.LedgerAccount.Code : null,
                LedgerAccountName = x.LedgerAccount != null ? x.LedgerAccount.Name : null,
                x.StatementFromUtc,
                x.StatementToUtc,
                x.StatementClosingBalance,
                x.BookClosingBalance,
                DifferenceAmount = x.StatementClosingBalance - x.BookClosingBalance,
                x.Status,
                x.Notes,
                x.CompletedOnUtc,
                x.CancelledOnUtc
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


        [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("reconciliations/{bankReconciliationId:guid}")]
    public async Task<IActionResult> GetBankReconciliationDetail(
        Guid bankReconciliationId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var reconciliation = await dbContext.BankReconciliations
            .AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.LedgerAccount)
            .FirstOrDefaultAsync(x => x.Id == bankReconciliationId, cancellationToken);

        if (reconciliation is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId
            });
        }

        var movementIds = reconciliation.Lines
            .Select(x => x.LedgerMovementId)
            .Distinct()
            .ToList();

        var movements = await dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => movementIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.JournalEntryId,
                x.JournalEntryLineId,
                x.LedgerAccountId,
                x.MovementDateUtc,
                x.Reference,
                x.Description,
                x.DebitAmount,
                x.CreditAmount
            })
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var items = reconciliation.Lines
            .OrderBy(x => movements.ContainsKey(x.LedgerMovementId) ? movements[x.LedgerMovementId].MovementDateUtc : DateTime.MaxValue)
            .ThenBy(x => movements.ContainsKey(x.LedgerMovementId) ? movements[x.LedgerMovementId].Reference : string.Empty)
            .Select(x =>
            {
                var movement = movements[x.LedgerMovementId];

                return new
                {
                    x.Id,
                    x.BankReconciliationId,
                    x.LedgerMovementId,
                    x.IsReconciled,
                    x.Notes,
                    movement.JournalEntryId,
                    movement.JournalEntryLineId,
                    movement.MovementDateUtc,
                    movement.Reference,
                    movement.Description,
                    movement.DebitAmount,
                    movement.CreditAmount
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Reconciliation = new
            {
                reconciliation.Id,
                reconciliation.TenantId,
                reconciliation.LedgerAccountId,
                LedgerAccountCode = reconciliation.LedgerAccount != null ? reconciliation.LedgerAccount.Code : null,
                LedgerAccountName = reconciliation.LedgerAccount != null ? reconciliation.LedgerAccount.Name : null,
                reconciliation.StatementFromUtc,
                reconciliation.StatementToUtc,
                reconciliation.StatementClosingBalance,
                reconciliation.BookClosingBalance,
                DifferenceAmount = reconciliation.DifferenceAmount,
                reconciliation.Status,
                reconciliation.Notes,
                reconciliation.CompletedOnUtc,
                reconciliation.CancelledOnUtc
            },
            Count = items.Count,
            ReconciledCount = items.Count(x => x.IsReconciled),
            UnreconciledCount = items.Count(x => !x.IsReconciled),
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("reconciliations/{bankReconciliationId:guid}/lines/{bankReconciliationLineId:guid}/set-reconciled")]
    public async Task<IActionResult> SetBankReconciliationLineReconciledState(
        Guid bankReconciliationId,
        Guid bankReconciliationLineId,
        [FromBody] SetBankReconciliationLineReconciledStateRequest request,
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

        var reconciliation = await dbContext.BankReconciliations
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == bankReconciliationId, cancellationToken);

        if (reconciliation is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId
            });
        }

        if (reconciliation.Status != BankReconciliationStatus.Draft)
        {
            return Conflict(new
            {
                Message = "Only draft bank reconciliations can be modified.",
                BankReconciliationId = bankReconciliationId,
                reconciliation.Status
            });
        }

        var line = reconciliation.Lines.FirstOrDefault(x => x.Id == bankReconciliationLineId);

        if (line is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation line was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId,
                BankReconciliationLineId = bankReconciliationLineId
            });
        }

        if (request.IsReconciled)
        {
            line.MarkAsReconciled();
        }
        else
        {
            line.MarkAsUnreconciled();
        }

        line.SetNotes(request.Notes);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Bank reconciliation line updated successfully.",
            line.Id,
            line.BankReconciliationId,
            line.LedgerMovementId,
            line.IsReconciled,
            line.Notes
        });
    }


    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("reconciliations/{bankReconciliationId:guid}/complete")]
    public async Task<IActionResult> CompleteBankReconciliation(
        Guid bankReconciliationId,
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

        var reconciliation = await dbContext.BankReconciliations
            .FirstOrDefaultAsync(x => x.Id == bankReconciliationId, cancellationToken);

        if (reconciliation is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId
            });
        }

        try
        {
            reconciliation.Complete(DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Bank reconciliation completed successfully.",
                reconciliation.Id,
                reconciliation.LedgerAccountId,
                reconciliation.StatementFromUtc,
                reconciliation.StatementToUtc,
                reconciliation.StatementClosingBalance,
                reconciliation.BookClosingBalance,
                DifferenceAmount = reconciliation.DifferenceAmount,
                reconciliation.Status,
                reconciliation.CompletedOnUtc
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                BankReconciliationId = bankReconciliationId,
                reconciliation.Status
            });
        }
    }


        [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("reconciliations/{bankReconciliationId:guid}/cancel")]
    public async Task<IActionResult> CancelBankReconciliation(
        Guid bankReconciliationId,
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

        var reconciliation = await dbContext.BankReconciliations
            .FirstOrDefaultAsync(x => x.Id == bankReconciliationId, cancellationToken);

        if (reconciliation is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId
            });
        }

        try
        {
            reconciliation.Cancel(DateTime.UtcNow);
            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Bank reconciliation cancelled successfully.",
                reconciliation.Id,
                reconciliation.LedgerAccountId,
                reconciliation.StatementFromUtc,
                reconciliation.StatementToUtc,
                reconciliation.StatementClosingBalance,
                reconciliation.BookClosingBalance,
                DifferenceAmount = reconciliation.DifferenceAmount,
                reconciliation.Status,
                reconciliation.CancelledOnUtc
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new
            {
                Message = ex.Message,
                BankReconciliationId = bankReconciliationId,
                reconciliation.Status
            });
        }
    }


    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("bank-statements/imports/upload")]
    public async Task<IActionResult> UploadBankStatementImport(
        [FromBody] UploadBankStatementImportRequest request,
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

        if (request.LedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Ledger account id is required." });
        }

        if (request.StatementToUtc < request.StatementFromUtc)
        {
            return BadRequest(new { Message = "Statement end date cannot be earlier than statement start date." });
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            return BadRequest(new { Message = "At least one bank statement line is required." });
        }

        var ledgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.LedgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return NotFound(new
            {
                Message = "Ledger account was not found for the current tenant.",
                request.LedgerAccountId
            });
        }

        if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed || !ledgerAccount.IsCashOrBankAccount)
        {
            return BadRequest(new
            {
                Message = "Selected ledger account must be an active posting cash or bank account.",
                request.LedgerAccountId,
                ledgerAccount.Code
            });
        }

        var effectiveSourceReference = string.IsNullOrWhiteSpace(request.SourceReference)
            ? $"UPLOAD-{DateTime.UtcNow:yyyyMMddHHmmss}"
            : request.SourceReference.Trim();

        var duplicateExists = await dbContext.BankStatementImports
            .AsNoTracking()
            .AnyAsync(
                x => x.LedgerAccountId == request.LedgerAccountId &&
                     x.StatementFromUtc == request.StatementFromUtc &&
                     x.StatementToUtc == request.StatementToUtc &&
                     x.SourceReference == effectiveSourceReference,
                cancellationToken);

        if (duplicateExists)
        {
            return Conflict(new
            {
                Message = "A bank statement import with the same account, statement period, and source reference already exists.",
                request.LedgerAccountId,
                request.StatementFromUtc,
                request.StatementToUtc,
                SourceReference = effectiveSourceReference
            });
        }

        try
        {
            var bankStatementImport = new BankStatementImport(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.LedgerAccountId,
                request.StatementFromUtc,
                request.StatementToUtc,
                BankStatementSourceType.Upload,
                effectiveSourceReference,
                request.FileName,
                request.Notes);

            var lines = request.Lines.Select(x => new BankStatementImportLine(
                Guid.NewGuid(),
                bankStatementImport.Id,
                x.TransactionDateUtc,
                x.Reference,
                x.Description,
                x.DebitAmount,
                x.CreditAmount,
                x.Balance,
                x.ValueDateUtc,
                x.ExternalReference)).ToList();

            dbContext.BankStatementImports.Add(bankStatementImport);
            dbContext.BankStatementImportLines.AddRange(lines);

            await dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                Message = "Bank statement upload import created successfully.",
                bankStatementImport.Id,
                bankStatementImport.TenantId,
                bankStatementImport.LedgerAccountId,
                LedgerAccountCode = ledgerAccount.Code,
                LedgerAccountName = ledgerAccount.Name,
                bankStatementImport.StatementFromUtc,
                bankStatementImport.StatementToUtc,
                bankStatementImport.SourceType,
                bankStatementImport.SourceReference,
                bankStatementImport.FileName,
                bankStatementImport.Notes,
                bankStatementImport.ImportedOnUtc,
                LineCount = lines.Count
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("bank-statements/imports/api-placeholder")]
    public async Task<IActionResult> CreateApiPlaceholderBankStatementImport(
        [FromBody] CreateApiPlaceholderBankStatementImportRequest request,
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

        if (request.LedgerAccountId == Guid.Empty)
        {
            return BadRequest(new { Message = "Ledger account id is required." });
        }

        if (request.StatementToUtc < request.StatementFromUtc)
        {
            return BadRequest(new { Message = "Statement end date cannot be earlier than statement start date." });
        }

        if (string.IsNullOrWhiteSpace(request.SourceReference))
        {
            return BadRequest(new { Message = "Source reference is required for API placeholder imports." });
        }

        var ledgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.LedgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return NotFound(new
            {
                Message = "Ledger account was not found for the current tenant.",
                request.LedgerAccountId
            });
        }

        if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed || !ledgerAccount.IsCashOrBankAccount)
        {
            return BadRequest(new
            {
                Message = "Selected ledger account must be an active posting cash or bank account.",
                request.LedgerAccountId,
                ledgerAccount.Code
            });
        }

        var normalizedSourceReference = request.SourceReference.Trim();

        var duplicateExists = await dbContext.BankStatementImports
            .AsNoTracking()
            .AnyAsync(
                x => x.LedgerAccountId == request.LedgerAccountId &&
                     x.StatementFromUtc == request.StatementFromUtc &&
                     x.StatementToUtc == request.StatementToUtc &&
                     x.SourceReference == normalizedSourceReference,
                cancellationToken);

        if (duplicateExists)
        {
            return Conflict(new
            {
                Message = "A bank statement import with the same account, statement period, and source reference already exists.",
                request.LedgerAccountId,
                request.StatementFromUtc,
                request.StatementToUtc,
                SourceReference = normalizedSourceReference
            });
        }

        var bankStatementImport = new BankStatementImport(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.LedgerAccountId,
            request.StatementFromUtc,
            request.StatementToUtc,
            BankStatementSourceType.ApiFeed,
            normalizedSourceReference,
            fileName: null,
            request.Notes);

        dbContext.BankStatementImports.Add(bankStatementImport);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Bank statement API placeholder import created successfully.",
            bankStatementImport.Id,
            bankStatementImport.TenantId,
            bankStatementImport.LedgerAccountId,
            LedgerAccountCode = ledgerAccount.Code,
            LedgerAccountName = ledgerAccount.Name,
            bankStatementImport.StatementFromUtc,
            bankStatementImport.StatementToUtc,
            bankStatementImport.SourceType,
            bankStatementImport.SourceReference,
            bankStatementImport.FileName,
            bankStatementImport.Notes,
            bankStatementImport.ImportedOnUtc,
            LineCount = 0
        });
    }


        [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("bank-statements/imports")]
    public async Task<IActionResult> GetBankStatementImports(
        [FromQuery] Guid? ledgerAccountId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        IQueryable<BankStatementImport> query = dbContext.BankStatementImports
            .AsNoTracking();

        if (ledgerAccountId.HasValue)
        {
            query = query.Where(x => x.LedgerAccountId == ledgerAccountId.Value);
        }

        var items = await query
            .OrderByDescending(x => x.StatementToUtc)
            .ThenByDescending(x => x.ImportedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.LedgerAccountId,
                LedgerAccountCode = x.LedgerAccount != null ? x.LedgerAccount.Code : null,
                LedgerAccountName = x.LedgerAccount != null ? x.LedgerAccount.Name : null,
                x.StatementFromUtc,
                x.StatementToUtc,
                x.SourceType,
                x.SourceReference,
                x.FileName,
                x.Notes,
                x.ImportedOnUtc,
                LineCount = x.Lines.Count
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



        [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("bank-statements/imports/{bankStatementImportId:guid}")]
    public async Task<IActionResult> GetBankStatementImportDetail(
        Guid bankStatementImportId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var bankStatementImport = await dbContext.BankStatementImports
            .AsNoTracking()
            .Include(x => x.LedgerAccount)
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == bankStatementImportId, cancellationToken);

        if (bankStatementImport is null)
        {
            return NotFound(new
            {
                Message = "Bank statement import was not found for the current tenant.",
                BankStatementImportId = bankStatementImportId
            });
        }

               var matches = await dbContext.BankReconciliationMatches
            .AsNoTracking()
            .Where(x => bankStatementImport.Lines.Select(line => line.Id).Contains(x.BankStatementImportLineId))
            .Select(x => new
            {
                x.Id,
                x.BankReconciliationId,
                x.BankReconciliationLineId,
                x.BankStatementImportLineId,
                x.MatchedOnUtc,
                x.Notes
            })
            .ToListAsync(cancellationToken);

        var matchByStatementLineId = matches
            .GroupBy(x => x.BankStatementImportLineId)
            .ToDictionary(x => x.Key, x => x.First());

        var items = bankStatementImport.Lines
            .OrderBy(x => x.TransactionDateUtc)
            .ThenBy(x => x.Reference)
            .Select(x =>
            {
                var match = matchByStatementLineId.TryGetValue(x.Id, out var foundMatch)
                    ? foundMatch
                    : null;

                return new
                {
                    x.Id,
                    x.BankStatementImportId,
                    x.TransactionDateUtc,
                    x.ValueDateUtc,
                    x.Reference,
                    x.Description,
                    x.DebitAmount,
                    x.CreditAmount,
                    x.Balance,
                    x.ExternalReference,
                    Match = match is null
                        ? null
                        : new
                        {
                            match.Id,
                            match.BankReconciliationId,
                            match.BankReconciliationLineId,
                            match.BankStatementImportLineId,
                            match.MatchedOnUtc,
                            match.Notes
                        }
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            BankStatementImport = new
            {
                bankStatementImport.Id,
                bankStatementImport.TenantId,
                bankStatementImport.LedgerAccountId,
                LedgerAccountCode = bankStatementImport.LedgerAccount != null ? bankStatementImport.LedgerAccount.Code : null,
                LedgerAccountName = bankStatementImport.LedgerAccount != null ? bankStatementImport.LedgerAccount.Name : null,
                bankStatementImport.StatementFromUtc,
                bankStatementImport.StatementToUtc,
                bankStatementImport.SourceType,
                bankStatementImport.SourceReference,
                bankStatementImport.FileName,
                bankStatementImport.Notes,
                bankStatementImport.ImportedOnUtc
            },
            MatchCount = matches.Count,
            Count = items.Count,
            TotalDebit = items.Sum(x => x.DebitAmount),
            TotalCredit = items.Sum(x => x.CreditAmount),
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("reconciliations/{bankReconciliationId:guid}/matches")]
    public async Task<IActionResult> CreateBankReconciliationMatch(
        Guid bankReconciliationId,
        [FromBody] CreateBankReconciliationMatchRequest request,
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

        if (request.BankReconciliationLineId == Guid.Empty)
        {
            return BadRequest(new { Message = "Bank reconciliation line id is required." });
        }

        if (request.BankStatementImportLineId == Guid.Empty)
        {
            return BadRequest(new { Message = "Bank statement import line id is required." });
        }

        var reconciliation = await dbContext.BankReconciliations
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == bankReconciliationId, cancellationToken);

        if (reconciliation is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId
            });
        }

        if (reconciliation.Status != BankReconciliationStatus.Draft)
        {
            return Conflict(new
            {
                Message = "Only draft bank reconciliations can be modified.",
                BankReconciliationId = bankReconciliationId,
                reconciliation.Status
            });
        }

        var reconciliationLine = reconciliation.Lines
            .FirstOrDefault(x => x.Id == request.BankReconciliationLineId);

        if (reconciliationLine is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation line was not found for the current tenant.",
                request.BankReconciliationLineId
            });
        }

        var statementLine = await dbContext.BankStatementImportLines
            .AsNoTracking()
            .Include(x => x.BankStatementImport)
            .FirstOrDefaultAsync(x => x.Id == request.BankStatementImportLineId, cancellationToken);

        if (statementLine is null)
        {
            return NotFound(new
            {
                Message = "Bank statement import line was not found for the current tenant.",
                request.BankStatementImportLineId
            });
        }

        if (statementLine.BankStatementImport is null)
        {
            return Conflict(new
            {
                Message = "Bank statement import line is missing its parent import.",
                request.BankStatementImportLineId
            });
        }

        if (statementLine.BankStatementImport.LedgerAccountId != reconciliation.LedgerAccountId)
        {
            return Conflict(new
            {
                Message = "Statement line treasury account does not match the reconciliation treasury account.",
                ReconciliationLedgerAccountId = reconciliation.LedgerAccountId,
                StatementLedgerAccountId = statementLine.BankStatementImport.LedgerAccountId
            });
        }

        if (statementLine.TransactionDateUtc < reconciliation.StatementFromUtc ||
            statementLine.TransactionDateUtc > reconciliation.StatementToUtc)
        {
            return Conflict(new
            {
                Message = "Statement line date is outside the reconciliation statement period.",
                statementLine.TransactionDateUtc,
                reconciliation.StatementFromUtc,
                reconciliation.StatementToUtc
            });
        }

        var reconciliationLineAlreadyMatched = await dbContext.BankReconciliationMatches
            .AsNoTracking()
            .AnyAsync(
                x => x.BankReconciliationId == bankReconciliationId &&
                     x.BankReconciliationLineId == request.BankReconciliationLineId,
                cancellationToken);

        if (reconciliationLineAlreadyMatched)
        {
            return Conflict(new
            {
                Message = "This reconciliation line has already been matched in the current reconciliation.",
                request.BankReconciliationLineId
            });
        }

        var statementLineAlreadyMatched = await dbContext.BankReconciliationMatches
            .AsNoTracking()
            .AnyAsync(
                x => x.BankReconciliationId == bankReconciliationId &&
                     x.BankStatementImportLineId == request.BankStatementImportLineId,
                cancellationToken);

        if (statementLineAlreadyMatched)
        {
            return Conflict(new
            {
                Message = "This bank statement line has already been matched in the current reconciliation.",
                request.BankStatementImportLineId
            });
        }

        var match = new BankReconciliationMatch(
            Guid.NewGuid(),
            bankReconciliationId,
            request.BankReconciliationLineId,
            request.BankStatementImportLineId,
            request.Notes);

        dbContext.BankReconciliationMatches.Add(match);
        reconciliationLine.MarkAsReconciled();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Bank reconciliation match created successfully.",
            match.Id,
            match.BankReconciliationId,
            match.BankReconciliationLineId,
            match.BankStatementImportLineId,
            match.MatchedOnUtc,
            match.Notes
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpPost("reconciliations/{bankReconciliationId:guid}/matches/{bankReconciliationMatchId:guid}/remove")]
    public async Task<IActionResult> RemoveBankReconciliationMatch(
        Guid bankReconciliationId,
        Guid bankReconciliationMatchId,
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

        var reconciliation = await dbContext.BankReconciliations
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == bankReconciliationId, cancellationToken);

        if (reconciliation is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId
            });
        }

        if (reconciliation.Status != BankReconciliationStatus.Draft)
        {
            return Conflict(new
            {
                Message = "Only draft bank reconciliations can be modified.",
                BankReconciliationId = bankReconciliationId,
                reconciliation.Status
            });
        }

        var match = await dbContext.BankReconciliationMatches
            .FirstOrDefaultAsync(
                x => x.Id == bankReconciliationMatchId &&
                     x.BankReconciliationId == bankReconciliationId,
                cancellationToken);

        if (match is null)
        {
            return NotFound(new
            {
                Message = "Bank reconciliation match was not found for the current tenant.",
                BankReconciliationId = bankReconciliationId,
                BankReconciliationMatchId = bankReconciliationMatchId
            });
        }

        var reconciliationLine = reconciliation.Lines
            .FirstOrDefault(x => x.Id == match.BankReconciliationLineId);

        dbContext.BankReconciliationMatches.Remove(match);

        if (reconciliationLine is not null)
        {
            reconciliationLine.MarkAsUnreconciled();
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Bank reconciliation match removed successfully.",
            BankReconciliationId = bankReconciliationId,
            BankReconciliationMatchId = bankReconciliationMatchId,
            BankReconciliationLineId = match.BankReconciliationLineId,
            BankStatementImportLineId = match.BankStatementImportLineId
        });
    }


    [Authorize(Policy = AuthorizationPolicies.FinanceReportsView)]
    [HttpGet("accounts/{ledgerAccountId:guid}/ledger")]
    public async Task<IActionResult> GetLedgerAccountStatement(
        Guid ledgerAccountId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var ledgerAccount = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == ledgerAccountId, cancellationToken);

        if (ledgerAccount is null)
        {
            return NotFound(new
            {
                Message = "Ledger account was not found for the current tenant.",
                LedgerAccountId = ledgerAccountId
            });
        }

        IQueryable<LedgerMovement> movementQuery = dbContext.LedgerMovements
            .AsNoTracking()
            .Where(x => x.LedgerAccountId == ledgerAccountId);

        if (fromUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            movementQuery = movementQuery.Where(x => x.MovementDateUtc <= toUtc.Value);
        }

        var movementRows = await movementQuery
            .OrderBy(x => x.MovementDateUtc)
            .ThenBy(x => x.Reference)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.JournalEntryId,
                x.JournalEntryLineId,
                x.MovementDateUtc,
                x.Reference,
                x.Description,
                x.DebitAmount,
                x.CreditAmount
            })
            .ToListAsync(cancellationToken);

        var runningBalance = 0m;

        var items = movementRows
            .Select(row =>
            {
                runningBalance += ledgerAccount.NormalBalance == AccountNature.Debit
                    ? row.DebitAmount - row.CreditAmount
                    : row.CreditAmount - row.DebitAmount;

                return new
                {
                    row.Id,
                    row.JournalEntryId,
                    row.JournalEntryLineId,
                    row.MovementDateUtc,
                    row.Reference,
                    row.Description,
                    row.DebitAmount,
                    row.CreditAmount,
                    RunningBalanceDebit = runningBalance > 0m ? runningBalance : 0m,
                    RunningBalanceCredit = runningBalance < 0m ? Math.Abs(runningBalance) : 0m
                };
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            LedgerAccount = new
            {
                ledgerAccount.Id,
                ledgerAccount.Code,
                ledgerAccount.Name,
                ledgerAccount.Category,
                ledgerAccount.NormalBalance,
                ledgerAccount.IsHeader,
                ledgerAccount.IsPostingAllowed,
                ledgerAccount.IsActive,
                ledgerAccount.IsCashOrBankAccount
            },
            FromUtc = fromUtc,
            ToUtc = toUtc,
            Count = items.Count,
            TotalDebit = movementRows.Sum(x => x.DebitAmount),
            TotalCredit = movementRows.Sum(x => x.CreditAmount),
            ClosingBalanceDebit = runningBalance > 0m ? runningBalance : 0m,
            ClosingBalanceCredit = runningBalance < 0m ? Math.Abs(runningBalance) : 0m,
            Items = items
        });
    }

    private static async Task<FiscalPeriod?> GetOpenFiscalPeriodForDateAsync(
        ApplicationDbContext dbContext,
        DateTime dateUtc,
        CancellationToken cancellationToken)
    {
        var postingDate = DateOnly.FromDateTime(dateUtc.Date);

        return await dbContext.FiscalPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Status == FiscalPeriodStatus.Open &&
                     x.StartDate <= postingDate &&
                     x.EndDate >= postingDate,
                cancellationToken);
    }

    private static string EnsureAuthenticatedUserId(ICurrentUserService currentUserService)
    {
        if (string.IsNullOrWhiteSpace(currentUserService.UserId))
        {
            throw new InvalidOperationException("Authenticated user context is required.");
        }

        return currentUserService.UserId.Trim();
    }

    public sealed record CreateOpeningBalanceRequest(
        DateTime EntryDateUtc,
        string? Reference,
        string Description,
        IReadOnlyCollection<CreateJournalEntryLineRequest> Lines);

    public sealed record CreateJournalNumberSequenceRequest(
        string Prefix,
        int NextNumber,
        int Padding,
        bool IsActive);

    public sealed record CreateFiscalPeriodRequest(
        string Name,
        DateOnly StartDate,
        DateOnly EndDate,
        bool IsOpen);

    public sealed record CreateLedgerAccountRequest(
        string Code,
        string Name,
        AccountCategory Category,
        AccountNature NormalBalance,
        bool IsHeader,
        bool IsPostingAllowed,
        Guid? ParentLedgerAccountId,
        string? Purpose,
        bool IsCashOrBankAccount);

    public sealed record UpdateLedgerAccountRequest(
        string Name,
        string? Purpose,
        bool IsActive,
        bool IsCashOrBankAccount);

    public sealed record CreateTaxCodeRequest(
        string Code,
        string Name,
        string? Description,
        TaxComponentKind ComponentKind,
        TaxApplicationMode ApplicationMode,
        TaxTransactionScope TransactionScope,
        decimal RatePercent,
        Guid TaxLedgerAccountId,
        bool IsActive,
        DateTime EffectiveFromUtc,
        DateTime? EffectiveToUtc);


    public sealed record PreviewTaxCalculationRequest(
        DateTime TransactionDateUtc,
        TaxTransactionScope TransactionScope,
        decimal TaxableAmount,
        IReadOnlyCollection<Guid> TaxCodeIds);

    public sealed record CreateBankReconciliationRequest(
        Guid LedgerAccountId,
        DateTime StatementFromUtc,
        DateTime StatementToUtc,
        decimal StatementClosingBalance,
        string? Notes);

    public sealed record SetBankReconciliationLineReconciledStateRequest(
        bool IsReconciled,
        string? Notes);


        public sealed record UploadBankStatementImportRequest(
        Guid LedgerAccountId,
        DateTime StatementFromUtc,
        DateTime StatementToUtc,
        string? SourceReference,
        string? FileName,
        string? Notes,
        IReadOnlyCollection<UploadBankStatementImportLineRequest> Lines);

    public sealed record UploadBankStatementImportLineRequest(
        DateTime TransactionDateUtc,
        DateTime? ValueDateUtc,
        string Reference,
        string Description,
        decimal DebitAmount,
        decimal CreditAmount,
        decimal? Balance,
        string? ExternalReference);

    public sealed record CreateApiPlaceholderBankStatementImportRequest(
        Guid LedgerAccountId,
        DateTime StatementFromUtc,
        DateTime StatementToUtc,
        string SourceReference,
        string? Notes);

    public sealed record CreateBankReconciliationMatchRequest(
        Guid BankReconciliationLineId,
        Guid BankStatementImportLineId,
        string? Notes);

    public sealed record CreateJournalEntryRequest(
        DateTime EntryDateUtc,
        string? Reference,
        string Description,
        IReadOnlyCollection<CreateJournalEntryLineRequest> Lines);

    public sealed record UpdateJournalEntryRequest(
        DateTime EntryDateUtc,
        string Reference,
        string Description,
        IReadOnlyCollection<CreateJournalEntryLineRequest> Lines);

    public sealed record CreateJournalEntryLineRequest(
        Guid LedgerAccountId,
        string Description,
        decimal DebitAmount,
        decimal CreditAmount);

    public sealed record ReverseJournalEntryRequest(
        DateTime ReversalDateUtc,
        string Reference,
        string Description);

    public sealed record RejectJournalEntryRequest(
        string Reason);
}