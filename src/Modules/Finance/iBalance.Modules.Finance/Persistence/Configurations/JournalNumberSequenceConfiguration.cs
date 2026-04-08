using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.Modules.Finance.Persistence.Configurations;

public sealed class JournalNumberSequenceConfiguration : IEntityTypeConfiguration<JournalNumberSequence>
{
    public void Configure(EntityTypeBuilder<JournalNumberSequence> builder)
    {
        builder.ToTable("JournalNumberSequences", "finance");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.TenantId)
            .IsRequired();

        builder.Property(x => x.Prefix)
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.NextNumber)
            .IsRequired();

        builder.Property(x => x.Padding)
            .IsRequired();

        builder.Property(x => x.IsActive)
            .IsRequired();

        builder.HasIndex(x => x.TenantId);

        builder.HasIndex(x => new { x.TenantId, x.Prefix })
            .IsUnique();
    }
}