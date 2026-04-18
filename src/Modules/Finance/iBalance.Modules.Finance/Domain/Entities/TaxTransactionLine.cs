using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class TaxTransactionLine : TenantOwnedEntity
{
    private TaxTransactionLine()
    {
    }

    public TaxTransactionLine(
        Guid id,
        Guid tenantId,
        Guid taxCodeId,
        DateTime transactionDateUtc,
        string sourceModule,
        string sourceDocumentType,
        Guid sourceDocumentId,
        string sourceDocumentNumber,
        decimal taxableAmount,
        decimal taxAmount,
        TaxComponentKind componentKind,
        TaxApplicationMode applicationMode,
        TaxTransactionScope transactionScope,
        decimal ratePercent,
        Guid taxLedgerAccountId,
        Guid? counterpartyId = null,
        string? counterpartyCode = null,
        string? counterpartyName = null,
        string? description = null,
        Guid? journalEntryId = null) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Tax transaction line id cannot be empty.", nameof(id));
        }

        if (taxCodeId == Guid.Empty)
        {
            throw new ArgumentException("Tax code id cannot be empty.", nameof(taxCodeId));
        }

        if (string.IsNullOrWhiteSpace(sourceModule))
        {
            throw new ArgumentException("Source module cannot be null or whitespace.", nameof(sourceModule));
        }

        if (string.IsNullOrWhiteSpace(sourceDocumentType))
        {
            throw new ArgumentException("Source document type cannot be null or whitespace.", nameof(sourceDocumentType));
        }

        if (sourceDocumentId == Guid.Empty)
        {
            throw new ArgumentException("Source document id cannot be empty.", nameof(sourceDocumentId));
        }

        if (string.IsNullOrWhiteSpace(sourceDocumentNumber))
        {
            throw new ArgumentException("Source document number cannot be null or whitespace.", nameof(sourceDocumentNumber));
        }

        if (taxableAmount < 0m)
        {
            throw new ArgumentException("Taxable amount cannot be negative.", nameof(taxableAmount));
        }

        if (taxAmount < 0m)
        {
            throw new ArgumentException("Tax amount cannot be negative.", nameof(taxAmount));
        }

        if (ratePercent < 0m || ratePercent > 100m)
        {
            throw new ArgumentException("Tax rate must be between 0 and 100 percent.", nameof(ratePercent));
        }

        if (taxLedgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Tax ledger account id cannot be empty.", nameof(taxLedgerAccountId));
        }

        Id = id;
        TaxCodeId = taxCodeId;
        TransactionDateUtc = transactionDateUtc;
        SourceModule = sourceModule.Trim();
        SourceDocumentType = sourceDocumentType.Trim();
        SourceDocumentId = sourceDocumentId;
        SourceDocumentNumber = sourceDocumentNumber.Trim();
        TaxableAmount = taxableAmount;
        TaxAmount = taxAmount;
        ComponentKind = componentKind;
        ApplicationMode = applicationMode;
        TransactionScope = transactionScope;
        RatePercent = ratePercent;
        TaxLedgerAccountId = taxLedgerAccountId;
        CounterpartyId = counterpartyId;
        CounterpartyCode = string.IsNullOrWhiteSpace(counterpartyCode) ? null : counterpartyCode.Trim();
        CounterpartyName = string.IsNullOrWhiteSpace(counterpartyName) ? null : counterpartyName.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        JournalEntryId = journalEntryId;
    }

    public Guid Id { get; private set; }

    public Guid TaxCodeId { get; private set; }

    public TaxCode? TaxCode { get; private set; }

    public DateTime TransactionDateUtc { get; private set; }

    public string SourceModule { get; private set; } = string.Empty;

    public string SourceDocumentType { get; private set; } = string.Empty;

    public Guid SourceDocumentId { get; private set; }

    public string SourceDocumentNumber { get; private set; } = string.Empty;

    public decimal TaxableAmount { get; private set; }

    public decimal TaxAmount { get; private set; }

    public TaxComponentKind ComponentKind { get; private set; }

    public TaxApplicationMode ApplicationMode { get; private set; }

    public TaxTransactionScope TransactionScope { get; private set; }

    public decimal RatePercent { get; private set; }

    public Guid TaxLedgerAccountId { get; private set; }

    public LedgerAccount? TaxLedgerAccount { get; private set; }

    public Guid? CounterpartyId { get; private set; }

    public string? CounterpartyCode { get; private set; }

    public string? CounterpartyName { get; private set; }

    public string? Description { get; private set; }

    public Guid? JournalEntryId { get; private set; }

    public JournalEntry? JournalEntry { get; private set; }

    public void LinkJournalEntry(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty)
        {
            throw new ArgumentException("Journal entry id cannot be empty.", nameof(journalEntryId));
        }

        JournalEntryId = journalEntryId;
    }

    public void SetDescription(string? description)
    {
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }
}