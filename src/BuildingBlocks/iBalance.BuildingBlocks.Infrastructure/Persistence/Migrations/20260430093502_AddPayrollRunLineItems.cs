using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollRunLineItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PayrollRunLineItems",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayrollRunLineId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayElementId = table.Column<Guid>(type: "uuid", nullable: true),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Description = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    ElementKind = table.Column<int>(type: "integer", nullable: false),
                    CalculationMode = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Sequence = table.Column<int>(type: "integer", nullable: false),
                    IsTaxable = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollRunLineItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollRunLineItems_PayrollPayElements_PayElementId",
                        column: x => x.PayElementId,
                        principalSchema: "finance",
                        principalTable: "PayrollPayElements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollRunLineItems_PayrollRunLines_PayrollRunLineId",
                        column: x => x.PayrollRunLineId,
                        principalSchema: "finance",
                        principalTable: "PayrollRunLines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PayrollRunLineItems_PayElementId",
                schema: "finance",
                table: "PayrollRunLineItems",
                column: "PayElementId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollRunLineItems_PayrollRunLineId",
                schema: "finance",
                table: "PayrollRunLineItems",
                column: "PayrollRunLineId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollRunLineItems_TenantId_PayrollRunLineId_Sequence",
                schema: "finance",
                table: "PayrollRunLineItems",
                columns: new[] { "TenantId", "PayrollRunLineId", "Sequence" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PayrollRunLineItems",
                schema: "finance");
        }
    }
}
