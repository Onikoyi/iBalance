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
[Route("api/oil-gas/upstream")]
public sealed class OilGasUpstreamCompletionController : ControllerBase
{
    [HttpGet("dashboard")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetDashboard(
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var today = DateTime.UtcNow.Date;
        var inNinetyDays = today.AddDays(90);

        return Ok(new
        {
            OpenLiftings = await db.OilGasLiftings.CountAsync(
                x => x.Status != OilGasLiftingStatus.Completed &&
                     x.Status != OilGasLiftingStatus.Cancelled,
                cancellationToken),
            PendingAfeApprovals = await db.OilGasAfes.CountAsync(
                x => x.Status == OilGasAfeStatus.Submitted,
                cancellationToken),
            OpenProductionPeriods = await db.OilGasProductionPeriods.CountAsync(
                x => x.Status != OilGasProductionPeriodStatus.Closed,
                cancellationToken),
            OpenHseIncidents = await db.OilGasHseIncidents.CountAsync(
                x => x.Status != OilGasHseStatus.Closed,
                cancellationToken),
            OverdueCorrectiveActions = await db.OilGasCorrectiveActions.CountAsync(
                x => !x.IsCompleted && x.TargetDateUtc < today,
                cancellationToken),
            MaintenanceDue = await db.OilGasEquipment.CountAsync(
                x => x.NextMaintenanceDateUtc.HasValue &&
                     x.NextMaintenanceDateUtc.Value <= inNinetyDays,
                cancellationToken),
            PermitExpiryAlerts = await db.OilGasPermits.CountAsync(
                x => x.ExpiryDateUtc <= inNinetyDays &&
                     x.Status == OilGasPermitStatus.Active,
                cancellationToken),
            UnbilledCompletedLiftings = await db.OilGasLiftings.CountAsync(
                x => x.Status == OilGasLiftingStatus.Completed &&
                     !x.BillingInvoiceId.HasValue &&
                     !x.SalesInvoiceId.HasValue,
                cancellationToken),
            ActivePartners = await db.OilGasPartners.CountAsync(
                x => x.IsActive,
                cancellationToken),
            OpenAfeValue = await db.OilGasAfes
                .Where(x => x.Status != OilGasAfeStatus.Closed &&
                            x.Status != OilGasAfeStatus.Cancelled)
                .SumAsync(
                    x => (decimal?)(x.RevisedAmount > 0
                        ? x.RevisedAmount
                        : x.ApprovedAmount),
                    cancellationToken) ?? 0m
        });
    }

    [HttpGet("liftings")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetLiftings(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var items = await db.OilGasLiftings
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Location)
            .Include(x => x.Product)
            .Include(x => x.SourceTank)
            .OrderByDescending(x => x.PlannedLoadingDateUtc)
            .Take(500)
            .Select(x => new
            {
                x.Id,
                x.LiftingNumber,
                x.NominationReference,
                x.AssetId,
                AssetName = x.Asset!.Name,
                x.LocationId,
                LocationName = x.Location!.Name,
                x.ProductId,
                ProductName = x.Product!.Name,
                x.SourceTankId,
                SourceTankName = x.SourceTank!.TankName,
                x.CustomerId,
                x.OfftakerName,
                x.PlannedQuantity,
                x.ActualLoadedQuantity,
                x.DeliveredQuantity,
                x.UnitOfMeasure,
                x.PlannedLoadingDateUtc,
                x.LoadingCompletedOnUtc,
                TransportType = x.TransportType.ToString(),
                x.VesselOrTruckReference,
                x.BillOfLadingNumber,
                x.UnitPrice,
                x.CurrencyCode,
                x.BillingInvoiceId,
                x.SalesInvoiceId,
                x.StockMovementId,
                x.Destination,
                x.QualityCertificateReference,
                x.Notes,
                Status = x.Status.ToString(),
                x.CreatedBy,
                x.CreatedOnUtc,
                x.SubmittedBy,
                x.SubmittedOnUtc,
                x.ApprovedBy,
                x.ApprovedOnUtc,
                x.RejectedBy,
                x.RejectedOnUtc,
                x.RejectionReason,
                x.CompletedBy,
                x.CompletedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new { Count = items.Count, Items = items });
    }

    [HttpPost("liftings")]
    [Authorize(Policy = AuthorizationPolicies.OilGasLiftingManage)]
    public async Task<IActionResult> CreateLifting(
        [FromBody] SaveLiftingRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var validationError = await ValidateLiftingAsync(
            request,
            db,
            cancellationToken);

        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        var entity = new OilGasLifting
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            LiftingNumber = await NextNumberAsync(
                db.OilGasLiftings.Select(x => x.LiftingNumber),
                "LFT",
                cancellationToken),
            CreatedBy = CurrentUser()
        };

        ApplyLifting(entity, request);
        db.OilGasLiftings.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasLifting",
            "Created",
            entity.Id,
            entity.LiftingNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "Lifting created successfully.",
            entity.Id,
            entity.LiftingNumber,
            Status = entity.Status.ToString()
        });
    }

    [HttpPut("liftings/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.OilGasLiftingManage)]
    public async Task<IActionResult> UpdateLifting(
        Guid id,
        [FromBody] SaveLiftingRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasLiftings
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { Message = "Lifting was not found." });
        }

        if (entity.Status is not (
            OilGasLiftingStatus.Draft or
            OilGasLiftingStatus.Rejected))
        {
            return Conflict(new
            {
                Message = "Only draft or rejected liftings can be edited."
            });
        }

        var validationError = await ValidateLiftingAsync(
            request,
            db,
            cancellationToken);

        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        ApplyLifting(entity, request);
        entity.Status = OilGasLiftingStatus.Draft;
        entity.RejectionReason = null;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasLifting",
            "Updated",
            entity.Id,
            entity.LiftingNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "Lifting updated successfully.",
            entity.Id,
            entity.LiftingNumber,
            Status = entity.Status.ToString()
        });
    }

    [HttpPost("liftings/{id:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.OilGasLiftingManage)]
    public Task<IActionResult> SubmitLifting(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangeLiftingStatus(
            id,
            db,
            tenant,
            audit,
            OilGasLiftingStatus.Draft,
            OilGasLiftingStatus.Submitted,
            "Submitted",
            null,
            cancellationToken);

    [HttpPost("liftings/{id:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.OilGasLiftingApprove)]
    public Task<IActionResult> ApproveLifting(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangeLiftingStatus(
            id,
            db,
            tenant,
            audit,
            OilGasLiftingStatus.Submitted,
            OilGasLiftingStatus.Approved,
            "Approved",
            null,
            cancellationToken);

    [HttpPost("liftings/{id:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.OilGasLiftingApprove)]
    public Task<IActionResult> RejectLifting(
        Guid id,
        [FromBody] RejectRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangeLiftingStatus(
            id,
            db,
            tenant,
            audit,
            OilGasLiftingStatus.Submitted,
            OilGasLiftingStatus.Rejected,
            "Rejected",
            request.Reason,
            cancellationToken);

    [HttpPost("liftings/{id:guid}/complete")]
    [Authorize(Policy = AuthorizationPolicies.OilGasLiftingComplete)]
    public async Task<IActionResult> CompleteLifting(
        Guid id,
        [FromBody] CompleteLiftingRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasLiftings
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { Message = "Lifting was not found." });
        }

        if (entity.Status != OilGasLiftingStatus.Approved)
        {
            return Conflict(new
            {
                Message = "Only approved liftings can be completed."
            });
        }

        if (request.ActualLoadedQuantity <= 0)
        {
            return BadRequest(new
            {
                Message = "Actual loaded quantity must be greater than zero."
            });
        }

        if (request.BillingInvoiceId.HasValue &&
            !await db.BillingInvoices.AnyAsync(
                x => x.Id == request.BillingInvoiceId.Value,
                cancellationToken))
        {
            return BadRequest(new
            {
                Message = "Selected billing invoice was not found."
            });
        }

        if (request.SalesInvoiceId.HasValue &&
            !await db.SalesInvoices.AnyAsync(
                x => x.Id == request.SalesInvoiceId.Value,
                cancellationToken))
        {
            return BadRequest(new
            {
                Message = "Selected sales invoice was not found."
            });
        }

        entity.ActualLoadedQuantity = request.ActualLoadedQuantity;
        entity.DeliveredQuantity = request.DeliveredQuantity;
        entity.BillOfLadingNumber = Clean(request.BillOfLadingNumber);
        entity.BillingInvoiceId = request.BillingInvoiceId;
        entity.SalesInvoiceId = request.SalesInvoiceId;
        entity.LoadingCompletedOnUtc =
            request.LoadingCompletedOnUtc ?? DateTime.UtcNow;
        entity.CompletedBy = CurrentUser();
        entity.CompletedOnUtc = DateTime.UtcNow;
        entity.Status = OilGasLiftingStatus.Completed;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasLifting",
            "Completed",
            entity.Id,
            entity.LiftingNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "Lifting completed successfully.",
            entity.Id,
            entity.LiftingNumber,
            Status = entity.Status.ToString()
        });
    }

    [HttpGet("afes")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetAfes(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var items = await db.OilGasAfes
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Location)
            .OrderByDescending(x => x.RequestDateUtc)
            .Take(500)
            .Select(x => new
            {
                x.Id,
                x.AfeNumber,
                x.AssetId,
                AssetName = x.Asset!.Name,
                x.LocationId,
                LocationName = x.Location != null
                    ? x.Location.Name
                    : null,
                x.Title,
                x.Description,
                x.CostCategory,
                x.BudgetId,
                x.PurchaseRequisitionId,
                x.PurchaseOrderId,
                x.PurchaseInvoiceId,
                x.FixedAssetId,
                x.OrganizationCostCenterId,
                x.OriginalEstimate,
                x.ApprovedAmount,
                x.RevisedAmount,
                x.CommittedAmount,
                x.ActualExpenditure,
                x.ForecastAtCompletion,
                AvailableBalance =
                    (x.RevisedAmount > 0
                        ? x.RevisedAmount
                        : x.ApprovedAmount)
                    - x.ActualExpenditure
                    - x.CommittedAmount,
                x.RequestDateUtc,
                x.ExpectedCompletionDateUtc,
                x.Justification,
                x.Notes,
                Status = x.Status.ToString(),
                x.CreatedBy,
                x.CreatedOnUtc,
                x.SubmittedBy,
                x.SubmittedOnUtc,
                x.ApprovedBy,
                x.ApprovedOnUtc,
                x.RejectedBy,
                x.RejectedOnUtc,
                x.RejectionReason,
                x.ClosedBy,
                x.ClosedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new { Count = items.Count, Items = items });
    }

    [HttpPost("afes")]
    [Authorize(Policy = AuthorizationPolicies.OilGasAfeManage)]
    public async Task<IActionResult> CreateAfe(
        [FromBody] SaveAfeRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var validationError = await ValidateAfeAsync(
            request,
            db,
            cancellationToken);

        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        var entity = new OilGasAfe
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            AfeNumber = await NextNumberAsync(
                db.OilGasAfes.Select(x => x.AfeNumber),
                "AFE",
                cancellationToken),
            CreatedBy = CurrentUser()
        };

        ApplyAfe(entity, request);
        db.OilGasAfes.Add(entity);

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasAfe",
            "Created",
            entity.Id,
            entity.AfeNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "AFE created successfully.",
            entity.Id,
            entity.AfeNumber,
            Status = entity.Status.ToString()
        });
    }

    [HttpPut("afes/{id:guid}")]
    [Authorize(Policy = AuthorizationPolicies.OilGasAfeManage)]
    public async Task<IActionResult> UpdateAfe(
        Guid id,
        [FromBody] SaveAfeRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasAfes
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { Message = "AFE was not found." });
        }

        if (entity.Status is not (
            OilGasAfeStatus.Draft or
            OilGasAfeStatus.Rejected))
        {
            return Conflict(new
            {
                Message = "Only draft or rejected AFEs can be edited."
            });
        }

        var validationError = await ValidateAfeAsync(
            request,
            db,
            cancellationToken);

        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        ApplyAfe(entity, request);
        entity.Status = OilGasAfeStatus.Draft;
        entity.RejectionReason = null;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasAfe",
            "Updated",
            entity.Id,
            entity.AfeNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "AFE updated successfully.",
            entity.Id,
            entity.AfeNumber,
            Status = entity.Status.ToString()
        });
    }

    [HttpPost("afes/{id:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.OilGasAfeManage)]
    public Task<IActionResult> SubmitAfe(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangeAfeStatus(
            id,
            db,
            tenant,
            audit,
            OilGasAfeStatus.Draft,
            OilGasAfeStatus.Submitted,
            "Submitted",
            null,
            cancellationToken);

    [HttpPost("afes/{id:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.OilGasAfeApprove)]
    public Task<IActionResult> ApproveAfe(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangeAfeStatus(
            id,
            db,
            tenant,
            audit,
            OilGasAfeStatus.Submitted,
            OilGasAfeStatus.Approved,
            "Approved",
            null,
            cancellationToken);

    [HttpPost("afes/{id:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.OilGasAfeApprove)]
    public Task<IActionResult> RejectAfe(
        Guid id,
        [FromBody] RejectRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangeAfeStatus(
            id,
            db,
            tenant,
            audit,
            OilGasAfeStatus.Submitted,
            OilGasAfeStatus.Rejected,
            "Rejected",
            request.Reason,
            cancellationToken);

    [HttpPost("afes/{id:guid}/close")]
    [Authorize(Policy = AuthorizationPolicies.OilGasAfeApprove)]
    public async Task<IActionResult> CloseAfe(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasAfes
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { Message = "AFE was not found." });
        }

        if (entity.Status != OilGasAfeStatus.Approved)
        {
            return Conflict(new
            {
                Message = "Only approved AFEs can be closed."
            });
        }

        entity.Status = OilGasAfeStatus.Closed;
        entity.ClosedBy = CurrentUser();
        entity.ClosedOnUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasAfe",
            "Closed",
            entity.Id,
            entity.AfeNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "AFE closed successfully.",
            entity.Id,
            Status = entity.Status.ToString()
        });
    }

    [HttpGet("partners")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetPartners(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var partners = await db.OilGasPartners
            .AsNoTracking()
            .OrderBy(x => x.PartnerName)
            .ToListAsync(cancellationToken);

        var interests = await db.OilGasPartnerInterests
            .AsNoTracking()
            .Include(x => x.Asset)
            .ToListAsync(cancellationToken);

        var funding = await db.OilGasPartnerFundings
            .AsNoTracking()
            .Include(x => x.Partner)
            .Include(x => x.Asset)
            .OrderByDescending(x => x.TransactionDateUtc)
            .Take(500)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = partners.Count,
            Items = partners,
            Interests = interests.Select(x => new
            {
                x.Id,
                x.PartnerId,
                x.AssetId,
                AssetName = x.Asset?.Name,
                x.IsOperator,
                x.WorkingInterestPercentage,
                x.CostSharePercentage,
                x.EffectiveFromUtc,
                x.EffectiveToUtc,
                x.Notes
            }),
            Funding = funding.Select(x => new
            {
                x.Id,
                x.PartnerId,
                PartnerName = x.Partner?.PartnerName,
                x.AssetId,
                AssetName = x.Asset?.Name,
                x.AfeId,
                FundingType = x.FundingType.ToString(),
                x.Reference,
                x.TransactionDateUtc,
                x.Amount,
                x.CurrencyCode,
                x.Notes,
                x.CreatedBy,
                x.CreatedOnUtc
            })
        });
    }

    [HttpPost("partners")]
    [Authorize(Policy = AuthorizationPolicies.OilGasPartnerManage)]
    public async Task<IActionResult> CreatePartner(
        [FromBody] CreatePartnerRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (string.IsNullOrWhiteSpace(request.PartnerCode) ||
            string.IsNullOrWhiteSpace(request.PartnerName))
        {
            return BadRequest(new
            {
                Message = "Partner code and name are required."
            });
        }

        var normalizedCode = request.PartnerCode.Trim();

        if (await db.OilGasPartners.AnyAsync(
            x => x.PartnerCode == normalizedCode,
            cancellationToken))
        {
            return Conflict(new
            {
                Message = "Partner code already exists."
            });
        }

        var entity = new OilGasPartner
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            PartnerCode = normalizedCode,
            PartnerName = request.PartnerName.Trim(),
            RegistrationNumber = Clean(request.RegistrationNumber),
            ContactEmail = Clean(request.ContactEmail),
            ContactPhone = Clean(request.ContactPhone),
            IsActive = true,
            Notes = Clean(request.Notes)
        };

        db.OilGasPartners.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasPartner",
            "Created",
            entity.Id,
            entity.PartnerCode,
            cancellationToken);

        return Ok(new
        {
            Message = "Partner created successfully.",
            entity.Id
        });
    }

    [HttpPost("partners/{partnerId:guid}/interests")]
    [Authorize(Policy = AuthorizationPolicies.OilGasPartnerManage)]
    public async Task<IActionResult> CreatePartnerInterest(
        Guid partnerId,
        [FromBody] CreatePartnerInterestRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (!await db.OilGasPartners.AnyAsync(
            x => x.Id == partnerId,
            cancellationToken))
        {
            return NotFound(new { Message = "Partner was not found." });
        }

        if (!await db.OilGasAssets.AnyAsync(
            x => x.Id == request.AssetId,
            cancellationToken))
        {
            return BadRequest(new { Message = "Asset was not found." });
        }

        if (request.WorkingInterestPercentage is < 0 or > 100 ||
            request.CostSharePercentage is < 0 or > 100)
        {
            return BadRequest(new
            {
                Message = "Interest percentages must be between 0 and 100."
            });
        }

        var entity = new OilGasPartnerInterest
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            PartnerId = partnerId,
            AssetId = request.AssetId,
            IsOperator = request.IsOperator,
            WorkingInterestPercentage =
                request.WorkingInterestPercentage,
            CostSharePercentage = request.CostSharePercentage,
            EffectiveFromUtc = request.EffectiveFromUtc.Date,
            EffectiveToUtc = request.EffectiveToUtc?.Date,
            Notes = Clean(request.Notes)
        };

        db.OilGasPartnerInterests.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasPartnerInterest",
            "Created",
            entity.Id,
            partnerId.ToString(),
            cancellationToken);

        return Ok(new
        {
            Message = "Partner interest created successfully.",
            entity.Id
        });
    }

    [HttpPost("partners/{partnerId:guid}/funding")]
    [Authorize(Policy = AuthorizationPolicies.OilGasPartnerManage)]
    public async Task<IActionResult> CreatePartnerFunding(
        Guid partnerId,
        [FromBody] CreatePartnerFundingRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (!await db.OilGasPartners.AnyAsync(
            x => x.Id == partnerId,
            cancellationToken))
        {
            return NotFound(new { Message = "Partner was not found." });
        }

        if (!await db.OilGasAssets.AnyAsync(
            x => x.Id == request.AssetId,
            cancellationToken))
        {
            return BadRequest(new { Message = "Asset was not found." });
        }

        if (request.AfeId.HasValue &&
            !await db.OilGasAfes.AnyAsync(
                x => x.Id == request.AfeId.Value,
                cancellationToken))
        {
            return BadRequest(new { Message = "AFE was not found." });
        }

        if (request.Amount <= 0 ||
            string.IsNullOrWhiteSpace(request.Reference))
        {
            return BadRequest(new
            {
                Message = "Reference and amount greater than zero are required."
            });
        }

        var entity = new OilGasPartnerFunding
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            PartnerId = partnerId,
            AssetId = request.AssetId,
            AfeId = request.AfeId,
            FundingType = request.FundingType,
            Reference = request.Reference.Trim(),
            TransactionDateUtc = request.TransactionDateUtc.Date,
            Amount = request.Amount,
            CurrencyCode = NormalizeCurrency(request.CurrencyCode),
            Notes = Clean(request.Notes),
            CreatedBy = CurrentUser()
        };

        db.OilGasPartnerFundings.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasPartnerFunding",
            "Created",
            entity.Id,
            entity.Reference,
            cancellationToken);

        return Ok(new
        {
            Message = "Partner funding record created successfully.",
            entity.Id
        });
    }

    [HttpGet("production-periods")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetProductionPeriods(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var items = await db.OilGasProductionPeriods
            .AsNoTracking()
            .OrderByDescending(x => x.StartDateUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = items.Count,
            Items = items.Select(x => new
            {
                x.Id,
                x.PeriodCode,
                x.StartDateUtc,
                x.EndDateUtc,
                Status = x.Status.ToString(),
                x.GrossOilVolume,
                x.NetOilVolume,
                x.GasProducedVolume,
                x.GasFlaredVolume,
                x.WaterProducedVolume,
                x.LiftingVolume,
                x.ClosingStockVolume,
                x.ReconciliationVariance,
                x.Notes,
                x.CreatedBy,
                x.CreatedOnUtc,
                x.SubmittedBy,
                x.SubmittedOnUtc,
                x.ApprovedBy,
                x.ApprovedOnUtc,
                x.RejectedBy,
                x.RejectedOnUtc,
                x.RejectionReason,
                x.ClosedBy,
                x.ClosedOnUtc
            })
        });
    }

    [HttpPost("production-periods")]
    [Authorize(Policy = AuthorizationPolicies.OilGasProductionClose)]
    public async Task<IActionResult> CreateProductionPeriod(
        [FromBody] CreateProductionPeriodRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (request.EndDateUtc.Date < request.StartDateUtc.Date)
        {
            return BadRequest(new
            {
                Message = "Period end date cannot precede start date."
            });
        }

        if (string.IsNullOrWhiteSpace(request.PeriodCode))
        {
            return BadRequest(new
            {
                Message = "Period code is required."
            });
        }

        if (await db.OilGasProductionPeriods.AnyAsync(
            x => x.StartDateUtc <= request.EndDateUtc.Date &&
                 x.EndDateUtc >= request.StartDateUtc.Date,
            cancellationToken))
        {
            return Conflict(new
            {
                Message = "The production period overlaps an existing period."
            });
        }

        var start = request.StartDateUtc.Date;
        var endExclusive = request.EndDateUtc.Date.AddDays(1);

        var production = await db.OilGasProductionEntries
            .Where(x =>
                x.Status == OilGasProductionStatus.Approved &&
                x.ProductionDateUtc >= start &&
                x.ProductionDateUtc < endExclusive)
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Gross = group.Sum(x => x.GrossOilVolume),
                Net = group.Sum(x => x.NetOilVolume),
                Gas = group.Sum(x => x.GasProducedVolume),
                Flare = group.Sum(x => x.GasFlaredVolume),
                Water = group.Sum(x => x.WaterProducedVolume),
                Closing = group.Sum(x => x.ClosingStockVolume)
            })
            .FirstOrDefaultAsync(cancellationToken);

        var liftingVolume = await db.OilGasLiftings
            .Where(x =>
                x.Status == OilGasLiftingStatus.Completed &&
                x.LoadingCompletedOnUtc >= start &&
                x.LoadingCompletedOnUtc < endExclusive)
            .SumAsync(
                x => (decimal?)x.ActualLoadedQuantity,
                cancellationToken) ?? 0m;

        var entity = new OilGasProductionPeriod
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            PeriodCode = request.PeriodCode.Trim(),
            StartDateUtc = start,
            EndDateUtc = request.EndDateUtc.Date,
            GrossOilVolume = production?.Gross ?? 0m,
            NetOilVolume = production?.Net ?? 0m,
            GasProducedVolume = production?.Gas ?? 0m,
            GasFlaredVolume = production?.Flare ?? 0m,
            WaterProducedVolume = production?.Water ?? 0m,
            ClosingStockVolume = production?.Closing ?? 0m,
            LiftingVolume = liftingVolume,
            ReconciliationVariance =
                (production?.Net ?? 0m)
                - liftingVolume
                - (production?.Closing ?? 0m),
            Notes = Clean(request.Notes),
            CreatedBy = CurrentUser()
        };

        db.OilGasProductionPeriods.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasProductionPeriod",
            "Created",
            entity.Id,
            entity.PeriodCode,
            cancellationToken);

        return Ok(new
        {
            Message = "Production period created and calculated successfully.",
            entity.Id
        });
    }

    [HttpPost("production-periods/{id:guid}/submit")]
    [Authorize(Policy = AuthorizationPolicies.OilGasProductionClose)]
    public Task<IActionResult> SubmitProductionPeriod(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangePeriodStatus(
            id,
            db,
            tenant,
            audit,
            OilGasProductionPeriodStatus.Open,
            OilGasProductionPeriodStatus.Submitted,
            "Submitted",
            null,
            cancellationToken);

    [HttpPost("production-periods/{id:guid}/approve")]
    [Authorize(Policy = AuthorizationPolicies.OilGasProductionCloseApprove)]
    public Task<IActionResult> ApproveProductionPeriod(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangePeriodStatus(
            id,
            db,
            tenant,
            audit,
            OilGasProductionPeriodStatus.Submitted,
            OilGasProductionPeriodStatus.Approved,
            "Approved",
            null,
            cancellationToken);

    [HttpPost("production-periods/{id:guid}/reject")]
    [Authorize(Policy = AuthorizationPolicies.OilGasProductionCloseApprove)]
    public Task<IActionResult> RejectProductionPeriod(
        Guid id,
        [FromBody] RejectRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken) =>
        ChangePeriodStatus(
            id,
            db,
            tenant,
            audit,
            OilGasProductionPeriodStatus.Submitted,
            OilGasProductionPeriodStatus.Rejected,
            "Rejected",
            request.Reason,
            cancellationToken);

    [HttpPost("production-periods/{id:guid}/close")]
    [Authorize(Policy = AuthorizationPolicies.OilGasProductionCloseApprove)]
    public async Task<IActionResult> CloseProductionPeriod(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasProductionPeriods
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new
            {
                Message = "Production period was not found."
            });
        }

        if (entity.Status != OilGasProductionPeriodStatus.Approved)
        {
            return Conflict(new
            {
                Message = "Only approved production periods can be closed."
            });
        }

        entity.Status = OilGasProductionPeriodStatus.Closed;
        entity.ClosedBy = CurrentUser();
        entity.ClosedOnUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasProductionPeriod",
            "Closed",
            entity.Id,
            entity.PeriodCode,
            cancellationToken);

        return Ok(new
        {
            Message = "Production period closed successfully.",
            entity.Id
        });
    }

    [HttpGet("hse-incidents")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetHseIncidents(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var incidents = await db.OilGasHseIncidents
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Location)
            .OrderByDescending(x => x.IncidentDateUtc)
            .ToListAsync(cancellationToken);

        var actions = await db.OilGasCorrectiveActions
            .AsNoTracking()
            .OrderBy(x => x.TargetDateUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = incidents.Count,
            Items = incidents.Select(x => new
            {
                x.Id,
                x.IncidentNumber,
                x.IncidentDateUtc,
                x.AssetId,
                AssetName = x.Asset?.Name,
                x.LocationId,
                LocationName = x.Location?.Name,
                x.IncidentCategory,
                Severity = x.Severity.ToString(),
                x.Description,
                x.ImmediateAction,
                x.RootCause,
                x.ResponsibleOfficer,
                x.TargetClosureDateUtc,
                x.ClosedOnUtc,
                Status = x.Status.ToString(),
                x.EvidenceReference,
                x.Notes,
                x.CreatedBy,
                x.CreatedOnUtc
            }),
            CorrectiveActions = actions
        });
    }

    [HttpPost("hse-incidents")]
    [Authorize(Policy = AuthorizationPolicies.OilGasHseManage)]
    public async Task<IActionResult> CreateHseIncident(
        [FromBody] CreateHseIncidentRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (!await db.OilGasAssets.AnyAsync(
            x => x.Id == request.AssetId,
            cancellationToken))
        {
            return BadRequest(new { Message = "Asset was not found." });
        }

        if (string.IsNullOrWhiteSpace(request.Description) ||
            string.IsNullOrWhiteSpace(request.ImmediateAction) ||
            string.IsNullOrWhiteSpace(request.ResponsibleOfficer))
        {
            return BadRequest(new
            {
                Message = "Description, immediate action and responsible officer are required."
            });
        }

        var entity = new OilGasHseIncident
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            IncidentNumber = await NextNumberAsync(
                db.OilGasHseIncidents.Select(x => x.IncidentNumber),
                "HSE",
                cancellationToken),
            IncidentDateUtc = request.IncidentDateUtc,
            AssetId = request.AssetId,
            LocationId = request.LocationId,
            IncidentCategory = request.IncidentCategory.Trim(),
            Severity = request.Severity,
            Description = request.Description.Trim(),
            ImmediateAction = request.ImmediateAction.Trim(),
            RootCause = Clean(request.RootCause),
            ResponsibleOfficer = request.ResponsibleOfficer.Trim(),
            TargetClosureDateUtc = request.TargetClosureDateUtc,
            EvidenceReference = Clean(request.EvidenceReference),
            Notes = Clean(request.Notes),
            CreatedBy = CurrentUser()
        };

        db.OilGasHseIncidents.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasHseIncident",
            "Created",
            entity.Id,
            entity.IncidentNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "HSE incident recorded successfully.",
            entity.Id,
            entity.IncidentNumber
        });
    }

    [HttpPost("hse-incidents/{incidentId:guid}/actions")]
    [Authorize(Policy = AuthorizationPolicies.OilGasHseManage)]
    public async Task<IActionResult> CreateCorrectiveAction(
        Guid incidentId,
        [FromBody] CreateCorrectiveActionRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var incident = await db.OilGasHseIncidents
            .FirstOrDefaultAsync(
                x => x.Id == incidentId,
                cancellationToken);

        if (incident is null)
        {
            return NotFound(new
            {
                Message = "HSE incident was not found."
            });
        }

        if (string.IsNullOrWhiteSpace(request.ActionDescription) ||
            string.IsNullOrWhiteSpace(request.ResponsibleOfficer))
        {
            return BadRequest(new
            {
                Message = "Corrective action and responsible officer are required."
            });
        }

        var entity = new OilGasCorrectiveAction
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            IncidentId = incidentId,
            ActionDescription = request.ActionDescription.Trim(),
            ResponsibleOfficer = request.ResponsibleOfficer.Trim(),
            TargetDateUtc = request.TargetDateUtc,
            CompletionEvidenceReference =
                Clean(request.CompletionEvidenceReference),
            Notes = Clean(request.Notes)
        };

        db.OilGasCorrectiveActions.Add(entity);
        incident.Status = OilGasHseStatus.CorrectiveAction;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasCorrectiveAction",
            "Created",
            entity.Id,
            incident.IncidentNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "Corrective action created successfully.",
            entity.Id
        });
    }

    [HttpPost("corrective-actions/{id:guid}/complete")]
    [Authorize(Policy = AuthorizationPolicies.OilGasHseManage)]
    public async Task<IActionResult> CompleteCorrectiveAction(
        Guid id,
        [FromBody] CompleteCorrectiveActionRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasCorrectiveActions
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new
            {
                Message = "Corrective action was not found."
            });
        }

        entity.IsCompleted = true;
        entity.CompletedOnUtc =
            request.CompletedOnUtc ?? DateTime.UtcNow;
        entity.CompletionEvidenceReference =
            Clean(request.CompletionEvidenceReference)
            ?? entity.CompletionEvidenceReference;
        entity.Notes = Clean(request.Notes) ?? entity.Notes;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasCorrectiveAction",
            "Completed",
            entity.Id,
            entity.IncidentId.ToString(),
            cancellationToken);

        return Ok(new
        {
            Message = "Corrective action completed successfully.",
            entity.Id
        });
    }

    [HttpPost("hse-incidents/{id:guid}/close")]
    [Authorize(Policy = AuthorizationPolicies.OilGasHseManage)]
    public async Task<IActionResult> CloseHseIncident(
        Guid id,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasHseIncidents
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new
            {
                Message = "HSE incident was not found."
            });
        }

        if (await db.OilGasCorrectiveActions.AnyAsync(
            x => x.IncidentId == id && !x.IsCompleted,
            cancellationToken))
        {
            return Conflict(new
            {
                Message = "All corrective actions must be completed before closing the incident."
            });
        }

        entity.Status = OilGasHseStatus.Closed;
        entity.ClosedOnUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasHseIncident",
            "Closed",
            entity.Id,
            entity.IncidentNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "HSE incident closed successfully.",
            entity.Id
        });
    }

    [HttpGet("equipment")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetEquipment(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var items = await db.OilGasEquipment
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Location)
            .OrderBy(x => x.EquipmentNumber)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = items.Count,
            Items = items.Select(x => new
            {
                x.Id,
                x.EquipmentNumber,
                x.EquipmentName,
                x.AssetId,
                AssetName = x.Asset?.Name,
                x.LocationId,
                LocationName = x.Location?.Name,
                x.FixedAssetId,
                x.EquipmentCategory,
                x.Manufacturer,
                x.Model,
                x.SerialNumber,
                x.CriticalityLevel,
                x.CommissioningDateUtc,
                x.LastMaintenanceDateUtc,
                x.NextMaintenanceDateUtc,
                x.NextInspectionDateUtc,
                Status = x.Status.ToString(),
                x.Notes,
                x.CreatedOnUtc
            })
        });
    }

    [HttpPost("equipment")]
    [Authorize(Policy = AuthorizationPolicies.OilGasEquipmentManage)]
    public async Task<IActionResult> CreateEquipment(
        [FromBody] CreateEquipmentRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (string.IsNullOrWhiteSpace(request.EquipmentNumber) ||
            string.IsNullOrWhiteSpace(request.EquipmentName))
        {
            return BadRequest(new
            {
                Message = "Equipment number and name are required."
            });
        }

        if (!await db.OilGasAssets.AnyAsync(
            x => x.Id == request.AssetId,
            cancellationToken))
        {
            return BadRequest(new { Message = "Asset was not found." });
        }

        if (request.FixedAssetId.HasValue &&
            !await db.FixedAssets.AnyAsync(
                x => x.Id == request.FixedAssetId.Value,
                cancellationToken))
        {
            return BadRequest(new
            {
                Message = "Fixed asset was not found."
            });
        }

        var normalizedNumber = request.EquipmentNumber.Trim();

        if (await db.OilGasEquipment.AnyAsync(
            x => x.EquipmentNumber == normalizedNumber,
            cancellationToken))
        {
            return Conflict(new
            {
                Message = "Equipment number already exists."
            });
        }

        var entity = new OilGasEquipment
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            EquipmentNumber = normalizedNumber,
            EquipmentName = request.EquipmentName.Trim(),
            AssetId = request.AssetId,
            LocationId = request.LocationId,
            FixedAssetId = request.FixedAssetId,
            EquipmentCategory = request.EquipmentCategory.Trim(),
            Manufacturer = Clean(request.Manufacturer),
            Model = Clean(request.Model),
            SerialNumber = Clean(request.SerialNumber),
            CriticalityLevel =
                Math.Clamp(request.CriticalityLevel, 1, 5),
            CommissioningDateUtc = request.CommissioningDateUtc,
            LastMaintenanceDateUtc = request.LastMaintenanceDateUtc,
            NextMaintenanceDateUtc = request.NextMaintenanceDateUtc,
            NextInspectionDateUtc = request.NextInspectionDateUtc,
            Status = request.Status,
            Notes = Clean(request.Notes)
        };

        db.OilGasEquipment.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasEquipment",
            "Created",
            entity.Id,
            entity.EquipmentNumber,
            cancellationToken);

        return Ok(new
        {
            Message = "Equipment created successfully.",
            entity.Id
        });
    }

    [HttpGet("documents")]
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    public async Task<IActionResult> GetDocuments(
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var items = await db.OilGasDocumentReferences
            .AsNoTracking()
            .OrderByDescending(x => x.RecordedOnUtc)
            .Take(1000)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = items.Count,
            Items = items.Select(x => new
            {
                x.Id,
                DocumentType = x.DocumentType.ToString(),
                x.RelatedEntityType,
                x.RelatedEntityId,
                x.DocumentReference,
                x.FileName,
                x.IssueDateUtc,
                x.ExpiryDateUtc,
                x.Description,
                x.RecordedBy,
                x.RecordedOnUtc
            })
        });
    }

    [HttpPost("documents")]
    [Authorize(Policy = AuthorizationPolicies.OilGasDocumentManage)]
    public async Task<IActionResult> CreateDocument(
        [FromBody] CreateDocumentRequest request,
        [FromServices] ApplicationDbContext db,
        [FromServices] ITenantContextAccessor tenant,
        [FromServices] IAuditTrailWriter audit,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        if (request.RelatedEntityId == Guid.Empty ||
            string.IsNullOrWhiteSpace(request.RelatedEntityType) ||
            string.IsNullOrWhiteSpace(request.DocumentReference))
        {
            return BadRequest(new
            {
                Message = "Related entity, entity type and document reference are required."
            });
        }

        var entity = new OilGasDocumentReference
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Current.TenantId,
            DocumentType = request.DocumentType,
            RelatedEntityType = request.RelatedEntityType.Trim(),
            RelatedEntityId = request.RelatedEntityId,
            DocumentReference = request.DocumentReference.Trim(),
            FileName = Clean(request.FileName),
            IssueDateUtc = request.IssueDateUtc,
            ExpiryDateUtc = request.ExpiryDateUtc,
            Description = Clean(request.Description),
            RecordedBy = CurrentUser()
        };

        db.OilGasDocumentReferences.Add(entity);
        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasDocumentReference",
            "Created",
            entity.Id,
            entity.DocumentReference,
            cancellationToken);

        return Ok(new
        {
            Message = "Document reference recorded successfully.",
            entity.Id
        });
    }

    [HttpGet("reports/management")]
    [Authorize(Policy = AuthorizationPolicies.OilGasReportsView)]
    public async Task<IActionResult> GetManagementReport(
        DateTime fromUtc,
        DateTime toUtc,
        [FromServices] ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        var from = fromUtc.Date;
        var toExclusive = toUtc.Date.AddDays(1);

        if (toExclusive <= from)
        {
            return BadRequest(new
            {
                Message = "Report end date must be after start date."
            });
        }

        var liftingSummary = await db.OilGasLiftings
            .Where(x =>
                x.PlannedLoadingDateUtc >= from &&
                x.PlannedLoadingDateUtc < toExclusive)
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Count = group.Count(),
                Planned = group.Sum(x => x.PlannedQuantity),
                Actual = group.Sum(x => x.ActualLoadedQuantity),
                Value = group.Sum(
                    x => (x.UnitPrice ?? 0m) *
                         x.ActualLoadedQuantity)
            })
            .FirstOrDefaultAsync(cancellationToken);

        var afeSummary = await db.OilGasAfes
            .Where(x =>
                x.RequestDateUtc >= from &&
                x.RequestDateUtc < toExclusive)
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Count = group.Count(),
                Approved = group.Sum(x => x.ApprovedAmount),
                Revised = group.Sum(x => x.RevisedAmount),
                Committed = group.Sum(x => x.CommittedAmount),
                Actual = group.Sum(x => x.ActualExpenditure),
                Forecast = group.Sum(x => x.ForecastAtCompletion)
            })
            .FirstOrDefaultAsync(cancellationToken);

        var hse = await db.OilGasHseIncidents
            .Where(x =>
                x.IncidentDateUtc >= from &&
                x.IncidentDateUtc < toExclusive)
            .GroupBy(x => x.Severity)
            .Select(group => new
            {
                Severity = group.Key.ToString(),
                Count = group.Count()
            })
            .ToListAsync(cancellationToken);

        var funding = await db.OilGasPartnerFundings
            .Where(x =>
                x.TransactionDateUtc >= from &&
                x.TransactionDateUtc < toExclusive)
            .GroupBy(x => x.FundingType)
            .Select(group => new
            {
                FundingType = group.Key.ToString(),
                Amount = group.Sum(x => x.Amount),
                Count = group.Count()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            FromUtc = from,
            ToUtc = toExclusive.AddDays(-1),
            Liftings = liftingSummary ?? new
            {
                Count = 0,
                Planned = 0m,
                Actual = 0m,
                Value = 0m
            },
            Afes = afeSummary ?? new
            {
                Count = 0,
                Approved = 0m,
                Revised = 0m,
                Committed = 0m,
                Actual = 0m,
                Forecast = 0m
            },
            Hse = hse,
            PartnerFunding = funding,
            MaintenanceDue = await db.OilGasEquipment.CountAsync(
                x => x.NextMaintenanceDateUtc >= from &&
                     x.NextMaintenanceDateUtc < toExclusive,
                cancellationToken),
            ExpiringDocuments =
                await db.OilGasDocumentReferences.CountAsync(
                    x => x.ExpiryDateUtc >= from &&
                         x.ExpiryDateUtc < toExclusive,
                    cancellationToken)
        });
    }

    private async Task<IActionResult> ChangeLiftingStatus(
        Guid id,
        ApplicationDbContext db,
        ITenantContextAccessor tenant,
        IAuditTrailWriter audit,
        OilGasLiftingStatus expected,
        OilGasLiftingStatus next,
        string action,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasLiftings
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { Message = "Lifting was not found." });
        }

        var canResubmit =
            expected == OilGasLiftingStatus.Draft &&
            entity.Status == OilGasLiftingStatus.Rejected;

        if (entity.Status != expected && !canResubmit)
        {
            return Conflict(new
            {
                Message = $"Only {expected} liftings can be {action.ToLowerInvariant()}."
            });
        }

        if (next == OilGasLiftingStatus.Rejected &&
            string.IsNullOrWhiteSpace(reason))
        {
            return BadRequest(new
            {
                Message = "Rejection reason is required."
            });
        }

        if ((next == OilGasLiftingStatus.Approved ||
             next == OilGasLiftingStatus.Rejected) &&
            SameUser(entity.CreatedBy, CurrentUser()))
        {
            return Conflict(new
            {
                Message = "Maker cannot approve or reject their own lifting."
            });
        }

        entity.Status = next;

        if (next == OilGasLiftingStatus.Submitted)
        {
            entity.SubmittedBy = CurrentUser();
            entity.SubmittedOnUtc = DateTime.UtcNow;
            entity.RejectionReason = null;
        }

        if (next == OilGasLiftingStatus.Approved)
        {
            entity.ApprovedBy = CurrentUser();
            entity.ApprovedOnUtc = DateTime.UtcNow;
        }

        if (next == OilGasLiftingStatus.Rejected)
        {
            entity.RejectedBy = CurrentUser();
            entity.RejectedOnUtc = DateTime.UtcNow;
            entity.RejectionReason = reason!.Trim();
        }

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasLifting",
            action,
            entity.Id,
            entity.LiftingNumber,
            cancellationToken);

        return Ok(new
        {
            Message = $"Lifting {action.ToLowerInvariant()} successfully.",
            entity.Id,
            Status = entity.Status.ToString()
        });
    }

    private async Task<IActionResult> ChangeAfeStatus(
        Guid id,
        ApplicationDbContext db,
        ITenantContextAccessor tenant,
        IAuditTrailWriter audit,
        OilGasAfeStatus expected,
        OilGasAfeStatus next,
        string action,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasAfes
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { Message = "AFE was not found." });
        }

        var canResubmit =
            expected == OilGasAfeStatus.Draft &&
            entity.Status == OilGasAfeStatus.Rejected;

        if (entity.Status != expected && !canResubmit)
        {
            return Conflict(new
            {
                Message = $"Only {expected} AFEs can be {action.ToLowerInvariant()}."
            });
        }

        if (next == OilGasAfeStatus.Rejected &&
            string.IsNullOrWhiteSpace(reason))
        {
            return BadRequest(new
            {
                Message = "Rejection reason is required."
            });
        }

        if ((next == OilGasAfeStatus.Approved ||
             next == OilGasAfeStatus.Rejected) &&
            SameUser(entity.CreatedBy, CurrentUser()))
        {
            return Conflict(new
            {
                Message = "Maker cannot approve or reject their own AFE."
            });
        }

        entity.Status = next;

        if (next == OilGasAfeStatus.Submitted)
        {
            entity.SubmittedBy = CurrentUser();
            entity.SubmittedOnUtc = DateTime.UtcNow;
            entity.RejectionReason = null;
        }

        if (next == OilGasAfeStatus.Approved)
        {
            entity.ApprovedBy = CurrentUser();
            entity.ApprovedOnUtc = DateTime.UtcNow;
            entity.ApprovedAmount =
                entity.RevisedAmount > 0
                    ? entity.RevisedAmount
                    : entity.OriginalEstimate;
        }

        if (next == OilGasAfeStatus.Rejected)
        {
            entity.RejectedBy = CurrentUser();
            entity.RejectedOnUtc = DateTime.UtcNow;
            entity.RejectionReason = reason!.Trim();
        }

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasAfe",
            action,
            entity.Id,
            entity.AfeNumber,
            cancellationToken);

        return Ok(new
        {
            Message = $"AFE {action.ToLowerInvariant()} successfully.",
            entity.Id,
            Status = entity.Status.ToString()
        });
    }

    private async Task<IActionResult> ChangePeriodStatus(
        Guid id,
        ApplicationDbContext db,
        ITenantContextAccessor tenant,
        IAuditTrailWriter audit,
        OilGasProductionPeriodStatus expected,
        OilGasProductionPeriodStatus next,
        string action,
        string? reason,
        CancellationToken cancellationToken)
    {
        if (!tenant.Current.IsAvailable) return TenantRequired();

        var entity = await db.OilGasProductionPeriods
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new
            {
                Message = "Production period was not found."
            });
        }

        var canResubmit =
            expected == OilGasProductionPeriodStatus.Open &&
            entity.Status == OilGasProductionPeriodStatus.Rejected;

        if (entity.Status != expected && !canResubmit)
        {
            return Conflict(new
            {
                Message = $"Only {expected} periods can be {action.ToLowerInvariant()}."
            });
        }

        if (next == OilGasProductionPeriodStatus.Rejected &&
            string.IsNullOrWhiteSpace(reason))
        {
            return BadRequest(new
            {
                Message = "Rejection reason is required."
            });
        }

        if ((next == OilGasProductionPeriodStatus.Approved ||
             next == OilGasProductionPeriodStatus.Rejected) &&
            SameUser(entity.CreatedBy, CurrentUser()))
        {
            return Conflict(new
            {
                Message = "Maker cannot approve or reject their own production period."
            });
        }

        entity.Status = next;

        if (next == OilGasProductionPeriodStatus.Submitted)
        {
            entity.SubmittedBy = CurrentUser();
            entity.SubmittedOnUtc = DateTime.UtcNow;
            entity.RejectionReason = null;
        }

        if (next == OilGasProductionPeriodStatus.Approved)
        {
            entity.ApprovedBy = CurrentUser();
            entity.ApprovedOnUtc = DateTime.UtcNow;
        }

        if (next == OilGasProductionPeriodStatus.Rejected)
        {
            entity.RejectedBy = CurrentUser();
            entity.RejectedOnUtc = DateTime.UtcNow;
            entity.RejectionReason = reason!.Trim();
        }

        await db.SaveChangesAsync(cancellationToken);

        await WriteAudit(
            audit,
            tenant.Current.TenantId,
            "OilGasProductionPeriod",
            action,
            entity.Id,
            entity.PeriodCode,
            cancellationToken);

        return Ok(new
        {
            Message = $"Production period {action.ToLowerInvariant()} successfully.",
            entity.Id,
            Status = entity.Status.ToString()
        });
    }

    private static void ApplyLifting(
        OilGasLifting entity,
        SaveLiftingRequest request)
    {
        entity.NominationReference = Clean(request.NominationReference);
        entity.AssetId = request.AssetId;
        entity.LocationId = request.LocationId;
        entity.ProductId = request.ProductId;
        entity.SourceTankId = request.SourceTankId;
        entity.CustomerId = request.CustomerId;
        entity.OfftakerName = request.OfftakerName.Trim();
        entity.PlannedQuantity = request.PlannedQuantity;
        entity.ActualLoadedQuantity = request.ActualLoadedQuantity;
        entity.DeliveredQuantity = request.DeliveredQuantity;
        entity.UnitOfMeasure = request.UnitOfMeasure.Trim();
        entity.PlannedLoadingDateUtc = request.PlannedLoadingDateUtc;
        entity.TransportType = request.TransportType;
        entity.VesselOrTruckReference =
            Clean(request.VesselOrTruckReference);
        entity.BillOfLadingNumber =
            Clean(request.BillOfLadingNumber);
        entity.UnitPrice = request.UnitPrice;
        entity.CurrencyCode =
            NormalizeCurrency(request.CurrencyCode);
        entity.BillingInvoiceId = request.BillingInvoiceId;
        entity.SalesInvoiceId = request.SalesInvoiceId;
        entity.StockMovementId = request.StockMovementId;
        entity.Destination = Clean(request.Destination);
        entity.QualityCertificateReference =
            Clean(request.QualityCertificateReference);
        entity.Notes = Clean(request.Notes);
    }

    private static void ApplyAfe(
        OilGasAfe entity,
        SaveAfeRequest request)
    {
        entity.AssetId = request.AssetId;
        entity.LocationId = request.LocationId;
        entity.Title = request.Title.Trim();
        entity.Description = request.Description.Trim();
        entity.CostCategory = request.CostCategory.Trim();
        entity.BudgetId = request.BudgetId;
        entity.PurchaseRequisitionId = request.PurchaseRequisitionId;
        entity.PurchaseOrderId = request.PurchaseOrderId;
        entity.PurchaseInvoiceId = request.PurchaseInvoiceId;
        entity.FixedAssetId = request.FixedAssetId;
        entity.OrganizationCostCenterId =
            request.OrganizationCostCenterId;
        entity.OriginalEstimate = request.OriginalEstimate;
        entity.RevisedAmount = request.RevisedAmount;
        entity.CommittedAmount = request.CommittedAmount;
        entity.ActualExpenditure = request.ActualExpenditure;
        entity.ForecastAtCompletion = request.ForecastAtCompletion;
        entity.RequestDateUtc = request.RequestDateUtc;
        entity.ExpectedCompletionDateUtc =
            request.ExpectedCompletionDateUtc;
        entity.Justification = request.Justification.Trim();
        entity.Notes = Clean(request.Notes);
    }

    private async Task<string?> ValidateLiftingAsync(
        SaveLiftingRequest request,
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.OfftakerName) ||
            string.IsNullOrWhiteSpace(request.UnitOfMeasure))
        {
            return "Offtaker and unit of measure are required.";
        }

        if (request.PlannedQuantity <= 0)
        {
            return "Planned quantity must be greater than zero.";
        }

        if (!await db.OilGasAssets.AnyAsync(
            x => x.Id == request.AssetId && x.IsActive,
            cancellationToken))
        {
            return "Selected asset was not found or is inactive.";
        }

        if (!await db.OilGasLocations.AnyAsync(
            x => x.Id == request.LocationId &&
                 x.AssetId == request.AssetId &&
                 x.IsActive,
            cancellationToken))
        {
            return "Selected location does not belong to the asset or is inactive.";
        }

        if (!await db.OilGasProducts.AnyAsync(
            x => x.Id == request.ProductId && x.IsActive,
            cancellationToken))
        {
            return "Selected product was not found or is inactive.";
        }

        if (!await db.OilGasTanks.AnyAsync(
            x => x.Id == request.SourceTankId &&
                 x.ProductId == request.ProductId,
            cancellationToken))
        {
            return "Source tank was not found or does not hold the selected product.";
        }

        if (request.CustomerId.HasValue &&
            !await db.Customers.AnyAsync(
                x => x.Id == request.CustomerId.Value,
                cancellationToken))
        {
            return "Selected customer was not found.";
        }

        if (request.BillingInvoiceId.HasValue &&
            !await db.BillingInvoices.AnyAsync(
                x => x.Id == request.BillingInvoiceId.Value,
                cancellationToken))
        {
            return "Selected billing invoice was not found.";
        }

        if (request.SalesInvoiceId.HasValue &&
            !await db.SalesInvoices.AnyAsync(
                x => x.Id == request.SalesInvoiceId.Value,
                cancellationToken))
        {
            return "Selected sales invoice was not found.";
        }

        return null;
    }

    private async Task<string?> ValidateAfeAsync(
        SaveAfeRequest request,
        ApplicationDbContext db,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title) ||
            string.IsNullOrWhiteSpace(request.Description) ||
            string.IsNullOrWhiteSpace(request.CostCategory) ||
            string.IsNullOrWhiteSpace(request.Justification))
        {
            return "Title, description, cost category and justification are required.";
        }

        if (request.OriginalEstimate <= 0)
        {
            return "Original estimate must be greater than zero.";
        }

        if (!await db.OilGasAssets.AnyAsync(
            x => x.Id == request.AssetId && x.IsActive,
            cancellationToken))
        {
            return "Selected asset was not found or is inactive.";
        }

        if (request.BudgetId.HasValue &&
            !await db.Budgets.AnyAsync(
                x => x.Id == request.BudgetId.Value,
                cancellationToken))
        {
            return "Selected budget was not found.";
        }

        if (request.PurchaseRequisitionId.HasValue &&
            !await db.PurchaseRequisitions.AnyAsync(
                x => x.Id == request.PurchaseRequisitionId.Value,
                cancellationToken))
        {
            return "Selected purchase requisition was not found.";
        }

        if (request.PurchaseOrderId.HasValue &&
            !await db.PurchaseOrders.AnyAsync(
                x => x.Id == request.PurchaseOrderId.Value,
                cancellationToken))
        {
            return "Selected purchase order was not found.";
        }

        if (request.PurchaseInvoiceId.HasValue &&
            !await db.PurchaseInvoices.AnyAsync(
                x => x.Id == request.PurchaseInvoiceId.Value,
                cancellationToken))
        {
            return "Selected purchase invoice was not found.";
        }

        if (request.FixedAssetId.HasValue &&
            !await db.FixedAssets.AnyAsync(
                x => x.Id == request.FixedAssetId.Value,
                cancellationToken))
        {
            return "Selected fixed asset was not found.";
        }

        return null;
    }

    private static async Task<string> NextNumberAsync(
        IQueryable<string> numbers,
        string prefix,
        CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year;
        var sequence = await numbers.CountAsync(
            x => x.StartsWith($"{prefix}-{year}-"),
            cancellationToken);

        return $"{prefix}-{year}-{sequence + 1:00000}";
    }

    private string CurrentUser() =>
        User.Identity?.Name ??
        User.FindFirst("email")?.Value ??
        "Unknown";

    private static bool SameUser(
        string left,
        string right) =>
        string.Equals(
            left?.Trim(),
            right?.Trim(),
            StringComparison.OrdinalIgnoreCase);

    private static string? Clean(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();

    private static string NormalizeCurrency(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? "NGN"
            : value.Trim().ToUpperInvariant();

    private IActionResult TenantRequired() =>
        BadRequest(new
        {
            Message = "Tenant context is required.",
            RequiredHeader = "X-Tenant-Key"
        });

    private async Task WriteAudit(
        IAuditTrailWriter audit,
        Guid tenantId,
        string entityType,
        string action,
        Guid entityId,
        string reference,
        CancellationToken cancellationToken) =>
        await audit.WriteAsync(
            "oilgas",
            entityType,
            action,
            entityId,
            reference,
            $"{entityType} '{reference}' {action.ToLowerInvariant()}.",
            User.Identity?.Name,
            tenantId,
            null,
            cancellationToken);

    public sealed record SaveLiftingRequest(
        string? NominationReference,
        Guid AssetId,
        Guid LocationId,
        Guid ProductId,
        Guid SourceTankId,
        Guid? CustomerId,
        string OfftakerName,
        decimal PlannedQuantity,
        decimal ActualLoadedQuantity,
        decimal? DeliveredQuantity,
        string UnitOfMeasure,
        DateTime PlannedLoadingDateUtc,
        OilGasTransportType TransportType,
        string? VesselOrTruckReference,
        string? BillOfLadingNumber,
        decimal? UnitPrice,
        string? CurrencyCode,
        Guid? BillingInvoiceId,
        Guid? SalesInvoiceId,
        Guid? StockMovementId,
        string? Destination,
        string? QualityCertificateReference,
        string? Notes);

    public sealed record CompleteLiftingRequest(
        decimal ActualLoadedQuantity,
        decimal? DeliveredQuantity,
        string? BillOfLadingNumber,
        Guid? BillingInvoiceId,
        Guid? SalesInvoiceId,
        DateTime? LoadingCompletedOnUtc);

    public sealed record SaveAfeRequest(
        Guid AssetId,
        Guid? LocationId,
        string Title,
        string Description,
        string CostCategory,
        Guid? BudgetId,
        Guid? PurchaseRequisitionId,
        Guid? PurchaseOrderId,
        Guid? PurchaseInvoiceId,
        Guid? FixedAssetId,
        Guid? OrganizationCostCenterId,
        decimal OriginalEstimate,
        decimal RevisedAmount,
        decimal CommittedAmount,
        decimal ActualExpenditure,
        decimal ForecastAtCompletion,
        DateTime RequestDateUtc,
        DateTime? ExpectedCompletionDateUtc,
        string Justification,
        string? Notes);

    public sealed record CreatePartnerRequest(
        string PartnerCode,
        string PartnerName,
        string? RegistrationNumber,
        string? ContactEmail,
        string? ContactPhone,
        string? Notes);

    public sealed record CreatePartnerInterestRequest(
        Guid AssetId,
        bool IsOperator,
        decimal WorkingInterestPercentage,
        decimal CostSharePercentage,
        DateTime EffectiveFromUtc,
        DateTime? EffectiveToUtc,
        string? Notes);

    public sealed record CreatePartnerFundingRequest(
        Guid AssetId,
        Guid? AfeId,
        OilGasPartnerFundingType FundingType,
        string Reference,
        DateTime TransactionDateUtc,
        decimal Amount,
        string? CurrencyCode,
        string? Notes);

    public sealed record CreateProductionPeriodRequest(
        string PeriodCode,
        DateTime StartDateUtc,
        DateTime EndDateUtc,
        string? Notes);

    public sealed record CreateHseIncidentRequest(
        DateTime IncidentDateUtc,
        Guid AssetId,
        Guid? LocationId,
        string IncidentCategory,
        OilGasHseSeverity Severity,
        string Description,
        string ImmediateAction,
        string? RootCause,
        string ResponsibleOfficer,
        DateTime? TargetClosureDateUtc,
        string? EvidenceReference,
        string? Notes);

    public sealed record CreateCorrectiveActionRequest(
        string ActionDescription,
        string ResponsibleOfficer,
        DateTime TargetDateUtc,
        string? CompletionEvidenceReference,
        string? Notes);

    public sealed record CompleteCorrectiveActionRequest(
        DateTime? CompletedOnUtc,
        string? CompletionEvidenceReference,
        string? Notes);

    public sealed record CreateEquipmentRequest(
        string EquipmentNumber,
        string EquipmentName,
        Guid AssetId,
        Guid? LocationId,
        Guid? FixedAssetId,
        string EquipmentCategory,
        string? Manufacturer,
        string? Model,
        string? SerialNumber,
        int CriticalityLevel,
        DateTime? CommissioningDateUtc,
        DateTime? LastMaintenanceDateUtc,
        DateTime? NextMaintenanceDateUtc,
        DateTime? NextInspectionDateUtc,
        OilGasEquipmentStatus Status,
        string? Notes);

    public sealed record CreateDocumentRequest(
        OilGasDocumentType DocumentType,
        string RelatedEntityType,
        Guid RelatedEntityId,
        string DocumentReference,
        string? FileName,
        DateTime? IssueDateUtc,
        DateTime? ExpiryDateUtc,
        string? Description);

    public sealed record RejectRequest(string Reason);
}
