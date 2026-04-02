using iBalance.BuildingBlocks.Application.Tenancy;

namespace iBalance.BuildingBlocks.Infrastructure.Tenancy;

internal sealed class TenantContextAccessor : ITenantContextAccessor
{
    private ITenantContext _current = TenantContext.Unavailable;

    public ITenantContext Current => _current;

    public void SetTenant(Guid tenantId, string tenantKey)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        }

        if (string.IsNullOrWhiteSpace(tenantKey))
        {
            throw new ArgumentException("TenantKey cannot be null or whitespace.", nameof(tenantKey));
        }

        _current = new TenantContext(tenantId, tenantKey);
    }

    public void Clear()
    {
        _current = TenantContext.Unavailable;
    }
}