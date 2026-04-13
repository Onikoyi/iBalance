using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CustomerReceiptMakerChecker : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "LastModifiedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApprovedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedOnUtc",
                schema: "public",
                table: "CustomerReceipts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PostingRequiresApproval",
                schema: "public",
                table: "CustomerReceipts",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RejectedOnUtc",
                schema: "public",
                table: "CustomerReceipts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                schema: "public",
                table: "CustomerReceipts",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmittedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SubmittedOnUtc",
                schema: "public",
                table: "CustomerReceipts",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApprovedBy",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "ApprovedOnUtc",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "PostingRequiresApproval",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "RejectedBy",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "RejectedOnUtc",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "SubmittedBy",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.DropColumn(
                name: "SubmittedOnUtc",
                schema: "public",
                table: "CustomerReceipts");

            migrationBuilder.AlterColumn<string>(
                name: "LastModifiedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CreatedBy",
                schema: "public",
                table: "CustomerReceipts",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);
        }
    }
}
