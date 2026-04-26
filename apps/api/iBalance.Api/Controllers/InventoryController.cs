using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/inventory")]
public sealed class InventoryController : ControllerBase
{
    [HttpGet("items")]
    public async Task<IActionResult> GetItems([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.InventoryItems.AsNoTracking()
            .OrderBy(x => x.ItemCode)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                Code = x.ItemCode,
                Name = x.ItemName,
                Type = x.ItemType,
                x.ItemCode,
                x.ItemName,
                x.Description,
                x.ItemType,
                x.UnitOfMeasure,
                x.ValuationMethod,
                x.ReorderLevel,
                x.IsActive,
                x.Notes,
                x.CreatedOnUtc,
                x.LastModifiedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new { TenantContextAvailable = true, tenantContext.TenantId, tenantContext.TenantKey, Count = items.Count, Items = items });
    }

    [HttpPost("items")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateItem([FromBody] CreateInventoryItemRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var normalizedCode = (request.ItemCode ?? request.Code)?.Trim().ToUpperInvariant();
        var itemName = request.ItemName ?? request.Name;
        var itemType = request.ItemType != 0 ? request.ItemType : request.Type;
        if (itemType == 0) itemType = InventoryItemType.StockItem;

        if (string.IsNullOrWhiteSpace(normalizedCode)) return BadRequest(new { Message = "Item code is required." });
        if (string.IsNullOrWhiteSpace(itemName)) return BadRequest(new { Message = "Item name is required." });
        if (string.IsNullOrWhiteSpace(request.UnitOfMeasure)) return BadRequest(new { Message = "Unit of measure is required." });

        var duplicate = await dbContext.InventoryItems.AsNoTracking().AnyAsync(x => x.ItemCode == normalizedCode, cancellationToken);
        if (duplicate) return Conflict(new { Message = "An inventory item with the same code already exists.", ItemCode = normalizedCode });

        try
        {
            var item = new InventoryItem(Guid.NewGuid(), tenantContext.TenantId, normalizedCode, itemName, itemType, request.UnitOfMeasure, request.ValuationMethod, request.Description, request.ReorderLevel, request.Notes);
            dbContext.InventoryItems.Add(item);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Inventory item created successfully.", Item = item });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPut("items/{itemId:guid}")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> UpdateItem(Guid itemId, [FromBody] UpdateInventoryItemRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == itemId, cancellationToken);
        if (item is null) return NotFound(new { Message = "Inventory item was not found.", ItemId = itemId });

        try
        {
            var itemName = request.ItemName ?? request.Name;
            var itemType = request.ItemType != 0 ? request.ItemType : request.Type;
            if (itemType == 0) itemType = item.ItemType;
            item.Update(itemName, itemType, request.UnitOfMeasure, request.ValuationMethod, request.Description, request.ReorderLevel, request.Notes);
            if (request.IsActive) item.Activate(); else item.Deactivate();
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Inventory item updated successfully.", Item = item });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("items/{itemId:guid}/activate")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> ActivateItem(Guid itemId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == itemId, cancellationToken);
        if (item is null) return NotFound(new { Message = "Inventory item was not found.", ItemId = itemId });
        item.Activate();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Inventory item activated successfully." });
    }

    [HttpPost("items/{itemId:guid}/deactivate")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> DeactivateItem(Guid itemId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == itemId, cancellationToken);
        if (item is null) return NotFound(new { Message = "Inventory item was not found.", ItemId = itemId });
        item.Deactivate();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Inventory item deactivated successfully." });
    }

    [HttpGet("warehouses")]
    public async Task<IActionResult> GetWarehouses([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Warehouses.AsNoTracking()
            .OrderBy(x => x.WarehouseCode)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                Code = x.WarehouseCode,
                Name = x.WarehouseName,
                x.WarehouseCode,
                x.WarehouseName,
                x.Location,
                x.IsActive,
                x.Notes,
                x.CreatedOnUtc,
                x.LastModifiedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new { TenantContextAvailable = true, tenantContext.TenantId, tenantContext.TenantKey, Count = items.Count, Items = items });
    }

    [HttpPost("warehouses")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> CreateWarehouse([FromBody] CreateWarehouseRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var warehouseName = request.WarehouseName ?? request.Name;
        var normalizedCode = (request.WarehouseCode ?? request.Code ?? warehouseName)?.Trim().ToUpperInvariant().Replace(' ', '-');
        if (string.IsNullOrWhiteSpace(normalizedCode)) return BadRequest(new { Message = "Warehouse code is required." });
        if (string.IsNullOrWhiteSpace(warehouseName)) return BadRequest(new { Message = "Warehouse name is required." });

        var duplicate = await dbContext.Warehouses.AsNoTracking().AnyAsync(x => x.WarehouseCode == normalizedCode, cancellationToken);
        if (duplicate) return Conflict(new { Message = "A warehouse with the same code already exists.", WarehouseCode = normalizedCode });

        try
        {
            var warehouse = new Warehouse(Guid.NewGuid(), tenantContext.TenantId, normalizedCode, warehouseName, request.Location, request.Notes);
            dbContext.Warehouses.Add(warehouse);
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Warehouse created successfully.", Warehouse = warehouse });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPut("warehouses/{warehouseId:guid}")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> UpdateWarehouse(Guid warehouseId, [FromBody] UpdateWarehouseRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == warehouseId, cancellationToken);
        if (warehouse is null) return NotFound(new { Message = "Warehouse was not found.", WarehouseId = warehouseId });

        try
        {
            var warehouseName = request.WarehouseName ?? request.Name;
            warehouse.Update(warehouseName, request.Location, request.Notes);
            if (request.IsActive) warehouse.Activate(); else warehouse.Deactivate();
            await dbContext.SaveChangesAsync(cancellationToken);
            return Ok(new { Message = "Warehouse updated successfully.", Warehouse = warehouse });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { Message = ex.Message });
        }
    }

    [HttpPost("warehouses/{warehouseId:guid}/activate")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> ActivateWarehouse(Guid warehouseId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == warehouseId, cancellationToken);
        if (warehouse is null) return NotFound(new { Message = "Warehouse was not found.", WarehouseId = warehouseId });
        warehouse.Activate();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Warehouse activated successfully." });
    }

    [HttpPost("warehouses/{warehouseId:guid}/deactivate")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> DeactivateWarehouse(Guid warehouseId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == warehouseId, cancellationToken);
        if (warehouse is null) return NotFound(new { Message = "Warehouse was not found.", WarehouseId = warehouseId });
        warehouse.Deactivate();
        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Warehouse deactivated successfully." });
    }

    [HttpGet("stock-position")]
    public async Task<IActionResult> GetStockPosition([FromQuery] Guid? inventoryItemId, [FromQuery] Guid? itemId, [FromQuery] Guid? warehouseId, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        var effectiveInventoryItemId = inventoryItemId ?? itemId;

        var query = dbContext.StockLedgerEntries.AsNoTracking();
        if (effectiveInventoryItemId.HasValue) query = query.Where(x => x.InventoryItemId == effectiveInventoryItemId.Value);
        if (warehouseId.HasValue) query = query.Where(x => x.WarehouseId == warehouseId.Value);

        var entries = await query.ToListAsync(cancellationToken);
        var itemIds = entries.Select(x => x.InventoryItemId).Distinct().ToList();
        var warehouseIds = entries.Select(x => x.WarehouseId).Distinct().ToList();
        var items = await dbContext.InventoryItems.AsNoTracking().Where(x => itemIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
        var warehouses = await dbContext.Warehouses.AsNoTracking().Where(x => warehouseIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);

        var rows = entries.GroupBy(x => new { x.InventoryItemId, x.WarehouseId }).Select(group =>
        {
            items.TryGetValue(group.Key.InventoryItemId, out var item);
            warehouses.TryGetValue(group.Key.WarehouseId, out var warehouse);
            var quantityOnHand = group.Sum(x => x.QuantityIn) - group.Sum(x => x.QuantityOut);
            var valueOnHand = group.Sum(x => x.QuantityIn * x.UnitCost) - group.Sum(x => x.QuantityOut * x.UnitCost);
            return new
            {
                group.Key.InventoryItemId,
                ItemId = group.Key.InventoryItemId,
                ItemCode = item?.ItemCode ?? string.Empty,
                ItemName = item?.ItemName ?? string.Empty,
                UnitOfMeasure = item?.UnitOfMeasure ?? string.Empty,
                ReorderLevel = item?.ReorderLevel ?? 0m,
                group.Key.WarehouseId,
                WarehouseCode = warehouse?.WarehouseCode ?? string.Empty,
                WarehouseName = warehouse?.WarehouseName ?? string.Empty,
                WarehouseLocation = warehouse?.Location,
                QuantityOnHand = quantityOnHand,
                InventoryValue = valueOnHand,
                AverageUnitCost = quantityOnHand > 0m ? valueOnHand / quantityOnHand : 0m,
                IsBelowReorderLevel = item is not null && quantityOnHand <= item.ReorderLevel
            };
        }).OrderBy(x => x.ItemCode).ThenBy(x => x.WarehouseCode).ToList();

        return Ok(new { TenantContextAvailable = true, tenantContext.TenantId, tenantContext.TenantKey, Count = rows.Count, TotalQuantityOnHand = rows.Sum(x => x.QuantityOnHand), TotalInventoryValue = rows.Sum(x => x.InventoryValue), Items = rows });
    }

    [HttpGet("stock-ledger")]
    public async Task<IActionResult> GetStockLedger([FromQuery] Guid? inventoryItemId, [FromQuery] Guid? itemId, [FromQuery] Guid? warehouseId, [FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        var effectiveInventoryItemId = inventoryItemId ?? itemId;

        var query = dbContext.StockLedgerEntries.AsNoTracking();
        if (effectiveInventoryItemId.HasValue) query = query.Where(x => x.InventoryItemId == effectiveInventoryItemId.Value);
        if (warehouseId.HasValue) query = query.Where(x => x.WarehouseId == warehouseId.Value);
        if (fromUtc.HasValue) query = query.Where(x => x.MovementDateUtc >= fromUtc.Value);
        if (toUtc.HasValue) query = query.Where(x => x.MovementDateUtc <= toUtc.Value);

        var rows = await query.OrderByDescending(x => x.MovementDateUtc).ThenByDescending(x => x.Id)
            .Join(dbContext.InventoryItems.AsNoTracking(), ledger => ledger.InventoryItemId, item => item.Id, (ledger, item) => new { ledger, item })
            .Join(dbContext.Warehouses.AsNoTracking(), joined => joined.ledger.WarehouseId, warehouse => warehouse.Id, (joined, warehouse) => new
            {
                joined.ledger.Id,
                joined.ledger.InventoryItemId,
                ItemId = joined.ledger.InventoryItemId,
                joined.item.ItemCode,
                joined.item.ItemName,
                joined.item.UnitOfMeasure,
                joined.ledger.WarehouseId,
                warehouse.WarehouseCode,
                WarehouseName = warehouse.WarehouseName,
                WarehouseLocation = warehouse.Location,
                joined.ledger.InventoryTransactionId,
                joined.ledger.InventoryTransactionLineId,
                joined.ledger.MovementType,
                joined.ledger.MovementDateUtc,
                joined.ledger.QuantityIn,
                joined.ledger.QuantityOut,
                Quantity = joined.ledger.QuantityIn > 0m ? joined.ledger.QuantityIn : -joined.ledger.QuantityOut,
                joined.ledger.UnitCost,
                TotalCost = joined.ledger.QuantityIn > 0m ? joined.ledger.TotalCost : -joined.ledger.TotalCost,
                ReferenceType = joined.ledger.MovementType == StockMovementType.StockIn ? 1 : 2,
                ReferenceId = joined.ledger.InventoryTransactionId,
                joined.ledger.Reference,
                joined.ledger.Description
            })
            .ToListAsync(cancellationToken);

        return Ok(new { TenantContextAvailable = true, tenantContext.TenantId, tenantContext.TenantKey, Count = rows.Count, Items = rows });
    }

    [HttpGet("transactions")]
    public async Task<IActionResult> GetTransactions([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var transactions = await dbContext.InventoryTransactions.AsNoTracking().Include(x => x.Lines).OrderByDescending(x => x.TransactionDateUtc).ThenByDescending(x => x.CreatedOnUtc).Select(x => new
        {
            x.Id,
            x.TenantId,
            x.TransactionNumber,
            x.TransactionType,
            x.TransactionDateUtc,
            x.Description,
            x.Reference,
            x.Notes,
            x.Status,
            x.JournalEntryId,
            x.CreatedOnUtc,
            LineCount = x.Lines.Count,
            TotalQuantity = x.Lines.Sum(line => line.Quantity),
            TotalCost = x.Lines.Sum(line => line.TotalCost)
        }).ToListAsync(cancellationToken);

        return Ok(new { TenantContextAvailable = true, tenantContext.TenantId, tenantContext.TenantKey, Count = transactions.Count, Items = transactions });
    }

    [HttpPost("stock-in")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> PostStockIn([FromBody] PostStockInRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        return await PostStockInAsync(dbContext, tenantContextAccessor, request, cancellationToken);
    }

    [HttpPost("adjust")]
    [HttpPost("adjustments")]
    [Authorize(Roles = "PlatformAdmin,TenantAdmin,Accountant")]
    public async Task<IActionResult> PostAdjustment([FromBody] PostStockAdjustmentRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        if (request.Lines is null || request.Lines.Count == 0) return BadRequest(new { Message = "At least one adjustment line is required." });
        if (request.InventoryLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Inventory control ledger account is required." });
        if (request.AdjustmentLedgerAccountId == Guid.Empty) return BadRequest(new { Message = "Inventory adjustment gain/loss ledger account is required." });

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.TransactionDateUtc, cancellationToken);
        if (postingPeriod is null) return Conflict(new { Message = "No open fiscal period exists for the inventory adjustment date.", request.TransactionDateUtc });

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(dbContext, new[] { request.InventoryLedgerAccountId, request.AdjustmentLedgerAccountId }, cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var effectiveDescription = string.IsNullOrWhiteSpace(request.Description) ? "Inventory stock adjustment" : request.Description.Trim();
        var transactionNumber = await ResolveTransactionNumberAsync(dbContext, tenantContext.TenantId, request.TransactionNumber, "ADJ", cancellationToken);
        var duplicate = await dbContext.InventoryTransactions.AsNoTracking().AnyAsync(x => x.TransactionNumber == transactionNumber, cancellationToken);
        if (duplicate) return Conflict(new { Message = "An inventory transaction with the same number already exists.", TransactionNumber = transactionNumber });

        var journalReference = string.IsNullOrWhiteSpace(request.JournalReference) ? $"INV-ADJ-{transactionNumber}" : request.JournalReference.Trim().ToUpperInvariant();
        var duplicateJournal = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == journalReference, cancellationToken);
        if (duplicateJournal) return Conflict(new { Message = "A journal entry with the same inventory adjustment reference already exists.", Reference = journalReference });

        var transaction = new InventoryTransaction(Guid.NewGuid(), tenantContext.TenantId, transactionNumber, InventoryTransactionType.Adjustment, request.TransactionDateUtc, effectiveDescription, request.Reference, request.Notes);
        var lines = new List<InventoryTransactionLine>();
        var ledgerEntries = new List<StockLedgerEntry>();
        var journalLines = new List<JournalEntryLine>();

        foreach (var line in request.Lines)
        {
            var effectiveItemId = line.InventoryItemId != Guid.Empty ? line.InventoryItemId : line.ItemId;
            var effectiveWarehouseId = line.WarehouseId != Guid.Empty ? line.WarehouseId : request.WarehouseId;
            var effectiveQuantityChange = line.QuantityChange != 0m ? line.QuantityChange : line.Quantity;
            if (effectiveItemId == Guid.Empty) return BadRequest(new { Message = "Inventory item is required." });
            if (effectiveWarehouseId == Guid.Empty) return BadRequest(new { Message = "Warehouse is required." });
            if (effectiveQuantityChange == 0m) return BadRequest(new { Message = "Adjustment quantity change cannot be zero.", InventoryItemId = effectiveItemId });
            if (line.UnitCost < 0m) return BadRequest(new { Message = "Unit cost cannot be negative.", InventoryItemId = effectiveItemId });

            var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == effectiveItemId, cancellationToken);
            if (item is null) return BadRequest(new { Message = "Inventory item was not found.", InventoryItemId = effectiveItemId });
            if (!item.IsActive || item.ItemType != InventoryItemType.StockItem) return BadRequest(new { Message = "Only active stock items can be adjusted.", item.ItemCode });

            var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == effectiveWarehouseId, cancellationToken);
            if (warehouse is null) return BadRequest(new { Message = "Warehouse was not found.", WarehouseId = effectiveWarehouseId });
            if (!warehouse.IsActive) return BadRequest(new { Message = "Only active warehouses can be used.", warehouse.WarehouseCode });

            var quantityAbs = Math.Abs(effectiveQuantityChange);
            if (effectiveQuantityChange < 0m)
            {
                var onHand = await GetQuantityOnHandAsync(dbContext, effectiveItemId, effectiveWarehouseId, cancellationToken);
                if (onHand < quantityAbs)
                {
                    return Conflict(new { Message = "Adjustment would create negative stock.", item.ItemCode, warehouse.WarehouseCode, QuantityOnHand = onHand, RequestedDecrease = quantityAbs });
                }
            }

            var transactionLine = new InventoryTransactionLine(Guid.NewGuid(), tenantContext.TenantId, transaction.Id, effectiveItemId, effectiveWarehouseId, quantityAbs, line.UnitCost, line.Description);
            lines.Add(transactionLine);

            var movementType = effectiveQuantityChange > 0m ? StockMovementType.AdjustmentIn : StockMovementType.AdjustmentOut;
            ledgerEntries.Add(new StockLedgerEntry(Guid.NewGuid(), tenantContext.TenantId, effectiveItemId, effectiveWarehouseId, transaction.Id, transactionLine.Id, movementType, request.TransactionDateUtc, effectiveQuantityChange > 0m ? quantityAbs : 0m, effectiveQuantityChange < 0m ? quantityAbs : 0m, line.UnitCost, transaction.TransactionNumber, line.Description ?? effectiveDescription));

            var lineValue = quantityAbs * line.UnitCost;
            if (lineValue <= 0m) continue;

            if (effectiveQuantityChange > 0m)
            {
                journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.InventoryLedgerAccountId, $"Inventory adjustment increase - {item.ItemCode}", lineValue, 0m));
                journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.AdjustmentLedgerAccountId, $"Inventory adjustment gain - {item.ItemCode}", 0m, lineValue));
            }
            else
            {
                journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.AdjustmentLedgerAccountId, $"Inventory adjustment loss - {item.ItemCode}", lineValue, 0m));
                journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.InventoryLedgerAccountId, $"Inventory adjustment decrease - {item.ItemCode}", 0m, lineValue));
            }
        }

        if (journalLines.Count == 0) return BadRequest(new { Message = "Inventory adjustment total value must be greater than zero for GL posting." });

        foreach (var transactionLine in lines) transaction.Lines.Add(transactionLine);

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.TransactionDateUtc,
            journalReference,
            $"Inventory adjustment posting - {transaction.TransactionNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            journalLines,
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);
        transaction.LinkJournal(journalEntry.Id);

        var movements = journalEntry.Lines.Select(line => new LedgerMovement(
            Guid.NewGuid(),
            tenantContext.TenantId,
            journalEntry.Id,
            line.Id,
            line.LedgerAccountId,
            journalEntry.EntryDateUtc,
            journalEntry.Reference,
            line.Description,
            line.DebitAmount,
            line.CreditAmount)).ToList();

        dbContext.InventoryTransactions.Add(transaction);
        dbContext.InventoryTransactionLines.AddRange(lines);
        dbContext.StockLedgerEntries.AddRange(ledgerEntries);
        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Inventory adjustment posted successfully with GL journal.",
            TransactionId = transaction.Id,
            transaction.TransactionNumber,
            transaction.JournalEntryId,
            LineCount = lines.Count,
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name,
            JournalEntry = new { journalEntry.Id, journalEntry.Reference, journalEntry.TotalDebit, journalEntry.TotalCredit }
        });
    }

    private static async Task<IActionResult> PostStockInAsync(ApplicationDbContext dbContext, ITenantContextAccessor tenantContextAccessor, PostStockInRequest request, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        if (request.Lines is null || request.Lines.Count == 0) return new BadRequestObjectResult(new { Message = "At least one stock line is required." });
        if (request.InventoryLedgerAccountId == Guid.Empty) return new BadRequestObjectResult(new { Message = "Inventory control ledger account is required." });
        if (request.CreditLedgerAccountId == Guid.Empty) return new BadRequestObjectResult(new { Message = "Credit ledger account is required for inventory stock-in posting." });

        var postingPeriod = await GetOpenFiscalPeriodForDateAsync(dbContext, request.TransactionDateUtc, cancellationToken);
        if (postingPeriod is null) return new ConflictObjectResult(new { Message = "No open fiscal period exists for the stock-in date.", request.TransactionDateUtc });

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(dbContext, new[] { request.InventoryLedgerAccountId, request.CreditLedgerAccountId }, cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var effectiveDescription = string.IsNullOrWhiteSpace(request.Description) ? "Inventory stock-in" : request.Description.Trim();
        var transactionNumber = await ResolveTransactionNumberAsync(dbContext, tenantContext.TenantId, request.TransactionNumber, "STK-IN", cancellationToken);
        var duplicate = await dbContext.InventoryTransactions.AsNoTracking().AnyAsync(x => x.TransactionNumber == transactionNumber, cancellationToken);
        if (duplicate) return new ConflictObjectResult(new { Message = "An inventory transaction with the same number already exists.", TransactionNumber = transactionNumber });

        var journalReference = string.IsNullOrWhiteSpace(request.JournalReference) ? $"INV-STK-IN-{transactionNumber}" : request.JournalReference.Trim().ToUpperInvariant();
        var duplicateJournal = await dbContext.JournalEntries.AsNoTracking().AnyAsync(x => x.Reference == journalReference, cancellationToken);
        if (duplicateJournal) return new ConflictObjectResult(new { Message = "A journal entry with the same stock-in reference already exists.", Reference = journalReference });

        var transaction = new InventoryTransaction(Guid.NewGuid(), tenantContext.TenantId, transactionNumber, InventoryTransactionType.StockIn, request.TransactionDateUtc, effectiveDescription, request.Reference, request.Notes);
        var lines = new List<InventoryTransactionLine>();
        var ledgerEntries = new List<StockLedgerEntry>();
        var journalLines = new List<JournalEntryLine>();

        foreach (var line in request.Lines)
        {
            var effectiveItemId = line.InventoryItemId != Guid.Empty ? line.InventoryItemId : line.ItemId;
            var effectiveWarehouseId = line.WarehouseId != Guid.Empty ? line.WarehouseId : request.WarehouseId;
            if (effectiveItemId == Guid.Empty) return new BadRequestObjectResult(new { Message = "Inventory item is required." });
            if (effectiveWarehouseId == Guid.Empty) return new BadRequestObjectResult(new { Message = "Warehouse is required." });
            if (line.Quantity <= 0m) return new BadRequestObjectResult(new { Message = "Quantity must be greater than zero.", InventoryItemId = effectiveItemId });
            if (line.UnitCost < 0m) return new BadRequestObjectResult(new { Message = "Unit cost cannot be negative.", InventoryItemId = effectiveItemId });

            var item = await dbContext.InventoryItems.FirstOrDefaultAsync(x => x.Id == effectiveItemId, cancellationToken);
            if (item is null) return new BadRequestObjectResult(new { Message = "Inventory item was not found.", InventoryItemId = effectiveItemId });
            if (!item.IsActive || item.ItemType != InventoryItemType.StockItem) return new BadRequestObjectResult(new { Message = "Only active stock items can receive stock.", item.ItemCode });

            var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == effectiveWarehouseId, cancellationToken);
            if (warehouse is null) return new BadRequestObjectResult(new { Message = "Warehouse was not found.", WarehouseId = effectiveWarehouseId });
            if (!warehouse.IsActive) return new BadRequestObjectResult(new { Message = "Only active warehouses can be used.", warehouse.WarehouseCode });

            var transactionLine = new InventoryTransactionLine(Guid.NewGuid(), tenantContext.TenantId, transaction.Id, effectiveItemId, effectiveWarehouseId, line.Quantity, line.UnitCost, line.Description);
            lines.Add(transactionLine);
            ledgerEntries.Add(new StockLedgerEntry(Guid.NewGuid(), tenantContext.TenantId, effectiveItemId, effectiveWarehouseId, transaction.Id, transactionLine.Id, StockMovementType.StockIn, request.TransactionDateUtc, line.Quantity, 0m, line.UnitCost, transaction.TransactionNumber, line.Description ?? effectiveDescription));

            var lineValue = line.Quantity * line.UnitCost;
            if (lineValue <= 0m) continue;
            journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.InventoryLedgerAccountId, $"Inventory stock-in - {item.ItemCode}", lineValue, 0m));
            journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.CreditLedgerAccountId, $"Inventory stock-in funding - {item.ItemCode}", 0m, lineValue));
        }

        if (journalLines.Count == 0) return new BadRequestObjectResult(new { Message = "Stock-in total value must be greater than zero for GL posting." });

        foreach (var transactionLine in lines) transaction.Lines.Add(transactionLine);

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.TransactionDateUtc,
            journalReference,
            $"Inventory stock-in posting - {transaction.TransactionNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            journalLines,
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);
        transaction.LinkJournal(journalEntry.Id);

        var movements = journalEntry.Lines.Select(line => new LedgerMovement(
            Guid.NewGuid(),
            tenantContext.TenantId,
            journalEntry.Id,
            line.Id,
            line.LedgerAccountId,
            journalEntry.EntryDateUtc,
            journalEntry.Reference,
            line.Description,
            line.DebitAmount,
            line.CreditAmount)).ToList();

        dbContext.InventoryTransactions.Add(transaction);
        dbContext.InventoryTransactionLines.AddRange(lines);
        dbContext.StockLedgerEntries.AddRange(ledgerEntries);
        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new OkObjectResult(new
        {
            Message = "Stock-in posted successfully with GL journal.",
            TransactionId = transaction.Id,
            transaction.TransactionNumber,
            transaction.JournalEntryId,
            LineCount = lines.Count,
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name,
            JournalEntry = new { journalEntry.Id, journalEntry.Reference, journalEntry.TotalDebit, journalEntry.TotalCredit }
        });
    }

    private static async Task<FiscalPeriod?> GetOpenFiscalPeriodForDateAsync(ApplicationDbContext dbContext, DateTime postingDateUtc, CancellationToken cancellationToken)
    {
        var postingDate = DateOnly.FromDateTime(postingDateUtc.Date);
        return await dbContext.FiscalPeriods
            .AsNoTracking()
            .Where(x => x.Status == FiscalPeriodStatus.Open && x.StartDate <= postingDate && x.EndDate >= postingDate)
            .OrderBy(x => x.StartDate)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private static async Task<IActionResult?> ValidatePostingLedgerAccountsAsync(ApplicationDbContext dbContext, IEnumerable<Guid> ledgerAccountIds, CancellationToken cancellationToken)
    {
        var requestedIds = ledgerAccountIds.Where(x => x != Guid.Empty).Distinct().ToList();
        var ledgerAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var ledgerAccountId in requestedIds)
        {
            if (!ledgerAccounts.TryGetValue(ledgerAccountId, out var ledgerAccount))
            {
                return new BadRequestObjectResult(new { Message = "One or more selected ledger accounts were not found.", LedgerAccountId = ledgerAccountId });
            }

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return new BadRequestObjectResult(new
                {
                    Message = "Inventory GL posting accounts must be active, non-header, posting-enabled ledger accounts.",
                    LedgerAccountId = ledgerAccount.Id,
                    ledgerAccount.Code,
                    ledgerAccount.Name
                });
            }
        }

        return null;
    }

    private static IActionResult TenantRequired() => new BadRequestObjectResult(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

    private static async Task<string> ResolveTransactionNumberAsync(ApplicationDbContext dbContext, Guid tenantId, string? requestedNumber, string prefix, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requestedNumber)) return requestedNumber.Trim().ToUpperInvariant();
        var count = await dbContext.InventoryTransactions.IgnoreQueryFilters().CountAsync(x => x.TenantId == tenantId, cancellationToken);
        return $"{prefix}-{DateTime.UtcNow:yyyyMMdd}-{count + 1:0000}";
    }

    private static async Task<decimal> GetQuantityOnHandAsync(ApplicationDbContext dbContext, Guid itemId, Guid warehouseId, CancellationToken cancellationToken)
    {
        var entries = await dbContext.StockLedgerEntries.AsNoTracking().Where(x => x.InventoryItemId == itemId && x.WarehouseId == warehouseId).Select(x => new { x.QuantityIn, x.QuantityOut }).ToListAsync(cancellationToken);
        return entries.Sum(x => x.QuantityIn) - entries.Sum(x => x.QuantityOut);
    }
}

public sealed class CreateInventoryItemRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? ItemCode { get; set; }
    public string? ItemName { get; set; }
    public string? Description { get; set; }
    public InventoryItemType Type { get; set; } = InventoryItemType.StockItem;
    public InventoryItemType ItemType { get; set; } = InventoryItemType.StockItem;
    public string UnitOfMeasure { get; set; } = string.Empty;
    public InventoryValuationMethod ValuationMethod { get; set; } = InventoryValuationMethod.WeightedAverage;
    public decimal ReorderLevel { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpdateInventoryItemRequest
{
    public string? Name { get; set; }
    public string? ItemName { get; set; }
    public string? Description { get; set; }
    public InventoryItemType Type { get; set; } = InventoryItemType.StockItem;
    public InventoryItemType ItemType { get; set; } = InventoryItemType.StockItem;
    public string UnitOfMeasure { get; set; } = string.Empty;
    public InventoryValuationMethod ValuationMethod { get; set; } = InventoryValuationMethod.WeightedAverage;
    public decimal ReorderLevel { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public sealed class CreateWarehouseRequest
{
    public string? Code { get; set; }
    public string? Name { get; set; }
    public string? WarehouseCode { get; set; }
    public string? WarehouseName { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
}

public sealed class UpdateWarehouseRequest
{
    public string? Name { get; set; }
    public string? WarehouseName { get; set; }
    public string? Location { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Notes { get; set; }
}

public sealed class PostStockInRequest
{
    public Guid WarehouseId { get; set; }
    public string? TransactionNumber { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
    public string Description { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public string? JournalReference { get; set; }
    public Guid InventoryLedgerAccountId { get; set; }
    public Guid CreditLedgerAccountId { get; set; }
    public string? Notes { get; set; }
    public List<PostStockInLineRequest> Lines { get; set; } = [];
}

public sealed class PostStockInLineRequest
{
    public Guid ItemId { get; set; }
    public Guid InventoryItemId { get; set; }
    public Guid WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public string? Description { get; set; }
}

public sealed class PostStockAdjustmentRequest
{
    public Guid WarehouseId { get; set; }
    public string? TransactionNumber { get; set; }
    public DateTime TransactionDateUtc { get; set; } = DateTime.UtcNow;
    public string Description { get; set; } = string.Empty;
    public string? Reference { get; set; }
    public string? JournalReference { get; set; }
    public Guid InventoryLedgerAccountId { get; set; }
    public Guid AdjustmentLedgerAccountId { get; set; }
    public string? Notes { get; set; }
    public List<PostStockAdjustmentLineRequest> Lines { get; set; } = [];
}

public sealed class PostStockAdjustmentLineRequest
{
    public Guid ItemId { get; set; }
    public Guid InventoryItemId { get; set; }
    public Guid WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    public decimal QuantityChange { get; set; }
    public decimal UnitCost { get; set; }
    public string? Description { get; set; }
}
