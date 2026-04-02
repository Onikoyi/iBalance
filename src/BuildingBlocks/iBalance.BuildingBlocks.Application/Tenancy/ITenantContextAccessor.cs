namespace iBalance.BuildingBlocks.Application.Tenancy;

public interface ITenantContextAccessor
{
    ITenantContext Current { get; }
    void SetTenant(Guid tenantId, string tenantKey);
    void Clear();
}