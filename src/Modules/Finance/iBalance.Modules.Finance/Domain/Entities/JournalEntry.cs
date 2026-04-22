using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class JournalEntry : TenantOwnedEntity
{
    private readonly List<JournalEntryLine> _lines = [];

    private JournalEntry()
    {
    }

    public JournalEntry(
        Guid id,
        Guid tenantId,
        DateTime entryDateUtc,
        string reference,
        string description,
        JournalEntryStatus status,
        JournalEntryType type,
        IEnumerable<JournalEntryLine> lines,
        Guid? reversedJournalEntryId = null,
        bool postingRequiresApproval = true) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(reference))
        {
            throw new ArgumentException("Reference cannot be null or whitespace.", nameof(reference));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Description cannot be null or whitespace.", nameof(description));
        }

        var lineList = lines?.ToList() ?? throw new ArgumentNullException(nameof(lines));

        ValidateLines(lineList);

        Id = id;
        EntryDateUtc = entryDateUtc;
        Reference = reference.Trim();
        Description = description.Trim();
        Status = status;
        Type = type;
        ReversedJournalEntryId = reversedJournalEntryId;
        PostingRequiresApproval = postingRequiresApproval;
        _lines.AddRange(lineList);
    }

    public Guid Id { get; private set; }

    public DateTime EntryDateUtc { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public JournalEntryStatus Status { get; private set; }

    public JournalEntryType Type { get; private set; }

    public bool PostingRequiresApproval { get; private set; }

    public string? SubmittedBy { get; private set; }

    public DateTime? SubmittedOnUtc { get; private set; }

    public string? ApprovedBy { get; private set; }

    public DateTime? ApprovedOnUtc { get; private set; }

    public string? RejectedBy { get; private set; }

    public DateTime? RejectedOnUtc { get; private set; }

    public string? RejectionReason { get; private set; }

    public DateTime? PostedAtUtc { get; private set; }

    public DateTime? ReversedAtUtc { get; private set; }

    public Guid? ReversalJournalEntryId { get; private set; }

    public Guid? ReversedJournalEntryId { get; private set; }

    public IReadOnlyCollection<JournalEntryLine> Lines => _lines;

    public decimal TotalDebit => _lines.Sum(x => x.DebitAmount);

    public decimal TotalCredit => _lines.Sum(x => x.CreditAmount);

    public void SubmitForApproval(string submittedBy)
    {
        if (string.IsNullOrWhiteSpace(submittedBy))
        {
            throw new ArgumentException("Submitted by user is required.", nameof(submittedBy));
        }

        if (Status != JournalEntryStatus.Draft && Status != JournalEntryStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected journal entries can be submitted for approval.");
        }

        if (Type == JournalEntryType.Reversal)
        {
            throw new InvalidOperationException("Reversal journals cannot be submitted through the standard approval workflow.");
        }

        SubmittedBy = submittedBy.Trim();
        SubmittedOnUtc = DateTime.UtcNow;
        ApprovedBy = null;
        ApprovedOnUtc = null;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Status = JournalEntryStatus.SubmittedForApproval;
    }

    public void Approve(string approvedBy)
    {
        if (string.IsNullOrWhiteSpace(approvedBy))
        {
            throw new ArgumentException("Approved by user is required.", nameof(approvedBy));
        }

        if (Status != JournalEntryStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only submitted journal entries can be approved.");
        }

        ApprovedBy = approvedBy.Trim();
        ApprovedOnUtc = DateTime.UtcNow;
        RejectedBy = null;
        RejectedOnUtc = null;
        RejectionReason = null;
        Status = JournalEntryStatus.Approved;
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

        if (Status != JournalEntryStatus.SubmittedForApproval)
        {
            throw new InvalidOperationException("Only submitted journal entries can be rejected.");
        }

        RejectedBy = rejectedBy.Trim();
        RejectedOnUtc = DateTime.UtcNow;
        RejectionReason = rejectionReason.Trim();
        ApprovedBy = null;
        ApprovedOnUtc = null;
        Status = JournalEntryStatus.Rejected;
    }

    public void MarkPosted(DateTime postedAtUtc)
    {
        var requiredStatus = PostingRequiresApproval
            ? JournalEntryStatus.Approved
            : JournalEntryStatus.Draft;

        if (Status != requiredStatus)
        {
            throw new InvalidOperationException(
                PostingRequiresApproval
                    ? "Only approved journal entries can be posted."
                    : "Only draft journal entries can be posted.");
        }

        PostedAtUtc = postedAtUtc;
        Status = JournalEntryStatus.Posted;
    }

    public void MarkVoided()
    {
        if (Status != JournalEntryStatus.Draft && Status != JournalEntryStatus.Rejected)
        {
            throw new InvalidOperationException("Only draft or rejected journal entries can be voided.");
        }

        Status = JournalEntryStatus.Voided;
    }

    public void ReplaceEditableDetails(
    DateTime entryDateUtc,
    string reference,
    string description,
    IEnumerable<JournalEntryLine> lines)
{
    if (Status != JournalEntryStatus.Draft && Status != JournalEntryStatus.Rejected)
    {
        throw new InvalidOperationException("Only draft or rejected journal entries can be edited.");
    }

    if (string.IsNullOrWhiteSpace(reference))
    {
        throw new ArgumentException("Reference cannot be null or whitespace.", nameof(reference));
    }

    if (string.IsNullOrWhiteSpace(description))
    {
        throw new ArgumentException("Description cannot be null or whitespace.", nameof(description));
    }

    var lineList = lines?.ToList() ?? throw new ArgumentNullException(nameof(lines));

    ValidateLines(lineList);

    EntryDateUtc = entryDateUtc;
    Reference = reference.Trim();
    Description = description.Trim();

    _lines.Clear();
    _lines.AddRange(lineList);
}

    public void MarkReversed(Guid reversalJournalEntryId, DateTime reversedAtUtc)
    {
        if (Status != JournalEntryStatus.Posted)
        {
            throw new InvalidOperationException("Only posted journal entries can be reversed.");
        }

        if (reversalJournalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Reversal journal entry id cannot be empty.", nameof(reversalJournalEntryId));
        }

        ReversalJournalEntryId = reversalJournalEntryId;
        ReversedAtUtc = reversedAtUtc;
        Status = JournalEntryStatus.Reversed;
    }

    private static void ValidateLines(IReadOnlyCollection<JournalEntryLine> lines)
    {
        if (lines.Count < 2)
        {
            throw new ArgumentException("A journal entry must contain at least two lines.");
        }

        var totalDebit = lines.Sum(x => x.DebitAmount);
        var totalCredit = lines.Sum(x => x.CreditAmount);

        if (totalDebit <= 0m)
        {
            throw new ArgumentException("Total debit must be greater than zero.");
        }

        if (totalCredit <= 0m)
        {
            throw new ArgumentException("Total credit must be greater than zero.");
        }

        if (totalDebit != totalCredit)
        {
            throw new ArgumentException("Total debit must equal total credit.");
        }
    }
}