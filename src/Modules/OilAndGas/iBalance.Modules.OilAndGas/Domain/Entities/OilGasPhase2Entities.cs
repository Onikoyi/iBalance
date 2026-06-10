using iBalance.Modules.OilAndGas.Domain.Enums;

namespace iBalance.Modules.OilAndGas.Domain.Entities;

public sealed class OilGasStockMovement
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string MovementNumber { get; set; } = "";
    public DateTime MovementDateUtc { get; set; }
    public OilGasStockMovementType MovementType { get; set; }
    public Guid AssetId { get; set; }
    public OilGasAsset? Asset { get; set; }
    public Guid LocationId { get; set; }
    public OilGasLocation? Location { get; set; }
    public Guid ProductId { get; set; }
    public OilGasProduct? Product { get; set; }
    public Guid? SourceTankId { get; set; }
    public OilGasTank? SourceTank { get; set; }
    public Guid? DestinationTankId { get; set; }
    public OilGasTank? DestinationTank { get; set; }
    public decimal Quantity { get; set; }
    public string UnitOfMeasure { get; set; } = "";
    public string Reference { get; set; } = "";
    public Guid? ProductionEntryId { get; set; }
    public Guid? CustomerId { get; set; }
    public Guid? SalesInvoiceId { get; set; }
    public Guid? BillingInvoiceId { get; set; }
    public Guid? InventoryTransactionId { get; set; }
    public OilGasTransportType TransportType { get; set; }
    public string? TransportReference { get; set; }
    public string? DestinationDescription { get; set; }
    public string? Notes { get; set; }
    public OilGasStockMovementStatus Status { get; set; } = OilGasStockMovementStatus.Draft;
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedOnUtc { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedOnUtc { get; set; }
    public string? RejectedBy { get; set; }
    public DateTime? RejectedOnUtc { get; set; }
    public string? RejectionReason { get; set; }
    public string? PostedBy { get; set; }
    public DateTime? PostedOnUtc { get; set; }
}

public sealed class OilGasMeterReading
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid MeterId { get; set; }
    public OilGasMeter? Meter { get; set; }
    public DateTime ReadingDateUtc { get; set; }
    public decimal PreviousReading { get; set; }
    public decimal CurrentReading { get; set; }
    public decimal MeasuredQuantity { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}

public sealed class OilGasMeterCalibration
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid MeterId { get; set; }
    public OilGasMeter? Meter { get; set; }
    public DateTime CalibrationDateUtc { get; set; }
    public DateTime NextCalibrationDateUtc { get; set; }
    public string CertificateReference { get; set; } = "";
    public string CalibratedBy { get; set; } = "";
    public string? Result { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedOnUtc { get; set; } = DateTime.UtcNow;
}
