using iBalance.Modules.HumanResources.Domain.Enums;

namespace iBalance.Modules.HumanResources.Domain.Entities;

public sealed class HrLeaveRequest
{
    private HrLeaveRequest() { }

    public HrLeaveRequest(Guid id, Guid tenantId, Guid employeeId, DateTime startDateUtc, DateTime endDateUtc, string leaveType, string reason)
    {
        if (id == Guid.Empty) throw new ArgumentException("Leave request id is required.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (employeeId == Guid.Empty) throw new ArgumentException("Employee is required.", nameof(employeeId));
        if (endDateUtc.Date < startDateUtc.Date) throw new ArgumentException("Leave end date cannot be before start date.");
        if (string.IsNullOrWhiteSpace(leaveType)) throw new ArgumentException("Leave type is required.", nameof(leaveType));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Leave reason is required.", nameof(reason));

        Id = id;
        TenantId = tenantId;
        EmployeeId = employeeId;
        StartDateUtc = startDateUtc;
        EndDateUtc = endDateUtc;
        LeaveType = leaveType.Trim();
        Reason = reason.Trim();
        Status = HrLeaveRequestStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public DateTime StartDateUtc { get; private set; }
    public DateTime EndDateUtc { get; private set; }
    public string LeaveType { get; private set; } = string.Empty;
    public string Reason { get; private set; } = string.Empty;
    public HrLeaveRequestStatus Status { get; private set; }
    public string? SubmittedBy { get; private set; }
    public DateTime? SubmittedOnUtc { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTime? ApprovedOnUtc { get; private set; }
    public string? RejectedBy { get; private set; }
    public DateTime? RejectedOnUtc { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime? CancelledOnUtc { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }

    public HrEmployee? Employee { get; private set; }

    public void UpdateDraft(DateTime startDateUtc, DateTime endDateUtc, string leaveType, string reason)
    {
        if (Status != HrLeaveRequestStatus.Draft && Status != HrLeaveRequestStatus.Rejected)
            throw new InvalidOperationException("Only draft or rejected leave requests can be changed.");
        if (endDateUtc.Date < startDateUtc.Date) throw new ArgumentException("Leave end date cannot be before start date.");
        if (string.IsNullOrWhiteSpace(leaveType)) throw new ArgumentException("Leave type is required.", nameof(leaveType));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Leave reason is required.", nameof(reason));

        StartDateUtc = startDateUtc;
        EndDateUtc = endDateUtc;
        LeaveType = leaveType.Trim();
        Reason = reason.Trim();
        Touch();
    }

    public void Submit(string submittedBy)
    {
        if (string.IsNullOrWhiteSpace(submittedBy)) throw new ArgumentException("Submitted by user is required.", nameof(submittedBy));
        if (Status != HrLeaveRequestStatus.Draft && Status != HrLeaveRequestStatus.Rejected)
            throw new InvalidOperationException("Only draft or rejected leave requests can be submitted.");

        Status = HrLeaveRequestStatus.SubmittedForApproval;
        SubmittedBy = submittedBy.Trim();
        SubmittedOnUtc = DateTime.UtcNow;
        ApprovedBy = null;
        ApprovedOnUtc = null;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Touch();
    }

    public void Approve(string approvedBy)
    {
        if (string.IsNullOrWhiteSpace(approvedBy)) throw new ArgumentException("Approved by user is required.", nameof(approvedBy));
        if (Status != HrLeaveRequestStatus.SubmittedForApproval)
            throw new InvalidOperationException("Only submitted leave requests can be approved.");
        Status = HrLeaveRequestStatus.Approved;
        ApprovedBy = approvedBy.Trim();
        ApprovedOnUtc = DateTime.UtcNow;
        Touch();
    }

    public void Reject(string rejectedBy, string reason)
    {
        if (string.IsNullOrWhiteSpace(rejectedBy)) throw new ArgumentException("Rejected by user is required.", nameof(rejectedBy));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Rejection reason is required.", nameof(reason));
        if (Status != HrLeaveRequestStatus.SubmittedForApproval)
            throw new InvalidOperationException("Only submitted leave requests can be rejected.");
        Status = HrLeaveRequestStatus.Rejected;
        RejectedBy = rejectedBy.Trim();
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        ApprovedBy = null;
        ApprovedOnUtc = null;
        Touch();
    }

    public void Cancel()
    {
        if (Status == HrLeaveRequestStatus.Approved) throw new InvalidOperationException("Approved leave requests cannot be cancelled from this action.");
        Status = HrLeaveRequestStatus.Cancelled;
        CancelledOnUtc = DateTime.UtcNow;
        Touch();
    }

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        if (!string.IsNullOrWhiteSpace(createdBy) && string.IsNullOrWhiteSpace(CreatedBy)) CreatedBy = createdBy.Trim();
        if (!string.IsNullOrWhiteSpace(lastModifiedBy))
        {
            LastModifiedBy = lastModifiedBy.Trim();
            LastModifiedOnUtc = DateTime.UtcNow;
        }
    }

    private void Touch() => LastModifiedOnUtc = DateTime.UtcNow;
}

