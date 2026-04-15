namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BankReconciliationMatch
{
    private BankReconciliationMatch()
    {
    }

    public BankReconciliationMatch(
        Guid id,
        Guid bankReconciliationId,
        Guid bankReconciliationLineId,
        Guid bankStatementImportLineId,
        string? notes = null)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Bank reconciliation match id cannot be empty.", nameof(id));
        }

        if (bankReconciliationId == Guid.Empty)
        {
            throw new ArgumentException("Bank reconciliation id cannot be empty.", nameof(bankReconciliationId));
        }

        if (bankReconciliationLineId == Guid.Empty)
        {
            throw new ArgumentException("Bank reconciliation line id cannot be empty.", nameof(bankReconciliationLineId));
        }

        if (bankStatementImportLineId == Guid.Empty)
        {
            throw new ArgumentException("Bank statement import line id cannot be empty.", nameof(bankStatementImportLineId));
        }

        Id = id;
        BankReconciliationId = bankReconciliationId;
        BankReconciliationLineId = bankReconciliationLineId;
        BankStatementImportLineId = bankStatementImportLineId;
        MatchedOnUtc = DateTime.UtcNow;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public Guid Id { get; private set; }

    public Guid BankReconciliationId { get; private set; }

    public BankReconciliation? BankReconciliation { get; private set; }

    public Guid BankReconciliationLineId { get; private set; }

    public BankReconciliationLine? BankReconciliationLine { get; private set; }

    public Guid BankStatementImportLineId { get; private set; }

    public BankStatementImportLine? BankStatementImportLine { get; private set; }

    public DateTime MatchedOnUtc { get; private set; }

    public string? Notes { get; private set; }

    public void SetNotes(string? notes)
    {
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }
}