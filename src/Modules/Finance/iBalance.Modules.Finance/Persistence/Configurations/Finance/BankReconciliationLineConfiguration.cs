using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class BankReconciliationLineConfiguration : IEntityTypeConfiguration<BankReconciliationLine>
{
    public void Configure(EntityTypeBuilder<BankReconciliationLine> builder)
    {
        builder.ToTable("bank_reconciliation_lines");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.BankReconciliationId)
            .IsRequired();

        builder.Property(x => x.LedgerMovementId)
            .IsRequired();

        builder.Property(x => x.IsReconciled)
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.HasOne(x => x.BankReconciliation)
            .WithMany(x => x.Lines)
            .HasForeignKey(x => x.BankReconciliationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.LedgerMovement)
            .WithMany()
            .HasForeignKey(x => x.LedgerMovementId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.BankReconciliationId, x.LedgerMovementId })
            .IsUnique();

        builder.HasIndex(x => x.LedgerMovementId);
    }
}