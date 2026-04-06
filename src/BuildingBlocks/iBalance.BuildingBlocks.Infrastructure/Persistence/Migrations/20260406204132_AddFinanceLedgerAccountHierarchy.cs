using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceLedgerAccountHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsHeader",
                schema: "finance",
                table: "LedgerAccounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentLedgerAccountId",
                schema: "finance",
                table: "LedgerAccounts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LedgerAccounts_ParentLedgerAccountId",
                schema: "finance",
                table: "LedgerAccounts",
                column: "ParentLedgerAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_LedgerAccounts_LedgerAccounts_ParentLedgerAccountId",
                schema: "finance",
                table: "LedgerAccounts",
                column: "ParentLedgerAccountId",
                principalSchema: "finance",
                principalTable: "LedgerAccounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LedgerAccounts_LedgerAccounts_ParentLedgerAccountId",
                schema: "finance",
                table: "LedgerAccounts");

            migrationBuilder.DropIndex(
                name: "IX_LedgerAccounts_ParentLedgerAccountId",
                schema: "finance",
                table: "LedgerAccounts");

            migrationBuilder.DropColumn(
                name: "IsHeader",
                schema: "finance",
                table: "LedgerAccounts");

            migrationBuilder.DropColumn(
                name: "ParentLedgerAccountId",
                schema: "finance",
                table: "LedgerAccounts");
        }
    }
}
