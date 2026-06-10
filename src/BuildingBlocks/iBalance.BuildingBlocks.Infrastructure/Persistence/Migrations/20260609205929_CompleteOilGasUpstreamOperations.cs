using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CompleteOilGasUpstreamOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OilGasAfes",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    AfeNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CostCategory = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    BudgetId = table.Column<Guid>(type: "uuid", nullable: true),
                    PurchaseRequisitionId = table.Column<Guid>(type: "uuid", nullable: true),
                    PurchaseOrderId = table.Column<Guid>(type: "uuid", nullable: true),
                    PurchaseInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    FixedAssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrganizationCostCenterId = table.Column<Guid>(type: "uuid", nullable: true),
                    OriginalEstimate = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ApprovedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RevisedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CommittedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ActualExpenditure = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ForecastAtCompletion = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    RequestDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpectedCompletionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Justification = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedBy = table.Column<string>(type: "text", nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ClosedBy = table.Column<string>(type: "text", nullable: true),
                    ClosedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasAfes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasAfes_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasAfes_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasDocumentReferences",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentType = table.Column<int>(type: "integer", nullable: false),
                    RelatedEntityType = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    RelatedEntityId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentReference = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IssueDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExpiryDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    RecordedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    RecordedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasDocumentReferences", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OilGasEquipment",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EquipmentNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EquipmentName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    FixedAssetId = table.Column<Guid>(type: "uuid", nullable: true),
                    EquipmentCategory = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Manufacturer = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Model = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    SerialNumber = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CriticalityLevel = table.Column<int>(type: "integer", nullable: false),
                    CommissioningDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastMaintenanceDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextMaintenanceDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    NextInspectionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasEquipment", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasEquipment_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasEquipment_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasHseIncidents",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    IncidentNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IncidentDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: true),
                    IncidentCategory = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(3000)", maxLength: 3000, nullable: false),
                    ImmediateAction = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    RootCause = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ResponsibleOfficer = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    TargetClosureDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    EvidenceReference = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasHseIncidents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasHseIncidents_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasHseIncidents_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasLiftings",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    LiftingNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NominationReference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    LocationId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductId = table.Column<Guid>(type: "uuid", nullable: false),
                    SourceTankId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uuid", nullable: true),
                    OfftakerName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    PlannedQuantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    ActualLoadedQuantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    DeliveredQuantity = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    UnitOfMeasure = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    PlannedLoadingDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LoadingCompletedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TransportType = table.Column<int>(type: "integer", nullable: false),
                    VesselOrTruckReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    BillOfLadingNumber = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    UnitPrice = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: true),
                    CurrencyCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    BillingInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    SalesInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    StockMovementId = table.Column<Guid>(type: "uuid", nullable: true),
                    Destination = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    QualityCertificateReference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
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
                    CompletedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    CompletedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasLiftings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasLiftings_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasLiftings_OilGasLocations_LocationId",
                        column: x => x.LocationId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasLocations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasLiftings_OilGasProducts_ProductId",
                        column: x => x.ProductId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasProducts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasLiftings_OilGasTanks_SourceTankId",
                        column: x => x.SourceTankId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasTanks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasPartners",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartnerCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    PartnerName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    RegistrationNumber = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    ContactEmail = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    ContactPhone = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasPartners", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OilGasProductionPeriods",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodCode = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    StartDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    GrossOilVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    NetOilVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    GasProducedVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    GasFlaredVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    WaterProducedVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    LiftingVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    ClosingStockVolume = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    ReconciliationVariance = table.Column<decimal>(type: "numeric(18,4)", precision: 18, scale: 4, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SubmittedBy = table.Column<string>(type: "text", nullable: true),
                    SubmittedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ApprovedBy = table.Column<string>(type: "text", nullable: true),
                    ApprovedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectedBy = table.Column<string>(type: "text", nullable: true),
                    RejectedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ClosedBy = table.Column<string>(type: "text", nullable: true),
                    ClosedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasProductionPeriods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OilGasCorrectiveActions",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    IncidentId = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionDescription = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ResponsibleOfficer = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    TargetDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CompletedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CompletionEvidenceReference = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasCorrectiveActions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasCorrectiveActions_OilGasHseIncidents_IncidentId",
                        column: x => x.IncidentId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasHseIncidents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OilGasPartnerFundings",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    AfeId = table.Column<Guid>(type: "uuid", nullable: true),
                    FundingType = table.Column<int>(type: "integer", nullable: false),
                    Reference = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    TransactionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CurrencyCode = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedBy = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasPartnerFundings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasPartnerFundings_OilGasAfes_AfeId",
                        column: x => x.AfeId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAfes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPartnerFundings_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPartnerFundings_OilGasPartners_PartnerId",
                        column: x => x.PartnerId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasPartners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OilGasPartnerInterests",
                schema: "oilgas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsOperator = table.Column<bool>(type: "boolean", nullable: false),
                    WorkingInterestPercentage = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    CostSharePercentage = table.Column<decimal>(type: "numeric(7,4)", precision: 7, scale: 4, nullable: false),
                    EffectiveFromUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EffectiveToUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OilGasPartnerInterests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OilGasPartnerInterests_OilGasAssets_AssetId",
                        column: x => x.AssetId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OilGasPartnerInterests_OilGasPartners_PartnerId",
                        column: x => x.PartnerId,
                        principalSchema: "oilgas",
                        principalTable: "OilGasPartners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasAfes_AssetId",
                schema: "oilgas",
                table: "OilGasAfes",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasAfes_LocationId",
                schema: "oilgas",
                table: "OilGasAfes",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasAfes_TenantId_AfeNumber",
                schema: "oilgas",
                table: "OilGasAfes",
                columns: new[] { "TenantId", "AfeNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasCorrectiveActions_IncidentId",
                schema: "oilgas",
                table: "OilGasCorrectiveActions",
                column: "IncidentId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasDocumentReferences_TenantId_RelatedEntityType_Related~",
                schema: "oilgas",
                table: "OilGasDocumentReferences",
                columns: new[] { "TenantId", "RelatedEntityType", "RelatedEntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_OilGasEquipment_AssetId",
                schema: "oilgas",
                table: "OilGasEquipment",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasEquipment_LocationId",
                schema: "oilgas",
                table: "OilGasEquipment",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasEquipment_TenantId_EquipmentNumber",
                schema: "oilgas",
                table: "OilGasEquipment",
                columns: new[] { "TenantId", "EquipmentNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasHseIncidents_AssetId",
                schema: "oilgas",
                table: "OilGasHseIncidents",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasHseIncidents_LocationId",
                schema: "oilgas",
                table: "OilGasHseIncidents",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasHseIncidents_TenantId_IncidentNumber",
                schema: "oilgas",
                table: "OilGasHseIncidents",
                columns: new[] { "TenantId", "IncidentNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLiftings_AssetId",
                schema: "oilgas",
                table: "OilGasLiftings",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLiftings_LocationId",
                schema: "oilgas",
                table: "OilGasLiftings",
                column: "LocationId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLiftings_ProductId",
                schema: "oilgas",
                table: "OilGasLiftings",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLiftings_SourceTankId",
                schema: "oilgas",
                table: "OilGasLiftings",
                column: "SourceTankId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasLiftings_TenantId_LiftingNumber",
                schema: "oilgas",
                table: "OilGasLiftings",
                columns: new[] { "TenantId", "LiftingNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartnerFundings_AfeId",
                schema: "oilgas",
                table: "OilGasPartnerFundings",
                column: "AfeId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartnerFundings_AssetId",
                schema: "oilgas",
                table: "OilGasPartnerFundings",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartnerFundings_PartnerId",
                schema: "oilgas",
                table: "OilGasPartnerFundings",
                column: "PartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartnerInterests_AssetId",
                schema: "oilgas",
                table: "OilGasPartnerInterests",
                column: "AssetId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartnerInterests_PartnerId",
                schema: "oilgas",
                table: "OilGasPartnerInterests",
                column: "PartnerId");

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartnerInterests_TenantId_PartnerId_AssetId_Effective~",
                schema: "oilgas",
                table: "OilGasPartnerInterests",
                columns: new[] { "TenantId", "PartnerId", "AssetId", "EffectiveFromUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasPartners_TenantId_PartnerCode",
                schema: "oilgas",
                table: "OilGasPartners",
                columns: new[] { "TenantId", "PartnerCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OilGasProductionPeriods_TenantId_PeriodCode",
                schema: "oilgas",
                table: "OilGasProductionPeriods",
                columns: new[] { "TenantId", "PeriodCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OilGasCorrectiveActions",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasDocumentReferences",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasEquipment",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasLiftings",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasPartnerFundings",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasPartnerInterests",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasProductionPeriods",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasHseIncidents",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasAfes",
                schema: "oilgas");

            migrationBuilder.DropTable(
                name: "OilGasPartners",
                schema: "oilgas");
        }
    }
}
