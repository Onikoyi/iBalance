using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBudgetControls : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowOverrun",
                schema: "finance",
                table: "Budgets",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ClosedBy",
                schema: "finance",
                table: "Budgets",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ClosedOnUtc",
                schema: "finance",
                table: "Budgets",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClosureReason",
                schema: "finance",
                table: "Budgets",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OverrunPolicy",
                schema: "finance",
                table: "Budgets",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "BudgetTransfers",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BudgetId = table.Column<Guid>(type: "uuid", nullable: false),
                    FromBudgetLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToBudgetLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    TransferredBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TransferredOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetTransfers", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetTransfers_BudgetId",
                schema: "finance",
                table: "BudgetTransfers",
                column: "BudgetId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BudgetTransfers",
                schema: "finance");

            migrationBuilder.DropColumn(
                name: "AllowOverrun",
                schema: "finance",
                table: "Budgets");

            migrationBuilder.DropColumn(
                name: "ClosedBy",
                schema: "finance",
                table: "Budgets");

            migrationBuilder.DropColumn(
                name: "ClosedOnUtc",
                schema: "finance",
                table: "Budgets");

            migrationBuilder.DropColumn(
                name: "ClosureReason",
                schema: "finance",
                table: "Budgets");

            migrationBuilder.DropColumn(
                name: "OverrunPolicy",
                schema: "finance",
                table: "Budgets");
        }
    }
}
