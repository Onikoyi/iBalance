using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class Warehouse : TenantOwnedEntity
{
    private Warehouse()
    {
    }

    public Warehouse(
        Guid id,
        Guid tenantId,
        string warehouseCode,
        string warehouseName,
        string? location = null,
        string? notes = null) : base(tenantId)
    {
        if (id == Guid.Empty) throw new ArgumentException("Warehouse id cannot be empty.", nameof(id));
        if (string.IsNullOrWhiteSpace(warehouseCode)) throw new ArgumentException("Warehouse code is required.", nameof(warehouseCode));
        if (string.IsNullOrWhiteSpace(warehouseName)) throw new ArgumentException("Warehouse name is required.", nameof(warehouseName));

        Id = id;
        WarehouseCode = warehouseCode.Trim().ToUpperInvariant();
        WarehouseName = warehouseName.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string WarehouseCode { get; private set; } = string.Empty;
    public string WarehouseName { get; private set; } = string.Empty;
    public string? Location { get; private set; }
    public bool IsActive { get; private set; }
    public string? Notes { get; private set; }

    public void Update(string warehouseName, string? location, string? notes)
    {
        if (string.IsNullOrWhiteSpace(warehouseName)) throw new ArgumentException("Warehouse name is required.", nameof(warehouseName));

        WarehouseName = warehouseName.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
