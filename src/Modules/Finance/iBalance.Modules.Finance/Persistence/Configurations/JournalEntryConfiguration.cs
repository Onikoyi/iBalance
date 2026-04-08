using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.Modules.Finance.Persistence.Configurations;

public sealed class JournalEntryConfiguration : IEntityTypeConfiguration<JournalEntry>
{
    public void Configure(EntityTypeBuilder<JournalEntry> builder)
    {
        builder.ToTable("JournalEntries", "finance");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.EntryDateUtc)
            .IsRequired();

        builder.Property(x => x.Reference)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.Status)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.Type)
            .HasConversion<int>()
            .IsRequired();

        builder.Property(x => x.PostedAtUtc)
            .IsRequired(false);

        builder.Property(x => x.ReversedAtUtc)
            .IsRequired(false);

        builder.Property(x => x.ReversalJournalEntryId)
            .IsRequired(false);

        builder.Property(x => x.ReversedJournalEntryId)
            .IsRequired(false);

        builder.HasMany(x => x.Lines)
            .WithOne(x => x.JournalEntry)
            .HasForeignKey(x => x.JournalEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<JournalEntry>()
            .WithMany()
            .HasForeignKey(x => x.ReversalJournalEntryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<JournalEntry>()
            .WithMany()
            .HasForeignKey(x => x.ReversedJournalEntryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.TenantId);

        builder.HasIndex(x => new { x.TenantId, x.Reference });

        builder.HasIndex(x => x.Type);

        builder.HasIndex(x => x.ReversalJournalEntryId);

        builder.HasIndex(x => x.ReversedJournalEntryId);
    }
}