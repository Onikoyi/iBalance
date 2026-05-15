using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFleetManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FleetDrivers",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DriverCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LicenseNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    PhoneNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    LicenseExpiryUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UserAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationDepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationBranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationCostCenterId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FleetDrivers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FleetFuelLogs",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuelLogNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuelDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    QuantityLitres = table.Column<decimal>(type: "numeric(18,3)", precision: 18, scale: 3, nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    OffsetLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    VendorName = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SubmittedBy = table.Column<string>(type: "text", nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FleetFuelLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FleetMaintenanceWorkOrders",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkOrderDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IssueDescription = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    EstimatedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ActualAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    OffsetLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    WorkshopVendorName = table.Column<string>(type: "text", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SubmittedBy = table.Column<string>(type: "text", nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FleetMaintenanceWorkOrders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FleetPolicySettings",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    FuelExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    MaintenanceExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    TripExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayableOrCashLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequiresMakerCheckerForFuel = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresMakerCheckerForMaintenance = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresTripApproval = table.Column<bool>(type: "boolean", nullable: false),
                    MaxFuelAmountPerEntry = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FleetPolicySettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FleetTrips",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TripNumber = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    VehicleId = table.Column<Guid>(type: "uuid", nullable: false),
                    DriverId = table.Column<Guid>(type: "uuid", nullable: false),
                    TripDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Origin = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Destination = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    StartOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    EndOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Purpose = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    OrganizationDepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationBranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationCostCenterId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    SubmittedBy = table.Column<string>(type: "text", nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FleetTrips", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FleetVehicles",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    VehicleCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    RegistrationNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    VehicleName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    VehicleType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Make = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    YearOfManufacture = table.Column<int>(type: "integer", nullable: false),
                    ChassisNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EngineNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    FuelType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CurrentOdometerKm = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OdometerAtLastServiceKm = table.Column<decimal>(type: "numeric", nullable: true),
                    DefaultDriverId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationDepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationBranchId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationCostCenterId = table.Column<Guid>(type: "uuid", nullable: true),
                    InsuranceExpiryUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RoadWorthinessExpiryUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LicenseExpiryUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FleetVehicles", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FleetDrivers_TenantId_DriverCode",
                schema: "finance",
                table: "FleetDrivers",
                columns: new[] { "TenantId", "DriverCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FleetFuelLogs_TenantId_FuelLogNumber",
                schema: "finance",
                table: "FleetFuelLogs",
                columns: new[] { "TenantId", "FuelLogNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FleetMaintenanceWorkOrders_TenantId_WorkOrderNumber",
                schema: "finance",
                table: "FleetMaintenanceWorkOrders",
                columns: new[] { "TenantId", "WorkOrderNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FleetPolicySettings_TenantId",
                schema: "finance",
                table: "FleetPolicySettings",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FleetTrips_TenantId_TripNumber",
                schema: "finance",
                table: "FleetTrips",
                columns: new[] { "TenantId", "TripNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FleetVehicles_TenantId_RegistrationNumber",
                schema: "finance",
                table: "FleetVehicles",
                columns: new[] { "TenantId", "RegistrationNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FleetVehicles_TenantId_VehicleCode",
                schema: "finance",
                table: "FleetVehicles",
                columns: new[] { "TenantId", "VehicleCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FleetDrivers",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FleetFuelLogs",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FleetMaintenanceWorkOrders",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FleetPolicySettings",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FleetTrips",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FleetVehicles",
                schema: "finance");
        }
    }
}
