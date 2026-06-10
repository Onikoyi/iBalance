using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOilGasStockMovementAndReconciliation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PreviousPermitNumber",
                schema: "oilgas",
                table: "OilGasPermits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RenewalApprovedOnUtc",
                schema: "oilgas",
                table: "OilGasPermits",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RenewalCost",
                schema: "oilgas",
                table: "OilGasPermits",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RenewalDateUtc",
                schema: "oilgas",
                table: "OilGasPermits",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RenewalReference",
                schema: "oilgas",
                table: "OilGasPermits",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RenewalSubmittedOnUtc",
                schema: "oilgas",
                table: "OilGasPermits",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OilGasMeterCalibrations",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeterId = table.Column<Guid>(type: "uuid", nullable: false),
                    CalibrationDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextCalibrationDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CertificateReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CalibratedBy = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Result = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasMeterCalibrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasMeterCalibrations_OilGasMeters_MeterId",
                        column: x => x.MeterId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasMeters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasMeterReadings",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeterId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReadingDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PreviousReading = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    CurrentReading = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    MeasuredQuantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Reference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasMeterReadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasMeterReadings_OilGasMeters_MeterId",
                        column: x => x.MeterId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasMeters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasStockMovements",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    MovementNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    MovementDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    MovementType = table.Column<int>(type: "integer", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceTankId = table.Column<Guid>(type: "uuid", nullable: true),
                    DestinationTankId = table.Column<Guid>(type: "uuid", nullable: true),
                    Quantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    UnitOfMeasure = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Reference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    ProductionEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    SalesInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    BillingInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    InventoryTransactionId = table.Column<Guid>(type: "uuid", nullable: true),
                    TransportType = table.Column<int>(type: "integer", nullable: false),
                    TransportReference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    DestinationDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    PostedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    PostedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasStockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasStockMovements_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasStockMovements_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasStockMovements_OilGasProducts_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasStockMovements_OilGasTanks_DestinationTankId",
                        column: x => x.DestinationTankId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasTanks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasStockMovements_OilGasTanks_SourceTankId",
                        column: x => x.SourceTankId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasTanks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeterCalibrations_MeterId",
                schema: "oilgas",
                table: "OilGasMeterCalibrations",
                column: "MeterId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeterCalibrations_TenantId_MeterId_CalibrationDateUtc",
                schema: "oilgas",
                table: "OilGasMeterCalibrations",
                columns: new[] { "TenantId", "MeterId", "CalibrationDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeterReadings_MeterId",
                schema: "oilgas",
                table: "OilGasMeterReadings",
                column: "MeterId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeterReadings_TenantId_MeterId_ReadingDateUtc",
                schema: "oilgas",
                table: "OilGasMeterReadings",
                columns: new[] { "TenantId", "MeterId", "ReadingDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_AssetId",
                schema: "oilgas",
                table: "OilGasStockMovements",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_DestinationTankId",
                schema: "oilgas",
                table: "OilGasStockMovements",
                column: "DestinationTankId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_LocationId",
                schema: "oilgas",
                table: "OilGasStockMovements",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_ProductId",
                schema: "oilgas",
                table: "OilGasStockMovements",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_SourceTankId",
                schema: "oilgas",
                table: "OilGasStockMovements",
                column: "SourceTankId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_TenantId_MovementDateUtc_Status",
                schema: "oilgas",
                table: "OilGasStockMovements",
                columns: new[] { "TenantId", "MovementDateUtc", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasStockMovements_TenantId_MovementNumber",
                schema: "oilgas",
                table: "OilGasStockMovements",
                columns: new[] { "TenantId", "MovementNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OilGasMeterCalibrations",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasMeterReadings",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasStockMovements",
                schema: "oilgas");

            migrationBuilder.DropColumn(
                name: "PreviousPermitNumber",
                schema: "oilgas",
                table: "OilGasPermits");

            migrationBuilder.DropColumn(
                name: "RenewalApprovedOnUtc",
                schema: "oilgas",
                table: "OilGasPermits");

            migrationBuilder.DropColumn(
                name: "RenewalCost",
                schema: "oilgas",
                table: "OilGasPermits");

            migrationBuilder.DropColumn(
                name: "RenewalDateUtc",
                schema: "oilgas",
                table: "OilGasPermits");

            migrationBuilder.DropColumn(
                name: "RenewalReference",
                schema: "oilgas",
                table: "OilGasPermits");

            migrationBuilder.DropColumn(
                name: "RenewalSubmittedOnUtc",
                schema: "oilgas",
                table: "OilGasPermits");
        }
    }
}
