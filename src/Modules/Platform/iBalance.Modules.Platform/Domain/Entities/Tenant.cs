using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Platform.Domain.Enums;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class Tenant : AuditableEntity
{
    private Tenant()
    {
    }

    public Tenant(Guid id, string name, string key, TenantStatus status)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Tenant id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Tenant name cannot be null or whitespace.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Tenant key cannot be null or whitespace.", nameof(key));
        }

        Id = id;
        Name = name.Trim();
        Key = key.Trim().ToLowerInvariant();
        Status = status;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Key { get; private set; } = string.Empty;

    public TenantStatus Status { get; private set; }

    public void Suspend()
    {
        Status = TenantStatus.Suspended;
    }

    public void Activate()
    {
        Status = TenantStatus.Active;
    }

    public void Disable()
    {
        Status = TenantStatus.Disabled;
    }
}