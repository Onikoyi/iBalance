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
            return BadRequest(new
            {
                Message = ex.Message
            });
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
            .AnyAsync(
                x => x.Id != journalEntryId && x.Reference == normalizedReference,
                cancellationToken);

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
            return BadRequest(new
            {
                Message = "EndDate cannot be earlier than StartDate."
            });
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
            .AnyAsync(
                x => request.StartDate <= x.EndDate && request.EndDate >= x.StartDate,
                cancellationToken);

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
            return BadRequest(new
            {
                Message = "A journal entry must contain at least two lines."
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
            return BadRequest(new
            {
                Message = ex.Message
            });
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
            return BadRequest(new
            {
                Message = ex.Message
            });
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
            return BadRequest(new
            {
                Message = ex.Message
            });
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
            return BadRequest(new
            {
                Message = ex.Message
            });
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

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(
            dbContext,
            journalEntry.EntryDateUtc,
            cancellationToken);

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

        var lineLedgerAccountIds = journalEntry.Lines
            .Select(x => x.LedgerAccountId)
            .Distinct()
            .ToList();

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

        var reversalPeriod = await GetOpenFiscalPeriodForDateAsync(
            dbContext,
            request.ReversalDateUtc,
            cancellationToken);

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

        var lineLedgerAccountIds = journalEntry.Lines
            .Select(x => x.LedgerAccountId)
            .Distinct()
            .ToList();

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

        IQueryable<LedgerMovement> movementQuery = dbContext.LedgerMovements
            .AsNoTracking();

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

        IQueryable<LedgerMovement> movementQuery = dbContext.LedgerMovements
            .AsNoTracking();

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
            .Where(x =>
                x.Category == AccountCategory.Income ||
                x.Category == AccountCategory.Expense)
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
                ledgerAccount.IsActive
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
        Guid? ParentLedgerAccountId);

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