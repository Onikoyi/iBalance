namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PurchaseRequisitionLine
{
    private PurchaseRequisitionLine()
    {
    }

    public PurchaseRequisitionLine(
        Guid id,
        Guid tenantId,
        Guid purchaseRequisitionId,
        Guid? inventoryItemId,
        string description,
        decimal quantity,
        decimal estimatedUnitPrice,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        PurchaseRequisitionId = purchaseRequisitionId;
        InventoryItemId = inventoryItemId;
        Description = description.Trim();
        Quantity = quantity;
        EstimatedUnitPrice = estimatedUnitPrice;
        Notes = notes?.Trim();
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PurchaseRequisitionId { get; private set; }
    public Guid? InventoryItemId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal EstimatedUnitPrice { get; private set; }
    public string? Notes { get; private set; }

    public decimal EstimatedTotalAmount => Quantity * EstimatedUnitPrice;
}
