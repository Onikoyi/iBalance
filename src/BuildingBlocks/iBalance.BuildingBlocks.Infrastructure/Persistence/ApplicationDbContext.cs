using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using iBalance.Modules.Platform.Persistence;
using Microsoft.EntityFrameworkCore;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext
{
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICurrentUserService _currentUserService;

    private Guid? CurrentTenantId =>
        _tenantContextAccessor.Current.IsAvailable
            ? _tenantContextAccessor.Current.TenantId
            : null;

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
    public DbSet<SubscriptionPackage> SubscriptionPackages => Set<SubscriptionPackage>();
    public DbSet<BillingSettings> BillingSettings => Set<BillingSettings>();
    public DbSet<TenantSubscriptionApplication> TenantSubscriptionApplications => Set<TenantSubscriptionApplication>();
    public DbSet<TenantLicense> TenantLicenses => Set<TenantLicense>();

    public DbSet<LedgerAccount> LedgerAccounts => Set<LedgerAccount>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();
    public DbSet<LedgerMovement> LedgerMovements => Set<LedgerMovement>();
    public DbSet<FiscalPeriod> FiscalPeriods => Set<FiscalPeriod>();
    public DbSet<JournalNumberSequence> JournalNumberSequences => Set<JournalNumberSequence>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.HasDefaultSchema("public");

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PlatformPersistenceMarker).Assembly);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FinancePersistenceMarker).Assembly);

        modelBuilder.Entity<SubscriptionPackage>(builder =>
        {
            builder.ToTable("SubscriptionPackages", "platform");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedNever();
            builder.Property(x => x.Code).HasMaxLength(50).IsRequired();
            builder.Property(x => x.Name).HasMaxLength(120).IsRequired();
            builder.Property(x => x.Description).HasMaxLength(500);
            builder.Property(x => x.CurrencyCode).HasMaxLength(10).IsRequired();
            builder.Property(x => x.MonthlyPrice).HasPrecision(18, 2);
            builder.HasIndex(x => x.Code).IsUnique();
        });

        modelBuilder.Entity<BillingSettings>(builder =>
        {
            builder.ToTable("BillingSettings", "platform");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedNever();
            builder.Property(x => x.AccountName).HasMaxLength(200);
            builder.Property(x => x.BankName).HasMaxLength(200);
            builder.Property(x => x.AccountNumber).HasMaxLength(50);
            builder.Property(x => x.SupportEmail).HasMaxLength(200);
            builder.Property(x => x.PaymentInstructions).HasMaxLength(2000);
        });

        modelBuilder.Entity<TenantSubscriptionApplication>(builder =>
        {
            builder.ToTable("TenantSubscriptionApplications", "platform");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedNever();
            builder.Property(x => x.CompanyName).HasMaxLength(200).IsRequired();
            builder.Property(x => x.DesiredTenantKey).HasMaxLength(100).IsRequired();
            builder.Property(x => x.AdminFirstName).HasMaxLength(100).IsRequired();
            builder.Property(x => x.AdminLastName).HasMaxLength(100).IsRequired();
            builder.Property(x => x.AdminEmail).HasMaxLength(256).IsRequired();
            builder.Property(x => x.AdminPasswordHash).HasMaxLength(512).IsRequired();
            builder.Property(x => x.AdminPasswordSalt).HasMaxLength(256).IsRequired();
            builder.Property(x => x.PackageCodeSnapshot).HasMaxLength(50).IsRequired();
            builder.Property(x => x.PackageNameSnapshot).HasMaxLength(120).IsRequired();
            builder.Property(x => x.AmountSnapshot).HasPrecision(18, 2);
            builder.Property(x => x.CurrencyCodeSnapshot).HasMaxLength(10).IsRequired();
            builder.Property(x => x.PaymentReference).HasMaxLength(100).IsRequired();
            builder.Property(x => x.PaymentConfirmationNote).HasMaxLength(1000);
            builder.Property(x => x.RejectionReason).HasMaxLength(1000);
            builder.Property(x => x.ConfirmedByUserId).HasMaxLength(100);
            builder.HasIndex(x => x.PaymentReference).IsUnique();
            builder.HasIndex(x => x.DesiredTenantKey);
            builder.HasOne<SubscriptionPackage>()
                .WithMany()
                .HasForeignKey(x => x.SubscriptionPackageId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TenantLicense>(builder =>
        {
            builder.ToTable("TenantLicenses", "platform");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedNever();
            builder.Property(x => x.PackageName).HasMaxLength(120).IsRequired();
            builder.Property(x => x.CurrencyCode).HasMaxLength(10).IsRequired();
            builder.Property(x => x.AmountPaid).HasPrecision(18, 2);
            builder.HasIndex(x => x.TenantId).IsUnique();
        });

        modelBuilder.Entity<UserAccount>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<TenantLicense>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<LedgerAccount>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<JournalEntry>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<LedgerMovement>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FiscalPeriod>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<JournalNumberSequence>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
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
            .Where(entry => entry.State is EntityState.Added or EntityState.Modified or EntityState.Deleted);

        foreach (var entry in entries)
        {
            if (!_tenantContextAccessor.Current.IsAvailable)
            {
                throw new InvalidOperationException("Tenant context is required for tenant-owned entities.");
            }

            var currentTenantId = _tenantContextAccessor.Current.TenantId;

            if (entry.State == EntityState.Added)
            {
                entry.Entity.AssignTenant(currentTenantId);
                continue;
            }

            if (entry.Entity.TenantId != currentTenantId)
            {
                throw new InvalidOperationException("Cross-tenant data access is not allowed.");
            }
        }
    }
}