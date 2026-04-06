namespace iBalance.BuildingBlocks.Domain.Common;

public abstract class TenantOwnedEntity : AuditableEntity
{
    public Guid TenantId { get; protected set; }

    protected TenantOwnedEntity(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        }

        TenantId = tenantId;
    }

    protected TenantOwnedEntity()
    {
    }

    public void AssignTenant(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        }

        TenantId = tenantId;
    }
}