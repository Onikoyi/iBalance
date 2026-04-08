namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class JournalEntryLine
{
    private JournalEntryLine()
    {
    }

    public JournalEntryLine(
        Guid id,
        Guid ledgerAccountId,
        string description,
        decimal debitAmount,
        decimal creditAmount)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Journal entry line id cannot be empty.", nameof(id));
        }

        if (ledgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Ledger account id cannot be empty.", nameof(ledgerAccountId));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Line description cannot be null or whitespace.", nameof(description));
        }

        if (debitAmount < 0)
        {
            throw new ArgumentException("Debit amount cannot be negative.", nameof(debitAmount));
        }

        if (creditAmount < 0)
        {
            throw new ArgumentException("Credit amount cannot be negative.", nameof(creditAmount));
        }

        if (debitAmount == 0m && creditAmount == 0m)
        {
            throw new ArgumentException("Either debit or credit amount must be greater than zero.");
        }

        if (debitAmount > 0m && creditAmount > 0m)
        {
            throw new ArgumentException("A journal entry line cannot contain both debit and credit amounts.");
        }

        Id = id;
        LedgerAccountId = ledgerAccountId;
        Description = description.Trim();
        DebitAmount = debitAmount;
        CreditAmount = creditAmount;
    }

    public Guid Id { get; private set; }

    public Guid JournalEntryId { get; private set; }

    public Guid LedgerAccountId { get; private set; }

    public string Description { get; private set; } = string.Empty;

    public decimal DebitAmount { get; private set; }

    public decimal CreditAmount { get; private set; }

    public JournalEntry JournalEntry { get; private set; } = null!;

    public LedgerAccount LedgerAccount { get; private set; } = null!;
}