using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class BankStatementImportConfiguration : IEntityTypeConfiguration<BankStatementImport>
{
    public void Configure(EntityTypeBuilder<BankStatementImport> builder)
    {
        builder.ToTable("bank_statement_imports");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.LedgerAccountId)
            .IsRequired();

        builder.Property(x => x.StatementFromUtc)
            .IsRequired();

        builder.Property(x => x.StatementToUtc)
            .IsRequired();

        builder.Property(x => x.SourceType)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.SourceReference)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.FileName)
            .HasMaxLength(260);

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.Property(x => x.ImportedOnUtc)
            .IsRequired();

        builder.HasOne(x => x.LedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.LedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Lines)
            .WithOne(x => x.BankStatementImport)
            .HasForeignKey(x => x.BankStatementImportId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.LedgerAccountId, x.StatementFromUtc, x.StatementToUtc, x.SourceReference })
            .IsUnique();

        builder.HasIndex(x => new { x.TenantId, x.LedgerAccountId });

        builder.HasIndex(x => new { x.TenantId, x.ImportedOnUtc });
    }
}