namespace iBalance.Modules.Platform.Application.Abstractions;

public interface ITenantLookupService
{
    Task<TenantLookupResult?> GetByKeyAsync(string tenantKey, CancellationToken cancellationToken = default);
}

public sealed record TenantLookupResult(Guid TenantId, string TenantKey, string TenantName);