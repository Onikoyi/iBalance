using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceLedgerMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PostedAtUtc",
                schema: "finance",
                table: "JournalEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LedgerMovements",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    JournalEntryLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    LedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    MovementDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reference = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    DebitAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreditAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedgerMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LedgerMovements_JournalEntries_JournalEntryId",
                        column: x => x.JournalEntryId,
                        principalSchema: "finance",
                        principalTable: "JournalEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LedgerMovements_JournalEntryLines_JournalEntryLineId",
                        column: x => x.JournalEntryLineId,
                        principalSchema: "finance",
                        principalTable: "JournalEntryLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_LedgerMovements_LedgerAccounts_LedgerAccountId",
                        column: x => x.LedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_JournalEntryId",
                schema: "finance",
                table: "LedgerMovements",
                column: "JournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_JournalEntryLineId",
                schema: "finance",
                table: "LedgerMovements",
                column: "JournalEntryLineId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_LedgerAccountId",
                schema: "finance",
                table: "LedgerMovements",
                column: "LedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_TenantId",
                schema: "finance",
                table: "LedgerMovements",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_TenantId_MovementDateUtc",
                schema: "finance",
                table: "LedgerMovements",
                columns: new[] { "TenantId", "MovementDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_TenantId_Reference",
                schema: "finance",
                table: "LedgerMovements",
                columns: new[] { "TenantId", "Reference" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LedgerMovements",
                schema: "finance");

            migrationBuilder.DropColumn(
                name: "PostedAtUtc",
                schema: "finance",
                table: "JournalEntries");
        }
    }
}
