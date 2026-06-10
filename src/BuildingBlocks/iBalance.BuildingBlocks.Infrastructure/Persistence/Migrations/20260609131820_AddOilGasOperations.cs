using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOilGasOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "oilgas");

            migrationBuilder.CreateTable(
                name: "OilGasBusinessUnits",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasBusinessUnits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OilGasPostingSetups",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    InventoryAssetLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductionRevenueLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductionLossExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    GasFlareExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductionCostLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    UpdatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasPostingSetups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasPostingSetups_LedgerAccounts_GasFlareExpenseLedgerAcc~",
                        column: x => x.GasFlareExpenseLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPostingSetups_LedgerAccounts_InventoryAssetLedgerAcco~",
                        column: x => x.InventoryAssetLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPostingSetups_LedgerAccounts_ProductionCostLedgerAcco~",
                        column: x => x.ProductionCostLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPostingSetups_LedgerAccounts_ProductionLossExpenseLed~",
                        column: x => x.ProductionLossExpenseLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPostingSetups_LedgerAccounts_ProductionRevenueLedgerA~",
                        column: x => x.ProductionRevenueLedgerAccountId,
                        principalSchema: "finance",
                        principalTable: "LedgerAccounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasProducts",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<int>(type: "integer", nullable: false),
                    UnitOfMeasure = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    StandardDensity = table.Column<decimal>(type: "numeric(18,6)", precision: 18, scale: 6, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasProducts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OilGasAssets",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    BusinessUnitId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    AssetType = table.Column<int>(type: "integer", nullable: false),
                    OperatorName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    OwnershipPercentage = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    OrganizationCostCenterId = table.Column<Guid>(type: "uuid", nullable: true),
                    LocationDescription = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CommissioningDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasAssets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasAssets_OilGasBusinessUnits_BusinessUnitId",
                        column: x => x.BusinessUnitId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasBusinessUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasAssets_OrganizationCostCenters_OrganizationCostCenter~",
                        column: x => x.OrganizationCostCenterId,
                        principalSchema: "platform",
                        principalTable: "OrganizationCostCenters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasLocations",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    ParentLocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    Code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    LocationType = table.Column<int>(type: "integer", nullable: false),
                    Coordinates = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasLocations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasLocations_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasLocations_OilGasLocations_ParentLocationId",
                        column: x => x.ParentLocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasMeters",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeterCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    MeterName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    MeterType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    LastCalibrationDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextCalibrationDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasMeters", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasMeters_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasMeters_OilGasProducts_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasPermits",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    PermitNumber = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    PermitType = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    IssuingAuthority = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    EffectiveDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiryDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ResponsibleOfficer = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasPermits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasPermits_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPermits_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasTanks",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    TankCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    TankName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    NominalCapacity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    SafeWorkingCapacity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    CurrentBookStock = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasTanks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasTanks_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasTanks_OilGasProducts_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasProductionEntries",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EntryNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ProductionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    MeterId = table.Column<Guid>(type: "uuid", nullable: true),
                    GrossOilVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    NetOilVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    GasProducedVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    GasFlaredVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    WaterProducedVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    OpeningStockVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    ClosingStockVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    LossAdjustmentVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    DowntimeHours = table.Column<decimal>(type: "numeric(8,2)", precision: 8, scale: 2, nullable: false),
                    DowntimeReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    MeterReading = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
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
                    RejectionReason = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasProductionEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasProductionEntries_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasProductionEntries_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasProductionEntries_OilGasMeters_MeterId",
                        column: x => x.MeterId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasMeters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasProductionEntries_OilGasProducts_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasAssets_BusinessUnitId",
                schema: "oilgas",
                table: "OilGasAssets",
                column: "BusinessUnitId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasAssets_OrganizationCostCenterId",
                schema: "oilgas",
                table: "OilGasAssets",
                column: "OrganizationCostCenterId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasAssets_TenantId_Code",
                schema: "oilgas",
                table: "OilGasAssets",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasBusinessUnits_TenantId_Code",
                schema: "oilgas",
                table: "OilGasBusinessUnits",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLocations_AssetId",
                schema: "oilgas",
                table: "OilGasLocations",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLocations_ParentLocationId",
                schema: "oilgas",
                table: "OilGasLocations",
                column: "ParentLocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLocations_TenantId_Code",
                schema: "oilgas",
                table: "OilGasLocations",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeters_LocationId",
                schema: "oilgas",
                table: "OilGasMeters",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeters_ProductId",
                schema: "oilgas",
                table: "OilGasMeters",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasMeters_TenantId_MeterCode",
                schema: "oilgas",
                table: "OilGasMeters",
                columns: new[] { "TenantId", "MeterCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPermits_AssetId",
                schema: "oilgas",
                table: "OilGasPermits",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPermits_LocationId",
                schema: "oilgas",
                table: "OilGasPermits",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPermits_TenantId_PermitNumber",
                schema: "oilgas",
                table: "OilGasPermits",
                columns: new[] { "TenantId", "PermitNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPostingSetups_GasFlareExpenseLedgerAccountId",
                schema: "oilgas",
                table: "OilGasPostingSetups",
                column: "GasFlareExpenseLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPostingSetups_InventoryAssetLedgerAccountId",
                schema: "oilgas",
                table: "OilGasPostingSetups",
                column: "InventoryAssetLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPostingSetups_ProductionCostLedgerAccountId",
                schema: "oilgas",
                table: "OilGasPostingSetups",
                column: "ProductionCostLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPostingSetups_ProductionLossExpenseLedgerAccountId",
                schema: "oilgas",
                table: "OilGasPostingSetups",
                column: "ProductionLossExpenseLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPostingSetups_ProductionRevenueLedgerAccountId",
                schema: "oilgas",
                table: "OilGasPostingSetups",
                column: "ProductionRevenueLedgerAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPostingSetups_TenantId",
                schema: "oilgas",
                table: "OilGasPostingSetups",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionEntries_AssetId",
                schema: "oilgas",
                table: "OilGasProductionEntries",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionEntries_LocationId",
                schema: "oilgas",
                table: "OilGasProductionEntries",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionEntries_MeterId",
                schema: "oilgas",
                table: "OilGasProductionEntries",
                column: "MeterId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionEntries_ProductId",
                schema: "oilgas",
                table: "OilGasProductionEntries",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionEntries_TenantId_EntryNumber",
                schema: "oilgas",
                table: "OilGasProductionEntries",
                columns: new[] { "TenantId", "EntryNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionEntries_TenantId_ProductionDateUtc_AssetId",
                schema: "oilgas",
                table: "OilGasProductionEntries",
                columns: new[] { "TenantId", "ProductionDateUtc", "AssetId" });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProducts_TenantId_Code",
                schema: "oilgas",
                table: "OilGasProducts",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasTanks_LocationId",
                schema: "oilgas",
                table: "OilGasTanks",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasTanks_ProductId",
                schema: "oilgas",
                table: "OilGasTanks",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasTanks_TenantId_TankCode",
                schema: "oilgas",
                table: "OilGasTanks",
                columns: new[] { "TenantId", "TankCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OilGasPermits",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasPostingSetups",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasProductionEntries",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasTanks",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasMeters",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasLocations",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasProducts",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasAssets",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasBusinessUnits",
                schema: "oilgas");
        }
    }
}
