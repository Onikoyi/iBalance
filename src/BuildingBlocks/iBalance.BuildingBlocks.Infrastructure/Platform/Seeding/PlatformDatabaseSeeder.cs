using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.BuildingBlocks.Infrastructure.Security;
using iBalance.Modules.Platform.Domain.Entities;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace iBalance.BuildingBlocks.Infrastructure.Platform.Seeding;

public sealed class PlatformDatabaseSeeder
{
    private static readonly Guid DefaultTenantId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid DefaultAdminUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid DefaultBillingSettingsId = Guid.Parse("33333333-3333-3333-3333-333333333333");

    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<PlatformDatabaseSeeder> _logger;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly PasswordHasher _passwordHasher;

    public PlatformDatabaseSeeder(
        ApplicationDbContext dbContext,
        ILogger<PlatformDatabaseSeeder> logger,
        ITenantContextAccessor tenantContextAccessor,
        PasswordHasher passwordHasher)
    {
        _dbContext = dbContext;
        _logger = logger;
        _tenantContextAccessor = tenantContextAccessor;
        _passwordHasher = passwordHasher;
    }

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.MigrateAsync(cancellationToken);

        var tenant = await _dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Key == "demo-tenant", cancellationToken);

        if (tenant is null)
        {
            tenant = new Tenant(
                DefaultTenantId,
                "Demo Tenant",
                "demo-tenant",
                TenantStatus.Active);

            _dbContext.Tenants.Add(tenant);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Default tenant seeded successfully.");
        }
        else
        {
            _logger.LogInformation("Default tenant already exists.");
        }

        _tenantContextAccessor.SetTenant(tenant.Id, tenant.Key);

        var adminExists = await _dbContext.UserAccounts
            .AsNoTracking()
            .AnyAsync(x => x.Email == "admin@demo-tenant.com", cancellationToken);

        if (!adminExists)
        {
            var password = _passwordHasher.HashPassword("Password123!");

            var adminUser = new UserAccount(
                DefaultAdminUserId,
                tenant.Id,
                "admin@demo-tenant.com",
                "Demo",
                "Admin",
                "TenantAdmin",
                password.Hash,
                password.Salt,
                true);

            _dbContext.UserAccounts.Add(adminUser);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Default demo tenant admin user seeded successfully.");
        }

        var billingSettings = await _dbContext.BillingSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (billingSettings is null)
        {
            billingSettings = new BillingSettings(
                DefaultBillingSettingsId,
                "Nikosoft Technologies",
                "Your Bank Name",
                "0000000000",
                "billing@nikosoft.example",
                "Use your payment reference when making direct bank transfer. Your tenant will be activated after payment confirmation.");

            _dbContext.BillingSettings.Add(billingSettings);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Default billing settings seeded successfully.");
        }

        var packageCount = await _dbContext.SubscriptionPackages.CountAsync(cancellationToken);
        if (packageCount == 0)
        {
            _dbContext.SubscriptionPackages.AddRange(
                new SubscriptionPackage(
                    Guid.NewGuid(),
                    "STARTER",
                    "Starter",
                    "For small teams proving finance discipline.",
                    25000m,
                    "NGN",
                    1,
                    true,
                    true),
                new SubscriptionPackage(
                    Guid.NewGuid(),
                    "BUSINESS",
                    "Business",
                    "For growing organizations with stronger controls.",
                    75000m,
                    "NGN",
                    2,
                    true,
                    true),
                new SubscriptionPackage(
                    Guid.NewGuid(),
                    "ENTERPRISE",
                    "Enterprise",
                    "For regulated and high-scale tenants.",
                    0m,
                    "NGN",
                    3,
                    true,
                    true));

            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Default subscription packages seeded successfully.");
        }

        var licenseExists = await _dbContext.TenantLicenses
            .AsNoTracking()
            .AnyAsync(cancellationToken);

        if (!licenseExists)
        {
            var start = DateTime.UtcNow.Date;
            var end = start.AddYears(1).AddDays(-1);

            var demoLicense = new TenantLicense(
                Guid.NewGuid(),
                start,
                end,
                "Business",
                75000m,
                "NGN");

            _dbContext.TenantLicenses.Add(demoLicense);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Default demo tenant license seeded successfully.");
        }
    }
}