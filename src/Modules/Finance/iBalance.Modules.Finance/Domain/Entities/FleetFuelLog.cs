using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public class FleetFuelLog
{
    private FleetFuelLog() { }

    public FleetFuelLog(Guid id, Guid tenantId, string fuelLogNumber, Guid vehicleId, DateTime fuelDateUtc, decimal quantityLitres, decimal unitPrice, decimal odometerKm, Guid expenseLedgerAccountId, Guid offsetLedgerAccountId, string? vendorName, string? notes)
    {
        Id = id;
        TenantId = tenantId;
        FuelLogNumber = fuelLogNumber.Trim().ToUpperInvariant();
        VehicleId = vehicleId;
        FuelDateUtc = fuelDateUtc;
        QuantityLitres = quantityLitres;
        UnitPrice = unitPrice;
        OdometerKm = odometerKm;
        ExpenseLedgerAccountId = expenseLedgerAccountId;
        OffsetLedgerAccountId = offsetLedgerAccountId;
        VendorName = vendorName?.Trim();
        Notes = notes?.Trim();
        Status = FleetPostingStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string FuelLogNumber { get; private set; } = string.Empty;
    public Guid VehicleId { get; private set; }
    public DateTime FuelDateUtc { get; private set; }
    public decimal QuantityLitres { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal TotalAmount => QuantityLitres * UnitPrice;
    public decimal OdometerKm { get; private set; }
    public Guid ExpenseLedgerAccountId { get; private set; }
    public Guid OffsetLedgerAccountId { get; private set; }
    public Guid? JournalEntryId { get; private set; }
    public string? VendorName { get; private set; }
    public string? Notes { get; private set; }
    public FleetPostingStatus Status { get; private set; }
    public string? SubmittedBy { get; private set; }
    public DateTime? SubmittedOnUtc { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTime? ApprovedOnUtc { get; private set; }
    public string? RejectedBy { get; private set; }
    public DateTime? RejectedOnUtc { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Submit(string submittedBy) { SubmittedBy = submittedBy; SubmittedOnUtc = DateTime.UtcNow; Status = FleetPostingStatus.Submitted; }
    public void Approve(string approvedBy) { ApprovedBy = approvedBy; ApprovedOnUtc = DateTime.UtcNow; Status = FleetPostingStatus.Approved; }
    public void Reject(string rejectedBy, string reason) { RejectedBy = rejectedBy; RejectedOnUtc = DateTime.UtcNow; RejectionReason = reason.Trim(); Status = FleetPostingStatus.Rejected; }
    public void MarkPosted(Guid journalEntryId) { JournalEntryId = journalEntryId; Status = FleetPostingStatus.Posted; }
}