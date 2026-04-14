using iBalance.Modules.Finance.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Configurations.Finance;

internal sealed class BankStatementImportLineConfiguration : IEntityTypeConfiguration<BankStatementImportLine>
{
    public void Configure(EntityTypeBuilder<BankStatementImportLine> builder)
    {
        builder.ToTable("bank_statement_import_lines");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .ValueGeneratedNever();

        builder.Property(x => x.BankStatementImportId)
            .IsRequired();

        builder.Property(x => x.TransactionDateUtc)
            .IsRequired();

        builder.Property(x => x.ValueDateUtc);

        builder.Property(x => x.Reference)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(x => x.DebitAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.CreditAmount)
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(x => x.Balance)
            .HasPrecision(18, 2);

        builder.Property(x => x.ExternalReference)
            .HasMaxLength(200);

        builder.HasOne(x => x.BankStatementImport)
            .WithMany(x => x.Lines)
            .HasForeignKey(x => x.BankStatementImportId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(x => x.BankStatementImportId);

        builder.HasIndex(x => new { x.BankStatementImportId, x.TransactionDateUtc });

        builder.HasIndex(x => new { x.BankStatementImportId, x.Reference });
    }
}