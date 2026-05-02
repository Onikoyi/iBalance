using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePayrollPolicyToGrossPercentage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MinimumTakeHomePercent",
                schema: "finance",
                table: "PayrollPolicySettings",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "MinimumTakeHomeRuleType",
                schema: "finance",
                table: "PayrollPolicySettings",
                type: "character varying(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinimumTakeHomePercent",
                schema: "finance",
                table: "PayrollPolicySettings");

            migrationBuilder.DropColumn(
                name: "MinimumTakeHomeRuleType",
                schema: "finance",
                table: "PayrollPolicySettings");
        }
    }
}
