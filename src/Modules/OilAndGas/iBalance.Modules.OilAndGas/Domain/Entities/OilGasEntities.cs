using iBalance.Modules.OilAndGas.Domain.Enums;

namespace iBalance.Modules.OilAndGas.Domain.Entities;

public sealed class OilGasBusinessUnit
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasAsset
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid BusinessUnitId { get; set; }
    public OilGasBusinessUnit? BusinessUnit { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public OilGasAssetType AssetType { get; set; }
    public string? OperatorName { get; set; }
    public decimal OwnershipPercentage { get; set; } = 100m;
    public Guid? OrganizationCostCenterId { get; set; }
    public string? LocationDescription { get; set; }
    public DateTime? CommissioningDateUtc { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasLocation
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid? ParentLocationId { get; set; }
    public OilGasLocation? ParentLocation { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public OilGasLocationType LocationType { get; set; }
    public string? Coordinates { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasProduct
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public OilGasProductCategory Category { get; set; }
    public string UnitOfMeasure { get; set; } = "";
    public decimal? StandardDensity { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasTank
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public Guid ProductId { get; set; }
    public OilGasProduct? Product { get; set; }
    public string TankCode { get; set; } = "";
    public string TankName { get; set; } = "";
    public decimal NominalCapacity { get; set; }
    public decimal SafeWorkingCapacity { get; set; }
    public decimal CurrentBookStock { get; set; }
    public OilGasTankStatus Status { get; set; } = OilGasTankStatus.Active;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasMeter
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public Guid ProductId { get; set; }
    public OilGasProduct? Product { get; set; }
    public string MeterCode { get; set; } = "";
    public string MeterName { get; set; } = "";
    public string MeterType { get; set; } = "";
    public string? SerialNumber { get; set; }
    public DateTime? LastCalibrationDateUtc { get; set; }
    public DateTime? NextCalibrationDateUtc { get; set; }
    public OilGasMeterStatus Status { get; set; } = OilGasMeterStatus.Active;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasPermit
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid? AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid? LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public string PermitNumber { get; set; } = "";
    public string PermitType { get; set; } = "";
    public string IssuingAuthority { get; set; } = "";
    public DateTime EffectiveDateUtc { get; set; }
    public DateTime ExpiryDateUtc { get; set; }
    public OilGasPermitStatus Status { get; set; } = OilGasPermitStatus.Active;
    public string? ResponsibleOfficer { get; set; }
    public string? Notes { get; set; }
    public string? PreviousPermitNumber { get; set; }
    public DateTime? RenewalSubmittedOnUtc { get; set; }
    public DateTime? RenewalApprovedOnUtc { get; set; }
    public DateTime? RenewalDateUtc { get; set; }
    public decimal? RenewalCost { get; set; }
    public string? RenewalReference { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasPostingSetup
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid InventoryAssetLedgerAccountId { get; set; }
    public Guid ProductionRevenueLedgerAccountId { get; set; }
    public Guid ProductionLossExpenseLedgerAccountId { get; set; }
    public Guid GasFlareExpenseLedgerAccountId { get; set; }
    public Guid? ProductionCostLedgerAccountId { get; set; }
    public string? Notes { get; set; }
    public DateTime UpdatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasProductionEntry
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string EntryNumber { get; set; } = "";
    public DateTime ProductionDateUtc { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public Guid ProductId { get; set; }
    public OilGasProduct? Product { get; set; }
    public Guid? MeterId { get; set; }
    public OilGasMeter? Meter { get; set; }
    public decimal GrossOilVolume { get; set; }
    public decimal NetOilVolume { get; set; }
    public decimal GasProducedVolume { get; set; }
    public decimal GasFlaredVolume { get; set; }
    public decimal WaterProducedVolume { get; set; }
    public decimal OpeningStockVolume { get; set; }
    public decimal ClosingStockVolume { get; set; }
    public decimal LossAdjustmentVolume { get; set; }
    public decimal DowntimeHours { get; set; }
    public string? DowntimeReason { get; set; }
    public decimal? MeterReading { get; set; }
    public string? Notes { get; set; }
    public OilGasProductionStatus Status { get; set; } = OilGasProductionStatus.Draft;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedOnUtc { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedOnUtc { get; set; }
    public string? RejectedBy { get; set; }
    public DateTime? RejectedOnUtc { get; set; }
    public string? RejectionReason { get; set; }
}

