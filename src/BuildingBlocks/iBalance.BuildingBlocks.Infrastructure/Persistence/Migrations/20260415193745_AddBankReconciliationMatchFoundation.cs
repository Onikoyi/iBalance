using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBankReconciliationMatchFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BankReconciliationMatches",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BankReconciliationId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankReconciliationLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    BankStatementImportLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BankReconciliationMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BankReconciliationMatches_BankStatementImportLines_BankStat~",
                        column: x => x.BankStatementImportLineId,
                        principalSchema: "public",
                        principalTable: "BankStatementImportLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BankReconciliationMatches_bank_reconciliation_lines_BankRec~",
                        column: x => x.BankReconciliationLineId,
                        principalSchema: "public",
                        principalTable: "bank_reconciliation_lines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BankReconciliationMatches_bank_reconciliations_BankReconcil~",
                        column: x => x.BankReconciliationId,
                        principalSchema: "public",
                        principalTable: "bank_reconciliations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BankReconciliationMatches_BankReconciliationId",
                schema: "public",
                table: "BankReconciliationMatches",
                column: "BankReconciliationId");

            migrationBuilder.CreateIndex(
                name: "IX_BankReconciliationMatches_BankReconciliationLineId",
                schema: "public",
                table: "BankReconciliationMatches",
                column: "BankReconciliationLineId");

            migrationBuilder.CreateIndex(
                name: "IX_BankReconciliationMatches_BankStatementImportLineId",
                schema: "public",
                table: "BankReconciliationMatches",
                column: "BankStatementImportLineId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BankReconciliationMatches",
                schema: "public");
        }
    }
}
