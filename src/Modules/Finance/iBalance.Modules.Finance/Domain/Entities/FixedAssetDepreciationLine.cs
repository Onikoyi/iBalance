using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FixedAssetDepreciationLine : TenantOwnedEntity
{
    private FixedAssetDepreciationLine()
    {
    }

    public FixedAssetDepreciationLine(
        Guid id,
        Guid tenantId,
        Guid depreciationRunId,
        Guid fixedAssetId,
        DateTime depreciationPeriodStartUtc,
        DateTime depreciationPeriodEndUtc,
        decimal depreciationAmount,
        decimal openingNetBookValue,
        decimal closingNetBookValue) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Fixed asset depreciation line id cannot be empty.", nameof(id));
        if (depreciationRunId == Guid.Empty) throw new ArgumentException("Depreciation run id is required.", nameof(depreciationRunId));
        if (fixedAssetId == Guid.Empty) throw new ArgumentException("Fixed asset id is required.", nameof(fixedAssetId));
        if (depreciationAmount < 0m) throw new ArgumentException("Depreciation amount cannot be negative.", nameof(depreciationAmount));

        Id = id;
        DepreciationRunId = depreciationRunId;
        FixedAssetId = fixedAssetId;
        DepreciationPeriodStartUtc = depreciationPeriodStartUtc;
        DepreciationPeriodEndUtc = depreciationPeriodEndUtc;
        DepreciationAmount = depreciationAmount;
        OpeningNetBookValue = openingNetBookValue;
        ClosingNetBookValue = closingNetBookValue;
    }

    public Guid Id { get; private set; }
    public Guid DepreciationRunId { get; private set; }
    public Guid FixedAssetId { get; private set; }
    public DateTime DepreciationPeriodStartUtc { get; private set; }
    public DateTime DepreciationPeriodEndUtc { get; private set; }
    public decimal DepreciationAmount { get; private set; }
    public decimal OpeningNetBookValue { get; private set; }
    public decimal ClosingNetBookValue { get; private set; }
}
