using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.Modules.Finance.Persistence.Configurations;

public sealed class JournalEntryLineConfiguration : IEntityTypeConfiguration<JournalEntryLine>
{
    public void Configure(EntityTypeBuilder<JournalEntryLine> builder)
    {
        builder.ToTable("JournalEntryLines", "finance");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.JournalEntryId)
            .IsRequired();

        builder.Property(x => x.LedgerAccountId)
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

        builder.HasOne(x => x.LedgerAccount)
            .WithMany()
            .HasForeignKey(x => x.LedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(x => x.JournalEntryId);

        builder.HasIndex(x => x.LedgerAccountId);
    }
}