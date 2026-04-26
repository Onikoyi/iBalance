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
    public DbSet<BankReconciliation> BankReconciliations => Set<BankReconciliation>();
    public DbSet<BankAccount> BankAccounts => Set<BankAccount>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<InventoryTransactionLine> InventoryTransactionLines => Set<InventoryTransactionLine>();
    public DbSet<StockLedgerEntry> StockLedgerEntries => Set<StockLedgerEntry>();
    public DbSet<BankReconciliationLine> BankReconciliationLines => Set<BankReconciliationLine>();
    public DbSet<BankStatementImport> BankStatementImports => Set<BankStatementImport>();
    public DbSet<BankStatementImportLine> BankStatementImportLines => Set<BankStatementImportLine>();
    public DbSet<BankReconciliationMatch> BankReconciliationMatches => Set<BankReconciliationMatch>();
    public DbSet<TaxCode> TaxCodes => Set<TaxCode>();
    public DbSet<TaxTransactionLine> TaxTransactionLines => Set<TaxTransactionLine>();
    public DbSet<SalesInvoiceTaxLine> SalesInvoiceTaxLines => Set<SalesInvoiceTaxLine>();
    public DbSet<PurchaseInvoiceTaxLine> PurchaseInvoiceTaxLines => Set<PurchaseInvoiceTaxLine>();
    public DbSet<FiscalPeriod> FiscalPeriods => Set<FiscalPeriod>();
    public DbSet<JournalNumberSequence> JournalNumberSequences => Set<JournalNumberSequence>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<SalesInvoice> SalesInvoices => Set<SalesInvoice>();
    public DbSet<SalesInvoiceLine> SalesInvoiceLines => Set<SalesInvoiceLine>();
    public DbSet<CustomerReceipt> CustomerReceipts => Set<CustomerReceipt>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<PurchaseInvoice> PurchaseInvoices => Set<PurchaseInvoice>();
    public DbSet<PurchaseInvoiceLine> PurchaseInvoiceLines => Set<PurchaseInvoiceLine>();
    public DbSet<VendorPayment> VendorPayments => Set<VendorPayment>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<BudgetLine> BudgetLines => Set<BudgetLine>();
    public DbSet<BudgetTransfer> BudgetTransfers => Set<BudgetTransfer>();
    public DbSet<FixedAssetClass> FixedAssetClasses => Set<FixedAssetClass>();
    public DbSet<FixedAsset> FixedAssets => Set<FixedAsset>();
    public DbSet<FixedAssetTransaction> FixedAssetTransactions => Set<FixedAssetTransaction>();
    public DbSet<FixedAssetDepreciationRun> FixedAssetDepreciationRuns => Set<FixedAssetDepreciationRun>();
    public DbSet<FixedAssetDepreciationLine> FixedAssetDepreciationLines => Set<FixedAssetDepreciationLine>();
    public DbSet<FixedAssetDisposal> FixedAssetDisposals => Set<FixedAssetDisposal>();

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
        modelBuilder.Entity<BankAccount>(entity =>
        {
            entity.ToTable("BankAccounts", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Name)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.BankName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.AccountNumber)
                .HasMaxLength(80)
                .IsRequired();

            entity.Property(x => x.Branch)
                .HasMaxLength(200);

            entity.Property(x => x.CurrencyCode)
                .HasMaxLength(10)
                .IsRequired();

            entity.Property(x => x.Notes)
                .HasMaxLength(1000);

            entity.HasIndex(x => new { x.TenantId, x.AccountNumber })
                .IsUnique();

            entity.HasIndex(x => new { x.TenantId, x.LedgerAccountId })
                .IsUnique();

            entity.HasOne<LedgerAccount>()
                .WithMany()
                .HasForeignKey(x => x.LedgerAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<InventoryItem>(entity =>
        {
            entity.ToTable("InventoryItems", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ItemCode).HasMaxLength(80).IsRequired();
            entity.Property(x => x.ItemName).HasMaxLength(250).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.UnitOfMeasure).HasMaxLength(30).IsRequired();
            entity.Property(x => x.ReorderLevel).HasPrecision(18, 4);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.ItemCode }).IsUnique();
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.ToTable("Warehouses", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.WarehouseCode).HasMaxLength(80).IsRequired();
            entity.Property(x => x.WarehouseName).HasMaxLength(250).IsRequired();
            entity.Property(x => x.Location).HasMaxLength(500);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.WarehouseCode }).IsUnique();
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<InventoryTransaction>(entity =>
        {
            entity.ToTable("InventoryTransactions", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.TransactionNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => x.JournalEntryId);
            entity.HasOne<JournalEntry>()
                .WithMany()
                .HasForeignKey(x => x.JournalEntryId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => new { x.TenantId, x.TransactionNumber }).IsUnique();
            entity.HasMany(x => x.Lines)
                .WithOne()
                .HasForeignKey(x => x.InventoryTransactionId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<InventoryTransactionLine>(entity =>
        {
            entity.ToTable("InventoryTransactionLines", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Quantity).HasPrecision(18, 4);
            entity.Property(x => x.UnitCost).HasPrecision(18, 4);
            entity.Property(x => x.TotalCost).HasPrecision(18, 2);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.HasOne<InventoryItem>().WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(x => new { x.TenantId, x.InventoryTransactionId });
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<StockLedgerEntry>(entity =>
        {
            entity.ToTable("StockLedgerEntries", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.QuantityIn).HasPrecision(18, 4);
            entity.Property(x => x.QuantityOut).HasPrecision(18, 4);
            entity.Property(x => x.UnitCost).HasPrecision(18, 4);
            entity.Property(x => x.TotalCost).HasPrecision(18, 2);
            entity.Property(x => x.Reference).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.InventoryItemId, x.WarehouseId, x.MovementDateUtc });
            entity.HasOne<InventoryItem>().WithMany().HasForeignKey(x => x.InventoryItemId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<Warehouse>().WithMany().HasForeignKey(x => x.WarehouseId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<InventoryTransaction>().WithMany().HasForeignKey(x => x.InventoryTransactionId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne<InventoryTransactionLine>().WithMany().HasForeignKey(x => x.InventoryTransactionLineId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<CustomerReceipt>(entity =>
        {
            entity.ToTable("CustomerReceipts", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.ReceiptNumber)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Amount)
                .HasPrecision(18, 2);

            entity.Property(x => x.PostingRequiresApproval)
                .HasDefaultValue(true);

            entity.Property(x => x.SubmittedBy)
                .HasMaxLength(100);

            entity.Property(x => x.ApprovedBy)
                .HasMaxLength(100);

            entity.Property(x => x.RejectedBy)
                .HasMaxLength(100);

            entity.Property(x => x.RejectionReason)
                .HasMaxLength(1000);

            entity.Property(x => x.CreatedBy)
                .HasMaxLength(100);

            entity.Property(x => x.LastModifiedBy)
                .HasMaxLength(100);

            entity.HasIndex(x => new { x.TenantId, x.ReceiptNumber })
                .IsUnique();

            entity.HasOne(x => x.Customer)
                .WithMany()
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.SalesInvoice)
                .WithMany()
                .HasForeignKey(x => x.SalesInvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<Customer>(entity =>
        {
            entity.ToTable("Customers", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.CustomerCode)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.CustomerName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Email)
                .HasMaxLength(256);

            entity.Property(x => x.PhoneNumber)
                .HasMaxLength(50);

            entity.Property(x => x.BillingAddress)
                .HasMaxLength(1000);

            entity.HasIndex(x => new { x.TenantId, x.CustomerCode })
                .IsUnique();

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<SalesInvoice>(entity =>
        {
            entity.ToTable("SalesInvoices", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.InvoiceNumber)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.TotalAmount)
                .HasPrecision(18, 2);

            entity.Property(x => x.AmountPaid)
                .HasPrecision(18, 2);

            entity.Property(x => x.BalanceAmount)
                .HasPrecision(18, 2);

            entity.HasIndex(x => new { x.TenantId, x.InvoiceNumber })
                .IsUnique();

            entity.HasOne(x => x.Customer)
                .WithMany(x => x.SalesInvoices)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<SalesInvoiceLine>(entity =>
        {
            entity.ToTable("SalesInvoiceLines", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Description)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Quantity)
                .HasPrecision(18, 2);

            entity.Property(x => x.UnitPrice)
                .HasPrecision(18, 2);

            entity.Property(x => x.LineTotal)
                .HasPrecision(18, 2);

            entity.HasOne(x => x.SalesInvoice)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.SalesInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<Vendor>(entity =>
        {
            entity.ToTable("Vendors", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.VendorCode)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.VendorName)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Email)
                .HasMaxLength(256);

            entity.Property(x => x.PhoneNumber)
                .HasMaxLength(50);

            entity.Property(x => x.BillingAddress)
                .HasMaxLength(1000);

            entity.HasIndex(x => new { x.TenantId, x.VendorCode })
                .IsUnique();

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<PurchaseInvoice>(entity =>
        {
            entity.ToTable("PurchaseInvoices", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.InvoiceNumber)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.TotalAmount)
                .HasPrecision(18, 2);

            entity.Property(x => x.AmountPaid)
                .HasPrecision(18, 2);

            entity.Property(x => x.BalanceAmount)
                .HasPrecision(18, 2);

            entity.HasIndex(x => new { x.TenantId, x.InvoiceNumber })
                .IsUnique();

            entity.HasOne(x => x.Vendor)
                .WithMany(x => x.PurchaseInvoices)
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<PurchaseInvoiceLine>(entity =>
        {
            entity.ToTable("PurchaseInvoiceLines", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Description)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Quantity)
                .HasPrecision(18, 2);

            entity.Property(x => x.UnitPrice)
                .HasPrecision(18, 2);

            entity.Property(x => x.LineTotal)
                .HasPrecision(18, 2);

            entity.HasOne(x => x.PurchaseInvoice)
                .WithMany(x => x.Lines)
                .HasForeignKey(x => x.PurchaseInvoiceId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<VendorPayment>(entity =>
        {
            entity.ToTable("VendorPayments", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.PaymentNumber)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(500)
                .IsRequired();

            entity.Property(x => x.Amount)
                .HasPrecision(18, 2);

            entity.Property(x => x.PostingRequiresApproval)
                .HasDefaultValue(true);

            entity.Property(x => x.SubmittedBy)
                .HasMaxLength(100);

            entity.Property(x => x.ApprovedBy)
                .HasMaxLength(100);

            entity.Property(x => x.RejectedBy)
                .HasMaxLength(100);

            entity.Property(x => x.RejectionReason)
                .HasMaxLength(1000);

            entity.HasIndex(x => new { x.TenantId, x.PaymentNumber })
                .IsUnique();

            entity.HasOne(x => x.Vendor)
                .WithMany()
                .HasForeignKey(x => x.VendorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(x => x.PurchaseInvoice)
                .WithMany()
                .HasForeignKey(x => x.PurchaseInvoiceId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<Budget>(entity =>
{
    entity.ToTable("Budgets", "finance");

    entity.HasKey(x => x.Id);

    entity.Property(x => x.BudgetNumber)
        .HasMaxLength(50)
        .IsRequired();

    entity.Property(x => x.Name)
        .HasMaxLength(200)
        .IsRequired();

    entity.Property(x => x.Description)
        .HasMaxLength(1000)
        .IsRequired();

    entity.Property(x => x.Notes)
        .HasMaxLength(2000);

    entity.Property(x => x.SubmittedBy)
        .HasMaxLength(100);

    entity.Property(x => x.ApprovedBy)
        .HasMaxLength(100);

    entity.Property(x => x.RejectedBy)
        .HasMaxLength(100);

    entity.Property(x => x.RejectionReason)
        .HasMaxLength(1000);

    entity.Property(x => x.LockedBy)
        .HasMaxLength(100);

    entity.HasIndex(x => new { x.TenantId, x.BudgetNumber })
        .IsUnique();

    entity.HasMany(x => x.Lines)
        .WithOne(x => x.Budget)
        .HasForeignKey(x => x.BudgetId)
        .OnDelete(DeleteBehavior.Cascade);

    entity.Property(x => x.ClosedBy)
    .HasMaxLength(100);

    entity.Property(x => x.ClosureReason)
    .HasMaxLength(1000);

    entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
});

modelBuilder.Entity<BudgetLine>(entity =>
{
    entity.ToTable("BudgetLines", "finance");

    entity.HasKey(x => x.Id);

    entity.Property(x => x.BudgetAmount)
        .HasPrecision(18, 2);

    entity.Property(x => x.Notes)
        .HasMaxLength(1000);

    entity.HasOne(x => x.Budget)
        .WithMany(x => x.Lines)
        .HasForeignKey(x => x.BudgetId)
        .OnDelete(DeleteBehavior.Cascade);

    entity.HasOne(x => x.LedgerAccount)
        .WithMany()
        .HasForeignKey(x => x.LedgerAccountId)
        .OnDelete(DeleteBehavior.Restrict);

    entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
});


modelBuilder.Entity<BudgetTransfer>(entity =>
{
    entity.ToTable("BudgetTransfers", "finance");

    entity.HasKey(x => x.Id);

    entity.Property(x => x.Amount)
        .HasPrecision(18, 2);

    entity.Property(x => x.Reason)
        .HasMaxLength(1000)
        .IsRequired();

    entity.Property(x => x.TransferredBy)
        .HasMaxLength(100);

    entity.HasIndex(x => x.BudgetId);

    entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
});



        modelBuilder.Entity<FixedAssetClass>(entity =>
        {
            entity.ToTable("FixedAssetClasses", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Code).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.CapitalizationThreshold).HasPrecision(18, 2);
            entity.Property(x => x.ResidualValuePercentDefault).HasPrecision(9, 4);
            entity.HasIndex(x => new { x.TenantId, x.Code }).IsUnique();
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<FixedAsset>(entity =>
        {
            entity.ToTable("FixedAssets", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AssetNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.AssetName).HasMaxLength(250).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(2000);
            entity.Property(x => x.Location).HasMaxLength(250);
            entity.Property(x => x.Custodian).HasMaxLength(250);
            entity.Property(x => x.SerialNumber).HasMaxLength(250);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.Property(x => x.AcquisitionCost).HasPrecision(18, 2);
            entity.Property(x => x.ResidualValue).HasPrecision(18, 2);
            entity.Property(x => x.AccumulatedDepreciationAmount).HasPrecision(18, 2);
            entity.Property(x => x.ImpairmentAmount).HasPrecision(18, 2);
            entity.Property(x => x.DisposalProceedsAmount).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.TenantId, x.AssetNumber }).IsUnique();
            entity.HasIndex(x => new { x.TenantId, x.PurchaseInvoiceId })
                .HasFilter("\"PurchaseInvoiceId\" IS NOT NULL")
                .IsUnique();
            entity.HasOne<FixedAssetClass>().WithMany().HasForeignKey(x => x.FixedAssetClassId).OnDelete(DeleteBehavior.Restrict);
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<FixedAssetTransaction>(entity =>
        {
            entity.ToTable("FixedAssetTransactions", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.Description).HasMaxLength(1000).IsRequired();
            entity.Property(x => x.Reference).HasMaxLength(100);
            entity.Property(x => x.Notes).HasMaxLength(2000);
            entity.HasIndex(x => new { x.TenantId, x.FixedAssetId, x.TransactionDateUtc, x.TransactionType });
            entity.HasOne<FixedAsset>().WithMany().HasForeignKey(x => x.FixedAssetId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<FixedAssetDepreciationRun>(entity =>
        {
            entity.ToTable("FixedAssetDepreciationRuns", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Description).HasMaxLength(500).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.PeriodStartUtc, x.PeriodEndUtc }).IsUnique();
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<FixedAssetDepreciationLine>(entity =>
        {
            entity.ToTable("FixedAssetDepreciationLines", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DepreciationAmount).HasPrecision(18, 2);
            entity.Property(x => x.OpeningNetBookValue).HasPrecision(18, 2);
            entity.Property(x => x.ClosingNetBookValue).HasPrecision(18, 2);
            entity.HasIndex(x => new { x.TenantId, x.DepreciationRunId, x.FixedAssetId }).IsUnique();
            entity.HasOne<FixedAssetDepreciationRun>().WithMany().HasForeignKey(x => x.DepreciationRunId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<FixedAsset>().WithMany().HasForeignKey(x => x.FixedAssetId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<FixedAssetDisposal>(entity =>
        {
            entity.ToTable("FixedAssetDisposals", "finance");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.DisposalProceedsAmount).HasPrecision(18, 2);
            entity.Property(x => x.NetBookValueAtDisposal).HasPrecision(18, 2);
            entity.Property(x => x.GainOrLossAmount).HasPrecision(18, 2);
            entity.Property(x => x.Notes).HasMaxLength(2000).IsRequired();
            entity.HasIndex(x => new { x.TenantId, x.FixedAssetId }).IsUnique();
            entity.HasOne<FixedAsset>().WithMany().HasForeignKey(x => x.FixedAssetId).OnDelete(DeleteBehavior.Cascade);
            entity.HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);
        });

        modelBuilder.Entity<JournalEntry>(entity =>
        {
            entity.ToTable("JournalEntries", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Reference)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Description)
                .HasMaxLength(1000)
                .IsRequired();

            entity.Property(x => x.PostingRequiresApproval)
                .HasDefaultValue(true);

            entity.Property(x => x.SubmittedBy)
                .HasMaxLength(100);

            entity.Property(x => x.ApprovedBy)
                .HasMaxLength(100);

            entity.Property(x => x.RejectedBy)
                .HasMaxLength(100);

            entity.Property(x => x.RejectionReason)
                .HasMaxLength(1000);

            entity.HasIndex(x => new { x.TenantId, x.Reference })
                .IsUnique();

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
        });

        modelBuilder.Entity<LedgerAccount>(entity =>
        {
            entity.ToTable("LedgerAccounts", "finance");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Code)
                .HasMaxLength(50)
                .IsRequired();

            entity.Property(x => x.Name)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.Purpose)
                .HasMaxLength(500);

            entity.Property(x => x.IsCashOrBankAccount)
                .IsRequired()
                .HasDefaultValue(false);

            entity.HasIndex(x => new { x.TenantId, x.Code })
                .IsUnique();

            entity.HasQueryFilter(x => x.TenantId == _tenantContextAccessor.Current.TenantId);
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

        modelBuilder.Entity<Vendor>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<PurchaseInvoice>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<PurchaseInvoiceLine>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<VendorPayment>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<Budget>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<BudgetLine>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<BudgetTransfer>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FixedAssetClass>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FixedAsset>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FixedAssetTransaction>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FixedAssetDepreciationRun>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FixedAssetDepreciationLine>()
            .HasQueryFilter(x => CurrentTenantId.HasValue && x.TenantId == CurrentTenantId.Value);

        modelBuilder.Entity<FixedAssetDisposal>()
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
        foreach (var entry in ChangeTracker.Entries<TenantOwnedEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                if (!CurrentTenantId.HasValue)
                {
                    throw new InvalidOperationException("Cannot persist tenant-owned entities without an active tenant context.");
                }

                if (entry.Entity.TenantId == Guid.Empty)
                {
                    entry.Entity.AssignTenant(CurrentTenantId.Value);
                }
                else if (entry.Entity.TenantId != CurrentTenantId.Value)
                {
                    throw new InvalidOperationException("Tenant-owned entity tenant mismatch detected.");
                }
            }

            if (entry.State == EntityState.Modified || entry.State == EntityState.Deleted)
            {
                if (CurrentTenantId.HasValue && entry.Entity.TenantId != CurrentTenantId.Value)
                {
                    throw new InvalidOperationException("Attempted to modify a tenant-owned entity outside the active tenant context.");
                }
            }
        }
    }
}




