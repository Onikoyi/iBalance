using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesInvoiceApprovalWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                schema: "finance",
                table: "SalesInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedOnUtc",
                schema: "finance",
                table: "SalesInvoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedBy",
                schema: "finance",
                table: "SalesInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedOnUtc",
                schema: "finance",
                table: "SalesInvoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "finance",
                table: "SalesInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedBy",
                schema: "finance",
                table: "SalesInvoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedOnUtc",
                schema: "finance",
                table: "SalesInvoices",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "ApprovedOnUtc",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "RejectedOnUtc",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                schema: "finance",
                table: "SalesInvoices");

            migrationBuilder.DropColumn(
                name: "SubmittedOnUtc",
                schema: "finance",
                table: "SalesInvoices");
        }
    }
}
