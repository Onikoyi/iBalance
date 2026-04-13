using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class JournalMakerChecker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_TenantId_Reference",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.RenameTable(
                name: "Vendors",
                schema: "public",
                newName: "Vendors",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "VendorPayments",
                schema: "public",
                newName: "VendorPayments",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "SalesInvoices",
                schema: "public",
                newName: "SalesInvoices",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "SalesInvoiceLines",
                schema: "public",
                newName: "SalesInvoiceLines",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "PurchaseInvoices",
                schema: "public",
                newName: "PurchaseInvoices",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "PurchaseInvoiceLines",
                schema: "public",
                newName: "PurchaseInvoiceLines",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "Customers",
                schema: "public",
                newName: "Customers",
                newSchema: "finance");

            migrationBuilder.RenameTable(
                name: "CustomerReceipts",
                schema: "public",
                newName: "CustomerReceipts",
                newSchema: "finance");

            migrationBuilder.AlterColumn<string>(
                name: "Reference",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(64)",
                oldMaxLength: 64);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedOnUtc",
                schema: "finance",
                table: "JournalEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PostingRequiresApproval",
                schema: "finance",
                table: "JournalEntries",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedBy",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedOnUtc",
                schema: "finance",
                table: "JournalEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedBy",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedOnUtc",
                schema: "finance",
                table: "JournalEntries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_TenantId_Reference",
                schema: "finance",
                table: "JournalEntries",
                columns: new[] { "TenantId", "Reference" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_JournalEntries_TenantId_Reference",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "ApprovedOnUtc",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "PostingRequiresApproval",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "RejectedOnUtc",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.DropColumn(
                name: "SubmittedOnUtc",
                schema: "finance",
                table: "JournalEntries");

            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.RenameTable(
                name: "Vendors",
                schema: "finance",
                newName: "Vendors",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "VendorPayments",
                schema: "finance",
                newName: "VendorPayments",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "SalesInvoices",
                schema: "finance",
                newName: "SalesInvoices",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "SalesInvoiceLines",
                schema: "finance",
                newName: "SalesInvoiceLines",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "PurchaseInvoices",
                schema: "finance",
                newName: "PurchaseInvoices",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "PurchaseInvoiceLines",
                schema: "finance",
                newName: "PurchaseInvoiceLines",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "Customers",
                schema: "finance",
                newName: "Customers",
                newSchema: "public");

            migrationBuilder.RenameTable(
                name: "CustomerReceipts",
                schema: "finance",
                newName: "CustomerReceipts",
                newSchema: "public");

            migrationBuilder.AlterColumn<string>(
                name: "Reference",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                schema: "finance",
                table: "JournalEntries",
                type: "character varying(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000);

            migrationBuilder.CreateIndex(
                name: "IX_JournalEntries_TenantId_Reference",
                schema: "finance",
                table: "JournalEntries",
                columns: new[] { "TenantId", "Reference" });
        }
    }
}
