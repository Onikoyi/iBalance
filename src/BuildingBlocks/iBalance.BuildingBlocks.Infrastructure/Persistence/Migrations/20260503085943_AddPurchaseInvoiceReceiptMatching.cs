using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseInvoiceReceiptMatching : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PurchaseInvoiceReceiptMatches",
                schema: "finance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseInvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PurchaseOrderReceiptId = table.Column<Guid>(type: "uuid", nullable: false),
                    MatchedBaseAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CreatedOnUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseInvoiceReceiptMatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceReceiptMatches_PurchaseInvoices_PurchaseInvo~",
                        column: x => x.PurchaseInvoiceId,
                        principalSchema: "finance",
                        principalTable: "PurchaseInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PurchaseInvoiceReceiptMatches_PurchaseOrderReceipts_Purchas~",
                        column: x => x.PurchaseOrderReceiptId,
                        principalSchema: "public",
                        principalTable: "PurchaseOrderReceipts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceReceiptMatches_PurchaseInvoiceId",
                schema: "finance",
                table: "PurchaseInvoiceReceiptMatches",
                column: "PurchaseInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceReceiptMatches_PurchaseOrderReceiptId",
                schema: "finance",
                table: "PurchaseInvoiceReceiptMatches",
                column: "PurchaseOrderReceiptId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseInvoiceReceiptMatches_TenantId_PurchaseInvoiceId_Pu~",
                schema: "finance",
                table: "PurchaseInvoiceReceiptMatches",
                columns: new[] { "TenantId", "PurchaseInvoiceId", "PurchaseOrderReceiptId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PurchaseInvoiceReceiptMatches",
                schema: "finance");
        }
    }
}
