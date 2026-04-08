using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceJournalReversalFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReversalJournalEntryId",
                schema: "finance",
                table: "JournalEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReversedAtUtc",
                schema: "finance",
                table: "JournalEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ReversedJournalEntryId",
                schema: "finance",
                table: "JournalEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_ReversalJournalEntryId",
                schema: "finance",
                table: "JournalEntries",
                column: "ReversalJournalEntryId");

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_ReversedJournalEntryId",
                schema: "finance",
                table: "JournalEntries",
                column: "ReversedJournalEntryId");

            migrationBuilder.AddForeignKey(
                name: "FK_JournalEntries_JournalEntries_ReversalJournalEntryId",
                schema: "finance",
                table: "JournalEntries",
                column: "ReversalJournalEntryId",
                principalSchema: "finance",
                principalTable: "JournalEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_JournalEntries_JournalEntries_ReversedJournalEntryId",
                schema: "finance",
                table: "JournalEntries",
                column: "ReversedJournalEntryId",
                principalSchema: "finance",
                principalTable: "JournalEntries",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_JournalEntries_JournalEntries_ReversalJournalEntryId",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_JournalEntries_JournalEntries_ReversedJournalEntryId",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_ReversalJournalEntryId",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_ReversedJournalEntryId",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "ReversalJournalEntryId",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "ReversedAtUtc",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "ReversedJournalEntryId",
                schema: "finance",
                table: "JournalEntries");
        }
    }
}
