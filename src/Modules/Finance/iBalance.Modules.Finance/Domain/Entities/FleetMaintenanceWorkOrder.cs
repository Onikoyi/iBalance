using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public class FleetMaintenanceWorkOrder
{
    private FleetMaintenanceWorkOrder() { }

    public FleetMaintenanceWorkOrder(
        Guid id,
        Guid tenantId,
        string workOrderNumber,
        Guid vehicleId,
        DateTime workOrderDateUtc,
        string issueDescription,
        decimal estimatedAmount,
        Guid expenseLedgerAccountId,
        Guid offsetLedgerAccountId,
        string? workshopVendorName,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(workOrderNumber))
        {
            throw new ArgumentException("Work order number is required.", nameof(workOrderNumber));
        }

        if (string.IsNullOrWhiteSpace(issueDescription))
        {
            throw new ArgumentException("Issue description is required.", nameof(issueDescription));
        }

        Id = id;
        TenantId = tenantId;
        WorkOrderNumber = workOrderNumber.Trim().ToUpperInvariant();
        VehicleId = vehicleId;
        WorkOrderDateUtc = workOrderDateUtc;
        IssueDescription = issueDescription.Trim();
        EstimatedAmount = estimatedAmount;
        ExpenseLedgerAccountId = expenseLedgerAccountId;
        OffsetLedgerAccountId = offsetLedgerAccountId;
        WorkshopVendorName = string.IsNullOrWhiteSpace(workshopVendorName) ? null : workshopVendorName.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = FleetPostingStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string WorkOrderNumber { get; private set; } = string.Empty;
    public Guid VehicleId { get; private set; }
    public DateTime WorkOrderDateUtc { get; private set; }
    public string IssueDescription { get; private set; } = string.Empty;
    public decimal EstimatedAmount { get; private set; }
    public decimal? ActualAmount { get; private set; }
    public Guid ExpenseLedgerAccountId { get; private set; }
    public Guid OffsetLedgerAccountId { get; private set; }
    public Guid? JournalEntryId { get; private set; }
    public string? WorkshopVendorName { get; private set; }
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
    public DateTime? LastModifiedOnUtc { get; private set; }

    public void Update(
        string issueDescription,
        decimal estimatedAmount,
        decimal? actualAmount,
        string? workshopVendorName,
        string? notes)
    {
        if (Status != FleetPostingStatus.Draft && Status != FleetPostingStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected work orders can be edited.");
        }

        IssueDescription = issueDescription.Trim();
        EstimatedAmount = estimatedAmount;
        ActualAmount = actualAmount;
        WorkshopVendorName = string.IsNullOrWhiteSpace(workshopVendorName) ? null : workshopVendorName.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public decimal ResolvePostingAmount()
    {
        return ActualAmount.GetValueOrDefault() > 0m ? ActualAmount!.Value : EstimatedAmount;
    }

    public void Submit(string submittedBy)
    {
        if (Status != FleetPostingStatus.Draft && Status != FleetPostingStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected work orders can be submitted.");
        }

        SubmittedBy = submittedBy;
        SubmittedOnUtc = DateTime.UtcNow;
        Status = FleetPostingStatus.Submitted;
    }

    public void Approve(string approvedBy)
    {
        if (Status != FleetPostingStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted work orders can be approved.");
        }

        ApprovedBy = approvedBy;
        ApprovedOnUtc = DateTime.UtcNow;
        Status = FleetPostingStatus.Approved;
    }

    public void Reject(string rejectedBy, string reason)
    {
        if (Status != FleetPostingStatus.Submitted)
        {
            throw new InvalidOperationException("Only submitted work orders can be rejected.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Rejection reason is required.", nameof(reason));
        }

        RejectedBy = rejectedBy;
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        Status = FleetPostingStatus.Rejected;
    }

    public void MarkPosted(Guid journalEntryId)
    {
        if (Status != FleetPostingStatus.Approved)
        {
            throw new InvalidOperationException("Only approved work orders can be posted.");
        }

        JournalEntryId = journalEntryId;
        Status = FleetPostingStatus.Posted;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
