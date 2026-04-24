using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FixedAssetTransaction : TenantOwnedEntity
{
    private FixedAssetTransaction()
    {
    }

    public FixedAssetTransaction(
        Guid id,
        Guid tenantId,
        Guid fixedAssetId,
        FixedAssetTransactionType transactionType,
        DateTime transactionDateUtc,
        decimal amount,
        string description,
        Guid? journalEntryId = null,
        string? reference = null,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Fixed asset transaction id cannot be empty.", nameof(id));
        if (fixedAssetId == Guid.Empty) throw new ArgumentException("Fixed asset id is required.", nameof(fixedAssetId));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));
        if (amount < 0m) throw new ArgumentException("Amount cannot be negative.", nameof(amount));

        Id = id;
        FixedAssetId = fixedAssetId;
        TransactionType = transactionType;
        TransactionDateUtc = transactionDateUtc;
        Amount = amount;
        Description = description.Trim();
        JournalEntryId = journalEntryId;
        Reference = string.IsNullOrWhiteSpace(reference) ? null : reference.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public Guid Id { get; private set; }
    public Guid FixedAssetId { get; private set; }
    public FixedAssetTransactionType TransactionType { get; private set; }
    public DateTime TransactionDateUtc { get; private set; }
    public decimal Amount { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public Guid? JournalEntryId { get; private set; }
    public string? Reference { get; private set; }
    public string? Notes { get; private set; }
}
