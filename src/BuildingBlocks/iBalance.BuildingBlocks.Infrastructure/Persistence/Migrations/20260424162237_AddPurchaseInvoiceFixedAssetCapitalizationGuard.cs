using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPurchaseInvoiceFixedAssetCapitalizationGuard : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_FixedAssets_TenantId_PurchaseInvoiceId",
                schema: "finance",
                table: "FixedAssets",
                columns: new[] { "TenantId", "PurchaseInvoiceId" },
                unique: true,
                filter: "\"PurchaseInvoiceId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_FixedAssets_TenantId_PurchaseInvoiceId",
                schema: "finance",
                table: "FixedAssets");
        }
    }
}
