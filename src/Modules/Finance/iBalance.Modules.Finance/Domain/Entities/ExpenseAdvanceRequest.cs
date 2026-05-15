using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseAdvanceRequest : TenantOwnedEntity
{
    private ExpenseAdvanceRequest() : base(Guid.Empty) { }

    public ExpenseAdvanceRequest(Guid id, Guid tenantId, Guid advanceTypeId, Guid employeeId, string requestNumber, DateTime requestDateUtc, string purpose, decimal requestedAmount, string? department, string? branch, string? costCenter, string? destination, DateTime? expectedRetirementDateUtc, string? notes)
        : base(tenantId)
    {
        Id = id;
        AdvanceTypeId = advanceTypeId;
        EmployeeId = employeeId;
        RequestNumber = requestNumber.Trim().ToUpperInvariant();
        RequestDateUtc = requestDateUtc;
        Purpose = purpose.Trim();
        RequestedAmount = requestedAmount;
        OutstandingAmount = requestedAmount;
        Department = string.IsNullOrWhiteSpace(department) ? null : department.Trim();
        Branch = string.IsNullOrWhiteSpace(branch) ? null : branch.Trim();
        CostCenter = string.IsNullOrWhiteSpace(costCenter) ? null : costCenter.Trim();
        Destination = string.IsNullOrWhiteSpace(destination) ? null : destination.Trim();
        ExpectedRetirementDateUtc = expectedRetirementDateUtc;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = AdvanceRequestStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid AdvanceTypeId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string RequestNumber { get; private set; } = string.Empty;
    public DateTime RequestDateUtc { get; private set; }
    public string Purpose { get; private set; } = string.Empty;
    public decimal RequestedAmount { get; private set; }
    public decimal DisbursedAmount { get; private set; }
    public decimal RetiredAmount { get; private set; }
    public decimal RefundedAmount { get; private set; }
    public decimal RecoveredAmount { get; private set; }
    public decimal ReimbursedAmount { get; private set; }
    public decimal OutstandingAmount { get; private set; }
    public string? Department { get; private set; }
    public string? Branch { get; private set; }
    public string? CostCenter { get; private set; }
    public string? Destination { get; private set; }
    public DateTime? ExpectedRetirementDateUtc { get; private set; }
    public DateTime? ApprovedOnUtc { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTime? RejectedOnUtc { get; private set; }
    public string? RejectedBy { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime? DisbursedOnUtc { get; private set; }
    public string? DisbursedBy { get; private set; }
    public Guid? DisbursementJournalEntryId { get; private set; }
    public AdvanceRequestStatus Status { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }

    public void UpdateEditableDetails(Guid advanceTypeId, Guid employeeId, DateTime requestDateUtc, string purpose, decimal requestedAmount, string? department, string? branch, string? costCenter, string? destination, DateTime? expectedRetirementDateUtc, string? notes, string? modifiedBy)
    {
        if (Status != AdvanceRequestStatus.Draft && Status != AdvanceRequestStatus.Rejected)
            throw new InvalidOperationException("Only draft or rejected advance requests can be edited.");
        AdvanceTypeId = advanceTypeId;
        EmployeeId = employeeId;
        RequestDateUtc = requestDateUtc;
        Purpose = purpose.Trim();
        RequestedAmount = requestedAmount;
        OutstandingAmount = requestedAmount - RetiredAmount - RefundedAmount - RecoveredAmount + ReimbursedAmount;
        Department = string.IsNullOrWhiteSpace(department) ? null : department.Trim();
        Branch = string.IsNullOrWhiteSpace(branch) ? null : branch.Trim();
        CostCenter = string.IsNullOrWhiteSpace(costCenter) ? null : costCenter.Trim();
        Destination = string.IsNullOrWhiteSpace(destination) ? null : destination.Trim();
        ExpectedRetirementDateUtc = expectedRetirementDateUtc;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        if (Status == AdvanceRequestStatus.Rejected)
        {
            RejectedBy = null;
            RejectedOnUtc = null;
            RejectionReason = null;
            Status = AdvanceRequestStatus.Draft;
        }
        SetAudit(modifiedBy);
    }

    public void Submit(string submittedBy)
    {
        if (Status != AdvanceRequestStatus.Draft) throw new InvalidOperationException("Only draft requests can be submitted.");
        CreatedBy ??= submittedBy?.Trim();
        LastModifiedBy = submittedBy?.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
        Status = AdvanceRequestStatus.Submitted;
    }

    public void Approve(string approvedBy)
    {
        if (Status != AdvanceRequestStatus.Submitted) throw new InvalidOperationException("Only submitted requests can be approved.");
        ApprovedBy = approvedBy.Trim();
        ApprovedOnUtc = DateTime.UtcNow;
        Status = AdvanceRequestStatus.Approved;
        SetAudit(approvedBy);
    }

    public void Reject(string rejectedBy, string reason)
    {
        if (Status != AdvanceRequestStatus.Submitted) throw new InvalidOperationException("Only submitted requests can be rejected.");
        RejectedBy = rejectedBy.Trim();
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        Status = AdvanceRequestStatus.Rejected;
        SetAudit(rejectedBy);
    }

    public void MarkDisbursed(decimal amount, string disbursedBy, Guid journalEntryId, DateTime disbursedOnUtc)
    {
        if (Status != AdvanceRequestStatus.Approved) throw new InvalidOperationException("Only approved requests can be disbursed.");
        DisbursedAmount += amount;
        OutstandingAmount = DisbursedAmount - RetiredAmount - RefundedAmount - RecoveredAmount + ReimbursedAmount;
        DisbursedBy = disbursedBy.Trim();
        DisbursedOnUtc = disbursedOnUtc;
        DisbursementJournalEntryId = journalEntryId;
        Status = AdvanceRequestStatus.Disbursed;
        SetAudit(disbursedBy);
    }

    public void ApplyRetirement(decimal amount, bool closeIfZero, string actor)
    {
        RetiredAmount += amount;
        OutstandingAmount = DisbursedAmount - RetiredAmount - RefundedAmount - RecoveredAmount + ReimbursedAmount;
        if (OutstandingAmount <= 0m)
        {
            Status = closeIfZero ? AdvanceRequestStatus.Closed : AdvanceRequestStatus.FullyRetired;
            OutstandingAmount = Math.Max(0m, OutstandingAmount);
        }
        else
        {
            Status = AdvanceRequestStatus.PartiallyRetired;
        }
        SetAudit(actor);
    }

    public void ApplyRefund(decimal amount, string actor) { RefundedAmount += amount; OutstandingAmount -= amount; Status = OutstandingAmount <= 0m ? AdvanceRequestStatus.Closed : AdvanceRequestStatus.PartiallyRetired; SetAudit(actor); }
    public void ApplyRecovery(decimal amount, string actor) { RecoveredAmount += amount; OutstandingAmount -= amount; Status = OutstandingAmount <= 0m ? AdvanceRequestStatus.Closed : AdvanceRequestStatus.PartiallyRetired; SetAudit(actor); }
    public void ApplyReimbursement(decimal amount, string actor) { ReimbursedAmount += amount; OutstandingAmount += amount; Status = AdvanceRequestStatus.PartiallyRetired; SetAudit(actor); }

    private void SetAudit(string? actor)
    {
        if (!string.IsNullOrWhiteSpace(actor) && string.IsNullOrWhiteSpace(CreatedBy)) CreatedBy = actor.Trim();
        if (!string.IsNullOrWhiteSpace(actor)) LastModifiedBy = actor.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}

