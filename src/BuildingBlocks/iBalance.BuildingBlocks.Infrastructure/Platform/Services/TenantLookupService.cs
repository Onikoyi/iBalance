using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace iBalance.BuildingBlocks.Infrastructure.Platform.Services;

internal sealed class TenantLookupService : ITenantLookupService
{
    private readonly ApplicationDbContext _dbContext;

    public TenantLookupService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<TenantLookupResult?> GetByKeyAsync(string tenantKey, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tenantKey))
        {
            return null;
        }

        var normalizedKey = tenantKey.Trim().ToLowerInvariant();

        var tenant = await _dbContext.Tenants
            .AsNoTracking()
            .Where(x => x.Key == normalizedKey)
            .Select(x => new TenantLookupResult(x.Id, x.Key, x.Name))
            .FirstOrDefaultAsync(cancellationToken);

        return tenant;
    }
}