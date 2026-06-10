using iBalance.Api.Security;
using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.OilAndGas.Domain.Entities;
using iBalance.Modules.OilAndGas.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/oil-gas/stock-operations")]
public sealed class OilGasStockOperationsController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard([FromServices] ApplicationDbContext db, CancellationToken ct)
    {
        var today=DateTime.UtcNow.Date;
        var movements=await db.OilGasStockMovements.AsNoTracking().Where(x=>x.MovementDateUtc.Date==today).ToListAsync(ct);
        return Ok(new {
            CurrentTankBookStock=await db.OilGasTanks.SumAsync(x=>(decimal?)x.CurrentBookStock,ct) ?? 0m,
            TodayReceipts=movements.Where(IsReceipt).Sum(x=>Math.Abs(x.Quantity)),
            TodayDeliveries=movements.Where(IsIssue).Sum(x=>Math.Abs(x.Quantity)),
            PendingMovementCount=await db.OilGasStockMovements.CountAsync(x=>x.Status==OilGasStockMovementStatus.Submitted,ct),
            RejectedMovementCount=await db.OilGasStockMovements.CountAsync(x=>x.Status==OilGasStockMovementStatus.Rejected,ct),
            UnpostedApprovedCount=await db.OilGasStockMovements.CountAsync(x=>x.Status==OilGasStockMovementStatus.Approved,ct),
            CalibrationDueCount=await db.OilGasMeters.CountAsync(x=>x.NextCalibrationDateUtc.HasValue && x.NextCalibrationDateUtc.Value.Date<=today.AddDays(30),ct),
            PermitExpiryCount=await db.OilGasPermits.CountAsync(x=>x.ExpiryDateUtc.Date<=today.AddDays(90) && x.Status==OilGasPermitStatus.Active,ct)
        });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("movements")]
    public async Task<IActionResult> GetMovements([FromQuery] OilGasStockMovementStatus? status,[FromQuery] DateTime? fromUtc,[FromQuery] DateTime? toUtc,[FromServices] ApplicationDbContext db,CancellationToken ct)
    {
        var q=db.OilGasStockMovements.AsNoTracking().Include(x=>x.Asset).Include(x=>x.Location).Include(x=>x.Product).Include(x=>x.SourceTank).Include(x=>x.DestinationTank).AsQueryable();
        if(status.HasValue) q=q.Where(x=>x.Status==status.Value);
        if(fromUtc.HasValue) q=q.Where(x=>x.MovementDateUtc>=fromUtc.Value.Date);
        if(toUtc.HasValue) q=q.Where(x=>x.MovementDateUtc<toUtc.Value.Date.AddDays(1));
        var entities=await q.OrderByDescending(x=>x.MovementDateUtc).ThenByDescending(x=>x.CreatedOnUtc).Take(1000).ToListAsync(ct);
        return Ok(new { Count=entities.Count, Items=entities.Select(MapMovement) });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMovementCreate)]
    [HttpPost("movements")]
    public async Task<IActionResult> CreateMovement([FromBody] SaveMovementRequest request,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct)
    {
        var tenant=tenantAccessor.Current; if(!tenant.IsAvailable) return BadRequest(TenantError());
        var error=await ValidateMovement(request,db,ct); if(error!=null) return BadRequest(new{Message=error});
        var count=await db.OilGasStockMovements.CountAsync(x=>x.MovementDateUtc.Date==request.MovementDateUtc.Date,ct);
        var entity=new OilGasStockMovement{Id=Guid.NewGuid(),TenantId=tenant.TenantId,MovementNumber=$"OGM-{request.MovementDateUtc:yyyyMMdd}-{count+1:0000}",CreatedBy=CurrentUser(),CreatedOnUtc=DateTime.UtcNow};
        ApplyMovement(entity,request); db.OilGasStockMovements.Add(entity); await db.SaveChangesAsync(ct);
        await WriteAudit(audit,tenant.TenantId,entity.Id,"Create",$"Stock movement {entity.MovementNumber} created.",ct);
        return Ok(new{Message="Stock movement created.",Item=MapMovement(entity)});
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMovementUpdate)]
    [HttpPut("movements/{id:guid}")]
    public async Task<IActionResult> UpdateMovement(Guid id,[FromBody] SaveMovementRequest request,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct)
    {
        var tenant=tenantAccessor.Current; if(!tenant.IsAvailable) return BadRequest(TenantError());
        var entity=await db.OilGasStockMovements.SingleOrDefaultAsync(x=>x.Id==id,ct); if(entity==null) return NotFound(new{Message="Stock movement not found."});
        if(entity.Status is not (OilGasStockMovementStatus.Draft or OilGasStockMovementStatus.Rejected)) return Conflict(new{Message="Only draft or rejected movements can be edited."});
        var error=await ValidateMovement(request,db,ct); if(error!=null) return BadRequest(new{Message=error});
        ApplyMovement(entity,request); entity.Status=OilGasStockMovementStatus.Draft; entity.RejectionReason=null; entity.RejectedBy=null; entity.RejectedOnUtc=null;
        await db.SaveChangesAsync(ct); await WriteAudit(audit,tenant.TenantId,entity.Id,"Update",$"Stock movement {entity.MovementNumber} updated.",ct);
        return Ok(new{Message="Stock movement updated.",Item=MapMovement(entity)});
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMovementSubmit)]
    [HttpPost("movements/{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct)
    {
        var tenant=tenantAccessor.Current; if(!tenant.IsAvailable) return BadRequest(TenantError());
        var e=await db.OilGasStockMovements.SingleOrDefaultAsync(x=>x.Id==id,ct); if(e==null) return NotFound(new{Message="Stock movement not found."});
        if(e.Status!=OilGasStockMovementStatus.Draft) return Conflict(new{Message="Only draft movements can be submitted."});
        e.Status=OilGasStockMovementStatus.Submitted;e.SubmittedBy=CurrentUser();e.SubmittedOnUtc=DateTime.UtcNow;await db.SaveChangesAsync(ct);
        await WriteAudit(audit,tenant.TenantId,e.Id,"Submit",$"Stock movement {e.MovementNumber} submitted.",ct);return Ok(new{Message="Stock movement submitted."});
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMovementApprove)]
    [HttpPost("movements/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct)
    {
        var tenant=tenantAccessor.Current; if(!tenant.IsAvailable) return BadRequest(TenantError());
        var e=await db.OilGasStockMovements.SingleOrDefaultAsync(x=>x.Id==id,ct); if(e==null) return NotFound(new{Message="Stock movement not found."});
        if(e.Status!=OilGasStockMovementStatus.Submitted) return Conflict(new{Message="Only submitted movements can be approved."});
        if(string.Equals(e.CreatedBy,CurrentUser(),StringComparison.OrdinalIgnoreCase)) return Conflict(new{Message="Maker cannot approve their own stock movement."});
        e.Status=OilGasStockMovementStatus.Approved;e.ApprovedBy=CurrentUser();e.ApprovedOnUtc=DateTime.UtcNow;await db.SaveChangesAsync(ct);
        await WriteAudit(audit,tenant.TenantId,e.Id,"Approve",$"Stock movement {e.MovementNumber} approved.",ct);return Ok(new{Message="Stock movement approved."});
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMovementReject)]
    [HttpPost("movements/{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id,[FromBody] RejectRequest request,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct)
    {
        var tenant=tenantAccessor.Current; if(!tenant.IsAvailable) return BadRequest(TenantError());
        var reason=request.Reason?.Trim();if(string.IsNullOrWhiteSpace(reason)) return BadRequest(new{Message="Reason for rejection is required."});
        var e=await db.OilGasStockMovements.SingleOrDefaultAsync(x=>x.Id==id,ct); if(e==null) return NotFound(new{Message="Stock movement not found."});
        if(e.Status!=OilGasStockMovementStatus.Submitted) return Conflict(new{Message="Only submitted movements can be rejected."});
        if(string.Equals(e.CreatedBy,CurrentUser(),StringComparison.OrdinalIgnoreCase)) return Conflict(new{Message="Maker cannot reject their own stock movement."});
        e.Status=OilGasStockMovementStatus.Rejected;e.RejectedBy=CurrentUser();e.RejectedOnUtc=DateTime.UtcNow;e.RejectionReason=reason;await db.SaveChangesAsync(ct);
        await WriteAudit(audit,tenant.TenantId,e.Id,"Reject",$"Stock movement {e.MovementNumber} rejected: {reason}",ct);return Ok(new{Message="Stock movement rejected."});
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMovementPost)]
    [HttpPost("movements/{id:guid}/post")]
    public async Task<IActionResult> Post(Guid id,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct)
    {
        var tenant=tenantAccessor.Current; if(!tenant.IsAvailable) return BadRequest(TenantError());
        await using var transaction=await db.Database.BeginTransactionAsync(ct);
        var e=await db.OilGasStockMovements.SingleOrDefaultAsync(x=>x.Id==id,ct);if(e==null) return NotFound(new{Message="Stock movement not found."});
        if(e.Status!=OilGasStockMovementStatus.Approved) return Conflict(new{Message="Only approved movements can be posted."});
        var source=e.SourceTankId.HasValue?await db.OilGasTanks.SingleOrDefaultAsync(x=>x.Id==e.SourceTankId.Value,ct):null;
        var destination=e.DestinationTankId.HasValue?await db.OilGasTanks.SingleOrDefaultAsync(x=>x.Id==e.DestinationTankId.Value,ct):null;
        var qty=Math.Abs(e.Quantity);
        if(e.MovementType==OilGasStockMovementType.MeasurementAdjustment){if(source==null) return BadRequest(new{Message="Measurement adjustment requires a tank."}); var updated=source.CurrentBookStock+e.Quantity;if(updated<0 || updated>source.SafeWorkingCapacity) return Conflict(new{Message="Adjustment would put tank stock outside permitted capacity."});source.CurrentBookStock=updated;}
        else if(e.MovementType==OilGasStockMovementType.TankTransfer){if(source==null||destination==null) return BadRequest(new{Message="Transfer requires source and destination tanks."});if(source.CurrentBookStock<qty) return Conflict(new{Message="Source tank has insufficient book stock."});if(destination.CurrentBookStock+qty>destination.SafeWorkingCapacity) return Conflict(new{Message="Destination tank safe working capacity would be exceeded."});source.CurrentBookStock-=qty;destination.CurrentBookStock+=qty;}
        else if(IsReceipt(e)){if(destination==null) return BadRequest(new{Message="Receipt requires a destination tank."});if(destination.CurrentBookStock+qty>destination.SafeWorkingCapacity) return Conflict(new{Message="Destination tank safe working capacity would be exceeded."});destination.CurrentBookStock+=qty;}
        else {if(source==null) return BadRequest(new{Message="Issue or delivery requires a source tank."});if(source.CurrentBookStock<qty) return Conflict(new{Message="Source tank has insufficient book stock."});source.CurrentBookStock-=qty;}
        e.Status=OilGasStockMovementStatus.Posted;e.PostedBy=CurrentUser();e.PostedOnUtc=DateTime.UtcNow;await db.SaveChangesAsync(ct);await transaction.CommitAsync(ct);
        await WriteAudit(audit,tenant.TenantId,e.Id,"Post",$"Stock movement {e.MovementNumber} posted to tank book stock. No duplicate GL journal was created.",ct);return Ok(new{Message="Stock movement posted and tank book stock updated."});
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMeterManage)]
    [HttpGet("meter-readings")]
    public async Task<IActionResult> Readings([FromQuery] Guid? meterId,[FromServices] ApplicationDbContext db,CancellationToken ct){var q=db.OilGasMeterReadings.AsNoTracking().Include(x=>x.Meter).AsQueryable();if(meterId.HasValue)q=q.Where(x=>x.MeterId==meterId);var items=await q.OrderByDescending(x=>x.ReadingDateUtc).Take(500).Select(x=>new{x.Id,x.MeterId,MeterCode=x.Meter!.MeterCode,x.ReadingDateUtc,x.PreviousReading,x.CurrentReading,x.MeasuredQuantity,x.Reference,x.Notes}).ToListAsync(ct);return Ok(new{Count=items.Count,Items=items});}

    [Authorize(Policy = AuthorizationPolicies.OilGasMeterManage)]
    [HttpPost("meter-readings")]
    public async Task<IActionResult> AddReading([FromBody] SaveReadingRequest request,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct){var tenant=tenantAccessor.Current;if(!tenant.IsAvailable)return BadRequest(TenantError());var meter=await db.OilGasMeters.SingleOrDefaultAsync(x=>x.Id==request.MeterId,ct);if(meter==null)return BadRequest(new{Message="Select a valid meter."});if(request.CurrentReading<request.PreviousReading)return BadRequest(new{Message="Current reading cannot be less than previous reading."});var e=new OilGasMeterReading{Id=Guid.NewGuid(),TenantId=tenant.TenantId,MeterId=request.MeterId,ReadingDateUtc=request.ReadingDateUtc.Date,PreviousReading=request.PreviousReading,CurrentReading=request.CurrentReading,MeasuredQuantity=request.CurrentReading-request.PreviousReading,Reference=Clean(request.Reference),Notes=Clean(request.Notes),CreatedBy=CurrentUser(),CreatedOnUtc=DateTime.UtcNow};db.OilGasMeterReadings.Add(e);await db.SaveChangesAsync(ct);await WriteAudit(audit,tenant.TenantId,e.Id,"CreateMeterReading",$"Meter reading recorded for {meter.MeterCode}.",ct);return Ok(new{Message="Meter reading recorded."});}

    [Authorize(Policy = AuthorizationPolicies.OilGasMeterManage)]
    [HttpPost("meter-calibrations")]
    public async Task<IActionResult> AddCalibration([FromBody] SaveCalibrationRequest request,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct){var tenant=tenantAccessor.Current;if(!tenant.IsAvailable)return BadRequest(TenantError());var meter=await db.OilGasMeters.SingleOrDefaultAsync(x=>x.Id==request.MeterId,ct);if(meter==null)return BadRequest(new{Message="Select a valid meter."});if(request.NextCalibrationDateUtc<=request.CalibrationDateUtc)return BadRequest(new{Message="Next calibration date must be later than calibration date."});if(string.IsNullOrWhiteSpace(request.CertificateReference)||string.IsNullOrWhiteSpace(request.CalibratedBy))return BadRequest(new{Message="Certificate reference and calibrated by are required."});var e=new OilGasMeterCalibration{Id=Guid.NewGuid(),TenantId=tenant.TenantId,MeterId=request.MeterId,CalibrationDateUtc=request.CalibrationDateUtc.Date,NextCalibrationDateUtc=request.NextCalibrationDateUtc.Date,CertificateReference=request.CertificateReference.Trim(),CalibratedBy=request.CalibratedBy.Trim(),Result=Clean(request.Result),Notes=Clean(request.Notes),CreatedBy=CurrentUser(),CreatedOnUtc=DateTime.UtcNow};db.OilGasMeterCalibrations.Add(e);meter.LastCalibrationDateUtc=e.CalibrationDateUtc;meter.NextCalibrationDateUtc=e.NextCalibrationDateUtc;meter.Status=OilGasMeterStatus.Active;await db.SaveChangesAsync(ct);await WriteAudit(audit,tenant.TenantId,e.Id,"CalibrateMeter",$"Meter {meter.MeterCode} calibrated.",ct);return Ok(new{Message="Meter calibration recorded."});}

    [Authorize(Policy = AuthorizationPolicies.OilGasPermitManage)]
    [HttpPost("permits/{id:guid}/renew")]
    public async Task<IActionResult> RenewPermit(Guid id,[FromBody] RenewPermitRequest request,[FromServices] ApplicationDbContext db,[FromServices] ITenantContextAccessor tenantAccessor,[FromServices] IAuditTrailWriter audit,CancellationToken ct){var tenant=tenantAccessor.Current;if(!tenant.IsAvailable)return BadRequest(TenantError());var e=await db.OilGasPermits.SingleOrDefaultAsync(x=>x.Id==id,ct);if(e==null)return NotFound(new{Message="Permit not found."});if(request.NewExpiryDateUtc<=request.RenewalDateUtc)return BadRequest(new{Message="New expiry date must be later than renewal date."});e.PreviousPermitNumber=e.PermitNumber;e.PermitNumber=string.IsNullOrWhiteSpace(request.NewPermitNumber)?e.PermitNumber:request.NewPermitNumber.Trim();e.RenewalSubmittedOnUtc=request.RenewalSubmittedOnUtc?.Date;e.RenewalApprovedOnUtc=request.RenewalApprovedOnUtc?.Date;e.RenewalDateUtc=request.RenewalDateUtc.Date;e.RenewalCost=request.RenewalCost;e.RenewalReference=Clean(request.RenewalReference);e.EffectiveDateUtc=request.RenewalDateUtc.Date;e.ExpiryDateUtc=request.NewExpiryDateUtc.Date;e.Status=OilGasPermitStatus.Renewed;await db.SaveChangesAsync(ct);await WriteAudit(audit,tenant.TenantId,e.Id,"RenewPermit",$"Permit {e.PermitNumber} renewed.",ct);return Ok(new{Message="Permit renewed."});}

    [Authorize(Policy = AuthorizationPolicies.OilGasReconciliationManage)]
    [HttpGet("reconciliation")]
    public async Task<IActionResult> Reconciliation([FromQuery] DateTime fromUtc,[FromQuery] DateTime toUtc,[FromServices] ApplicationDbContext db,CancellationToken ct)
    {
        if(toUtc.Date<fromUtc.Date)return BadRequest(new{Message="To date cannot be earlier than from date."});var end=toUtc.Date.AddDays(1);
        var tanks=await db.OilGasTanks.AsNoTracking().Include(x=>x.Product).Include(x=>x.Location).OrderBy(x=>x.TankCode).ToListAsync(ct);
        var moves=await db.OilGasStockMovements.AsNoTracking().Where(x=>x.Status==OilGasStockMovementStatus.Posted&&x.MovementDateUtc>=fromUtc.Date&&x.MovementDateUtc<end).ToListAsync(ct);
        var rows=tanks.Select(t=>{var ins=moves.Where(x=>x.DestinationTankId==t.Id&&x.MovementType!=OilGasStockMovementType.MeasurementAdjustment).Sum(x=>Math.Abs(x.Quantity));var outs=moves.Where(x=>x.SourceTankId==t.Id&&x.MovementType!=OilGasStockMovementType.MeasurementAdjustment).Sum(x=>Math.Abs(x.Quantity));var adjustments=moves.Where(x=>x.SourceTankId==t.Id&&x.MovementType==OilGasStockMovementType.MeasurementAdjustment).Sum(x=>x.Quantity);return new{t.Id,t.TankCode,t.TankName,LocationName=t.Location?.Name,ProductName=t.Product?.Name,Receipts=ins,Issues=outs,Adjustments=adjustments,CurrentBookStock=t.CurrentBookStock,MovementCount=moves.Count(x=>x.SourceTankId==t.Id||x.DestinationTankId==t.Id)};}).ToList();
        var unposted=await db.OilGasStockMovements.CountAsync(x=>x.MovementDateUtc>=fromUtc.Date&&x.MovementDateUtc<end&&x.Status!=OilGasStockMovementStatus.Posted&&x.Status!=OilGasStockMovementStatus.Cancelled,ct);
        return Ok(new{FromUtc=fromUtc.Date,ToUtc=toUtc.Date,UnpostedMovementCount=unposted,Rows=rows});
    }

    private async Task<string?> ValidateMovement(SaveMovementRequest r,ApplicationDbContext db,CancellationToken ct){if(r.MovementDateUtc==default)return "Movement date is required.";if(r.MovementDateUtc.Date>DateTime.UtcNow.Date)return "Movement date cannot be in the future.";if(r.Quantity==0)return "Quantity must not be zero.";if(r.MovementType!=OilGasStockMovementType.MeasurementAdjustment&&r.Quantity<0)return "Quantity must be positive except for measurement adjustments.";if(!await db.OilGasAssets.AnyAsync(x=>x.Id==r.AssetId&&x.IsActive,ct))return "Select an active asset.";if(!await db.OilGasLocations.AnyAsync(x=>x.Id==r.LocationId&&x.AssetId==r.AssetId&&x.IsActive,ct))return "Select an active location for the asset.";if(!await db.OilGasProducts.AnyAsync(x=>x.Id==r.ProductId&&x.IsActive,ct))return "Select an active product.";if(r.SourceTankId.HasValue&&!await db.OilGasTanks.AnyAsync(x=>x.Id==r.SourceTankId&&x.ProductId==r.ProductId,ct))return "Source tank must hold the selected product.";if(r.DestinationTankId.HasValue&&!await db.OilGasTanks.AnyAsync(x=>x.Id==r.DestinationTankId&&x.ProductId==r.ProductId,ct))return "Destination tank must hold the selected product.";if(r.SourceTankId.HasValue&&r.SourceTankId==r.DestinationTankId)return "Source and destination tanks must differ.";if(r.MovementType==OilGasStockMovementType.TankTransfer&&(!r.SourceTankId.HasValue||!r.DestinationTankId.HasValue))return "Tank transfer requires source and destination tanks.";if(IsReceipt(r.MovementType)&&!r.DestinationTankId.HasValue)return "Receipt requires a destination tank.";if(IsIssue(r.MovementType)&&!r.SourceTankId.HasValue)return "Delivery, consumption or loss requires a source tank.";if(r.MovementType==OilGasStockMovementType.ProductionReceipt&&!r.ProductionEntryId.HasValue)return "Production receipt must reference an approved production entry.";if(r.ProductionEntryId.HasValue&&!await db.OilGasProductionEntries.AnyAsync(x=>x.Id==r.ProductionEntryId&&x.Status==OilGasProductionStatus.Approved,ct))return "Referenced production entry must be approved.";if(r.CustomerId.HasValue&&!await db.Customers.AnyAsync(x=>x.Id==r.CustomerId,ct))return "Referenced customer was not found.";if(r.SalesInvoiceId.HasValue&&!await db.SalesInvoices.AnyAsync(x=>x.Id==r.SalesInvoiceId,ct))return "Referenced sales invoice was not found.";if(r.BillingInvoiceId.HasValue&&!await db.BillingInvoices.AnyAsync(x=>x.Id==r.BillingInvoiceId,ct))return "Referenced billing invoice was not found.";if(r.InventoryTransactionId.HasValue&&!await db.InventoryTransactions.AnyAsync(x=>x.Id==r.InventoryTransactionId,ct))return "Referenced inventory transaction was not found.";return null;}
    private static void ApplyMovement(OilGasStockMovement e,SaveMovementRequest r){e.MovementDateUtc=r.MovementDateUtc.Date;e.MovementType=r.MovementType;e.AssetId=r.AssetId;e.LocationId=r.LocationId;e.ProductId=r.ProductId;e.SourceTankId=r.SourceTankId;e.DestinationTankId=r.DestinationTankId;e.Quantity=r.Quantity;e.UnitOfMeasure=r.UnitOfMeasure.Trim();e.Reference=r.Reference.Trim();e.ProductionEntryId=r.ProductionEntryId;e.CustomerId=r.CustomerId;e.SalesInvoiceId=r.SalesInvoiceId;e.BillingInvoiceId=r.BillingInvoiceId;e.InventoryTransactionId=r.InventoryTransactionId;e.TransportType=r.TransportType;e.TransportReference=Clean(r.TransportReference);e.DestinationDescription=Clean(r.DestinationDescription);e.Notes=Clean(r.Notes);}
    private static object MapMovement(OilGasStockMovement x)=>new{x.Id,x.MovementNumber,x.MovementDateUtc,MovementType=x.MovementType.ToString(),x.AssetId,AssetName=x.Asset?.Name,x.LocationId,LocationName=x.Location?.Name,x.ProductId,ProductName=x.Product?.Name,x.SourceTankId,SourceTankName=x.SourceTank?.TankName,x.DestinationTankId,DestinationTankName=x.DestinationTank?.TankName,x.Quantity,x.UnitOfMeasure,x.Reference,x.ProductionEntryId,x.CustomerId,x.SalesInvoiceId,x.BillingInvoiceId,x.InventoryTransactionId,TransportType=x.TransportType.ToString(),x.TransportReference,x.DestinationDescription,x.Notes,Status=x.Status.ToString(),x.CreatedBy,x.CreatedOnUtc,x.SubmittedBy,x.SubmittedOnUtc,x.ApprovedBy,x.ApprovedOnUtc,x.RejectedBy,x.RejectedOnUtc,x.RejectionReason,x.PostedBy,x.PostedOnUtc};
    private static bool IsReceipt(OilGasStockMovement x)=>IsReceipt(x.MovementType);private static bool IsReceipt(OilGasStockMovementType x)=>x is OilGasStockMovementType.ProductionReceipt or OilGasStockMovementType.ExternalReceipt or OilGasStockMovementType.Return;private static bool IsIssue(OilGasStockMovement x)=>IsIssue(x.MovementType);private static bool IsIssue(OilGasStockMovementType x)=>x is OilGasStockMovementType.LiftingDelivery or OilGasStockMovementType.OperationalConsumption or OilGasStockMovementType.ApprovedLoss;
    private string CurrentUser()=>User.Identity?.Name??"system";private static string? Clean(string? x)=>string.IsNullOrWhiteSpace(x)?null:x.Trim();private static object TenantError()=>new{Message="Tenant context is required.",RequiredHeader="X-Tenant-Key"};
    private async Task WriteAudit(IAuditTrailWriter writer,Guid tenantId,Guid id,string action,string description,CancellationToken ct)=>await writer.WriteAsync("oilgas","OilGasStockMovement",action,id,id.ToString(),description,User.Identity?.Name,tenantId,null,ct);
    public sealed record SaveMovementRequest(DateTime MovementDateUtc,OilGasStockMovementType MovementType,Guid AssetId,Guid LocationId,Guid ProductId,Guid? SourceTankId,Guid? DestinationTankId,decimal Quantity,string UnitOfMeasure,string Reference,Guid? ProductionEntryId,Guid? CustomerId,Guid? SalesInvoiceId,Guid? BillingInvoiceId,Guid? InventoryTransactionId,OilGasTransportType TransportType,string? TransportReference,string? DestinationDescription,string? Notes);
    public sealed record RejectRequest(string Reason);public sealed record SaveReadingRequest(Guid MeterId,DateTime ReadingDateUtc,decimal PreviousReading,decimal CurrentReading,string? Reference,string? Notes);public sealed record SaveCalibrationRequest(Guid MeterId,DateTime CalibrationDateUtc,DateTime NextCalibrationDateUtc,string CertificateReference,string CalibratedBy,string? Result,string? Notes);public sealed record RenewPermitRequest(string? NewPermitNumber,DateTime? RenewalSubmittedOnUtc,DateTime? RenewalApprovedOnUtc,DateTime RenewalDateUtc,DateTime NewExpiryDateUtc,decimal? RenewalCost,string? RenewalReference);
}
