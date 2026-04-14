using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BankReconciliationLine
{
    private BankReconciliationLine()
    {
    }

    public BankReconciliationLine(
        Guid id,
        Guid bankReconciliationId,
        Guid ledgerMovementId,
        bool isReconciled,
        string? notes = null)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Bank reconciliation line id cannot be empty.", nameof(id));
        }

        if (bankReconciliationId == Guid.Empty)
        {
            throw new ArgumentException("Bank reconciliation id cannot be empty.", nameof(bankReconciliationId));
        }

        if (ledgerMovementId == Guid.Empty)
        {
            throw new ArgumentException("Ledger movement id cannot be empty.", nameof(ledgerMovementId));
        }

        Id = id;
        BankReconciliationId = bankReconciliationId;
        LedgerMovementId = ledgerMovementId;
        IsReconciled = isReconciled;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public Guid Id { get; private set; }

    public Guid BankReconciliationId { get; private set; }

    public BankReconciliation? BankReconciliation { get; private set; }

    public Guid LedgerMovementId { get; private set; }

    public LedgerMovement? LedgerMovement { get; private set; }

    public bool IsReconciled { get; private set; }

    public string? Notes { get; private set; }

    public void MarkAsReconciled()
    {
        IsReconciled = true;
    }

    public void MarkAsUnreconciled()
    {
        IsReconciled = false;
    }

    public void SetNotes(string? notes)
    {
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }
}