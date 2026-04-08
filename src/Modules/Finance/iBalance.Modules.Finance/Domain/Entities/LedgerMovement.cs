using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class LedgerMovement : TenantOwnedEntity
{
    private LedgerMovement()
    {
    }

    public LedgerMovement(
        Guid id,
        Guid tenantId,
        Guid journalEntryId,
        Guid journalEntryLineId,
        Guid ledgerAccountId,
        DateTime movementDateUtc,
        string reference,
        string description,
        decimal debitAmount,
        decimal creditAmount) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Ledger movement id cannot be empty.", nameof(id));
        }

        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id cannot be empty.", nameof(journalEntryId));
        }

        if (journalEntryLineId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry line id cannot be empty.", nameof(journalEntryLineId));
        }

        if (ledgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Ledger account id cannot be empty.", nameof(ledgerAccountId));
        }

        if (string.IsNullOrWhiteSpace(reference))
        {
            throw new ArgumentException("Reference cannot be null or whitespace.", nameof(reference));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Description cannot be null or whitespace.", nameof(description));
        }

        if (debitAmount < 0m)
        {
            throw new ArgumentException("Debit amount cannot be negative.", nameof(debitAmount));
        }

        if (creditAmount < 0m)
        {
            throw new ArgumentException("Credit amount cannot be negative.", nameof(creditAmount));
        }

        if (debitAmount == 0m && creditAmount == 0m)
        {
            throw new ArgumentException("Either debit or credit amount must be greater than zero.");
        }

        if (debitAmount > 0m && creditAmount > 0m)
        {
            throw new ArgumentException("A ledger movement cannot contain both debit and credit amounts.");
        }

        Id = id;
        JournalEntryId = journalEntryId;
        JournalEntryLineId = journalEntryLineId;
        LedgerAccountId = ledgerAccountId;
        MovementDateUtc = movementDateUtc;
        Reference = reference.Trim();
        Description = description.Trim();
        DebitAmount = debitAmount;
        CreditAmount = creditAmount;
    }

    public Guid Id { get; private set; }

    public Guid JournalEntryId { get; private set; }

    public Guid JournalEntryLineId { get; private set; }

    public Guid LedgerAccountId { get; private set; }

    public DateTime MovementDateUtc { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public decimal DebitAmount { get; private set; }

    public decimal CreditAmount { get; private set; }

    public JournalEntry JournalEntry { get; private set; } = null!;

    public JournalEntryLine JournalEntryLine { get; private set; } = null!;

    public LedgerAccount LedgerAccount { get; private set; } = null!;
}