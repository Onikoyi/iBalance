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
        Guid? reversedJournalEntryId = null) : base(tenantId)
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
        _lines.AddRange(lineList);
    }

    public Guid Id { get; private set; }

    public DateTime EntryDateUtc { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public JournalEntryStatus Status { get; private set; }

    public JournalEntryType Type { get; private set; }

    public DateTime? PostedAtUtc { get; private set; }

    public DateTime? ReversedAtUtc { get; private set; }

    public Guid? ReversalJournalEntryId { get; private set; }

    public Guid? ReversedJournalEntryId { get; private set; }

    public IReadOnlyCollection<JournalEntryLine> Lines => _lines;

    public decimal TotalDebit => _lines.Sum(x => x.DebitAmount);

    public decimal TotalCredit => _lines.Sum(x => x.CreditAmount);

    public void MarkPosted(DateTime postedAtUtc)
    {
        if (Status != JournalEntryStatus.Draft)
        {
            throw new InvalidOperationException("Only draft journal entries can be posted.");
        }

        PostedAtUtc = postedAtUtc;
        Status = JournalEntryStatus.Posted;
    }

    public void MarkVoided()
    {
        if (Status != JournalEntryStatus.Draft)
        {
            throw new InvalidOperationException("Only draft journal entries can be voided.");
        }

        Status = JournalEntryStatus.Voided;
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