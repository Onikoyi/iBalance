using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseAdvanceRetirement : TenantOwnedEntity
{
    private readonly List<ExpenseAdvanceRetirementLine> _lines = [];
    private ExpenseAdvanceRetirement() : base(Guid.Empty) { }

    public ExpenseAdvanceRetirement(Guid id, Guid tenantId, Guid advanceRequestId, string retirementNumber, DateTime retirementDateUtc, string? reasonCode, string? notes)
        : base(tenantId)
    {
        Id = id;
        AdvanceRequestId = advanceRequestId;
        RetirementNumber = retirementNumber.Trim().ToUpperInvariant();
        RetirementDateUtc = retirementDateUtc;
        ReasonCode = string.IsNullOrWhiteSpace(reasonCode) ? null : reasonCode.Trim().ToUpperInvariant();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = AdvanceRetirementStatus.Draft;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid AdvanceRequestId { get; private set; }
    public string RetirementNumber { get; private set; } = string.Empty;
    public DateTime RetirementDateUtc { get; private set; }
    public string? ReasonCode { get; private set; }
    public string? Notes { get; private set; }
    public AdvanceRetirementStatus Status { get; private set; }
    public decimal TotalExpenseAmount { get; private set; }
    public decimal RefundAmount { get; private set; }
    public decimal RecoverableAmount { get; private set; }
    public decimal ReimbursableAmount { get; private set; }
    public Guid? PostingJournalEntryId { get; private set; }
    public string? SubmittedBy { get; private set; }
    public DateTime? SubmittedOnUtc { get; private set; }
    public string? ApprovedBy { get; private set; }
    public DateTime? ApprovedOnUtc { get; private set; }
    public string? RejectedBy { get; private set; }
    public DateTime? RejectedOnUtc { get; private set; }
    public string? RejectionReason { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public IReadOnlyCollection<ExpenseAdvanceRetirementLine> Lines => _lines;

    public void ReplaceLines(IEnumerable<ExpenseAdvanceRetirementLine> lines)
    {
        if (Status != AdvanceRetirementStatus.Draft && Status != AdvanceRetirementStatus.Rejected) throw new InvalidOperationException("Only draft or rejected retirements can be edited.");
        _lines.Clear();
        _lines.AddRange(lines);
        TotalExpenseAmount = _lines.Sum(x => x.Amount);
        if (Status == AdvanceRetirementStatus.Rejected)
        {
            Status = AdvanceRetirementStatus.Draft;
            RejectedBy = null;
            RejectedOnUtc = null;
            RejectionReason = null;
        }
    }

    public void SetSettlementAmounts(decimal refundAmount, decimal recoverableAmount, decimal reimbursableAmount) { RefundAmount = refundAmount; RecoverableAmount = recoverableAmount; ReimbursableAmount = reimbursableAmount; }
    public void Submit(string submittedBy) { SubmittedBy = submittedBy.Trim(); SubmittedOnUtc = DateTime.UtcNow; Status = AdvanceRetirementStatus.Submitted; }
    public void Approve(string approvedBy) { ApprovedBy = approvedBy.Trim(); ApprovedOnUtc = DateTime.UtcNow; Status = AdvanceRetirementStatus.Approved; }
    public void Reject(string rejectedBy, string reason) { RejectedBy = rejectedBy.Trim(); RejectedOnUtc = DateTime.UtcNow; RejectionReason = reason.Trim(); Status = AdvanceRetirementStatus.Rejected; }
    public void MarkPosted(Guid postingJournalEntryId) { PostingJournalEntryId = postingJournalEntryId; Status = AdvanceRetirementStatus.Posted; }
}