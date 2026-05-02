using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollPayGroupComposition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "MiddleName",
                schema: "finance",
                table: "PayrollEmployees",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "PayrollPayGroupElements",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayElementId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    AmountOverride = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    RateOverride = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EffectiveToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollPayGroupElements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollPayGroupElements_PayrollPayElements_PayElementId",
                        column: x => x.PayElementId,
                        principalSchema: "finance",
                        principalTable: "PayrollPayElements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollPayGroupElements_PayrollPayGroups_PayGroupId",
                        column: x => x.PayGroupId,
                        principalSchema: "finance",
                        principalTable: "PayrollPayGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayGroupElements_PayElementId",
                schema: "finance",
                table: "PayrollPayGroupElements",
                column: "PayElementId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayGroupElements_PayGroupId",
                schema: "finance",
                table: "PayrollPayGroupElements",
                column: "PayGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayGroupElements_TenantId_PayGroupId_PayElementId",
                schema: "finance",
                table: "PayrollPayGroupElements",
                columns: new[] { "TenantId", "PayGroupId", "PayElementId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayGroupElements_TenantId_PayGroupId_Sequence",
                schema: "finance",
                table: "PayrollPayGroupElements",
                columns: new[] { "TenantId", "PayGroupId", "Sequence" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PayrollPayGroupElements",
                schema: "finance");

            migrationBuilder.AlterColumn<string>(
                name: "MiddleName",
                schema: "finance",
                table: "PayrollEmployees",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(150)",
                oldMaxLength: 150,
                oldNullable: true);
        }
    }
}
