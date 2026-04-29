namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollPayGroup
{
    private PayrollPayGroup()
    {
    }

    public PayrollPayGroup(Guid id, Guid tenantId, string code, string name, string? description, bool isActive)
    {
        Id = id;
        TenantId = tenantId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = description?.Trim();
        IsActive = isActive;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public void Update(string name, string? description, bool isActive)
    {
        Name = name.Trim();
        Description = description?.Trim();
        IsActive = isActive;
    }
}
