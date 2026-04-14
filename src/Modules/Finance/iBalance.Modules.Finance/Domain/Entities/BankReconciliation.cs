using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BankReconciliation : TenantOwnedEntity
{
    private readonly List<BankReconciliationLine> _lines = [];

    private BankReconciliation()
    {
    }

    public BankReconciliation(
        Guid id,
        Guid tenantId,
        Guid ledgerAccountId,
        DateTime statementFromUtc,
        DateTime statementToUtc,
        decimal statementClosingBalance,
        decimal bookClosingBalance,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Bank reconciliation id cannot be empty.", nameof(id));
        }

        if (ledgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Ledger account id cannot be empty.", nameof(ledgerAccountId));
        }

        if (statementToUtc < statementFromUtc)
        {
            throw new ArgumentException("Statement end date cannot be earlier than statement start date.");
        }

        Id = id;
        LedgerAccountId = ledgerAccountId;
        StatementFromUtc = statementFromUtc;
        StatementToUtc = statementToUtc;
        StatementClosingBalance = statementClosingBalance;
        BookClosingBalance = bookClosingBalance;
        Status = BankReconciliationStatus.Draft;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public Guid Id { get; private set; }

    public Guid LedgerAccountId { get; private set; }

    public LedgerAccount? LedgerAccount { get; private set; }

    public DateTime StatementFromUtc { get; private set; }

    public DateTime StatementToUtc { get; private set; }

    public decimal StatementClosingBalance { get; private set; }

    public decimal BookClosingBalance { get; private set; }

    public decimal DifferenceAmount => StatementClosingBalance - BookClosingBalance;

    public BankReconciliationStatus Status { get; private set; }

    public string? Notes { get; private set; }

    public DateTime? CompletedOnUtc { get; private set; }

    public DateTime? CancelledOnUtc { get; private set; }

    public IReadOnlyCollection<BankReconciliationLine> Lines => _lines;

    public void UpdateStatementPeriod(DateTime statementFromUtc, DateTime statementToUtc)
    {
        EnsureDraft();

        if (statementToUtc < statementFromUtc)
        {
            throw new ArgumentException("Statement end date cannot be earlier than statement start date.");
        }

        StatementFromUtc = statementFromUtc;
        StatementToUtc = statementToUtc;
    }

    public void SetStatementClosingBalance(decimal statementClosingBalance)
    {
        EnsureDraft();
        StatementClosingBalance = statementClosingBalance;
    }

    public void SetBookClosingBalance(decimal bookClosingBalance)
    {
        EnsureDraft();
        BookClosingBalance = bookClosingBalance;
    }

    public void SetNotes(string? notes)
    {
        EnsureDraft();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public void Complete(DateTime completedOnUtc)
    {
        EnsureDraft();
        CompletedOnUtc = completedOnUtc;
        CancelledOnUtc = null;
        Status = BankReconciliationStatus.Completed;
    }

    public void Cancel(DateTime cancelledOnUtc)
    {
        if (Status == BankReconciliationStatus.Completed)
        {
            throw new InvalidOperationException("A completed bank reconciliation cannot be cancelled.");
        }

        if (Status == BankReconciliationStatus.Cancelled)
        {
            throw new InvalidOperationException("Bank reconciliation is already cancelled.");
        }

        CancelledOnUtc = cancelledOnUtc;
        CompletedOnUtc = null;
        Status = BankReconciliationStatus.Cancelled;
    }

    private void EnsureDraft()
    {
        if (Status != BankReconciliationStatus.Draft)
        {
            throw new InvalidOperationException("Only draft bank reconciliations can be modified.");
        }
    }
}