using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class InventoryTransaction : TenantOwnedEntity
{
    private InventoryTransaction()
    {
    }

    public InventoryTransaction(
        Guid id,
        Guid tenantId,
        string transactionNumber,
        InventoryTransactionType transactionType,
        DateTime transactionDateUtc,
        string description,
        string? reference = null,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Inventory transaction id cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(transactionNumber)) throw new ArgumentException("Transaction number is required.", nameof(transactionNumber));
        if (transactionDateUtc == default) throw new ArgumentException("Transaction date is required.", nameof(transactionDateUtc));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));

        Id = id;
        TransactionNumber = transactionNumber.Trim().ToUpperInvariant();
        TransactionType = transactionType;
        TransactionDateUtc = transactionDateUtc;
        Description = description.Trim();
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        Status = InventoryTransactionStatus.Posted;
    }

    public Guid Id { get; private set; }
    public string TransactionNumber { get; private set; } = string.Empty;
    public InventoryTransactionType TransactionType { get; private set; }
    public DateTime TransactionDateUtc { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public string? Reference { get; private set; }
    public string? Notes { get; private set; }
    public InventoryTransactionStatus Status { get; private set; }
    public Guid? JournalEntryId { get; private set; }

    public ICollection<InventoryTransactionLine> Lines { get; private set; } = new List<InventoryTransactionLine>();

    public void LinkJournal(Guid journalEntryId)
    {
        if (journalEntryId == Guid.Empty) throw new ArgumentException("Journal entry id cannot be empty.", nameof(journalEntryId));
        if (JournalEntryId.HasValue) throw new InvalidOperationException("Inventory transaction is already linked to a journal entry.");
        JournalEntryId = journalEntryId;
    }
}
