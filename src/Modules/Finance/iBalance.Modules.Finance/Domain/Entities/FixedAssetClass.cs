using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FixedAssetClass : TenantOwnedEntity
{
    private FixedAssetClass()
    {
    }

    public FixedAssetClass(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string? description,
        decimal capitalizationThreshold,
        decimal residualValuePercentDefault,
        int usefulLifeMonthsDefault,
        FixedAssetDepreciationMethod depreciationMethodDefault,
        Guid assetCostLedgerAccountId,
        Guid accumulatedDepreciationLedgerAccountId,
        Guid depreciationExpenseLedgerAccountId,
        Guid disposalGainLossLedgerAccountId,
        FixedAssetClassStatus status = FixedAssetClassStatus.Active) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Fixed asset class id cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Fixed asset class code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Fixed asset class name is required.", nameof(name));
        if (capitalizationThreshold < 0m) throw new ArgumentException("Capitalization threshold cannot be negative.", nameof(capitalizationThreshold));
        if (residualValuePercentDefault < 0m || residualValuePercentDefault > 100m) throw new ArgumentException("Residual value percent default must be between 0 and 100.", nameof(residualValuePercentDefault));
        if (usefulLifeMonthsDefault <= 0) throw new ArgumentException("Useful life months default must be greater than zero.", nameof(usefulLifeMonthsDefault));
        if (assetCostLedgerAccountId == Guid.Empty || accumulatedDepreciationLedgerAccountId == Guid.Empty || depreciationExpenseLedgerAccountId == Guid.Empty || disposalGainLossLedgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("All ledger account ids are required.");
        }

        Id = id;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        CapitalizationThreshold = capitalizationThreshold;
        ResidualValuePercentDefault = residualValuePercentDefault;
        UsefulLifeMonthsDefault = usefulLifeMonthsDefault;
        DepreciationMethodDefault = depreciationMethodDefault;
        AssetCostLedgerAccountId = assetCostLedgerAccountId;
        AccumulatedDepreciationLedgerAccountId = accumulatedDepreciationLedgerAccountId;
        DepreciationExpenseLedgerAccountId = depreciationExpenseLedgerAccountId;
        DisposalGainLossLedgerAccountId = disposalGainLossLedgerAccountId;
        Status = status;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public decimal CapitalizationThreshold { get; private set; }
    public decimal ResidualValuePercentDefault { get; private set; }
    public int UsefulLifeMonthsDefault { get; private set; }
    public FixedAssetDepreciationMethod DepreciationMethodDefault { get; private set; }
    public Guid AssetCostLedgerAccountId { get; private set; }
    public Guid AccumulatedDepreciationLedgerAccountId { get; private set; }
    public Guid DepreciationExpenseLedgerAccountId { get; private set; }
    public Guid DisposalGainLossLedgerAccountId { get; private set; }
    public FixedAssetClassStatus Status { get; private set; }

    public void Update(
        string name,
        string? description,
        decimal capitalizationThreshold,
        decimal residualValuePercentDefault,
        int usefulLifeMonthsDefault,
        FixedAssetDepreciationMethod depreciationMethodDefault,
        Guid assetCostLedgerAccountId,
        Guid accumulatedDepreciationLedgerAccountId,
        Guid depreciationExpenseLedgerAccountId,
        Guid disposalGainLossLedgerAccountId)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Fixed asset class name is required.", nameof(name));
        if (capitalizationThreshold < 0m) throw new ArgumentException("Capitalization threshold cannot be negative.", nameof(capitalizationThreshold));
        if (residualValuePercentDefault < 0m || residualValuePercentDefault > 100m) throw new ArgumentException("Residual value percent default must be between 0 and 100.", nameof(residualValuePercentDefault));
        if (usefulLifeMonthsDefault <= 0) throw new ArgumentException("Useful life months default must be greater than zero.", nameof(usefulLifeMonthsDefault));

        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        CapitalizationThreshold = capitalizationThreshold;
        ResidualValuePercentDefault = residualValuePercentDefault;
        UsefulLifeMonthsDefault = usefulLifeMonthsDefault;
        DepreciationMethodDefault = depreciationMethodDefault;
        AssetCostLedgerAccountId = assetCostLedgerAccountId;
        AccumulatedDepreciationLedgerAccountId = accumulatedDepreciationLedgerAccountId;
        DepreciationExpenseLedgerAccountId = depreciationExpenseLedgerAccountId;
        DisposalGainLossLedgerAccountId = disposalGainLossLedgerAccountId;
    }

    public void Activate() => Status = FixedAssetClassStatus.Active;
    public void Deactivate() => Status = FixedAssetClassStatus.Inactive;
}
