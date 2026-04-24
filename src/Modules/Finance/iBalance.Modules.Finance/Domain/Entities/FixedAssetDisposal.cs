using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FixedAssetDisposal : TenantOwnedEntity
{
    private FixedAssetDisposal()
    {
    }

    public FixedAssetDisposal(
        Guid id,
        Guid tenantId,
        Guid fixedAssetId,
        FixedAssetDisposalType disposalType,
        DateTime disposalDateUtc,
        decimal disposalProceedsAmount,
        decimal netBookValueAtDisposal,
        decimal gainOrLossAmount,
        string notes,
        Guid? journalEntryId = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Fixed asset disposal id cannot be empty.", nameof(id));
        if (fixedAssetId == Guid.Empty) throw new ArgumentException("Fixed asset id is required.", nameof(fixedAssetId));
        if (disposalProceedsAmount < 0m) throw new ArgumentException("Disposal proceeds cannot be negative.", nameof(disposalProceedsAmount));
        if (string.IsNullOrWhiteSpace(notes)) throw new ArgumentException("Disposal notes are required.", nameof(notes));

        Id = id;
        FixedAssetId = fixedAssetId;
        DisposalType = disposalType;
        DisposalDateUtc = disposalDateUtc;
        DisposalProceedsAmount = disposalProceedsAmount;
        NetBookValueAtDisposal = netBookValueAtDisposal;
        GainOrLossAmount = gainOrLossAmount;
        Notes = notes.Trim();
        JournalEntryId = journalEntryId;
    }

    public Guid Id { get; private set; }
    public Guid FixedAssetId { get; private set; }
    public FixedAssetDisposalType DisposalType { get; private set; }
    public DateTime DisposalDateUtc { get; private set; }
    public decimal DisposalProceedsAmount { get; private set; }
    public decimal NetBookValueAtDisposal { get; private set; }
    public decimal GainOrLossAmount { get; private set; }
    public string Notes { get; private set; } = string.Empty;
    public Guid? JournalEntryId { get; private set; }
}
