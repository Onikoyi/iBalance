using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class BankReconciliationConfiguration : IEntityTypeConfiguration<BankReconciliation>
{
    public void Configure(EntityTypeBuilder<BankReconciliation> builder)
    {
        builder.ToTable("bank_reconciliations");

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

        builder.Property(x => x.StatementClosingBalance)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.BookClosingBalance)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.Notes)
            .HasMaxLength(1000);

        builder.Property(x => x.CompletedOnUtc);

        builder.Property(x => x.CancelledOnUtc);

        builder.HasOne(x => x.LedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.LedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(x => x.Lines)
            .WithOne(x => x.BankReconciliation)
            .HasForeignKey(x => x.BankReconciliationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => new { x.TenantId, x.LedgerAccountId, x.StatementFromUtc, x.StatementToUtc })
            .IsUnique();

        builder.HasIndex(x => new { x.TenantId, x.Status });

        builder.HasIndex(x => new { x.TenantId, x.LedgerAccountId });
    }
}