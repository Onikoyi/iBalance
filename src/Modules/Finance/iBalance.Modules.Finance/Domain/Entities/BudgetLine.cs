using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BudgetLine : TenantOwnedEntity
{
    private BudgetLine()
    {
    }

    public BudgetLine(
        Guid id,
        Guid tenantId,
        Guid budgetId,
        Guid ledgerAccountId,
        DateTime periodStartUtc,
        DateTime periodEndUtc,
        decimal budgetAmount,
        string? notes)
        : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Budget line id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (budgetId == Guid.Empty)
        {
            throw new ArgumentException("Budget id is required.", nameof(budgetId));
        }

        if (ledgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Ledger account is required.", nameof(ledgerAccountId));
        }

        if (periodEndUtc < periodStartUtc)
        {
            throw new ArgumentException("Budget line period end date cannot be earlier than period start date.");
        }

        if (budgetAmount < 0m)
        {
            throw new ArgumentException("Budget amount cannot be negative.", nameof(budgetAmount));
        }

        Id = id;
        BudgetId = budgetId;
        LedgerAccountId = ledgerAccountId;
        PeriodStartUtc = periodStartUtc;
        PeriodEndUtc = periodEndUtc;
        BudgetAmount = budgetAmount;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public Guid Id { get; private set; }

    public Guid BudgetId { get; private set; }

    public Budget Budget { get; private set; } = null!;

    public Guid LedgerAccountId { get; private set; }

    public LedgerAccount LedgerAccount { get; private set; } = null!;

    public DateTime PeriodStartUtc { get; private set; }

    public DateTime PeriodEndUtc { get; private set; }

    public decimal BudgetAmount { get; private set; }

    public string? Notes { get; private set; }

    public void Update(
        Guid ledgerAccountId,
        DateTime periodStartUtc,
        DateTime periodEndUtc,
        decimal budgetAmount,
        string? notes)
    {
        if (ledgerAccountId == Guid.Empty)
        {
            throw new ArgumentException("Ledger account is required.", nameof(ledgerAccountId));
        }

        if (periodEndUtc < periodStartUtc)
        {
            throw new ArgumentException("Budget line period end date cannot be earlier than period start date.");
        }

        if (budgetAmount < 0m)
        {
            throw new ArgumentException("Budget amount cannot be negative.", nameof(budgetAmount));
        }

        LedgerAccountId = ledgerAccountId;
        PeriodStartUtc = periodStartUtc;
        PeriodEndUtc = periodEndUtc;
        BudgetAmount = budgetAmount;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }
}