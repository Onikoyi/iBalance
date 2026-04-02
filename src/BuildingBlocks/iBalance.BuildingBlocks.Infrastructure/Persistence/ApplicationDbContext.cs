using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Platform.Domain.Entities;
using iBalance.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICurrentUserService _currentUserService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ITenantContextAccessor tenantContextAccessor,
        ICurrentUserService currentUserService)
        : base(options)
    {
        _tenantContextAccessor = tenantContextAccessor;
        _currentUserService = currentUserService;
    }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("public");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PlatformPersistenceMarker).Assembly);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditing();
        ApplyTenantOwnershipRules();

        return await base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        ApplyAuditing();
        ApplyTenantOwnershipRules();

        return base.SaveChanges();
    }

    private void ApplyAuditing()
    {
        var entries = ChangeTracker
            .Entries<AuditableEntity>()
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified);

        foreach (var entry in entries)
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.SetCreated(_currentUserService.UserId);
            }

            if (entry.State == EntityState.Modified)
            {
                entry.Entity.SetModified(_currentUserService.UserId);
            }
        }
    }

    private void ApplyTenantOwnershipRules()
    {
        var entries = ChangeTracker
            .Entries<TenantOwnedEntity>()
            .Where(entry => entry.State == EntityState.Added);

        foreach (var entry in entries)
        {
            if (!_tenantContextAccessor.Current.IsAvailable)
            {
                throw new InvalidOperationException("Tenant context is required for tenant-owned entities.");
            }

            typeof(TenantOwnedEntity)
                .GetProperty(nameof(TenantOwnedEntity.TenantId))!
                .SetValue(entry.Entity, _tenantContextAccessor.Current.TenantId);
        }
    }
}