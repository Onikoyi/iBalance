using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseCategory : TenantOwnedEntity
{
    private ExpenseCategory() : base(Guid.Empty) { }

    public ExpenseCategory(Guid id, Guid tenantId, string code, string name, Guid? defaultExpenseLedgerAccountId, bool isActive, string? description = null)
        : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Id is required.", nameof(id));
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));

        Id = id;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        DefaultExpenseLedgerAccountId = defaultExpenseLedgerAccountId;
        IsActive = isActive;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public Guid? DefaultExpenseLedgerAccountId { get; private set; }
    public bool IsActive { get; private set; }
    public string? Description { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
}

