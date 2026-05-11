using iBalance.Api.Services;
using iBalance.Api.Security;
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
[Route("api/finance/procurement")]
public sealed class ProcurementController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.ProcurementView)]
    [HttpGet("requisitions")]
    public async Task<IActionResult> GetPurchaseRequisitions(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<PurchaseRequisition>()
            .AsNoTracking()
            .Where(x => x.Status != 7)
            .OrderByDescending(x => x.RequestDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.RequisitionNumber,
                x.RequestDateUtc,
                x.RequestedByName,
                x.Department,
                x.NeededByUtc,
                x.Purpose,
                x.Status,
                x.Notes,
                x.CreatedOnUtc,
                LineCount = x.Lines.Count,
                EstimatedTotalAmount = x.Lines.Sum(line => line.Quantity * line.EstimatedUnitPrice)
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.ProcurementView)]
    [HttpGet("requisitions/rejected")]
    public async Task<IActionResult> GetRejectedPurchaseRequisitions(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<PurchaseRequisition>()
            .AsNoTracking()
            .Where(x => x.Status == 7)
            .OrderByDescending(x => x.RequestDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.RequisitionNumber,
                x.RequestDateUtc,
                x.RequestedByName,
                x.Department,
                x.NeededByUtc,
                x.Purpose,
                x.Status,
                x.Notes,
                x.CreatedOnUtc,
                LineCount = x.Lines.Count,
                EstimatedTotalAmount = x.Lines.Sum(line => line.Quantity * line.EstimatedUnitPrice),
                Lines = x.Lines.Select(line => new
                {
                    line.Id,
                    line.InventoryItemId,
                    line.Description,
                    line.Quantity,
                    line.EstimatedUnitPrice,
                    line.Notes
                }).ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("requisitions")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementRequisitionCreate)]
    public async Task<IActionResult> CreatePurchaseRequisition(
        [FromBody] CreatePurchaseRequisitionRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var validationError = ValidateRequisitionRequest(request);
        if (validationError is not null) return BadRequest(new { Message = validationError });

        var requisitionNumber = await GenerateProcurementNumberAsync(
            dbContext,
            "PRQ-",
            tenantContext.TenantId,
            cancellationToken);

        var requisition = new PurchaseRequisition(
            Guid.NewGuid(),
            tenantContext.TenantId,
            requisitionNumber,
            request.RequestDateUtc,
            request.RequestedByName,
            request.Department,
            request.NeededByUtc,
            request.Purpose,
            request.Notes);

        var lines = request.Lines.Select(line => new PurchaseRequisitionLine(
            Guid.NewGuid(),
            tenantContext.TenantId,
            requisition.Id,
            line.InventoryItemId,
            line.Description,
            line.Quantity,
            line.EstimatedUnitPrice,
            line.Notes)).ToList();

        requisition.ReplaceEditableDetails(
            request.RequestDateUtc,
            request.RequestedByName,
            request.Department,
            request.NeededByUtc,
            request.Purpose,
            request.Notes,
            lines);

        dbContext.Add(requisition);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase requisition created successfully.", requisition.Id, requisition.RequisitionNumber });
    }

    [HttpPut("requisitions/{requisitionId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementRequisitionCreate)]
    public async Task<IActionResult> UpdatePurchaseRequisition(
        Guid requisitionId,
        [FromBody] UpdatePurchaseRequisitionRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var requisition = await dbContext.Set<PurchaseRequisition>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == requisitionId, cancellationToken);

        if (requisition is null) return NotFound(new { Message = "Purchase requisition was not found.", RequisitionId = requisitionId });
        if (requisition.Status != 1 && requisition.Status != 7) return Conflict(new { Message = "Only draft or rejected purchase requisitions can be edited.", requisition.Status });

        var validationError = ValidateRequisitionRequest(new CreatePurchaseRequisitionRequest(
            request.RequestDateUtc,
            request.RequestedByName,
            request.Department,
            request.NeededByUtc,
            request.Purpose,
            request.Notes,
            request.Lines));
        if (validationError is not null) return BadRequest(new { Message = validationError });

        dbContext.RemoveRange(requisition.Lines);

        var replacementLines = request.Lines.Select(line => new PurchaseRequisitionLine(
            Guid.NewGuid(),
            tenantContext.TenantId,
            requisition.Id,
            line.InventoryItemId,
            line.Description,
            line.Quantity,
            line.EstimatedUnitPrice,
            line.Notes)).ToList();

        requisition.ReplaceEditableDetails(
            request.RequestDateUtc,
            request.RequestedByName,
            request.Department,
            request.NeededByUtc,
            request.Purpose,
            request.Notes,
            replacementLines);

        if (requisition.Status == 7) requisition.ResetToDraft();

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Purchase requisition updated successfully.", requisition.Id, requisition.RequisitionNumber, requisition.Status });
    }

    [HttpPost("requisitions/{requisitionId:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementRequisitionSubmit)]
    public async Task<IActionResult> SubmitPurchaseRequisition(
        Guid requisitionId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var requisition = await dbContext.Set<PurchaseRequisition>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == requisitionId, cancellationToken);

        if (requisition is null) return NotFound(new { Message = "Purchase requisition was not found.", RequisitionId = requisitionId });
        if (requisition.Status != 1) return Conflict(new { Message = "Only draft purchase requisitions can be submitted.", requisition.Status });
        if (requisition.Lines.Count == 0) return BadRequest(new { Message = "Purchase requisition must contain at least one line before submission." });

        requisition.MarkSubmitted();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase requisition submitted successfully.", requisition.Id, requisition.RequisitionNumber, requisition.Status });
    }

    [HttpPost("requisitions/{requisitionId:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementRequisitionApprove)]
    public async Task<IActionResult> ApprovePurchaseRequisition(
        Guid requisitionId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var requisition = await dbContext.Set<PurchaseRequisition>()
            .FirstOrDefaultAsync(x => x.Id == requisitionId, cancellationToken);

        if (requisition is null) return NotFound(new { Message = "Purchase requisition was not found.", RequisitionId = requisitionId });
        if (requisition.Status != 2) return Conflict(new { Message = "Only submitted purchase requisitions can be approved.", requisition.Status });

        requisition.MarkApproved();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase requisition approved successfully.", requisition.Id, requisition.RequisitionNumber, requisition.Status });
    }

    [HttpPost("requisitions/{requisitionId:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementRequisitionReject)]
    public async Task<IActionResult> RejectPurchaseRequisition(
        Guid requisitionId,
        [FromBody] RejectProcurementDocumentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { Message = "Reject reason is required." });

        var requisition = await dbContext.Set<PurchaseRequisition>()
            .FirstOrDefaultAsync(x => x.Id == requisitionId, cancellationToken);

        if (requisition is null) return NotFound(new { Message = "Purchase requisition was not found.", RequisitionId = requisitionId });
        if (requisition.Status != 2) return Conflict(new { Message = "Only submitted purchase requisitions can be rejected.", requisition.Status });

        requisition.MarkRejected();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase requisition rejected successfully.", requisition.Id, requisition.RequisitionNumber, requisition.Status, Reason = request.Reason.Trim() });
    }

    [HttpDelete("requisitions/{requisitionId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementRequisitionCreate)]
    public async Task<IActionResult> DeletePurchaseRequisition(
        Guid requisitionId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var requisition = await dbContext.Set<PurchaseRequisition>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == requisitionId, cancellationToken);

        if (requisition is null) return NotFound(new { Message = "Purchase requisition was not found.", RequisitionId = requisitionId });
        if (requisition.Status != 1 && requisition.Status != 7) return Conflict(new { Message = "Only draft or rejected purchase requisitions can be deleted.", requisition.Status });

        dbContext.RemoveRange(requisition.Lines);
        dbContext.Remove(requisition);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase requisition deleted successfully.", requisition.Id, requisition.RequisitionNumber });
    }

    [Authorize(Policy = AuthorizationPolicies.ProcurementView)]
    [HttpGet("purchase-orders")]
    public async Task<IActionResult> GetPurchaseOrders(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<PurchaseOrder>()
            .AsNoTracking()
            .Where(x => x.Status != 7)
            .OrderByDescending(x => x.OrderDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.PurchaseOrderNumber,
                x.PurchaseRequisitionId,
                x.VendorId,
                VendorName = dbContext.Vendors.Where(v => v.Id == x.VendorId).Select(v => v.VendorName).FirstOrDefault(),
                PurchaseRequisitionNumber = dbContext.Set<PurchaseRequisition>().Where(r => r.Id == x.PurchaseRequisitionId).Select(r => r.RequisitionNumber).FirstOrDefault(),
                x.OrderDateUtc,
                x.ExpectedDeliveryUtc,
                x.CurrencyCode,
                x.Status,
                x.Notes,
                x.CreatedOnUtc,
                LineCount = x.Lines.Count,
                TotalAmount = x.Lines.Sum(line => line.Quantity * line.UnitPrice)
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.ProcurementView)]
    [HttpGet("purchase-orders/rejected")]
    public async Task<IActionResult> GetRejectedPurchaseOrders(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<PurchaseOrder>()
            .AsNoTracking()
            .Where(x => x.Status == 7)
            .OrderByDescending(x => x.OrderDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.PurchaseOrderNumber,
                x.PurchaseRequisitionId,
                x.VendorId,
                VendorName = dbContext.Vendors.Where(v => v.Id == x.VendorId).Select(v => v.VendorName).FirstOrDefault(),
                PurchaseRequisitionNumber = dbContext.Set<PurchaseRequisition>().Where(r => r.Id == x.PurchaseRequisitionId).Select(r => r.RequisitionNumber).FirstOrDefault(),
                x.OrderDateUtc,
                x.ExpectedDeliveryUtc,
                x.CurrencyCode,
                x.Status,
                x.Notes,
                x.CreatedOnUtc,
                LineCount = x.Lines.Count,
                TotalAmount = x.Lines.Sum(line => line.Quantity * line.UnitPrice),
                Lines = x.Lines.Select(line => new
                {
                    line.Id,
                    line.PurchaseRequisitionLineId,
                    line.InventoryItemId,
                    line.Description,
                    line.Quantity,
                    line.UnitPrice,
                    line.Notes
                }).ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("purchase-orders/from-requisition/{requisitionId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementPoCreate)]
    public async Task<IActionResult> CreatePurchaseOrderFromApprovedRequisition(
        Guid requisitionId,
        [FromBody] CreatePurchaseOrderFromRequisitionRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        if (request.VendorId == Guid.Empty) return BadRequest(new { Message = "Vendor is required." });
        if (string.IsNullOrWhiteSpace(request.CurrencyCode)) return BadRequest(new { Message = "Currency code is required." });

        var requisition = await dbContext.Set<PurchaseRequisition>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == requisitionId, cancellationToken);

        if (requisition is null) return NotFound(new { Message = "Approved purchase requisition was not found.", RequisitionId = requisitionId });
        if (requisition.Status != 3) return Conflict(new { Message = "Only approved purchase requisitions can be converted to purchase orders.", requisition.Status });
        if (requisition.Lines.Count == 0) return BadRequest(new { Message = "The selected requisition has no lines." });

        var poNumber = await GenerateProcurementNumberAsync(dbContext, "PO-", tenantContext.TenantId, cancellationToken);
        var purchaseOrder = new PurchaseOrder(
            Guid.NewGuid(),
            tenantContext.TenantId,
            poNumber,
            requisition.Id,
            request.VendorId,
            request.OrderDateUtc,
            request.ExpectedDeliveryUtc,
            request.CurrencyCode,
            request.Notes);

        var lines = requisition.Lines.Select(line => new PurchaseOrderLine(
            Guid.NewGuid(),
            tenantContext.TenantId,
            purchaseOrder.Id,
            line.Id,
            line.InventoryItemId,
            line.Description,
            line.Quantity,
            line.EstimatedUnitPrice,
            line.Notes)).ToList();

        purchaseOrder.ReplaceEditableDetails(
            request.VendorId,
            request.OrderDateUtc,
            request.ExpectedDeliveryUtc,
            request.CurrencyCode,
            request.Notes,
            lines);

        dbContext.Add(purchaseOrder);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase order created from requisition successfully.", purchaseOrder.Id, purchaseOrder.PurchaseOrderNumber });
    }

    [HttpPut("purchase-orders/{purchaseOrderId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementPoCreate)]
    public async Task<IActionResult> UpdatePurchaseOrder(
        Guid purchaseOrderId,
        [FromBody] UpdatePurchaseOrderRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == purchaseOrderId, cancellationToken);

        if (purchaseOrder is null) return NotFound(new { Message = "Purchase order was not found.", PurchaseOrderId = purchaseOrderId });
        if (purchaseOrder.Status != 1 && purchaseOrder.Status != 7) return Conflict(new { Message = "Only draft or rejected purchase orders can be edited.", purchaseOrder.Status });

        var validationError = ValidatePurchaseOrderRequest(request);
        if (validationError is not null) return BadRequest(new { Message = validationError });

        dbContext.RemoveRange(purchaseOrder.Lines);

        var replacementLines = request.Lines.Select(line => new PurchaseOrderLine(
            Guid.NewGuid(),
            tenantContext.TenantId,
            purchaseOrder.Id,
            line.PurchaseRequisitionLineId,
            line.InventoryItemId,
            line.Description,
            line.Quantity,
            line.UnitPrice,
            line.Notes)).ToList();

        purchaseOrder.ReplaceEditableDetails(
            request.VendorId,
            request.OrderDateUtc,
            request.ExpectedDeliveryUtc,
            request.CurrencyCode,
            request.Notes,
            replacementLines);

        if (purchaseOrder.Status == 7) purchaseOrder.ResetToDraft();

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Purchase order updated successfully.", purchaseOrder.Id, purchaseOrder.PurchaseOrderNumber, purchaseOrder.Status });
    }

    [HttpPost("purchase-orders/{purchaseOrderId:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementPoCreate)]
    public async Task<IActionResult> SubmitPurchaseOrder(
        Guid purchaseOrderId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == purchaseOrderId, cancellationToken);

        if (purchaseOrder is null) return NotFound(new { Message = "Purchase order was not found.", PurchaseOrderId = purchaseOrderId });
        if (purchaseOrder.Status != 1) return Conflict(new { Message = "Only draft purchase orders can be submitted.", purchaseOrder.Status });
        if (purchaseOrder.Lines.Count == 0) return BadRequest(new { Message = "Purchase order must contain at least one line before submission." });

        purchaseOrder.MarkSubmitted();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase order submitted successfully.", purchaseOrder.Id, purchaseOrder.PurchaseOrderNumber, purchaseOrder.Status });
    }

    [HttpPost("purchase-orders/{purchaseOrderId:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementPoApprove)]
    public async Task<IActionResult> ApprovePurchaseOrder(
        Guid purchaseOrderId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .FirstOrDefaultAsync(x => x.Id == purchaseOrderId, cancellationToken);

        if (purchaseOrder is null) return NotFound(new { Message = "Purchase order was not found.", PurchaseOrderId = purchaseOrderId });
        if (purchaseOrder.Status != 2) return Conflict(new { Message = "Only submitted purchase orders can be approved.", purchaseOrder.Status });

        purchaseOrder.MarkApproved();
        purchaseOrder.MarkIssued();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase order approved and issued successfully.", purchaseOrder.Id, purchaseOrder.PurchaseOrderNumber, purchaseOrder.Status });
    }

    [HttpPost("purchase-orders/{purchaseOrderId:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementPoApprove)]
    public async Task<IActionResult> RejectPurchaseOrder(
        Guid purchaseOrderId,
        [FromBody] RejectProcurementDocumentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { Message = "Reject reason is required." });

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .FirstOrDefaultAsync(x => x.Id == purchaseOrderId, cancellationToken);

        if (purchaseOrder is null) return NotFound(new { Message = "Purchase order was not found.", PurchaseOrderId = purchaseOrderId });
        if (purchaseOrder.Status != 2) return Conflict(new { Message = "Only submitted purchase orders can be rejected.", purchaseOrder.Status });

        purchaseOrder.MarkRejected();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase order rejected successfully.", purchaseOrder.Id, purchaseOrder.PurchaseOrderNumber, purchaseOrder.Status, Reason = request.Reason.Trim() });
    }

    [HttpDelete("purchase-orders/{purchaseOrderId:guid}")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementPoCreate)]
    public async Task<IActionResult> DeletePurchaseOrder(
        Guid purchaseOrderId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == purchaseOrderId, cancellationToken);

        if (purchaseOrder is null) return NotFound(new { Message = "Purchase order was not found.", PurchaseOrderId = purchaseOrderId });
        if (purchaseOrder.Status != 1 && purchaseOrder.Status != 7) return Conflict(new { Message = "Only draft or rejected purchase orders can be deleted.", purchaseOrder.Status });

        dbContext.RemoveRange(purchaseOrder.Lines);
        dbContext.Remove(purchaseOrder);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Purchase order deleted successfully.", purchaseOrder.Id, purchaseOrder.PurchaseOrderNumber });
    }


    [Authorize(Policy = AuthorizationPolicies.ProcurementView)]
    [HttpGet("purchase-order-receipts")]
    public async Task<IActionResult> GetPurchaseOrderReceipts(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<PurchaseOrderReceipt>()
            .AsNoTracking()
            .OrderByDescending(x => x.ReceiptDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.ReceiptNumber,
                x.PurchaseOrderId,
                x.WarehouseId,
                WarehouseName = dbContext.Warehouses.Where(w => w.Id == x.WarehouseId).Select(w => w.WarehouseName).FirstOrDefault(),
                PurchaseOrderNumber = dbContext.Set<PurchaseOrder>().Where(p => p.Id == x.PurchaseOrderId).Select(p => p.PurchaseOrderNumber).FirstOrDefault(),
                x.ReceiptDateUtc,
                x.Status,
                x.Notes,
                x.InventoryTransactionId,
                x.JournalEntryId,
                x.CreatedOnUtc,
                LineCount = x.Lines.Count,
                TotalAmount = x.Lines.Sum(line => line.Quantity * line.UnitCost),
                Lines = x.Lines.Select(line => new
                {
                    line.Id,
                    line.PurchaseOrderLineId,
                    line.InventoryItemId,
                    line.Description,
                    line.Quantity,
                    line.UnitCost,
                    line.ReceiptKind,
                    line.Notes
                }).ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("purchase-order-receipts")]
    [Authorize(Policy = AuthorizationPolicies.ProcurementReceiptCreate)]
    public async Task<IActionResult> CreatePurchaseOrderReceipt(
        [FromBody] CreatePurchaseOrderReceiptRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var validationError = ValidatePurchaseOrderReceiptRequest(request);
        if (validationError is not null) return BadRequest(new { Message = validationError });

        var purchaseOrder = await dbContext.Set<PurchaseOrder>()
            .Include(x => x.Lines)
            .FirstOrDefaultAsync(x => x.Id == request.PurchaseOrderId, cancellationToken);

        if (purchaseOrder is null) return NotFound(new { Message = "Purchase order was not found.", PurchaseOrderId = request.PurchaseOrderId });
        if (purchaseOrder.Status != 3 && purchaseOrder.Status != 4) return Conflict(new { Message = "Only approved or issued purchase orders can be received.", purchaseOrder.Status });

        Warehouse? warehouse = null;
        if (request.WarehouseId.HasValue)
        {
            warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(x => x.Id == request.WarehouseId.Value, cancellationToken);
            if (warehouse is null) return BadRequest(new { Message = "Warehouse was not found.", request.WarehouseId });
            if (!warehouse.IsActive) return BadRequest(new { Message = "Only active warehouses can receive stock items.", warehouse.WarehouseCode });
        }

        var lineIds = request.Lines.Select(x => x.PurchaseOrderLineId).Distinct().ToList();
        var poLineMap = purchaseOrder.Lines.Where(x => lineIds.Contains(x.Id)).ToDictionary(x => x.Id, x => x);

        if (poLineMap.Count != lineIds.Count)
        {
            return BadRequest(new { Message = "One or more receipt lines do not belong to the selected purchase order." });
        }

        var inventoryItemIds = request.Lines
            .Where(x => x.InventoryItemId.HasValue)
            .Select(x => x.InventoryItemId!.Value)
            .Distinct()
            .ToList();

        var inventoryItems = inventoryItemIds.Count == 0
            ? new Dictionary<Guid, InventoryItem>()
            : await dbContext.InventoryItems
                .Where(x => inventoryItemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

        var receiptDateUtc = request.ReceiptDateUtc == default ? DateTime.UtcNow : request.ReceiptDateUtc;

        var postingGuard = await FiscalPeriodPostingGuard.EnsureOpenPeriodAsync(
            dbContext,
            receiptDateUtc,
            "Purchase Order Receipt",
            cancellationToken);

        if (!postingGuard.Allowed)
        {
            return Conflict(postingGuard.ToProblem());
        }

        var postingPeriod = postingGuard.FiscalPeriod!;
        var receiptNumber = await GenerateProcurementNumberAsync(dbContext, "GRN-", tenantContext.TenantId, cancellationToken);

        var receipt = new PurchaseOrderReceipt(
            Guid.NewGuid(),
            tenantContext.TenantId,
            receiptNumber,
            purchaseOrder.Id,
            request.WarehouseId,
            receiptDateUtc,
            request.Notes);

        var stockLines = new List<(PurchaseOrderReceiptLine ReceiptLine, InventoryItem Item)>();
        var serviceLines = new List<PurchaseOrderReceiptLine>();

        foreach (var line in request.Lines)
        {
            var poLine = poLineMap[line.PurchaseOrderLineId];
            var outstandingQty = poLine.Quantity - poLine.ReceivedQuantity;

            if (line.Quantity > outstandingQty)
            {
                return Conflict(new
                {
                    Message = "Receipt quantity cannot exceed outstanding purchase order quantity.",
                    line.PurchaseOrderLineId,
                    OrderedQuantity = poLine.Quantity,
                    ReceivedQuantity = poLine.ReceivedQuantity,
                    OutstandingQuantity = outstandingQty
                });
            }

            var effectiveUnitCost = line.UnitCost > 0m ? line.UnitCost : poLine.UnitPrice;
            var effectiveItemId = line.InventoryItemId ?? poLine.InventoryItemId;

            var receiptKind = 2;
            InventoryItem? stockItem = null;

            if (effectiveItemId.HasValue && inventoryItems.TryGetValue(effectiveItemId.Value, out var item))
            {
                if (!item.IsActive)
                {
                    return BadRequest(new { Message = "Only active inventory items can be received.", item.Id, item.ItemCode });
                }

                if (item.ItemType == InventoryItemType.StockItem)
                {
                    receiptKind = 1;
                    stockItem = item;
                }
            }

            if (receiptKind == 1 && !request.WarehouseId.HasValue)
            {
                return BadRequest(new { Message = "Warehouse is required when receiving stock items." });
            }

            var receiptLine = new PurchaseOrderReceiptLine(
                Guid.NewGuid(),
                tenantContext.TenantId,
                receipt.Id,
                poLine.Id,
                effectiveItemId,
                string.IsNullOrWhiteSpace(line.Description) ? poLine.Description : line.Description.Trim(),
                line.Quantity,
                effectiveUnitCost,
                receiptKind,
                line.Notes);

            receipt.AddLine(receiptLine);
            poLine.RecordReceipt(line.Quantity);

            if (receiptKind == 1 && stockItem is not null)
            {
                stockLines.Add((receiptLine, stockItem));
            }
            else
            {
                serviceLines.Add(receiptLine);
            }
        }

        InventoryTransaction? inventoryTransaction = null;
        JournalEntry? journalEntry = null;
        List<InventoryTransactionLine> inventoryTransactionLines = new();
        List<StockLedgerEntry> stockLedgerEntries = new();
        List<LedgerMovement> ledgerMovements = new();

        if (stockLines.Count > 0)
        {
            if (!request.InventoryLedgerAccountId.HasValue || !request.ReceiptClearingLedgerAccountId.HasValue)
            {
                return BadRequest(new { Message = "Inventory control and receipt clearing ledger accounts are required for stock item receipts." });
            }

            var ledgerValidation = await ValidatePostingLedgerAccountsAsync(
                dbContext,
                new[] { request.InventoryLedgerAccountId.Value, request.ReceiptClearingLedgerAccountId.Value },
                cancellationToken);

            if (ledgerValidation is not null) return ledgerValidation;

            inventoryTransaction = new InventoryTransaction(
                Guid.NewGuid(),
                tenantContext.TenantId,
                receipt.ReceiptNumber,
                InventoryTransactionType.StockIn,
                receiptDateUtc,
                $"Goods receipt from purchase order {purchaseOrder.PurchaseOrderNumber}",
                purchaseOrder.PurchaseOrderNumber,
                request.Notes);

            var journalLines = new List<JournalEntryLine>();

            foreach (var stockLine in stockLines)
            {
                var lineDescription = $"PO receipt - {purchaseOrder.PurchaseOrderNumber} - {stockLine.Item.ItemCode}";
                var txnLine = new InventoryTransactionLine(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    inventoryTransaction.Id,
                    stockLine.Item.Id,
                    warehouse!.Id,
                    stockLine.ReceiptLine.Quantity,
                    stockLine.ReceiptLine.UnitCost,
                    lineDescription);

                inventoryTransactionLines.Add(txnLine);
                stockLedgerEntries.Add(new StockLedgerEntry(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    stockLine.Item.Id,
                    warehouse.Id,
                    inventoryTransaction.Id,
                    txnLine.Id,
                    StockMovementType.StockIn,
                    receiptDateUtc,
                    stockLine.ReceiptLine.Quantity,
                    0m,
                    stockLine.ReceiptLine.UnitCost,
                    inventoryTransaction.TransactionNumber,
                    lineDescription));

                var lineValue = stockLine.ReceiptLine.Quantity * stockLine.ReceiptLine.UnitCost;
                if (lineValue > 0m)
                {
                    journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.InventoryLedgerAccountId!.Value, lineDescription, lineValue, 0m));
                    journalLines.Add(new JournalEntryLine(Guid.NewGuid(), request.ReceiptClearingLedgerAccountId!.Value, $"PO receipt clearing - {purchaseOrder.PurchaseOrderNumber} - {stockLine.Item.ItemCode}", 0m, lineValue));
                }
            }

            journalEntry = new JournalEntry(
                Guid.NewGuid(),
                tenantContext.TenantId,
                receiptDateUtc,
                $"PO-REC-{purchaseOrder.PurchaseOrderNumber}-{receipt.ReceiptNumber}",
                $"Purchase order receipt posting - {purchaseOrder.PurchaseOrderNumber}",
                JournalEntryStatus.Draft,
                JournalEntryType.Normal,
                journalLines,
                postingRequiresApproval: false);

            journalEntry.MarkPosted(DateTime.UtcNow);
            ledgerMovements = journalEntry.Lines
                .Select(line => new LedgerMovement(Guid.NewGuid(), tenantContext.TenantId, journalEntry.Id, line.Id, line.LedgerAccountId, journalEntry.EntryDateUtc, journalEntry.Reference, line.Description, line.DebitAmount, line.CreditAmount))
                .ToList();

            inventoryTransaction.LinkJournal(journalEntry.Id);
            receipt.LinkInventoryTransaction(inventoryTransaction.Id);
            receipt.LinkJournal(journalEntry.Id);
        }

        if (purchaseOrder.Status == 3)
        {
            purchaseOrder.MarkIssued();
        }

        dbContext.Add(receipt);
        if (inventoryTransaction is not null)
        {
            dbContext.InventoryTransactions.Add(inventoryTransaction);
            dbContext.InventoryTransactionLines.AddRange(inventoryTransactionLines);
            dbContext.StockLedgerEntries.AddRange(stockLedgerEntries);
        }
        if (journalEntry is not null)
        {
            dbContext.JournalEntries.Add(journalEntry);
            dbContext.LedgerMovements.AddRange(ledgerMovements);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = stockLines.Count > 0
                ? "Purchase order receipt created and stock received successfully."
                : "Purchase order service receipt created successfully.",
            Receipt = new
            {
                receipt.Id,
                receipt.ReceiptNumber,
                receipt.PurchaseOrderId,
                PurchaseOrderNumber = purchaseOrder.PurchaseOrderNumber,
                receipt.ReceiptDateUtc,
                receipt.Status,
                receipt.InventoryTransactionId,
                receipt.JournalEntryId,
                LineCount = receipt.Lines.Count,
                TotalAmount = receipt.Lines.Sum(x => x.Quantity * x.UnitCost)
            },
            FiscalPeriodId = postingPeriod.Id,
            FiscalPeriodName = postingPeriod.Name
        });
    }

    private static string? ValidateRequisitionRequest(CreatePurchaseRequisitionRequest request)
    {
        if (request.RequestDateUtc == default) return "Request date is required.";
        if (string.IsNullOrWhiteSpace(request.RequestedByName)) return "Requested by is required.";
        if (string.IsNullOrWhiteSpace(request.Purpose)) return "Purpose is required.";
        if (request.Lines is null || request.Lines.Count == 0) return "At least one requisition line is required.";

        foreach (var line in request.Lines)
        {
            if (string.IsNullOrWhiteSpace(line.Description)) return "Line description is required.";
            if (line.Quantity <= 0) return "Line quantity must be greater than zero.";
            if (line.EstimatedUnitPrice < 0) return "Estimated unit price cannot be negative.";
        }

        return null;
    }

    private static string? ValidatePurchaseOrderRequest(UpdatePurchaseOrderRequest request)
    {
        if (request.VendorId == Guid.Empty) return "Vendor is required.";
        if (request.OrderDateUtc == default) return "Order date is required.";
        if (string.IsNullOrWhiteSpace(request.CurrencyCode)) return "Currency code is required.";
        if (request.Lines is null || request.Lines.Count == 0) return "At least one purchase order line is required.";

        foreach (var line in request.Lines)
        {
            if (string.IsNullOrWhiteSpace(line.Description)) return "Line description is required.";
            if (line.Quantity <= 0) return "Line quantity must be greater than zero.";
            if (line.UnitPrice < 0) return "Unit price cannot be negative.";
        }

        return null;
    }

    private static IActionResult TenantRequired()
    {
        return new BadRequestObjectResult(new
        {
            Message = "Tenant context is required.",
            RequiredHeader = "X-Tenant-Key"
        });
    }

    private static async Task<string> GenerateProcurementNumberAsync(
        ApplicationDbContext dbContext,
        string prefix,
        Guid tenantId,
        CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year;
        var sequencePrefix = $"{prefix}{year}-";
        var nextNumber = 1;

        var existingNumbers = await dbContext.Set<PurchaseRequisition>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && x.RequisitionNumber.StartsWith(sequencePrefix))
            .Select(x => x.RequisitionNumber)
            .ToListAsync(cancellationToken);

        if (prefix == "PO-")
        {
            existingNumbers = await dbContext.Set<PurchaseOrder>()
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.PurchaseOrderNumber.StartsWith(sequencePrefix))
                .Select(x => x.PurchaseOrderNumber)
                .ToListAsync(cancellationToken);
        }
        else if (prefix == "GRN-")
        {
            existingNumbers = await dbContext.Set<PurchaseOrderReceipt>()
                .AsNoTracking()
                .Where(x => x.TenantId == tenantId && x.ReceiptNumber.StartsWith(sequencePrefix))
                .Select(x => x.ReceiptNumber)
                .ToListAsync(cancellationToken);
        }

        foreach (var value in existingNumbers)
        {
            var numberPart = value[sequencePrefix.Length..];
            if (int.TryParse(numberPart, out var parsed) && parsed >= nextNumber)
            {
                nextNumber = parsed + 1;
            }
        }

        return $"{sequencePrefix}{nextNumber:0000}";
    }

    public sealed record CreatePurchaseRequisitionRequest(
        DateTime RequestDateUtc,
        string RequestedByName,
        string? Department,
        DateTime? NeededByUtc,
        string Purpose,
        string? Notes,
        List<PurchaseRequisitionLineRequest> Lines);

    public sealed record UpdatePurchaseRequisitionRequest(
        DateTime RequestDateUtc,
        string RequestedByName,
        string? Department,
        DateTime? NeededByUtc,
        string Purpose,
        string? Notes,
        List<PurchaseRequisitionLineRequest> Lines);

    public sealed record PurchaseRequisitionLineRequest(
        Guid? InventoryItemId,
        string Description,
        decimal Quantity,
        decimal EstimatedUnitPrice,
        string? Notes);

    public sealed record CreatePurchaseOrderFromRequisitionRequest(
        Guid VendorId,
        DateTime OrderDateUtc,
        DateTime? ExpectedDeliveryUtc,
        string CurrencyCode,
        string? Notes);

    public sealed record UpdatePurchaseOrderRequest(
        Guid VendorId,
        DateTime OrderDateUtc,
        DateTime? ExpectedDeliveryUtc,
        string CurrencyCode,
        string? Notes,
        List<PurchaseOrderLineRequest> Lines);

    public sealed record PurchaseOrderLineRequest(
        Guid? PurchaseRequisitionLineId,
        Guid? InventoryItemId,
        string Description,
        decimal Quantity,
        decimal UnitPrice,
        string? Notes);


    private static string? ValidatePurchaseOrderReceiptRequest(CreatePurchaseOrderReceiptRequest request)
    {
        if (request.PurchaseOrderId == Guid.Empty) return "Purchase order is required.";
        if (request.ReceiptDateUtc == default) return "Receipt date is required.";
        if (request.Lines is null || request.Lines.Count == 0) return "At least one receipt line is required.";

        foreach (var line in request.Lines)
        {
            if (line.PurchaseOrderLineId == Guid.Empty) return "Each receipt line must reference a purchase order line.";
            if (line.Quantity <= 0m) return "Receipt quantity must be greater than zero.";
            if (line.UnitCost < 0m) return "Receipt unit cost cannot be negative.";
        }

        return null;
    }

    private static async Task<IActionResult?> ValidatePostingLedgerAccountsAsync(
        ApplicationDbContext dbContext,
        IEnumerable<Guid> ledgerAccountIds,
        CancellationToken cancellationToken)
    {
        var requestedIds = ledgerAccountIds.Distinct().ToList();

        var ledgerAccounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (ledgerAccounts.Count != requestedIds.Count)
        {
            return new BadRequestObjectResult(new { Message = "One or more ledger accounts were not found." });
        }

        foreach (var ledgerAccountId in requestedIds)
        {
            var ledgerAccount = ledgerAccounts[ledgerAccountId];

            if (!ledgerAccount.IsActive || ledgerAccount.IsHeader || !ledgerAccount.IsPostingAllowed)
            {
                return new BadRequestObjectResult(new
                {
                    Message = "All posting accounts must be active, non-header, posting-enabled ledger accounts.",
                    ledgerAccount.Id,
                    ledgerAccount.Code
                });
            }
        }

        return null;
    }

    public sealed record CreatePurchaseOrderReceiptRequest(
        Guid PurchaseOrderId,
        Guid? WarehouseId,
        Guid? InventoryLedgerAccountId,
        Guid? ReceiptClearingLedgerAccountId,
        DateTime ReceiptDateUtc,
        string? Notes,
        List<PurchaseOrderReceiptLineRequest> Lines);

    public sealed record PurchaseOrderReceiptLineRequest(
        Guid PurchaseOrderLineId,
        Guid? InventoryItemId,
        string? Description,
        decimal Quantity,
        decimal UnitCost,
        string? Notes);

    public sealed record RejectProcurementDocumentRequest(string Reason);
}

