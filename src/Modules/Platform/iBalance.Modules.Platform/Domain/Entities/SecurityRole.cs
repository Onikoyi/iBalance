namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class SecurityRole
{
    private SecurityRole()
    {
    }

    public SecurityRole(
        Guid id,
        Guid tenantId,
        string code,
        string name,
        string? description,
        bool isSystemDefined,
        bool isActive)
    {
        Id = id;
        TenantId = tenantId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsSystemDefined = isSystemDefined;
        IsActive = isActive;
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Code { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public bool IsSystemDefined { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }

    public void Update(string name, string? description, bool isActive)
    {
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        IsActive = isActive;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
