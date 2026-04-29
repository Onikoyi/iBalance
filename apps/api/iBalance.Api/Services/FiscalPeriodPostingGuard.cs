using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Services;

public sealed record FiscalPeriodPostingGuardResult(
    bool Allowed,
    string Message,
    DateTime PostingDateUtc,
    DateOnly PostingDate,
    string SourceLabel,
    FiscalPeriod? FiscalPeriod)
{
    public object ToProblem()
    {
        return new
        {
            Message,
            PostingDateUtc,
            PostingDate,
            SourceLabel,
            FiscalPeriod = FiscalPeriod is null
                ? null
                : new
                {
                    FiscalPeriod.Id,
                    FiscalPeriod.Name,
                    FiscalPeriod.StartDate,
                    FiscalPeriod.EndDate,
                    FiscalPeriod.Status
                }
        };
    }
}

public static class FiscalPeriodPostingGuard
{
    public static async Task<FiscalPeriodPostingGuardResult> EnsureOpenPeriodAsync(
        ApplicationDbContext dbContext,
        DateTime postingDateUtc,
        string sourceLabel,
        CancellationToken cancellationToken)
    {
        var postingDate = DateOnly.FromDateTime(postingDateUtc.Date);

        var fiscalPeriod = await dbContext.FiscalPeriods
            .AsNoTracking()
            .Where(x => x.StartDate <= postingDate && x.EndDate >= postingDate)
            .OrderBy(x => x.StartDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (fiscalPeriod is null)
        {
            return new FiscalPeriodPostingGuardResult(
                false,
                "Posting is blocked because no fiscal month exists for the posting date.",
                postingDateUtc,
                postingDate,
                sourceLabel,
                null);
        }

        if (fiscalPeriod.Status != FiscalPeriodStatus.Open)
        {
            return new FiscalPeriodPostingGuardResult(
                false,
                "Posting is blocked because the fiscal month is closed.",
                postingDateUtc,
                postingDate,
                sourceLabel,
                fiscalPeriod);
        }

        return new FiscalPeriodPostingGuardResult(
            true,
            "Fiscal month is open for posting.",
            postingDateUtc,
            postingDate,
            sourceLabel,
            fiscalPeriod);
    }
}
