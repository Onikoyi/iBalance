using iBalance.BuildingBlocks.Application.Tenancy;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.DesignTime;

internal sealed class DesignTimeTenantContextAccessor : ITenantContextAccessor
{
    private sealed class DesignTimeTenantContext : ITenantContext
    {
        public Guid TenantId => Guid.Parse("11111111-1111-1111-1111-111111111111");
        public string TenantKey => "design-time";
        public bool IsAvailable => true;
    }

    public ITenantContext Current { get; } = new DesignTimeTenantContext();

    public void SetTenant(Guid tenantId, string tenantKey)
    {
    }

    public void Clear()
    {
    }
}