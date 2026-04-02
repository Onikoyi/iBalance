namespace iBalance.BuildingBlocks.Application.Tenancy;

public interface ITenantContext
{
    Guid TenantId { get; }
    string TenantKey { get; }
    bool IsAvailable { get; }
}