using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseInvoiceApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedOnUtc",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedBy",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedOnUtc",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedBy",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedOnUtc",
                schema: "finance",
                table: "PurchaseInvoices",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "ApprovedOnUtc",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "RejectedOnUtc",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                schema: "finance",
                table: "PurchaseInvoices");

            migrationBuilder.DropColumn(
                name: "SubmittedOnUtc",
                schema: "finance",
                table: "PurchaseInvoices");
        }
    }
}
