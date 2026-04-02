using iBalance.BuildingBlocks.Application.Tenancy;

namespace iBalance.BuildingBlocks.Infrastructure.Tenancy;

internal sealed class TenantContext : ITenantContext
{
    public static readonly TenantContext Unavailable = new(Guid.Empty, string.Empty);

    public TenantContext(Guid tenantId, string tenantKey)
    {
        TenantId = tenantId;
        TenantKey = tenantKey;
    }

    public Guid TenantId { get; }

    public string TenantKey { get; }

    public bool IsAvailable => TenantId != Guid.Empty && !string.IsNullOrWhiteSpace(TenantKey);
}