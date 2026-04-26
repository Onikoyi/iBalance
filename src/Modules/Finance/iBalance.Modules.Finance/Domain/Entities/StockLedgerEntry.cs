using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class StockLedgerEntry : TenantOwnedEntity
{
    private StockLedgerEntry()
    {
    }

    public StockLedgerEntry(
        Guid id,
        Guid tenantId,
        Guid inventoryItemId,
        Guid warehouseId,
        Guid inventoryTransactionId,
        Guid? inventoryTransactionLineId,
        StockMovementType movementType,
        DateTime movementDateUtc,
        decimal quantityIn,
        decimal quantityOut,
        decimal unitCost,
        string reference,
        string description) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Stock ledger entry id cannot be empty.", nameof(id));
        if (inventoryItemId == Guid.Empty) throw new ArgumentException("Inventory item is required.", nameof(inventoryItemId));
        if (warehouseId == Guid.Empty) throw new ArgumentException("Warehouse is required.", nameof(warehouseId));
        if (inventoryTransactionId == Guid.Empty) throw new ArgumentException("Inventory transaction id is required.", nameof(inventoryTransactionId));
        if (movementDateUtc == default) throw new ArgumentException("Movement date is required.", nameof(movementDateUtc));
        if (quantityIn < 0m || quantityOut < 0m) throw new ArgumentException("Stock movement quantities cannot be negative.");
        if (quantityIn == 0m && quantityOut == 0m) throw new ArgumentException("Stock movement must have either quantity in or quantity out.");
        if (quantityIn > 0m && quantityOut > 0m) throw new ArgumentException("Stock movement cannot have both quantity in and quantity out.");
        if (unitCost < 0m) throw new ArgumentException("Unit cost cannot be negative.", nameof(unitCost));
        if (string.IsNullOrWhiteSpace(reference)) throw new ArgumentException("Reference is required.", nameof(reference));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Description is required.", nameof(description));

        Id = id;
        InventoryItemId = inventoryItemId;
        WarehouseId = warehouseId;
        InventoryTransactionId = inventoryTransactionId;
        InventoryTransactionLineId = inventoryTransactionLineId;
        MovementType = movementType;
        MovementDateUtc = movementDateUtc;
        QuantityIn = quantityIn;
        QuantityOut = quantityOut;
        UnitCost = unitCost;
        TotalCost = (quantityIn > 0m ? quantityIn : quantityOut) * unitCost;
        Reference = reference.Trim();
        Description = description.Trim();
    }

    public Guid Id { get; private set; }
    public Guid InventoryItemId { get; private set; }
    public Guid WarehouseId { get; private set; }
    public Guid InventoryTransactionId { get; private set; }
    public Guid? InventoryTransactionLineId { get; private set; }
    public StockMovementType MovementType { get; private set; }
    public DateTime MovementDateUtc { get; private set; }
    public decimal QuantityIn { get; private set; }
    public decimal QuantityOut { get; private set; }
    public decimal UnitCost { get; private set; }
    public decimal TotalCost { get; private set; }
    public string Reference { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
}
