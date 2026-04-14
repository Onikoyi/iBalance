using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBankReconciliationFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "bank_reconciliations",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    StatementFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StatementToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    StatementClosingBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    BookClosingBalance = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CompletedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_reconciliations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_reconciliations_LedgerAccounts_LedgerAccountId",
                        column: x => x.LedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "bank_reconciliation_lines",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BankReconciliationId = table.Column<Guid>(type: "uuid", nullable: false),
                    LedgerMovementId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsReconciled = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bank_reconciliation_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bank_reconciliation_lines_LedgerMovements_LedgerMovementId",
                        column: x => x.LedgerMovementId,
                        principalSchema: "finance",
                        principalTable: "LedgerMovements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_bank_reconciliation_lines_bank_reconciliations_BankReconcil~",
                        column: x => x.BankReconciliationId,
                        principalSchema: "public",
                        principalTable: "bank_reconciliations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliation_lines_BankReconciliationId_LedgerMoveme~",
                schema: "public",
                table: "bank_reconciliation_lines",
                columns: new[] { "BankReconciliationId", "LedgerMovementId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliation_lines_LedgerMovementId",
                schema: "public",
                table: "bank_reconciliation_lines",
                column: "LedgerMovementId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_LedgerAccountId",
                schema: "public",
                table: "bank_reconciliations",
                column: "LedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_TenantId_LedgerAccountId",
                schema: "public",
                table: "bank_reconciliations",
                columns: new[] { "TenantId", "LedgerAccountId" });

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_TenantId_LedgerAccountId_StatementFrom~",
                schema: "public",
                table: "bank_reconciliations",
                columns: new[] { "TenantId", "LedgerAccountId", "StatementFromUtc", "StatementToUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bank_reconciliations_TenantId_Status",
                schema: "public",
                table: "bank_reconciliations",
                columns: new[] { "TenantId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bank_reconciliation_lines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "bank_reconciliations",
                schema: "public");
        }
    }
}
