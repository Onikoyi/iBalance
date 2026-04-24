using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFixedAssetsModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FixedAssetClasses",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CapitalizationThreshold = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ResidualValuePercentDefault = table.Column<decimal>(type: "numeric(9,4)", precision: 9, scale: 4, nullable: false),
                    UsefulLifeMonthsDefault = table.Column<int>(type: "integer", nullable: false),
                    DepreciationMethodDefault = table.Column<int>(type: "integer", nullable: false),
                    AssetCostLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccumulatedDepreciationLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepreciationExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisposalGainLossLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FixedAssetClasses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FixedAssetDepreciationRuns",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodStartUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PeriodEndUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RunDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FixedAssetDepreciationRuns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FixedAssets",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FixedAssetClassId = table.Column<Guid>(type: "uuid", nullable: false),
                    AssetNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    AssetName = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    AcquisitionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CapitalizationDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcquisitionCost = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ResidualValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    UsefulLifeMonths = table.Column<int>(type: "integer", nullable: false),
                    DepreciationMethod = table.Column<int>(type: "integer", nullable: false),
                    AccumulatedDepreciationAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ImpairmentAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssetCostLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    AccumulatedDepreciationLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepreciationExpenseLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisposalGainLossLedgerAccountId = table.Column<Guid>(type: "uuid", nullable: false),
                    VendorId = table.Column<Guid>(type: "uuid", nullable: true),
                    PurchaseInvoiceId = table.Column<Guid>(type: "uuid", nullable: true),
                    Location = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    Custodian = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    SerialNumber = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    LastDepreciationPostedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DisposedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DisposalProceedsAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FixedAssets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FixedAssets_FixedAssetClasses_FixedAssetClassId",
                        column: x => x.FixedAssetClassId,
                        principalSchema: "finance",
                        principalTable: "FixedAssetClasses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FixedAssetDepreciationLines",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DepreciationRunId = table.Column<Guid>(type: "uuid", nullable: false),
                    FixedAssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepreciationPeriodStartUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DepreciationPeriodEndUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DepreciationAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    OpeningNetBookValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    ClosingNetBookValue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FixedAssetDepreciationLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FixedAssetDepreciationLines_FixedAssetDepreciationRuns_Depr~",
                        column: x => x.DepreciationRunId,
                        principalSchema: "finance",
                        principalTable: "FixedAssetDepreciationRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FixedAssetDepreciationLines_FixedAssets_FixedAssetId",
                        column: x => x.FixedAssetId,
                        principalSchema: "finance",
                        principalTable: "FixedAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FixedAssetDisposals",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FixedAssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    DisposalType = table.Column<int>(type: "integer", nullable: false),
                    DisposalDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DisposalProceedsAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    NetBookValueAtDisposal = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    GainOrLossAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FixedAssetDisposals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FixedAssetDisposals_FixedAssets_FixedAssetId",
                        column: x => x.FixedAssetId,
                        principalSchema: "finance",
                        principalTable: "FixedAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FixedAssetTransactions",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FixedAssetId = table.Column<Guid>(type: "uuid", nullable: false),
                    TransactionType = table.Column<int>(type: "integer", nullable: false),
                    TransactionDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    JournalEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "text", nullable: true),
                    LastModifiedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifiedBy = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FixedAssetTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FixedAssetTransactions_FixedAssets_FixedAssetId",
                        column: x => x.FixedAssetId,
                        principalSchema: "finance",
                        principalTable: "FixedAssets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetClasses_TenantId_Code",
                schema: "finance",
                table: "FixedAssetClasses",
                columns: new[] { "TenantId", "Code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetDepreciationLines_DepreciationRunId",
                schema: "finance",
                table: "FixedAssetDepreciationLines",
                column: "DepreciationRunId");

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetDepreciationLines_FixedAssetId",
                schema: "finance",
                table: "FixedAssetDepreciationLines",
                column: "FixedAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetDepreciationLines_TenantId_DepreciationRunId_Fixe~",
                schema: "finance",
                table: "FixedAssetDepreciationLines",
                columns: new[] { "TenantId", "DepreciationRunId", "FixedAssetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetDepreciationRuns_TenantId_PeriodStartUtc_PeriodEn~",
                schema: "finance",
                table: "FixedAssetDepreciationRuns",
                columns: new[] { "TenantId", "PeriodStartUtc", "PeriodEndUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetDisposals_FixedAssetId",
                schema: "finance",
                table: "FixedAssetDisposals",
                column: "FixedAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetDisposals_TenantId_FixedAssetId",
                schema: "finance",
                table: "FixedAssetDisposals",
                columns: new[] { "TenantId", "FixedAssetId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssets_FixedAssetClassId",
                schema: "finance",
                table: "FixedAssets",
                column: "FixedAssetClassId");

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssets_TenantId_AssetNumber",
                schema: "finance",
                table: "FixedAssets",
                columns: new[] { "TenantId", "AssetNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetTransactions_FixedAssetId",
                schema: "finance",
                table: "FixedAssetTransactions",
                column: "FixedAssetId");

            migrationBuilder.CreateIndex(
                name: "IX_FixedAssetTransactions_TenantId_FixedAssetId_TransactionDat~",
                schema: "finance",
                table: "FixedAssetTransactions",
                columns: new[] { "TenantId", "FixedAssetId", "TransactionDateUtc", "TransactionType" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FixedAssetDepreciationLines",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FixedAssetDisposals",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FixedAssetTransactions",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FixedAssetDepreciationRuns",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FixedAssets",
                schema: "finance");

            migrationBuilder.DropTable(
                name: "FixedAssetClasses",
                schema: "finance");
        }
    }
}
