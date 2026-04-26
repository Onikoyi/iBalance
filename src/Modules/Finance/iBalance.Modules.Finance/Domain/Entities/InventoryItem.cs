using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class InventoryItem : TenantOwnedEntity
{
    private InventoryItem()
    {
    }

    public InventoryItem(
        Guid id,
        Guid tenantId,
        string itemCode,
        string itemName,
        InventoryItemType itemType,
        string unitOfMeasure,
        InventoryValuationMethod valuationMethod,
        string? description = null,
        decimal reorderLevel = 0m,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Inventory item id cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(itemCode)) throw new ArgumentException("Item code is required.", nameof(itemCode));
        if (string.IsNullOrWhiteSpace(itemName)) throw new ArgumentException("Item name is required.", nameof(itemName));
        if (string.IsNullOrWhiteSpace(unitOfMeasure)) throw new ArgumentException("Unit of measure is required.", nameof(unitOfMeasure));
        if (reorderLevel < 0m) throw new ArgumentException("Reorder level cannot be negative.", nameof(reorderLevel));

        Id = id;
        ItemCode = itemCode.Trim().ToUpperInvariant();
        ItemName = itemName.Trim();
        ItemType = itemType;
        UnitOfMeasure = unitOfMeasure.Trim().ToUpperInvariant();
        ValuationMethod = valuationMethod;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        ReorderLevel = reorderLevel;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string ItemCode { get; private set; } = string.Empty;
    public string ItemName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public InventoryItemType ItemType { get; private set; }
    public string UnitOfMeasure { get; private set; } = string.Empty;
    public InventoryValuationMethod ValuationMethod { get; private set; }
    public decimal ReorderLevel { get; private set; }
    public bool IsActive { get; private set; }
    public string? Notes { get; private set; }

    public void Update(
        string itemName,
        InventoryItemType itemType,
        string unitOfMeasure,
        InventoryValuationMethod valuationMethod,
        string? description,
        decimal reorderLevel,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(itemName)) throw new ArgumentException("Item name is required.", nameof(itemName));
        if (string.IsNullOrWhiteSpace(unitOfMeasure)) throw new ArgumentException("Unit of measure is required.", nameof(unitOfMeasure));
        if (reorderLevel < 0m) throw new ArgumentException("Reorder level cannot be negative.", nameof(reorderLevel));

        ItemName = itemName.Trim();
        ItemType = itemType;
        UnitOfMeasure = unitOfMeasure.Trim().ToUpperInvariant();
        ValuationMethod = valuationMethod;
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        ReorderLevel = reorderLevel;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
