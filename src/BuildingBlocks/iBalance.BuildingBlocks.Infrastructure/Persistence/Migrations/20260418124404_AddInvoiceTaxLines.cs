using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceTaxLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PurchaseInvoiceTaxLines",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseInvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComponentKind = table.Column<int>(type: "integer", nullable: false),
                    ApplicationMode = table.Column<int>(type: "integer", nullable: false),
                    TransactionScope = table.Column<int>(type: "integer", nullable: false),
                    RatePercent = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxableAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseInvoiceTaxLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceTaxLines_LedgerAccounts_TaxLedgerAccountId",
                        column: x => x.TaxLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceTaxLines_PurchaseInvoices_PurchaseInvoiceId",
                        column: x => x.PurchaseInvoiceId,
                        principalSchema: "finance",
                        principalTable: "PurchaseInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceTaxLines_TaxCodes_TaxCodeId",
                        column: x => x.TaxCodeId,
                        principalSchema: "public",
                        principalTable: "TaxCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalesInvoiceTaxLines",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SalesInvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    TaxCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComponentKind = table.Column<int>(type: "integer", nullable: false),
                    ApplicationMode = table.Column<int>(type: "integer", nullable: false),
                    TransactionScope = table.Column<int>(type: "integer", nullable: false),
                    RatePercent = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxableAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    TaxLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesInvoiceTaxLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesInvoiceTaxLines_LedgerAccounts_TaxLedgerAccountId",
                        column: x => x.TaxLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SalesInvoiceTaxLines_SalesInvoices_SalesInvoiceId",
                        column: x => x.SalesInvoiceId,
                        principalSchema: "finance",
                        principalTable: "SalesInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SalesInvoiceTaxLines_TaxCodes_TaxCodeId",
                        column: x => x.TaxCodeId,
                        principalSchema: "public",
                        principalTable: "TaxCodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceTaxLines_PurchaseInvoiceId",
                schema: "public",
                table: "PurchaseInvoiceTaxLines",
                column: "PurchaseInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceTaxLines_TaxCodeId",
                schema: "public",
                table: "PurchaseInvoiceTaxLines",
                column: "TaxCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceTaxLines_TaxLedgerAccountId",
                schema: "public",
                table: "PurchaseInvoiceTaxLines",
                column: "TaxLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesInvoiceTaxLines_SalesInvoiceId",
                schema: "public",
                table: "SalesInvoiceTaxLines",
                column: "SalesInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesInvoiceTaxLines_TaxCodeId",
                schema: "public",
                table: "SalesInvoiceTaxLines",
                column: "TaxCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesInvoiceTaxLines_TaxLedgerAccountId",
                schema: "public",
                table: "SalesInvoiceTaxLines",
                column: "TaxLedgerAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PurchaseInvoiceTaxLines",
                schema: "public");

            migrationBuilder.DropTable(
                name: "SalesInvoiceTaxLines",
                schema: "public");
        }
    }
}
