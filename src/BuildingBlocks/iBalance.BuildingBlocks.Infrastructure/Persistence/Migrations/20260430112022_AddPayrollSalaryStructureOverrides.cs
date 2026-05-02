using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollSalaryStructureOverrides : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PayrollSalaryStructureOverrides",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollSalaryStructureId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayElementId = table.Column<Guid>(type: "uuid", nullable: false),
                    AmountOverride = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    RateOverride = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    IsExcluded = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EffectiveToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollSalaryStructureOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollSalaryStructureOverrides_PayrollPayElements_PayEleme~",
                        column: x => x.PayElementId,
                        principalSchema: "finance",
                        principalTable: "PayrollPayElements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollSalaryStructureOverrides_PayrollSalaryStructures_Pay~",
                        column: x => x.PayrollSalaryStructureId,
                        principalSchema: "finance",
                        principalTable: "PayrollSalaryStructures",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSalaryStructureOverrides_PayElementId",
                schema: "finance",
                table: "PayrollSalaryStructureOverrides",
                column: "PayElementId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSalaryStructureOverrides_PayrollSalaryStructureId",
                schema: "finance",
                table: "PayrollSalaryStructureOverrides",
                column: "PayrollSalaryStructureId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSalaryStructureOverrides_TenantId_PayrollSalaryStruc~",
                schema: "finance",
                table: "PayrollSalaryStructureOverrides",
                columns: new[] { "TenantId", "PayrollSalaryStructureId", "PayElementId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PayrollSalaryStructureOverrides",
                schema: "finance");
        }
    }
}
