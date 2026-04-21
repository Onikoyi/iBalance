using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BudgetTransfer : TenantOwnedEntity
{
    private BudgetTransfer()
    {
    }

    public BudgetTransfer(
        Guid id,
        Guid tenantId,
        Guid budgetId,
        Guid fromBudgetLineId,
        Guid toBudgetLineId,
        decimal amount,
        string reason,
        string? createdBy)
        : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Budget transfer id is required.", nameof(id));
        if (budgetId == Guid.Empty) throw new ArgumentException("Budget id is required.", nameof(budgetId));
        if (fromBudgetLineId == Guid.Empty) throw new ArgumentException("Source budget line is required.", nameof(fromBudgetLineId));
        if (toBudgetLineId == Guid.Empty) throw new ArgumentException("Destination budget line is required.", nameof(toBudgetLineId));
        if (fromBudgetLineId == toBudgetLineId) throw new ArgumentException("Source and destination budget lines cannot be the same.");
        if (amount <= 0m) throw new ArgumentException("Transfer amount must be greater than zero.", nameof(amount));
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Transfer reason is required.", nameof(reason));

        Id = id;
        BudgetId = budgetId;
        FromBudgetLineId = fromBudgetLineId;
        ToBudgetLineId = toBudgetLineId;
        Amount = amount;
        Reason = reason.Trim();
        TransferredBy = string.IsNullOrWhiteSpace(createdBy) ? null : createdBy.Trim();
        TransferredOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }

    public Guid BudgetId { get; private set; }

    public Guid FromBudgetLineId { get; private set; }

    public Guid ToBudgetLineId { get; private set; }

    public decimal Amount { get; private set; }

    public string Reason { get; private set; } = string.Empty;

    public string? TransferredBy { get; private set; }

    public DateTime TransferredOnUtc { get; private set; }
}