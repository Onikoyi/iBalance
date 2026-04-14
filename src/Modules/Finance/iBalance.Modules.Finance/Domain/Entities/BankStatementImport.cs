using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BankStatementImport : TenantOwnedEntity
{
    private readonly List<BankStatementImportLine> _lines = [];

    private BankStatementImport()
    {
    }

    public BankStatementImport(
        Guid id,
        Guid tenantId,
        Guid ledgerAccountId,
        DateTime statementFromUtc,
        DateTime statementToUtc,
        BankStatementSourceType sourceType,
        string sourceReference,
        string? fileName = null,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Bank statement import id cannot be empty.", nameof(id));
        }

        if (ledgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Ledger account id cannot be empty.", nameof(ledgerAccountId));
        }

        if (statementToUtc < statementFromUtc)
        {
            throw new ArgumentException("Statement end date cannot be earlier than statement start date.");
        }

        if (string.IsNullOrWhiteSpace(sourceReference))
        {
            throw new ArgumentException("Source reference cannot be null or whitespace.", nameof(sourceReference));
        }

        Id = id;
        LedgerAccountId = ledgerAccountId;
        StatementFromUtc = statementFromUtc;
        StatementToUtc = statementToUtc;
        SourceType = sourceType;
        SourceReference = sourceReference.Trim();
        FileName = string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        ImportedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid LedgerAccountId { get; private set; }

    public LedgerAccount? LedgerAccount { get; private set; }

    public DateTime StatementFromUtc { get; private set; }

    public DateTime StatementToUtc { get; private set; }

    public BankStatementSourceType SourceType { get; private set; }

    public string SourceReference { get; private set; } = string.Empty;

    public string? FileName { get; private set; }

    public string? Notes { get; private set; }

    public DateTime ImportedOnUtc { get; private set; }

    public IReadOnlyCollection<BankStatementImportLine> Lines => _lines;

    public void UpdateStatementPeriod(DateTime statementFromUtc, DateTime statementToUtc)
    {
        if (statementToUtc < statementFromUtc)
        {
            throw new ArgumentException("Statement end date cannot be earlier than statement start date.");
        }

        StatementFromUtc = statementFromUtc;
        StatementToUtc = statementToUtc;
    }

    public void SetSourceReference(string sourceReference)
    {
        if (string.IsNullOrWhiteSpace(sourceReference))
        {
            throw new ArgumentException("Source reference cannot be null or whitespace.", nameof(sourceReference));
        }

        SourceReference = sourceReference.Trim();
    }

    public void SetFileName(string? fileName)
    {
        FileName = string.IsNullOrWhiteSpace(fileName) ? null : fileName.Trim();
    }

    public void SetNotes(string? notes)
    {
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }
}