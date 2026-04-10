using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step24A_AuthFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PasswordHash",
                schema: "platform",
                table: "UserAccounts",
                type: "character varying(512)",
                maxLength: 512,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "PasswordResetTokenExpiresOnUtc",
                schema: "platform",
                table: "UserAccounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordResetTokenHash",
                schema: "platform",
                table: "UserAccounts",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PasswordSalt",
                schema: "platform",
                table: "UserAccounts",
                type: "character varying(256)",
                maxLength: 256,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Role",
                schema: "platform",
                table: "UserAccounts",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PasswordHash",
                schema: "platform",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordResetTokenExpiresOnUtc",
                schema: "platform",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordResetTokenHash",
                schema: "platform",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "PasswordSalt",
                schema: "platform",
                table: "UserAccounts");

            migrationBuilder.DropColumn(
                name: "Role",
                schema: "platform",
                table: "UserAccounts");
        }
    }
}
