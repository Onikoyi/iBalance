using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHrPayrollEmployeeIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "HrEmployeeId",
                schema: "finance",
                table: "PayrollEmployees",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HrSyncStatus",
                schema: "finance",
                table: "PayrollEmployees",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SyncedFromHrOnUtc",
                schema: "finance",
                table: "PayrollEmployees",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEmployees_TenantId_HrEmployeeId",
                schema: "finance",
                table: "PayrollEmployees",
                columns: new[] { "TenantId", "HrEmployeeId" },
                unique: true,
                filter: "\"HrEmployeeId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_PayrollEmployees_TenantId_HrEmployeeId",
                schema: "finance",
                table: "PayrollEmployees");

            migrationBuilder.DropColumn(
                name: "HrEmployeeId",
                schema: "finance",
                table: "PayrollEmployees");

            migrationBuilder.DropColumn(
                name: "HrSyncStatus",
                schema: "finance",
                table: "PayrollEmployees");

            migrationBuilder.DropColumn(
                name: "SyncedFromHrOnUtc",
                schema: "finance",
                table: "PayrollEmployees");
        }
    }
}
