using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxSetupFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TaxCodes",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    ComponentKind = table.Column<int>(type: "integer", nullable: false),
                    ApplicationMode = table.Column<int>(type: "integer", nullable: false),
                    TransactionScope = table.Column<int>(type: "integer", nullable: false),
                    RatePercent = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxCodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaxCodes_LedgerAccounts_TaxLedgerAccountId",
                        column: x => x.TaxLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TaxTransactionLines",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SourceModule = table.Column<string>(type: "text", nullable: false),
                    SourceDocumentType = table.Column<string>(type: "text", nullable: false),
                    SourceDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceDocumentNumber = table.Column<string>(type: "text", nullable: false),
                    TaxableAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    ComponentKind = table.Column<int>(type: "integer", nullable: false),
                    ApplicationMode = table.Column<int>(type: "integer", nullable: false),
                    TransactionScope = table.Column<int>(type: "integer", nullable: false),
                    RatePercent = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    CounterpartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    CounterpartyCode = table.Column<string>(type: "text", nullable: true),
                    CounterpartyName = table.Column<string>(type: "text", nullable: true),
                    Description = table.Column<string>(type: "text", nullable: true),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaxTransactionLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaxTransactionLines_JournalEntries_JournalEntryId",
                        column: x => x.JournalEntryId,
                        principalSchema: "finance",
                        principalTable: "JournalEntries",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_TaxTransactionLines_LedgerAccounts_TaxLedgerAccountId",
                        column: x => x.TaxLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaxTransactionLines_TaxCodes_TaxCodeId",
                        column: x => x.TaxCodeId,
                        principalSchema: "public",
                        principalTable: "TaxCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaxCodes_TaxLedgerAccountId",
                schema: "public",
                table: "TaxCodes",
                column: "TaxLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxTransactionLines_JournalEntryId",
                schema: "public",
                table: "TaxTransactionLines",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxTransactionLines_TaxCodeId",
                schema: "public",
                table: "TaxTransactionLines",
                column: "TaxCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_TaxTransactionLines_TaxLedgerAccountId",
                schema: "public",
                table: "TaxTransactionLines",
                column: "TaxLedgerAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaxTransactionLines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "TaxCodes",
                schema: "public");
        }
    }
}
