using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FixedAssetDepreciationRun : TenantOwnedEntity
{
    private FixedAssetDepreciationRun()
    {
    }

    public FixedAssetDepreciationRun(Guid id, Guid tenantId, DateTime periodStartUtc, DateTime periodEndUtc, DateTime runDateUtc, string description) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Fixed asset depreciation run id cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));
        if (periodEndUtc < periodStartUtc) throw new ArgumentException("Period end cannot be earlier than period start.");

        Id = id;
        PeriodStartUtc = periodStartUtc;
        PeriodEndUtc = periodEndUtc;
        RunDateUtc = runDateUtc;
        Description = description.Trim();
    }

    public Guid Id { get; private set; }
    public DateTime PeriodStartUtc { get; private set; }
    public DateTime PeriodEndUtc { get; private set; }
    public DateTime RunDateUtc { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public Guid? JournalEntryId { get; private set; }

    public void LinkJournal(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty) throw new ArgumentException("Journal entry id is required.", nameof(journalEntryId));
        JournalEntryId = journalEntryId;
    }
}
