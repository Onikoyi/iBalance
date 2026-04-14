using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBankStatementImportFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BankStatementImports",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    StatementFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StatementToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SourceType = table.Column<int>(type: "integer", nullable: false),
                    SourceReference = table.Column<string>(type: "text", nullable: false),
                    FileName = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    ImportedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankStatementImports", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankStatementImports_LedgerAccounts_LedgerAccountId",
                        column: x => x.LedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BankStatementImportLines",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BankStatementImportId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ValueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Reference = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    DebitAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    CreditAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Balance = table.Column<decimal>(type: "numeric", nullable: true),
                    ExternalReference = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankStatementImportLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankStatementImportLines_BankStatementImports_BankStatement~",
                        column: x => x.BankStatementImportId,
                        principalSchema: "public",
                        principalTable: "BankStatementImports",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankStatementImportLines_BankStatementImportId",
                schema: "public",
                table: "BankStatementImportLines",
                column: "BankStatementImportId");

            migrationBuilder.CreateIndex(
                name: "IX_BankStatementImports_LedgerAccountId",
                schema: "public",
                table: "BankStatementImports",
                column: "LedgerAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BankStatementImportLines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "BankStatementImports",
                schema: "public");
        }
    }
}
