using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.Modules.Finance.Persistence.Configurations;

public sealed class LedgerAccountConfiguration : IEntityTypeConfiguration<LedgerAccount>
{
    public void Configure(EntityTypeBuilder<LedgerAccount> builder)
    {
        builder.ToTable("LedgerAccounts", "finance");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.Code)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(x => x.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Category)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.NormalBalance)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.IsHeader)
            .IsRequired();

        builder.Property(x => x.IsPostingAllowed)
            .IsRequired();

        builder.Property(x => x.IsActive)
            .IsRequired();

        builder.Property(x => x.ParentLedgerAccountId)
            .IsRequired(false);

        builder.HasOne(x => x.ParentLedgerAccount)
            .WithMany(x => x.Children)
            .HasForeignKey(x => x.ParentLedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => new { x.TenantId, x.Code })
            .IsUnique();

        builder.HasIndex(x => new { x.TenantId, x.Name });

        builder.HasIndex(x => x.TenantId);

        builder.HasIndex(x => x.ParentLedgerAccountId);
    }
}