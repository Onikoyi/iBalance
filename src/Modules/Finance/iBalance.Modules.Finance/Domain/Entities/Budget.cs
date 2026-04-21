using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class Budget : TenantOwnedEntity
{
    private readonly List<BudgetLine> _lines = [];

    private Budget()
    {
    }

    public Budget(
        Guid id,
        Guid tenantId,
        string budgetNumber,
        string name,
        string description,
        BudgetType type,
        DateTime periodStartUtc,
        DateTime periodEndUtc,
        string? notes)
        : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Budget id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (string.IsNullOrWhiteSpace(budgetNumber))
        {
            throw new ArgumentException("Budget number is required.", nameof(budgetNumber));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Budget name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Budget description is required.", nameof(description));
        }

        if (periodEndUtc < periodStartUtc)
        {
            throw new ArgumentException("Budget period end date cannot be earlier than period start date.");
        }

        Id = id;
        BudgetNumber = budgetNumber.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description.Trim();
        Type = type;
        PeriodStartUtc = periodStartUtc;
        PeriodEndUtc = periodEndUtc;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = BudgetStatus.Draft;
    }

    public Guid Id { get; private set; }

    public string BudgetNumber { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public BudgetType Type { get; private set; }

    public DateTime PeriodStartUtc { get; private set; }

    public DateTime PeriodEndUtc { get; private set; }

    public BudgetStatus Status { get; private set; }

    public string? Notes { get; private set; }

    public string? SubmittedBy { get; private set; }

    public DateTime? SubmittedOnUtc { get; private set; }

    public string? ApprovedBy { get; private set; }

    public DateTime? ApprovedOnUtc { get; private set; }

    public string? RejectedBy { get; private set; }

    public DateTime? RejectedOnUtc { get; private set; }

    public string? RejectionReason { get; private set; }

    public string? LockedBy { get; private set; }

    public DateTime? LockedOnUtc { get; private set; }

    public DateTime? CancelledOnUtc { get; private set; }

    public IReadOnlyCollection<BudgetLine> Lines => _lines;

    public decimal TotalAmount => _lines.Sum(x => x.BudgetAmount);

    public BudgetOverrunPolicy OverrunPolicy { get; private set; }

    public bool AllowOverrun { get; private set; }

    public string? ClosedBy { get; private set; }

    public DateTime? ClosedOnUtc { get; private set; }

    public string? ClosureReason { get; private set; }

    public void AddLine(BudgetLine line)
    {
        if (line is null)
        {
            throw new ArgumentNullException(nameof(line));
        }

        if (Status != BudgetStatus.Draft && Status != BudgetStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected budgets can be edited.");
        }

        if (line.BudgetId != Id)
        {
            throw new InvalidOperationException("Budget line does not belong to this budget.");
        }

        _lines.Add(line);
    }

    public void ClearLines()
    {
        if (Status != BudgetStatus.Draft && Status != BudgetStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected budgets can be edited.");
        }

        _lines.Clear();
    }

    public void UpdateHeader(
        string budgetNumber,
        string name,
        string description,
        BudgetType type,
        DateTime periodStartUtc,
        DateTime periodEndUtc,
        string? notes)
    {
        if (Status != BudgetStatus.Draft && Status != BudgetStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected budgets can be edited.");
        }

        if (string.IsNullOrWhiteSpace(budgetNumber))
        {
            throw new ArgumentException("Budget number is required.", nameof(budgetNumber));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Budget name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Budget description is required.", nameof(description));
        }

        if (periodEndUtc < periodStartUtc)
        {
            throw new ArgumentException("Budget period end date cannot be earlier than period start date.");
        }

        BudgetNumber = budgetNumber.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description.Trim();
        Type = type;
        PeriodStartUtc = periodStartUtc;
        PeriodEndUtc = periodEndUtc;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public void SubmitForApproval(string submittedBy)
    {
        if (string.IsNullOrWhiteSpace(submittedBy))
        {
            throw new ArgumentException("Submitted by user is required.", nameof(submittedBy));
        }

        if (Status != BudgetStatus.Draft && Status != BudgetStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected budgets can be submitted for approval.");
        }

        if (_lines.Count == 0)
        {
            throw new InvalidOperationException("A budget must have at least one line before submission.");
        }

        SubmittedBy = submittedBy.Trim();
        SubmittedOnUtc = DateTime.UtcNow;
        ApprovedBy = null;
        ApprovedOnUtc = null;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Status = BudgetStatus.SubmittedForApproval;
        OverrunPolicy = BudgetOverrunPolicy.WarnOnly;
        AllowOverrun = true;
    }

    public void Approve(string approvedBy)
    {
        if (string.IsNullOrWhiteSpace(approvedBy))
        {
            throw new ArgumentException("Approved by user is required.", nameof(approvedBy));
        }

        if (Status != BudgetStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only submitted budgets can be approved.");
        }

        ApprovedBy = approvedBy.Trim();
        ApprovedOnUtc = DateTime.UtcNow;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Status = BudgetStatus.Approved;
    }

    public void Reject(string rejectedBy, string rejectionReason)
    {
        if (string.IsNullOrWhiteSpace(rejectedBy))
        {
            throw new ArgumentException("Rejected by user is required.", nameof(rejectedBy));
        }

        if (string.IsNullOrWhiteSpace(rejectionReason))
        {
            throw new ArgumentException("Rejection reason is required.", nameof(rejectionReason));
        }

        if (Status != BudgetStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only submitted budgets can be rejected.");
        }

        RejectedBy = rejectedBy.Trim();
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = rejectionReason.Trim();
        ApprovedBy = null;
        ApprovedOnUtc = null;
        Status = BudgetStatus.Rejected;
    }

    public void Lock(string lockedBy)
    {
        if (string.IsNullOrWhiteSpace(lockedBy))
        {
            throw new ArgumentException("Locked by user is required.", nameof(lockedBy));
        }

        if (Status != BudgetStatus.Approved)
        {
            throw new InvalidOperationException("Only approved budgets can be locked.");
        }

        LockedBy = lockedBy.Trim();
        LockedOnUtc = DateTime.UtcNow;
        Status = BudgetStatus.Locked;
    }

    public void Cancel()
{
    if (Status == BudgetStatus.Locked || Status == BudgetStatus.Closed)
    {
        throw new InvalidOperationException("Locked or closed budgets cannot be cancelled.");
    }

    Status = BudgetStatus.Cancelled;
    CancelledOnUtc = DateTime.UtcNow;
}

    public void SetOverrunPolicy(BudgetOverrunPolicy policy)
{
    if (Status == BudgetStatus.Closed || Status == BudgetStatus.Cancelled)
    {
        throw new InvalidOperationException("Closed or cancelled budgets cannot be updated.");
    }

    OverrunPolicy = policy;
    AllowOverrun = policy == BudgetOverrunPolicy.Allow || policy == BudgetOverrunPolicy.WarnOnly;
}

public void Close(string closedBy, string reason)
{
    if (string.IsNullOrWhiteSpace(closedBy))
    {
        throw new ArgumentException("Closed by user is required.", nameof(closedBy));
    }

    if (string.IsNullOrWhiteSpace(reason))
    {
        throw new ArgumentException("Closure reason is required.", nameof(reason));
    }

    if (Status != BudgetStatus.Approved && Status != BudgetStatus.Locked)
    {
        throw new InvalidOperationException("Only approved or locked budgets can be closed.");
    }

    ClosedBy = closedBy.Trim();
    ClosedOnUtc = DateTime.UtcNow;
    ClosureReason = reason.Trim();
    Status = BudgetStatus.Closed;
}
}