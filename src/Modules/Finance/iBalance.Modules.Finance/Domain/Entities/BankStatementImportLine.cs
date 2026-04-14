namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BankStatementImportLine
{
    private BankStatementImportLine()
    {
    }

    public BankStatementImportLine(
        Guid id,
        Guid bankStatementImportId,
        DateTime transactionDateUtc,
        string reference,
        string description,
        decimal debitAmount,
        decimal creditAmount,
        decimal? balance = null,
        DateTime? valueDateUtc = null,
        string? externalReference = null)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Bank statement import line id cannot be empty.", nameof(id));
        }

        if (bankStatementImportId == Guid.Empty)
        {
            throw new ArgumentException("Bank statement import id cannot be empty.", nameof(bankStatementImportId));
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

        if (debitAmount > 0m && creditAmount > 0m)
        {
            throw new ArgumentException("A bank statement line cannot have both debit and credit amounts.");
        }

        Id = id;
        BankStatementImportId = bankStatementImportId;
        TransactionDateUtc = transactionDateUtc;
        ValueDateUtc = valueDateUtc;
        Reference = reference.Trim();
        Description = description.Trim();
        DebitAmount = debitAmount;
        CreditAmount = creditAmount;
        Balance = balance;
        ExternalReference = string.IsNullOrWhiteSpace(externalReference) ? null : externalReference.Trim();
    }

    public Guid Id { get; private set; }

    public Guid BankStatementImportId { get; private set; }

    public BankStatementImport? BankStatementImport { get; private set; }

    public DateTime TransactionDateUtc { get; private set; }

    public DateTime? ValueDateUtc { get; private set; }

    public string Reference { get; private set; } = string.Empty;

    public string Description { get; private set; } = string.Empty;

    public decimal DebitAmount { get; private set; }

    public decimal CreditAmount { get; private set; }

    public decimal? Balance { get; private set; }

    public string? ExternalReference { get; private set; }

    public void SetReference(string reference)
    {
        if (string.IsNullOrWhiteSpace(reference))
        {
            throw new ArgumentException("Reference cannot be null or whitespace.", nameof(reference));
        }

        Reference = reference.Trim();
    }

    public void SetDescription(string description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Description cannot be null or whitespace.", nameof(description));
        }

        Description = description.Trim();
    }

    public void SetAmounts(decimal debitAmount, decimal creditAmount)
    {
        if (debitAmount < 0m)
        {
            throw new ArgumentException("Debit amount cannot be negative.", nameof(debitAmount));
        }

        if (creditAmount < 0m)
        {
            throw new ArgumentException("Credit amount cannot be negative.", nameof(creditAmount));
        }

        if (debitAmount > 0m && creditAmount > 0m)
        {
            throw new ArgumentException("A bank statement line cannot have both debit and credit amounts.");
        }

        DebitAmount = debitAmount;
        CreditAmount = creditAmount;
    }

    public void SetBalance(decimal? balance)
    {
        Balance = balance;
    }

    public void SetValueDate(DateTime? valueDateUtc)
    {
        ValueDateUtc = valueDateUtc;
    }

    public void SetExternalReference(string? externalReference)
    {
        ExternalReference = string.IsNullOrWhiteSpace(externalReference) ? null : externalReference.Trim();
    }
}