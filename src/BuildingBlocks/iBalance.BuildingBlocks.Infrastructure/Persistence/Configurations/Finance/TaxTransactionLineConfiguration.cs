using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class TaxTransactionLineConfiguration : IEntityTypeConfiguration<TaxTransactionLine>
{
    public void Configure(EntityTypeBuilder<TaxTransactionLine> builder)
    {
        builder.ToTable("tax_transaction_lines");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.TaxCodeId)
            .IsRequired();

        builder.Property(x => x.TransactionDateUtc)
            .IsRequired();

        builder.Property(x => x.SourceModule)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.SourceDocumentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.SourceDocumentId)
            .IsRequired();

        builder.Property(x => x.SourceDocumentNumber)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.TaxableAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.TaxAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.ComponentKind)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.ApplicationMode)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.TransactionScope)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.RatePercent)
            .HasPrecision(9, 4)
            .IsRequired();

        builder.Property(x => x.TaxLedgerAccountId)
            .IsRequired();

        builder.Property(x => x.CounterpartyId);

        builder.Property(x => x.CounterpartyCode)
            .HasMaxLength(100);

        builder.Property(x => x.CounterpartyName)
            .HasMaxLength(250);

        builder.Property(x => x.Description)
            .HasMaxLength(1000);

        builder.Property(x => x.JournalEntryId);

        builder.HasOne(x => x.TaxCode)
            .WithMany()
            .HasForeignKey(x => x.TaxCodeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.TaxLedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.TaxLedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.JournalEntry)
            .WithMany()
            .HasForeignKey(x => x.JournalEntryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.TenantId, x.TransactionDateUtc });

        builder.HasIndex(x => new { x.TenantId, x.ComponentKind, x.TransactionDateUtc });

        builder.HasIndex(x => new { x.TenantId, x.ApplicationMode, x.TransactionDateUtc });

        builder.HasIndex(x => new { x.TenantId, x.TransactionScope, x.TransactionDateUtc });

        builder.HasIndex(x => new { x.TenantId, x.SourceModule, x.SourceDocumentType, x.SourceDocumentId });

        builder.HasIndex(x => new { x.TenantId, x.TaxCodeId, x.TransactionDateUtc });

        builder.HasIndex(x => new { x.TenantId, x.TaxLedgerAccountId, x.TransactionDateUtc });
    }
}