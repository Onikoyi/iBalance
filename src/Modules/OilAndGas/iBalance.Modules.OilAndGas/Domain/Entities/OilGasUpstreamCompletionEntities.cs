using iBalance.Modules.OilAndGas.Domain.Enums;

namespace iBalance.Modules.OilAndGas.Domain.Entities;

public sealed class OilGasLifting
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string LiftingNumber { get; set; } = "";
    public string? NominationReference { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public Guid ProductId { get; set; }
    public OilGasProduct? Product { get; set; }
    public Guid SourceTankId { get; set; }
    public OilGasTank? SourceTank { get; set; }
    public Guid? CustomerId { get; set; }
    public string OfftakerName { get; set; } = "";
    public decimal PlannedQuantity { get; set; }
    public decimal ActualLoadedQuantity { get; set; }
    public decimal? DeliveredQuantity { get; set; }
    public string UnitOfMeasure { get; set; } = "";
    public DateTime PlannedLoadingDateUtc { get; set; }
    public DateTime? LoadingCompletedOnUtc { get; set; }
    public OilGasTransportType TransportType { get; set; }
    public string? VesselOrTruckReference { get; set; }
    public string? BillOfLadingNumber { get; set; }
    public decimal? UnitPrice { get; set; }
    public string CurrencyCode { get; set; } = "NGN";
    public Guid? BillingInvoiceId { get; set; }
    public Guid? SalesInvoiceId { get; set; }
    public Guid? StockMovementId { get; set; }
    public string? Destination { get; set; }
    public string? QualityCertificateReference { get; set; }
    public string? Notes { get; set; }
    public OilGasLiftingStatus Status { get; set; } = OilGasLiftingStatus.Draft;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedOnUtc { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedOnUtc { get; set; }
    public string? RejectedBy { get; set; }
    public DateTime? RejectedOnUtc { get; set; }
    public string? RejectionReason { get; set; }
    public string? CompletedBy { get; set; }
    public DateTime? CompletedOnUtc { get; set; }
}

public sealed class OilGasAfe
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string AfeNumber { get; set; } = "";
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid? LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string CostCategory { get; set; } = "";
    public Guid? BudgetId { get; set; }
    public Guid? PurchaseRequisitionId { get; set; }
    public Guid? PurchaseOrderId { get; set; }
    public Guid? PurchaseInvoiceId { get; set; }
    public Guid? FixedAssetId { get; set; }
    public Guid? OrganizationCostCenterId { get; set; }
    public decimal OriginalEstimate { get; set; }
    public decimal ApprovedAmount { get; set; }
    public decimal RevisedAmount { get; set; }
    public decimal CommittedAmount { get; set; }
    public decimal ActualExpenditure { get; set; }
    public decimal ForecastAtCompletion { get; set; }
    public DateTime RequestDateUtc { get; set; }
    public DateTime? ExpectedCompletionDateUtc { get; set; }
    public string Justification { get; set; } = "";
    public string? Notes { get; set; }
    public OilGasAfeStatus Status { get; set; } = OilGasAfeStatus.Draft;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedOnUtc { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedOnUtc { get; set; }
    public string? RejectedBy { get; set; }
    public DateTime? RejectedOnUtc { get; set; }
    public string? RejectionReason { get; set; }
    public string? ClosedBy { get; set; }
    public DateTime? ClosedOnUtc { get; set; }
}

public sealed class OilGasPartner
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string PartnerCode { get; set; } = "";
    public string PartnerName { get; set; } = "";
    public string? RegistrationNumber { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasPartnerInterest
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PartnerId { get; set; }
    public OilGasPartner? Partner { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public bool IsOperator { get; set; }
    public decimal WorkingInterestPercentage { get; set; }
    public decimal CostSharePercentage { get; set; }
    public DateTime EffectiveFromUtc { get; set; }
    public DateTime? EffectiveToUtc { get; set; }
    public string? Notes { get; set; }
}

public sealed class OilGasPartnerFunding
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid PartnerId { get; set; }
    public OilGasPartner? Partner { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid? AfeId { get; set; }
    public OilGasAfe? Afe { get; set; }
    public OilGasPartnerFundingType FundingType { get; set; }
    public string Reference { get; set; } = "";
    public DateTime TransactionDateUtc { get; set; }
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = "NGN";
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasProductionPeriod
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string PeriodCode { get; set; } = "";
    public DateTime StartDateUtc { get; set; }
    public DateTime EndDateUtc { get; set; }
    public OilGasProductionPeriodStatus Status { get; set; } = OilGasProductionPeriodStatus.Open;
    public decimal GrossOilVolume { get; set; }
    public decimal NetOilVolume { get; set; }
    public decimal GasProducedVolume { get; set; }
    public decimal GasFlaredVolume { get; set; }
    public decimal WaterProducedVolume { get; set; }
    public decimal LiftingVolume { get; set; }
    public decimal ClosingStockVolume { get; set; }
    public decimal ReconciliationVariance { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedOnUtc { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedOnUtc { get; set; }
    public string? RejectedBy { get; set; }
    public DateTime? RejectedOnUtc { get; set; }
    public string? RejectionReason { get; set; }
    public string? ClosedBy { get; set; }
    public DateTime? ClosedOnUtc { get; set; }
}

public sealed class OilGasHseIncident
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string IncidentNumber { get; set; } = "";
    public DateTime IncidentDateUtc { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid? LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public string IncidentCategory { get; set; } = "";
    public OilGasHseSeverity Severity { get; set; }
    public string Description { get; set; } = "";
    public string ImmediateAction { get; set; } = "";
    public string? RootCause { get; set; }
    public string ResponsibleOfficer { get; set; } = "";
    public DateTime? TargetClosureDateUtc { get; set; }
    public DateTime? ClosedOnUtc { get; set; }
    public OilGasHseStatus Status { get; set; } = OilGasHseStatus.Open;
    public string? EvidenceReference { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasCorrectiveAction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid IncidentId { get; set; }
    public OilGasHseIncident? Incident { get; set; }
    public string ActionDescription { get; set; } = "";
    public string ResponsibleOfficer { get; set; } = "";
    public DateTime TargetDateUtc { get; set; }
    public DateTime? CompletedOnUtc { get; set; }
    public bool IsCompleted { get; set; }
    public string? CompletionEvidenceReference { get; set; }
    public string? Notes { get; set; }
}

public sealed class OilGasEquipment
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string EquipmentNumber { get; set; } = "";
    public string EquipmentName { get; set; } = "";
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid? LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public Guid? FixedAssetId { get; set; }
    public string EquipmentCategory { get; set; } = "";
    public string? Manufacturer { get; set; }
    public string? Model { get; set; }
    public string? SerialNumber { get; set; }
    public int CriticalityLevel { get; set; }
    public DateTime? CommissioningDateUtc { get; set; }
    public DateTime? LastMaintenanceDateUtc { get; set; }
    public DateTime? NextMaintenanceDateUtc { get; set; }
    public DateTime? NextInspectionDateUtc { get; set; }
    public OilGasEquipmentStatus Status { get; set; } = OilGasEquipmentStatus.Operational;
    public string? Notes { get; set; }
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasDocumentReference
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public OilGasDocumentType DocumentType { get; set; }
    public string RelatedEntityType { get; set; } = "";
    public Guid RelatedEntityId { get; set; }
    public string DocumentReference { get; set; } = "";
    public string? FileName { get; set; }
    public DateTime? IssueDateUtc { get; set; }
    public DateTime? ExpiryDateUtc { get; set; }
    public string? Description { get; set; }
    public string RecordedBy { get; set; } = "";
    public DateTime RecordedOnUtc { get; set; } = DateTime.UtcNow;
}
