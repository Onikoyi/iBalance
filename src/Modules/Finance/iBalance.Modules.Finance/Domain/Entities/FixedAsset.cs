using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FixedAsset : TenantOwnedEntity
{
    private FixedAsset()
    {
    }

    public FixedAsset(
        Guid id,
        Guid tenantId,
        Guid fixedAssetClassId,
        string assetNumber,
        string assetName,
        string? description,
        DateTime acquisitionDateUtc,
        decimal acquisitionCost,
        decimal residualValue,
        int usefulLifeMonths,
        FixedAssetDepreciationMethod depreciationMethod,
        Guid assetCostLedgerAccountId,
        Guid accumulatedDepreciationLedgerAccountId,
        Guid depreciationExpenseLedgerAccountId,
        Guid disposalGainLossLedgerAccountId,
        Guid? vendorId = null,
        Guid? purchaseInvoiceId = null,
        string? location = null,
        string? custodian = null,
        string? serialNumber = null,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Fixed asset id cannot be empty.", nameof(id));
        if (fixedAssetClassId == Guid.Empty) throw new ArgumentException("Fixed asset class id is required.", nameof(fixedAssetClassId));
        if (string.IsNullOrWhiteSpace(assetNumber)) throw new ArgumentException("Asset number is required.", nameof(assetNumber));
        if (string.IsNullOrWhiteSpace(assetName)) throw new ArgumentException("Asset name is required.", nameof(assetName));
        if (acquisitionCost <= 0m) throw new ArgumentException("Acquisition cost must be greater than zero.", nameof(acquisitionCost));
        if (residualValue < 0m || residualValue >= acquisitionCost) throw new ArgumentException("Residual value must be zero or greater and less than acquisition cost.", nameof(residualValue));
        if (usefulLifeMonths <= 0) throw new ArgumentException("Useful life months must be greater than zero.", nameof(usefulLifeMonths));

        Id = id;
        FixedAssetClassId = fixedAssetClassId;
        AssetNumber = assetNumber.Trim().ToUpperInvariant();
        AssetName = assetName.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        AcquisitionDateUtc = acquisitionDateUtc;
        AcquisitionCost = acquisitionCost;
        ResidualValue = residualValue;
        UsefulLifeMonths = usefulLifeMonths;
        DepreciationMethod = depreciationMethod;
        AssetCostLedgerAccountId = assetCostLedgerAccountId;
        AccumulatedDepreciationLedgerAccountId = accumulatedDepreciationLedgerAccountId;
        DepreciationExpenseLedgerAccountId = depreciationExpenseLedgerAccountId;
        DisposalGainLossLedgerAccountId = disposalGainLossLedgerAccountId;
        VendorId = vendorId;
        PurchaseInvoiceId = purchaseInvoiceId;
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Custodian = string.IsNullOrWhiteSpace(custodian) ? null : custodian.Trim();
        SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = FixedAssetStatus.Draft;
    }

    public Guid Id { get; private set; }
    public Guid FixedAssetClassId { get; private set; }
    public string AssetNumber { get; private set; } = string.Empty;
    public string AssetName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DateTime AcquisitionDateUtc { get; private set; }
    public DateTime? CapitalizationDateUtc { get; private set; }
    public decimal AcquisitionCost { get; private set; }
    public decimal ResidualValue { get; private set; }
    public int UsefulLifeMonths { get; private set; }
    public FixedAssetDepreciationMethod DepreciationMethod { get; private set; }
    public decimal AccumulatedDepreciationAmount { get; private set; }
    public decimal ImpairmentAmount { get; private set; }
    public FixedAssetStatus Status { get; private set; }
    public Guid AssetCostLedgerAccountId { get; private set; }
    public Guid AccumulatedDepreciationLedgerAccountId { get; private set; }
    public Guid DepreciationExpenseLedgerAccountId { get; private set; }
    public Guid DisposalGainLossLedgerAccountId { get; private set; }
    public Guid? VendorId { get; private set; }
    public Guid? PurchaseInvoiceId { get; private set; }
    public string? Location { get; private set; }
    public string? Custodian { get; private set; }
    public string? SerialNumber { get; private set; }
    public string? Notes { get; private set; }
    public DateTime? LastDepreciationPostedOnUtc { get; private set; }
    public DateTime? DisposedOnUtc { get; private set; }
    public decimal? DisposalProceedsAmount { get; private set; }

    public decimal DepreciableBase => Math.Max(0m, AcquisitionCost - ResidualValue - ImpairmentAmount);
    public decimal NetBookValue => Math.Max(0m, AcquisitionCost - AccumulatedDepreciationAmount - ImpairmentAmount);

    public void UpdateCoreDetails(string assetName, string? description, string? location, string? custodian, string? serialNumber, string? notes)
    {
        if (Status == FixedAssetStatus.Disposed)
        {
            throw new InvalidOperationException("Disposed fixed assets cannot be edited.");
        }

        if (string.IsNullOrWhiteSpace(assetName)) throw new ArgumentException("Asset name is required.", nameof(assetName));
        AssetName = assetName.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Custodian = string.IsNullOrWhiteSpace(custodian) ? null : custodian.Trim();
        SerialNumber = string.IsNullOrWhiteSpace(serialNumber) ? null : serialNumber.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public void Capitalize(DateTime capitalizationDateUtc)
    {
        if (Status != FixedAssetStatus.Draft)
        {
            throw new InvalidOperationException("Only draft fixed assets can be capitalized.");
        }

        CapitalizationDateUtc = capitalizationDateUtc;
        Status = FixedAssetStatus.Active;
    }

    public void RecordDepreciation(decimal amount, DateTime postedOnUtc)
    {
        if (Status != FixedAssetStatus.Active && Status != FixedAssetStatus.Impaired && Status != FixedAssetStatus.Reclassified && Status != FixedAssetStatus.Transferred)
        {
            throw new InvalidOperationException("Only active fixed assets can be depreciated.");
        }

        if (amount <= 0m) throw new ArgumentException("Depreciation amount must be greater than zero.", nameof(amount));
        if (amount > NetBookValue - ResidualValue) throw new InvalidOperationException("Depreciation amount exceeds remaining depreciable amount.");

        AccumulatedDepreciationAmount += amount;
        LastDepreciationPostedOnUtc = postedOnUtc;

        if (NetBookValue <= ResidualValue)
        {
            Status = FixedAssetStatus.FullyDepreciated;
        }
    }

    public void RecordImprovement(decimal amount, int? usefulLifeMonthsOverride = null)
    {
        if (Status == FixedAssetStatus.Disposed) throw new InvalidOperationException("Disposed fixed assets cannot be improved.");
        if (amount <= 0m) throw new ArgumentException("Improvement amount must be greater than zero.", nameof(amount));

        AcquisitionCost += amount;
        if (usefulLifeMonthsOverride.HasValue && usefulLifeMonthsOverride.Value > 0)
        {
            UsefulLifeMonths = usefulLifeMonthsOverride.Value;
        }

        if (Status == FixedAssetStatus.FullyDepreciated)
        {
            Status = FixedAssetStatus.Active;
        }
    }

    public void Transfer(string? location, string? custodian)
    {
        if (Status == FixedAssetStatus.Disposed) throw new InvalidOperationException("Disposed fixed assets cannot be transferred.");
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Custodian = string.IsNullOrWhiteSpace(custodian) ? null : custodian.Trim();
        Status = FixedAssetStatus.Transferred;
    }

    public void Reclassify(Guid fixedAssetClassId)
    {
        if (Status == FixedAssetStatus.Disposed) throw new InvalidOperationException("Disposed fixed assets cannot be reclassified.");
        if (fixedAssetClassId == Guid.Empty) throw new ArgumentException("Fixed asset class id is required.", nameof(fixedAssetClassId));
        FixedAssetClassId = fixedAssetClassId;
        Status = FixedAssetStatus.Reclassified;
    }

    public void Impair(decimal amount)
    {
        if (Status == FixedAssetStatus.Disposed) throw new InvalidOperationException("Disposed fixed assets cannot be impaired.");
        if (amount <= 0m) throw new ArgumentException("Impairment amount must be greater than zero.", nameof(amount));
        if (amount >= NetBookValue) throw new InvalidOperationException("Impairment amount cannot exceed or equal the current net book value.");

        ImpairmentAmount += amount;
        Status = FixedAssetStatus.Impaired;
    }

    public void Dispose(DateTime disposedOnUtc, decimal disposalProceedsAmount)
    {
        if (Status == FixedAssetStatus.Disposed) throw new InvalidOperationException("Fixed asset has already been disposed.");
        if (disposedOnUtc == default) throw new ArgumentException("Disposed date is required.", nameof(disposedOnUtc));
        if (disposalProceedsAmount < 0m) throw new ArgumentException("Disposal proceeds amount cannot be negative.", nameof(disposalProceedsAmount));

        DisposedOnUtc = disposedOnUtc;
        DisposalProceedsAmount = disposalProceedsAmount;
        Status = FixedAssetStatus.Disposed;
    }
}
