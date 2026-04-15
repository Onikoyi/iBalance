using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class BankReconciliationMatchConfiguration : IEntityTypeConfiguration<BankReconciliationMatch>
{
    public void Configure(EntityTypeBuilder<BankReconciliationMatch> builder)
    {
        builder.ToTable("bank_reconciliation_matches");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.BankReconciliationId)
            .IsRequired();

        builder.Property(x => x.BankReconciliationLineId)
            .IsRequired();

        builder.Property(x => x.BankStatementImportLineId)
            .IsRequired();

        builder.Property(x => x.MatchedOnUtc)
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.HasOne(x => x.BankReconciliation)
            .WithMany()
            .HasForeignKey(x => x.BankReconciliationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.BankReconciliationLine)
            .WithMany()
            .HasForeignKey(x => x.BankReconciliationLineId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.BankStatementImportLine)
            .WithMany()
            .HasForeignKey(x => x.BankStatementImportLineId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.BankReconciliationId, x.BankReconciliationLineId })
            .IsUnique();

        builder.HasIndex(x => new { x.BankReconciliationId, x.BankStatementImportLineId })
            .IsUnique();

        builder.HasIndex(x => x.BankReconciliationLineId);

        builder.HasIndex(x => x.BankStatementImportLineId);
    }
}