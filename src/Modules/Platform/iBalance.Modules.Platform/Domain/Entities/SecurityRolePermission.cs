namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class SecurityRolePermission
{
    private SecurityRolePermission()
    {
    }

    public SecurityRolePermission(Guid id, Guid tenantId, Guid securityRoleId, Guid securityPermissionId)
    {
        Id = id;
        TenantId = tenantId;
        SecurityRoleId = securityRoleId;
        SecurityPermissionId = securityPermissionId;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid SecurityRoleId { get; private set; }
    public Guid SecurityPermissionId { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
}
