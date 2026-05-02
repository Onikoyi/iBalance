namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseOrderReceiptLine
{
    private PurchaseOrderReceiptLine()
    {
    }

    public PurchaseOrderReceiptLine(
        Guid id,
        Guid tenantId,
        Guid purchaseOrderReceiptId,
        Guid purchaseOrderLineId,
        Guid? inventoryItemId,
        string description,
        decimal quantity,
        decimal unitCost,
        int receiptKind,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        PurchaseOrderReceiptId = purchaseOrderReceiptId;
        PurchaseOrderLineId = purchaseOrderLineId;
        InventoryItemId = inventoryItemId;
        Description = description.Trim();
        Quantity = quantity;
        UnitCost = unitCost;
        ReceiptKind = receiptKind;
        Notes = notes?.Trim();
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PurchaseOrderReceiptId { get; private set; }
    public Guid PurchaseOrderLineId { get; private set; }
    public Guid? InventoryItemId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitCost { get; private set; }
    public int ReceiptKind { get; private set; } // 1 = Stock, 2 = Service / Non-stock
    public string? Notes { get; private set; }

    public decimal LineAmount => Quantity * UnitCost;
}
