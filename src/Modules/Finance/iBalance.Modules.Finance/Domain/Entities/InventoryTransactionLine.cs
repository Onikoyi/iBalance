using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class InventoryTransactionLine : TenantOwnedEntity
{
    private InventoryTransactionLine()
    {
    }

    public InventoryTransactionLine(
        Guid id,
        Guid tenantId,
        Guid inventoryTransactionId,
        Guid inventoryItemId,
        Guid warehouseId,
        decimal quantity,
        decimal unitCost,
        string? description = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Inventory transaction line id cannot be empty.", nameof(id));
        if (inventoryTransactionId == Guid.Empty) throw new ArgumentException("Inventory transaction id is required.", nameof(inventoryTransactionId));
        if (inventoryItemId == Guid.Empty) throw new ArgumentException("Inventory item is required.", nameof(inventoryItemId));
        if (warehouseId == Guid.Empty) throw new ArgumentException("Warehouse is required.", nameof(warehouseId));
        if (quantity <= 0m) throw new ArgumentException("Quantity must be greater than zero.", nameof(quantity));
        if (unitCost < 0m) throw new ArgumentException("Unit cost cannot be negative.", nameof(unitCost));

        Id = id;
        InventoryTransactionId = inventoryTransactionId;
        InventoryItemId = inventoryItemId;
        WarehouseId = warehouseId;
        Quantity = quantity;
        UnitCost = unitCost;
        TotalCost = quantity * unitCost;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
    }

    public Guid Id { get; private set; }
    public Guid InventoryTransactionId { get; private set; }
    public Guid InventoryItemId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public decimal Quantity { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal TotalCost { get; private set; }
    public string? Description { get; private set; }
}
