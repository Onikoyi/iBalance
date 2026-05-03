namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class UserSecurityRoleAssignment
{
    private UserSecurityRoleAssignment()
    {
    }

    public UserSecurityRoleAssignment(Guid id, Guid tenantId, Guid userAccountId, Guid securityRoleId, bool isPrimary)
    {
        Id = id;
        TenantId = tenantId;
        UserAccountId = userAccountId;
        SecurityRoleId = securityRoleId;
        IsPrimary = isPrimary;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid UserAccountId { get; private set; }
    public Guid SecurityRoleId { get; private set; }
    public bool IsPrimary { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
}
