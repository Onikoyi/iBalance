using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class VendorPaymentMakerChecker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Vendors_TenantId_VendorName",
                schema: "public",
                table: "Vendors");

            migrationBuilder.DropIndex(
                name: "IX_Customers_TenantId_CustomerName",
                schema: "public",
                table: "Customers");

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                schema: "public",
                table: "VendorPayments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedOnUtc",
                schema: "public",
                table: "VendorPayments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PostingRequiresApproval",
                schema: "public",
                table: "VendorPayments",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedBy",
                schema: "public",
                table: "VendorPayments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedOnUtc",
                schema: "public",
                table: "VendorPayments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "public",
                table: "VendorPayments",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedBy",
                schema: "public",
                table: "VendorPayments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedOnUtc",
                schema: "public",
                table: "VendorPayments",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "ApprovedOnUtc",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "PostingRequiresApproval",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "RejectedOnUtc",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.DropColumn(
                name: "SubmittedOnUtc",
                schema: "public",
                table: "VendorPayments");

            migrationBuilder.CreateIndex(
                name: "IX_Vendors_TenantId_VendorName",
                schema: "public",
                table: "Vendors",
                columns: new[] { "TenantId", "VendorName" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_TenantId_CustomerName",
                schema: "public",
                table: "Customers",
                columns: new[] { "TenantId", "CustomerName" });
        }
    }
}
