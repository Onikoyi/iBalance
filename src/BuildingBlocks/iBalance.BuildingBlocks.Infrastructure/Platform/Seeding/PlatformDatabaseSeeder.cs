using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace iBalance.BuildingBlocks.Infrastructure.Platform.Seeding;

public sealed class PlatformDatabaseSeeder
{
    private static readonly Guid DefaultTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PlatformDatabaseSeeder> _logger;

    public PlatformDatabaseSeeder(
        ApplicationDbContext dbContext,
        ILogger<PlatformDatabaseSeeder> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.MigrateAsync(cancellationToken);

        var tenantExists = await _dbContext.Tenants
            .AsNoTracking()
            .AnyAsync(x => x.Key == "demo-tenant", cancellationToken);

        if (tenantExists)
        {
            _logger.LogInformation("Default tenant already exists.");
            return;
        }

        var tenant = new Tenant(
            DefaultTenantId,
            "Demo Tenant",
            "demo-tenant",
            TenantStatus.Active);

        _dbContext.Tenants.Add(tenant);
        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Default tenant seeded successfully.");
    }
}