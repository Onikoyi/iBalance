using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class TaxCodeConfiguration : IEntityTypeConfiguration<TaxCode>
{
    public void Configure(EntityTypeBuilder<TaxCode> builder)
    {
        builder.ToTable("tax_codes");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.Code)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(1000);

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

        builder.Property(x => x.IsActive)
            .IsRequired();

        builder.Property(x => x.EffectiveFromUtc)
            .IsRequired();

        builder.Property(x => x.EffectiveToUtc);

        builder.HasOne(x => x.TaxLedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.TaxLedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.TenantId, x.Code })
            .IsUnique();

        builder.HasIndex(x => new { x.TenantId, x.ComponentKind });

        builder.HasIndex(x => new { x.TenantId, x.TransactionScope });

        builder.HasIndex(x => new { x.TenantId, x.IsActive });

        builder.HasIndex(x => new { x.TenantId, x.EffectiveFromUtc, x.EffectiveToUtc });
    }
}