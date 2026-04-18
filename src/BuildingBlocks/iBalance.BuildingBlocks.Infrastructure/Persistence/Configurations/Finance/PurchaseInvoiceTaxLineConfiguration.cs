using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class PurchaseInvoiceTaxLineConfiguration : IEntityTypeConfiguration<PurchaseInvoiceTaxLine>
{
    public void Configure(EntityTypeBuilder<PurchaseInvoiceTaxLine> builder)
    {
        builder.ToTable("purchase_invoice_tax_lines");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.PurchaseInvoiceId)
            .IsRequired();

        builder.Property(x => x.TaxCodeId)
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

        builder.Property(x => x.TaxableAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.TaxAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.TaxLedgerAccountId)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(1000);

        builder.HasOne(x => x.PurchaseInvoice)
            .WithMany()
            .HasForeignKey(x => x.PurchaseInvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.TaxCode)
            .WithMany()
            .HasForeignKey(x => x.TaxCodeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.TaxLedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.TaxLedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.PurchaseInvoiceId);

        builder.HasIndex(x => x.TaxCodeId);

        builder.HasIndex(x => x.TaxLedgerAccountId);

        builder.HasIndex(x => new { x.PurchaseInvoiceId, x.TaxCodeId })
            .IsUnique();
    }
}