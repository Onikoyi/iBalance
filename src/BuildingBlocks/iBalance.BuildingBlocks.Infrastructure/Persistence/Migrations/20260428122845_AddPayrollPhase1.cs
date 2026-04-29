using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPayrollPhase1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PayrollEmployees",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    FirstName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    LastName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PhoneNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Department = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    JobTitle = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    HireDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BankName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    BankAccountNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    PensionNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    TaxIdentificationNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollEmployees", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PayrollPayElements",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ElementKind = table.Column<int>(type: "integer", nullable: false),
                    CalculationMode = table.Column<int>(type: "integer", nullable: false),
                    DefaultAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    DefaultRate = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: false),
                    LedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsTaxable = table.Column<bool>(type: "boolean", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollPayElements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollPayElements_LedgerAccounts_LedgerAccountId",
                        column: x => x.LedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PayrollPayGroups",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollPayGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PayrollSalaryStructures",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EmployeeId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    BasicSalary = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PayrollSalaryStructures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PayrollSalaryStructures_PayrollEmployees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalSchema: "finance",
                        principalTable: "PayrollEmployees",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PayrollSalaryStructures_PayrollPayGroups_PayGroupId",
                        column: x => x.PayGroupId,
                        principalSchema: "finance",
                        principalTable: "PayrollPayGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PayrollEmployees_TenantId_EmployeeNumber",
                schema: "finance",
                table: "PayrollEmployees",
                columns: new[] { "TenantId", "EmployeeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayElements_LedgerAccountId",
                schema: "finance",
                table: "PayrollPayElements",
                column: "LedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayElements_TenantId_Code",
                schema: "finance",
                table: "PayrollPayElements",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollPayGroups_TenantId_Code",
                schema: "finance",
                table: "PayrollPayGroups",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSalaryStructures_EmployeeId",
                schema: "finance",
                table: "PayrollSalaryStructures",
                column: "EmployeeId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSalaryStructures_PayGroupId",
                schema: "finance",
                table: "PayrollSalaryStructures",
                column: "PayGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_PayrollSalaryStructures_TenantId_EmployeeId_EffectiveFromUtc",
                schema: "finance",
                table: "PayrollSalaryStructures",
                columns: new[] { "TenantId", "EmployeeId", "EffectiveFromUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PayrollPayElements",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "PayrollSalaryStructures",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "PayrollEmployees",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "PayrollPayGroups",
                schema: "finance");
        }
    }
}
