using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseAdvanceType : TenantOwnedEntity
{
    private ExpenseAdvanceType() : base(Guid.Empty) { }

    public ExpenseAdvanceType(Guid id, Guid tenantId, string code, string name, AdvanceTypeCategory category, bool requiresRetirement, bool isImprest, bool isActive, string? description = null)
        : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Id is required.", nameof(id));
        if (string.IsNullOrWhiteSpace(code)) throw new ArgumentException("Code is required.", nameof(code));
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));

        Id = id;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Category = category;
        RequiresRetirement = requiresRetirement;
        IsImprest = isImprest;
        IsActive = isActive;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public AdvanceTypeCategory Category { get; private set; }
    public bool RequiresRetirement { get; private set; }
    public bool IsImprest { get; private set; }
    public bool IsActive { get; private set; }
    public string? Description { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Update(string name, AdvanceTypeCategory category, bool requiresRetirement, bool isImprest, bool isActive, string? description)
    {
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Name is required.", nameof(name));
        Name = name.Trim();
        Category = category;
        RequiresRetirement = requiresRetirement;
        IsImprest = isImprest;
        IsActive = isActive;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }
}
