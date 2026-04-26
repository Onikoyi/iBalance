using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InventoryPhase3Final : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "JournalEntryId",
                schema: "finance",
                table: "InventoryTransactions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InventoryTransactions_JournalEntryId",
                schema: "finance",
                table: "InventoryTransactions",
                column: "JournalEntryId");

            migrationBuilder.AddForeignKey(
                name: "FK_InventoryTransactions_JournalEntries_JournalEntryId",
                schema: "finance",
                table: "InventoryTransactions",
                column: "JournalEntryId",
                principalSchema: "finance",
                principalTable: "JournalEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InventoryTransactions_JournalEntries_JournalEntryId",
                schema: "finance",
                table: "InventoryTransactions");

            migrationBuilder.DropIndex(
                name: "IX_InventoryTransactions_JournalEntryId",
                schema: "finance",
                table: "InventoryTransactions");

            migrationBuilder.DropColumn(
                name: "JournalEntryId",
                schema: "finance",
                table: "InventoryTransactions");
        }
    }
}
