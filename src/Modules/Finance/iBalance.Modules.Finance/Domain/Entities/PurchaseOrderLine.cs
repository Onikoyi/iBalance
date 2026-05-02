namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseOrderLine
{
    private PurchaseOrderLine()
    {
    }

    public PurchaseOrderLine(
        Guid id,
        Guid tenantId,
        Guid purchaseOrderId,
        Guid? purchaseRequisitionLineId,
        Guid? inventoryItemId,
        string description,
        decimal quantity,
        decimal unitPrice,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        PurchaseOrderId = purchaseOrderId;
        PurchaseRequisitionLineId = purchaseRequisitionLineId;
        InventoryItemId = inventoryItemId;
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        Notes = notes?.Trim();
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PurchaseOrderId { get; private set; }
    public Guid? PurchaseRequisitionLineId { get; private set; }
    public Guid? InventoryItemId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal ReceivedQuantity { get; private set; }
    public decimal InvoicedQuantity { get; private set; }
    public string? Notes { get; private set; }

    public decimal LineAmount => Quantity * UnitPrice;

    public void RecordReceipt(decimal quantity)
    {
        if (quantity <= 0) return;
        ReceivedQuantity += quantity;
    }

    public void RecordInvoiced(decimal quantity)
    {
        if (quantity <= 0) return;
        InvoicedQuantity += quantity;
    }
}
