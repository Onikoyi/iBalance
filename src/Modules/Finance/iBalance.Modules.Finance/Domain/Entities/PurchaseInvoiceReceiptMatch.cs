namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseInvoiceReceiptMatch
{
    private PurchaseInvoiceReceiptMatch()
    {
    }

    public PurchaseInvoiceReceiptMatch(
        Guid id,
        Guid tenantId,
        Guid purchaseInvoiceId,
        Guid purchaseOrderReceiptId,
        decimal matchedBaseAmount)
    {
        Id = id;
        TenantId = tenantId;
        PurchaseInvoiceId = purchaseInvoiceId;
        PurchaseOrderReceiptId = purchaseOrderReceiptId;
        MatchedBaseAmount = matchedBaseAmount;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PurchaseInvoiceId { get; private set; }
    public Guid PurchaseOrderReceiptId { get; private set; }
    public decimal MatchedBaseAmount { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
}
