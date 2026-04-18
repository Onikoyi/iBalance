using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaxAwareInvoiceTotals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GrossAmount",
                schema: "finance",
                table: "SalesInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NetReceivableAmount",
                schema: "finance",
                table: "SalesInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAdditionAmount",
                schema: "finance",
                table: "SalesInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxDeductionAmount",
                schema: "finance",
                table: "SalesInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "GrossAmount",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NetPayableAmount",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAdditionAmount",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxDeductionAmount",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }
        
        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GrossAmount",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "NetReceivableAmount",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "TaxAdditionAmount",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "TaxDeductionAmount",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "GrossAmount",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "NetPayableAmount",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "TaxAdditionAmount",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "TaxDeductionAmount",
                schema: "finance",
                table: "PurchaseInvoices");
        }
    }
}
