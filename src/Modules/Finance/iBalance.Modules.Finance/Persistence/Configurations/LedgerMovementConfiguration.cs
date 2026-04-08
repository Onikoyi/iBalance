using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.Modules.Finance.Persistence.Configurations;

public sealed class LedgerMovementConfiguration : IEntityTypeConfiguration<LedgerMovement>
{
    public void Configure(EntityTypeBuilder<LedgerMovement> builder)
    {
        builder.ToTable("LedgerMovements", "finance");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.JournalEntryId)
            .IsRequired();

        builder.Property(x => x.JournalEntryLineId)
            .IsRequired();

        builder.Property(x => x.LedgerAccountId)
            .IsRequired();

        builder.Property(x => x.MovementDateUtc)
            .IsRequired();

        builder.Property(x => x.Reference)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(x => x.DebitAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.CreditAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.HasOne(x => x.JournalEntry)
            .WithMany()
            .HasForeignKey(x => x.JournalEntryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.JournalEntryLine)
            .WithMany()
            .HasForeignKey(x => x.JournalEntryLineId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.LedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.LedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.TenantId);

        builder.HasIndex(x => x.JournalEntryId);

        builder.HasIndex(x => x.JournalEntryLineId)
            .IsUnique();

        builder.HasIndex(x => x.LedgerAccountId);

        builder.HasIndex(x => new { x.TenantId, x.MovementDateUtc });

        builder.HasIndex(x => new { x.TenantId, x.Reference });
    }
}