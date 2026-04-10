using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Step25_CommercialSubscriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BillingSettings",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AccountName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    BankName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AccountNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SupportEmail = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    PaymentInstructions = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionPackages",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MonthlyPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    DisplayOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsPublic = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionPackages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenantSubscriptionApplications",
                schema: "platform",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CompanyName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DesiredTenantKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AdminFirstName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AdminLastName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AdminEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    AdminPasswordHash = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    AdminPasswordSalt = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    SubscriptionPackageId = table.Column<Guid>(type: "uuid", nullable: false),
                    PackageCodeSnapshot = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    PackageNameSnapshot = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    AmountSnapshot = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCodeSnapshot = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    PaymentReference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    PaymentConfirmationNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ConfirmedByUserId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PaymentConfirmedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ActivatedTenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantSubscriptionApplications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantSubscriptionApplications_SubscriptionPackages_Subscri~",
                        column: x => x.SubscriptionPackageId,
                        principalSchema: "platform",
                        principalTable: "SubscriptionPackages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionPackages_Code",
                schema: "platform",
                table: "SubscriptionPackages",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptionApplications_DesiredTenantKey",
                schema: "platform",
                table: "TenantSubscriptionApplications",
                column: "DesiredTenantKey");

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptionApplications_PaymentReference",
                schema: "platform",
                table: "TenantSubscriptionApplications",
                column: "PaymentReference",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TenantSubscriptionApplications_SubscriptionPackageId",
                schema: "platform",
                table: "TenantSubscriptionApplications",
                column: "SubscriptionPackageId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BillingSettings",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "TenantSubscriptionApplications",
                schema: "platform");

            migrationBuilder.DropTable(
                name: "SubscriptionPackages",
                schema: "platform");
        }
    }
}
