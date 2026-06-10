using iBalance.Api.Security;
using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Application.Security;
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
[Route("api/oil-gas")]
public sealed class OilGasController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());

        var today = DateTime.UtcNow.Date;
        var permitsExpiringBefore = today.AddDays(90);

        var todaysEntries = await dbContext.OilGasProductionEntries
            .AsNoTracking()
            .Where(x => x.ProductionDateUtc.Date == today)
            .ToListAsync(cancellationToken);

        var recentEntries = await dbContext.OilGasProductionEntries
            .AsNoTracking()
            .Include(x => x.Asset)
            .Include(x => x.Location)
            .Include(x => x.Product)
            .OrderByDescending(x => x.ProductionDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .Take(10)
            .Select(x => new
            {
                x.Id,
                x.EntryNumber,
                x.ProductionDateUtc,
                AssetName = x.Asset != null ? x.Asset.Name : "",
                LocationName = x.Location != null ? x.Location.Name : "",
                ProductName = x.Product != null ? x.Product.Name : "",
                x.NetOilVolume,
                x.GasProducedVolume,
                x.GasFlaredVolume,
                Status = x.Status.ToString()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            BusinessUnitCount = await dbContext.OilGasBusinessUnits.CountAsync(x => x.IsActive, cancellationToken),
            AssetCount = await dbContext.OilGasAssets.CountAsync(x => x.IsActive, cancellationToken),
            LocationCount = await dbContext.OilGasLocations.CountAsync(x => x.IsActive, cancellationToken),
            ProductCount = await dbContext.OilGasProducts.CountAsync(x => x.IsActive, cancellationToken),
            TankCount = await dbContext.OilGasTanks.CountAsync(x => x.Status != OilGasTankStatus.Retired, cancellationToken),
            MeterCount = await dbContext.OilGasMeters.CountAsync(x => x.Status != OilGasMeterStatus.Retired, cancellationToken),
            PendingProductionCount = await dbContext.OilGasProductionEntries.CountAsync(x => x.Status == OilGasProductionStatus.Submitted, cancellationToken),
            RejectedProductionCount = await dbContext.OilGasProductionEntries.CountAsync(x => x.Status == OilGasProductionStatus.Rejected, cancellationToken),
            ExpiringPermitCount = await dbContext.OilGasPermits.CountAsync(x => x.Status == OilGasPermitStatus.Active && x.ExpiryDateUtc <= permitsExpiringBefore, cancellationToken),
            TodayGrossOilVolume = todaysEntries.Sum(x => x.GrossOilVolume),
            TodayNetOilVolume = todaysEntries.Sum(x => x.NetOilVolume),
            TodayGasProducedVolume = todaysEntries.Sum(x => x.GasProducedVolume),
            TodayGasFlaredVolume = todaysEntries.Sum(x => x.GasFlaredVolume),
            TodayWaterProducedVolume = todaysEntries.Sum(x => x.WaterProducedVolume),
            TodayOpeningStockVolume = todaysEntries.Sum(x => x.OpeningStockVolume),
            TodayClosingStockVolume = todaysEntries.Sum(x => x.ClosingStockVolume),
            RecentEntries = recentEntries
        });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("ledger-accounts")]
    public async Task<IActionResult> GetPostingLedgerAccounts(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var items = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => x.IsActive && x.IsPostingAllowed)
            .OrderBy(x => x.Code)
            .Select(x => new { x.Id, x.Code, x.Name, x.Category, x.IsCashOrBankAccount })
            .ToListAsync(cancellationToken);

        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("posting-setup")]
    public async Task<IActionResult> GetPostingSetup(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var setup = await dbContext.OilGasPostingSetups.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
        return Ok(new { Item = setup });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasSetupManage)]
    [HttpPut("posting-setup")]
    public async Task<IActionResult> SavePostingSetup(
        [FromBody] SavePostingSetupRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());

        var accountIds = new[]
        {
            request.InventoryAssetLedgerAccountId,
            request.ProductionRevenueLedgerAccountId,
            request.ProductionLossExpenseLedgerAccountId,
            request.GasFlareExpenseLedgerAccountId
        }.Concat(request.ProductionCostLedgerAccountId.HasValue ? new[] { request.ProductionCostLedgerAccountId.Value } : Array.Empty<Guid>())
         .Distinct()
         .ToList();

        var validCount = await dbContext.LedgerAccounts.CountAsync(
            x => accountIds.Contains(x.Id) && x.IsActive && x.IsPostingAllowed,
            cancellationToken);

        if (validCount != accountIds.Count)
        {
            return BadRequest(new { Message = "Every selected Oil & Gas account must be an active, posting-enabled account from the shared Chart of Accounts." });
        }

        var setup = await dbContext.OilGasPostingSetups.SingleOrDefaultAsync(cancellationToken);
        if (setup is null)
        {
            setup = new OilGasPostingSetup
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.TenantId
            };
            dbContext.OilGasPostingSetups.Add(setup);
        }

        setup.InventoryAssetLedgerAccountId = request.InventoryAssetLedgerAccountId;
        setup.ProductionRevenueLedgerAccountId = request.ProductionRevenueLedgerAccountId;
        setup.ProductionLossExpenseLedgerAccountId = request.ProductionLossExpenseLedgerAccountId;
        setup.GasFlareExpenseLedgerAccountId = request.GasFlareExpenseLedgerAccountId;
        setup.ProductionCostLedgerAccountId = request.ProductionCostLedgerAccountId;
        setup.Notes = NormalizeOptional(request.Notes);
        setup.UpdatedOnUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasPostingSetup", setup.Id, "SavePostingSetup", "Oil & Gas posting setup saved using the shared Chart of Accounts.", cancellationToken);
        return Ok(new { Message = "Oil & Gas posting setup saved.", Item = setup });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("business-units")]
    public async Task<IActionResult> GetBusinessUnits([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasBusinessUnits.AsNoTracking().OrderBy(x => x.Code).ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasSetupManage)]
    [HttpPost("business-units")]
    public async Task<IActionResult> CreateBusinessUnit(
        [FromBody] SaveBusinessUnitRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var code = RequiredCode(request.Code, "Business unit code");
        if (code.Error is not null) return BadRequest(new { Message = code.Error });
        var name = RequiredText(request.Name, "Business unit name");
        if (name.Error is not null) return BadRequest(new { Message = name.Error });
        if (await dbContext.OilGasBusinessUnits.AnyAsync(x => x.Code == code.Value, cancellationToken))
            return Conflict(new { Message = $"Business unit code '{code.Value}' already exists." });

        var entity = new OilGasBusinessUnit
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.TenantId,
            Code = code.Value!,
            Name = name.Value!,
            Description = NormalizeOptional(request.Description),
            IsActive = request.IsActive,
            CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasBusinessUnits.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasBusinessUnit", entity.Id, "Create", $"Oil & Gas business unit {entity.Code} created.", cancellationToken);
        return Ok(new { Message = "Business unit created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("assets")]
    public async Task<IActionResult> GetAssets([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasAssets.AsNoTracking().Include(x => x.BusinessUnit).OrderBy(x => x.Code)
            .Select(x => new
            {
                x.Id, x.BusinessUnitId, BusinessUnitCode = x.BusinessUnit != null ? x.BusinessUnit.Code : "",
                BusinessUnitName = x.BusinessUnit != null ? x.BusinessUnit.Name : "", x.Code, x.Name,
                AssetType = x.AssetType.ToString(), x.OperatorName, x.OwnershipPercentage, x.OrganizationCostCenterId,
                x.LocationDescription, x.CommissioningDateUtc, x.IsActive, x.Notes, x.CreatedOnUtc
            }).ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasAssetManage)]
    [HttpPost("assets")]
    public async Task<IActionResult> CreateAsset(
        [FromBody] SaveAssetRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        if (!await dbContext.OilGasBusinessUnits.AnyAsync(x => x.Id == request.BusinessUnitId && x.IsActive, cancellationToken))
            return BadRequest(new { Message = "Select an active Oil & Gas business unit." });
        var code = RequiredCode(request.Code, "Asset code");
        if (code.Error is not null) return BadRequest(new { Message = code.Error });
        var name = RequiredText(request.Name, "Asset name");
        if (name.Error is not null) return BadRequest(new { Message = name.Error });
        if (!Enum.IsDefined(request.AssetType)) return BadRequest(new { Message = "Select a valid asset type." });
        if (request.OwnershipPercentage < 0 || request.OwnershipPercentage > 100)
            return BadRequest(new { Message = "Ownership percentage must be between 0 and 100." });
        if (await dbContext.OilGasAssets.AnyAsync(x => x.Code == code.Value, cancellationToken))
            return Conflict(new { Message = $"Asset code '{code.Value}' already exists." });

        var entity = new OilGasAsset
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, BusinessUnitId = request.BusinessUnitId,
            Code = code.Value!, Name = name.Value!, AssetType = request.AssetType,
            OperatorName = NormalizeOptional(request.OperatorName), OwnershipPercentage = request.OwnershipPercentage,
            OrganizationCostCenterId = request.OrganizationCostCenterId, LocationDescription = NormalizeOptional(request.LocationDescription),
            CommissioningDateUtc = request.CommissioningDateUtc, IsActive = request.IsActive, Notes = NormalizeOptional(request.Notes),
            CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasAssets.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasAsset", entity.Id, "Create", $"Oil & Gas asset {entity.Code} created.", cancellationToken);
        return Ok(new { Message = "Oil & Gas asset created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("locations")]
    public async Task<IActionResult> GetLocations([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasLocations.AsNoTracking().Include(x => x.Asset).Include(x => x.ParentLocation)
            .OrderBy(x => x.Code).Select(x => new
            {
                x.Id, x.AssetId, AssetCode = x.Asset != null ? x.Asset.Code : "", AssetName = x.Asset != null ? x.Asset.Name : "",
                x.ParentLocationId, ParentLocationName = x.ParentLocation != null ? x.ParentLocation.Name : null,
                x.Code, x.Name, LocationType = x.LocationType.ToString(), x.Coordinates, x.IsActive, x.Notes, x.CreatedOnUtc
            }).ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasAssetManage)]
    [HttpPost("locations")]
    public async Task<IActionResult> CreateLocation(
        [FromBody] SaveLocationRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        if (!await dbContext.OilGasAssets.AnyAsync(x => x.Id == request.AssetId && x.IsActive, cancellationToken))
            return BadRequest(new { Message = "Select an active Oil & Gas asset." });
        if (request.ParentLocationId.HasValue && !await dbContext.OilGasLocations.AnyAsync(x => x.Id == request.ParentLocationId.Value && x.AssetId == request.AssetId, cancellationToken))
            return BadRequest(new { Message = "Parent location must belong to the selected asset." });
        var code = RequiredCode(request.Code, "Location code");
        if (code.Error is not null) return BadRequest(new { Message = code.Error });
        var name = RequiredText(request.Name, "Location name");
        if (name.Error is not null) return BadRequest(new { Message = name.Error });
        if (!Enum.IsDefined(request.LocationType)) return BadRequest(new { Message = "Select a valid location type." });
        if (await dbContext.OilGasLocations.AnyAsync(x => x.Code == code.Value, cancellationToken))
            return Conflict(new { Message = $"Location code '{code.Value}' already exists." });

        var entity = new OilGasLocation
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, AssetId = request.AssetId,
            ParentLocationId = request.ParentLocationId, Code = code.Value!, Name = name.Value!,
            LocationType = request.LocationType, Coordinates = NormalizeOptional(request.Coordinates),
            IsActive = request.IsActive, Notes = NormalizeOptional(request.Notes), CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasLocations.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasLocation", entity.Id, "Create", $"Oil & Gas location {entity.Code} created.", cancellationToken);
        return Ok(new { Message = "Operational location created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasProducts.AsNoTracking().OrderBy(x => x.Code)
            .Select(x => new { x.Id, x.Code, x.Name, Category = x.Category.ToString(), x.UnitOfMeasure, x.StandardDensity, x.IsActive, x.Notes, x.CreatedOnUtc })
            .ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasProductManage)]
    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct(
        [FromBody] SaveProductRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var code = RequiredCode(request.Code, "Product code");
        if (code.Error is not null) return BadRequest(new { Message = code.Error });
        var name = RequiredText(request.Name, "Product name");
        if (name.Error is not null) return BadRequest(new { Message = name.Error });
        var unit = RequiredText(request.UnitOfMeasure, "Unit of measure");
        if (unit.Error is not null) return BadRequest(new { Message = unit.Error });
        if (!Enum.IsDefined(request.Category)) return BadRequest(new { Message = "Select a valid petroleum product category." });
        if (await dbContext.OilGasProducts.AnyAsync(x => x.Code == code.Value, cancellationToken))
            return Conflict(new { Message = $"Product code '{code.Value}' already exists." });

        var entity = new OilGasProduct
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, Code = code.Value!, Name = name.Value!,
            Category = request.Category, UnitOfMeasure = unit.Value!, StandardDensity = request.StandardDensity,
            IsActive = request.IsActive, Notes = NormalizeOptional(request.Notes), CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasProducts.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasProduct", entity.Id, "Create", $"Oil & Gas product {entity.Code} created.", cancellationToken);
        return Ok(new { Message = "Petroleum product created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("tanks")]
    public async Task<IActionResult> GetTanks([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasTanks.AsNoTracking().Include(x => x.Location).Include(x => x.Product).OrderBy(x => x.TankCode)
            .Select(x => new
            {
                x.Id, x.LocationId, LocationName = x.Location != null ? x.Location.Name : "", x.ProductId,
                ProductName = x.Product != null ? x.Product.Name : "", x.TankCode, x.TankName, x.NominalCapacity,
                x.SafeWorkingCapacity, x.CurrentBookStock, Status = x.Status.ToString(), x.Notes, x.CreatedOnUtc
            }).ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasTankManage)]
    [HttpPost("tanks")]
    public async Task<IActionResult> CreateTank(
        [FromBody] SaveTankRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        if (!await dbContext.OilGasLocations.AnyAsync(x => x.Id == request.LocationId && x.IsActive, cancellationToken))
            return BadRequest(new { Message = "Select an active operational location." });
        if (!await dbContext.OilGasProducts.AnyAsync(x => x.Id == request.ProductId && x.IsActive, cancellationToken))
            return BadRequest(new { Message = "Select an active petroleum product." });
        if (request.NominalCapacity <= 0 || request.SafeWorkingCapacity <= 0 || request.SafeWorkingCapacity > request.NominalCapacity)
            return BadRequest(new { Message = "Safe working capacity must be positive and cannot exceed nominal capacity." });
        var code = RequiredCode(request.TankCode, "Tank code");
        if (code.Error is not null) return BadRequest(new { Message = code.Error });
        var name = RequiredText(request.TankName, "Tank name");
        if (name.Error is not null) return BadRequest(new { Message = name.Error });
        if (await dbContext.OilGasTanks.AnyAsync(x => x.TankCode == code.Value, cancellationToken))
            return Conflict(new { Message = $"Tank code '{code.Value}' already exists." });

        var entity = new OilGasTank
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, LocationId = request.LocationId, ProductId = request.ProductId,
            TankCode = code.Value!, TankName = name.Value!, NominalCapacity = request.NominalCapacity,
            SafeWorkingCapacity = request.SafeWorkingCapacity, CurrentBookStock = request.CurrentBookStock,
            Status = request.Status, Notes = NormalizeOptional(request.Notes), CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasTanks.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasTank", entity.Id, "Create", $"Oil & Gas tank {entity.TankCode} created.", cancellationToken);
        return Ok(new { Message = "Tank created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("meters")]
    public async Task<IActionResult> GetMeters([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasMeters.AsNoTracking().Include(x => x.Location).Include(x => x.Product).OrderBy(x => x.MeterCode)
            .Select(x => new
            {
                x.Id, x.LocationId, LocationName = x.Location != null ? x.Location.Name : "", x.ProductId,
                ProductName = x.Product != null ? x.Product.Name : "", x.MeterCode, x.MeterName, x.MeterType,
                x.SerialNumber, x.LastCalibrationDateUtc, x.NextCalibrationDateUtc, Status = x.Status.ToString(), x.Notes, x.CreatedOnUtc
            }).ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasMeterManage)]
    [HttpPost("meters")]
    public async Task<IActionResult> CreateMeter(
        [FromBody] SaveMeterRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        if (!await dbContext.OilGasLocations.AnyAsync(x => x.Id == request.LocationId && x.IsActive, cancellationToken))
            return BadRequest(new { Message = "Select an active operational location." });
        if (!await dbContext.OilGasProducts.AnyAsync(x => x.Id == request.ProductId && x.IsActive, cancellationToken))
            return BadRequest(new { Message = "Select an active petroleum product." });
        if (request.LastCalibrationDateUtc.HasValue && request.NextCalibrationDateUtc.HasValue &&
            request.NextCalibrationDateUtc.Value <= request.LastCalibrationDateUtc.Value)
            return BadRequest(new { Message = "Next calibration date must be later than the last calibration date." });
        var code = RequiredCode(request.MeterCode, "Meter code");
        if (code.Error is not null) return BadRequest(new { Message = code.Error });
        var name = RequiredText(request.MeterName, "Meter name");
        if (name.Error is not null) return BadRequest(new { Message = name.Error });
        var meterType = RequiredText(request.MeterType, "Meter type");
        if (meterType.Error is not null) return BadRequest(new { Message = meterType.Error });
        if (await dbContext.OilGasMeters.AnyAsync(x => x.MeterCode == code.Value, cancellationToken))
            return Conflict(new { Message = $"Meter code '{code.Value}' already exists." });

        var entity = new OilGasMeter
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, LocationId = request.LocationId, ProductId = request.ProductId,
            MeterCode = code.Value!, MeterName = name.Value!, MeterType = meterType.Value!,
            SerialNumber = NormalizeOptional(request.SerialNumber), LastCalibrationDateUtc = request.LastCalibrationDateUtc,
            NextCalibrationDateUtc = request.NextCalibrationDateUtc, Status = request.Status,
            Notes = NormalizeOptional(request.Notes), CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasMeters.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasMeter", entity.Id, "Create", $"Oil & Gas meter {entity.MeterCode} created.", cancellationToken);
        return Ok(new { Message = "Meter created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("permits")]
    public async Task<IActionResult> GetPermits([FromServices] ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        var items = await dbContext.OilGasPermits.AsNoTracking().Include(x => x.Asset).Include(x => x.Location).OrderBy(x => x.ExpiryDateUtc)
            .Select(x => new
            {
                x.Id, x.AssetId, AssetName = x.Asset != null ? x.Asset.Name : null, x.LocationId,
                LocationName = x.Location != null ? x.Location.Name : null, x.PermitNumber, x.PermitType,
                x.IssuingAuthority, x.EffectiveDateUtc, x.ExpiryDateUtc, Status = x.Status.ToString(),
                x.ResponsibleOfficer, x.Notes, x.CreatedOnUtc
            }).ToListAsync(cancellationToken);
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasPermitManage)]
    [HttpPost("permits")]
    public async Task<IActionResult> CreatePermit(
        [FromBody] SavePermitRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        if (request.ExpiryDateUtc <= request.EffectiveDateUtc)
            return BadRequest(new { Message = "Permit expiry date must be later than its effective date." });
        if (request.AssetId.HasValue && !await dbContext.OilGasAssets.AnyAsync(x => x.Id == request.AssetId.Value, cancellationToken))
            return BadRequest(new { Message = "Selected Oil & Gas asset was not found." });
        if (request.LocationId.HasValue && !await dbContext.OilGasLocations.AnyAsync(x => x.Id == request.LocationId.Value, cancellationToken))
            return BadRequest(new { Message = "Selected operational location was not found." });
        var number = RequiredText(request.PermitNumber, "Permit number");
        if (number.Error is not null) return BadRequest(new { Message = number.Error });
        var type = RequiredText(request.PermitType, "Permit type");
        if (type.Error is not null) return BadRequest(new { Message = type.Error });
        var authority = RequiredText(request.IssuingAuthority, "Issuing authority");
        if (authority.Error is not null) return BadRequest(new { Message = authority.Error });
        if (await dbContext.OilGasPermits.AnyAsync(x => x.PermitNumber == number.Value, cancellationToken))
            return Conflict(new { Message = $"Permit number '{number.Value}' already exists." });

        var entity = new OilGasPermit
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, AssetId = request.AssetId, LocationId = request.LocationId,
            PermitNumber = number.Value!, PermitType = type.Value!, IssuingAuthority = authority.Value!,
            EffectiveDateUtc = request.EffectiveDateUtc, ExpiryDateUtc = request.ExpiryDateUtc, Status = request.Status,
            ResponsibleOfficer = NormalizeOptional(request.ResponsibleOfficer), Notes = NormalizeOptional(request.Notes),
            CreatedOnUtc = DateTime.UtcNow
        };
        dbContext.OilGasPermits.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasPermit", entity.Id, "Create", $"Oil & Gas permit {entity.PermitNumber} created.", cancellationToken);
        return Ok(new { Message = "Licence or permit created.", Item = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasView)]
    [HttpGet("production")]
    public async Task<IActionResult> GetProductionEntries(
        [FromQuery] OilGasProductionStatus? status,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var query = dbContext.OilGasProductionEntries.AsNoTracking().Include(x => x.Asset).Include(x => x.Location)
            .Include(x => x.Product).Include(x => x.Meter).AsQueryable();
        if (status.HasValue) query = query.Where(x => x.Status == status.Value);
        if (fromUtc.HasValue) query = query.Where(x => x.ProductionDateUtc >= fromUtc.Value.Date);
        if (toUtc.HasValue) query = query.Where(x => x.ProductionDateUtc < toUtc.Value.Date.AddDays(1));

        var entities = await query.OrderByDescending(x => x.ProductionDateUtc).ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);
        var items = entities.Select(MapProduction).ToList();
        return Ok(new { Count = items.Count, Items = items });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasProductionCreate)]
    [HttpPost("production")]
    public async Task<IActionResult> CreateProductionEntry(
        [FromBody] SaveProductionRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var validation = await ValidateProductionRequest(request, dbContext, cancellationToken);
        if (validation is not null) return BadRequest(new { Message = validation });

        var nextNumber = $"OGP-{request.ProductionDateUtc:yyyyMMdd}-{(await dbContext.OilGasProductionEntries.CountAsync(x => x.ProductionDateUtc.Date == request.ProductionDateUtc.Date, cancellationToken) + 1):D4}";
        var entity = new OilGasProductionEntry
        {
            Id = Guid.NewGuid(), TenantId = tenant.TenantId, EntryNumber = nextNumber,
            CreatedBy = User.Identity?.Name ?? "Unknown", CreatedOnUtc = DateTime.UtcNow
        };
        ApplyProduction(entity, request);
        dbContext.OilGasProductionEntries.Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasProductionEntry", entity.Id, "Create", $"Production entry {entity.EntryNumber} created.", cancellationToken);
        return Ok(new { Message = "Daily production entry created.", Item = MapProduction(entity) });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasProductionUpdate)]
    [HttpPut("production/{id:guid}")]
    public async Task<IActionResult> UpdateProductionEntry(
        Guid id,
        [FromBody] SaveProductionRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var entity = await dbContext.OilGasProductionEntries.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Production entry was not found." });
        if (entity.Status is not (OilGasProductionStatus.Draft or OilGasProductionStatus.Rejected))
            return BadRequest(new { Message = "Only draft or rejected production entries can be edited." });
        var validation = await ValidateProductionRequest(request, dbContext, cancellationToken);
        if (validation is not null) return BadRequest(new { Message = validation });
        ApplyProduction(entity, request);
        if (entity.Status == OilGasProductionStatus.Rejected)
        {
            entity.RejectionReason = null;
            entity.RejectedBy = null;
            entity.RejectedOnUtc = null;
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasProductionEntry", entity.Id, "Update", $"Production entry {entity.EntryNumber} updated.", cancellationToken);
        return Ok(new { Message = "Production entry updated.", Item = MapProduction(entity) });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasProductionSubmit)]
    [HttpPost("production/{id:guid}/submit")]
    public async Task<IActionResult> SubmitProductionEntry(
        Guid id,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var entity = await dbContext.OilGasProductionEntries.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Production entry was not found." });
        if (entity.Status is not (OilGasProductionStatus.Draft or OilGasProductionStatus.Rejected))
            return BadRequest(new { Message = "Only draft or rejected production entries can be submitted." });
        entity.Status = OilGasProductionStatus.Submitted;
        entity.SubmittedBy = User.Identity?.Name;
        entity.SubmittedOnUtc = DateTime.UtcNow;
        entity.RejectionReason = null;
        entity.RejectedBy = null;
        entity.RejectedOnUtc = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasProductionEntry", entity.Id, "Submit", $"Production entry {entity.EntryNumber} submitted.", cancellationToken);
        return Ok(new { Message = "Production entry submitted for approval." });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasProductionApprove)]
    [HttpPost("production/{id:guid}/approve")]
    public async Task<IActionResult> ApproveProductionEntry(
        Guid id,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var entity = await dbContext.OilGasProductionEntries.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Production entry was not found." });
        if (entity.Status != OilGasProductionStatus.Submitted)
            return BadRequest(new { Message = "Only submitted production entries can be approved." });
        if (string.Equals(entity.CreatedBy, User.Identity?.Name, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { Message = "Maker/checker control prevents the creator from approving this production entry." });
        entity.Status = OilGasProductionStatus.Approved;
        entity.ApprovedBy = User.Identity?.Name;
        entity.ApprovedOnUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasProductionEntry", entity.Id, "Approve", $"Production entry {entity.EntryNumber} approved.", cancellationToken);
        return Ok(new { Message = "Production entry approved." });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasProductionReject)]
    [HttpPost("production/{id:guid}/reject")]
    public async Task<IActionResult> RejectProductionEntry(
        Guid id,
        [FromBody] RejectProductionRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable) return BadRequest(TenantError());
        var reason = RequiredText(request.Reason, "Rejection reason");
        if (reason.Error is not null) return BadRequest(new { Message = reason.Error });
        var entity = await dbContext.OilGasProductionEntries.SingleOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Production entry was not found." });
        if (entity.Status != OilGasProductionStatus.Submitted)
            return BadRequest(new { Message = "Only submitted production entries can be rejected." });
        if (string.Equals(entity.CreatedBy, User.Identity?.Name, StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { Message = "Maker/checker control prevents the creator from rejecting this production entry." });
        entity.Status = OilGasProductionStatus.Rejected;
        entity.RejectionReason = reason.Value;
        entity.RejectedBy = User.Identity?.Name;
        entity.RejectedOnUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await WriteAudit(auditTrailWriter, tenant.TenantId, "OilGasProductionEntry", entity.Id, "Reject", $"Production entry {entity.EntryNumber} rejected. Reason: {reason.Value}", cancellationToken);
        return Ok(new { Message = "Production entry rejected." });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasReportsView)]
    [HttpGet("reports/production-summary")]
    public async Task<IActionResult> GetProductionSummary(
        [FromQuery] DateTime fromUtc,
        [FromQuery] DateTime toUtc,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (toUtc.Date < fromUtc.Date) return BadRequest(new { Message = "Report end date cannot be earlier than start date." });
        var endExclusive = toUtc.Date.AddDays(1);
        var source = dbContext.OilGasProductionEntries.AsNoTracking()
            .Where(x => x.ProductionDateUtc >= fromUtc.Date && x.ProductionDateUtc < endExclusive && x.Status == OilGasProductionStatus.Approved);

        var byAsset = await source.GroupBy(x => new { x.AssetId, AssetName = x.Asset!.Name })
            .Select(x => new
            {
                x.Key.AssetId, x.Key.AssetName, EntryCount = x.Count(), GrossOilVolume = x.Sum(y => y.GrossOilVolume),
                NetOilVolume = x.Sum(y => y.NetOilVolume), GasProducedVolume = x.Sum(y => y.GasProducedVolume),
                GasFlaredVolume = x.Sum(y => y.GasFlaredVolume), WaterProducedVolume = x.Sum(y => y.WaterProducedVolume),
                LossAdjustmentVolume = x.Sum(y => y.LossAdjustmentVolume), DowntimeHours = x.Sum(y => y.DowntimeHours)
            }).OrderBy(x => x.AssetName).ToListAsync(cancellationToken);

        var daily = await source.GroupBy(x => x.ProductionDateUtc.Date)
            .Select(x => new
            {
                ProductionDateUtc = x.Key, GrossOilVolume = x.Sum(y => y.GrossOilVolume), NetOilVolume = x.Sum(y => y.NetOilVolume),
                GasProducedVolume = x.Sum(y => y.GasProducedVolume), GasFlaredVolume = x.Sum(y => y.GasFlaredVolume),
                WaterProducedVolume = x.Sum(y => y.WaterProducedVolume), OpeningStockVolume = x.Sum(y => y.OpeningStockVolume),
                ClosingStockVolume = x.Sum(y => y.ClosingStockVolume), LossAdjustmentVolume = x.Sum(y => y.LossAdjustmentVolume)
            }).OrderBy(x => x.ProductionDateUtc).ToListAsync(cancellationToken);

        return Ok(new { FromUtc = fromUtc.Date, ToUtc = toUtc.Date, AssetSummary = byAsset, DailySummary = daily });
    }

    [Authorize(Policy = AuthorizationPolicies.OilGasReportsView)]
    [HttpGet("reports/compliance")]
    public async Task<IActionResult> GetComplianceReport(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date;
        var permitEntities = await dbContext.OilGasPermits.AsNoTracking().OrderBy(x => x.ExpiryDateUtc)
            .ToListAsync(cancellationToken);
        var permits = permitEntities.Select(x => new
        {
            x.Id,
            x.PermitNumber,
            x.PermitType,
            x.IssuingAuthority,
            x.ExpiryDateUtc,
            Status = x.Status.ToString(),
            DaysToExpiry = (x.ExpiryDateUtc.Date - today).Days
        }).ToList();
        var meters = await dbContext.OilGasMeters.AsNoTracking().OrderBy(x => x.NextCalibrationDateUtc)
            .Select(x => new { x.Id, x.MeterCode, x.MeterName, x.NextCalibrationDateUtc, Status = x.Status.ToString() })
            .ToListAsync(cancellationToken);
        return Ok(new { Permits = permits, Meters = meters });
    }

    private static object MapProduction(OilGasProductionEntry x) => new
    {
        x.Id, x.EntryNumber, x.ProductionDateUtc, x.AssetId, AssetName = x.Asset?.Name,
        x.LocationId, LocationName = x.Location?.Name, x.ProductId, ProductName = x.Product?.Name,
        x.MeterId, MeterName = x.Meter?.MeterName, x.GrossOilVolume, x.NetOilVolume,
        x.GasProducedVolume, x.GasFlaredVolume, x.WaterProducedVolume, x.OpeningStockVolume,
        x.ClosingStockVolume, x.LossAdjustmentVolume, x.DowntimeHours, x.DowntimeReason,
        x.MeterReading, x.Notes, Status = x.Status.ToString(), x.CreatedBy, x.CreatedOnUtc,
        x.SubmittedBy, x.SubmittedOnUtc, x.ApprovedBy, x.ApprovedOnUtc, x.RejectedBy,
        x.RejectedOnUtc, x.RejectionReason
    };

    private static async Task<string?> ValidateProductionRequest(SaveProductionRequest request, ApplicationDbContext dbContext, CancellationToken cancellationToken)
    {
        if (request.ProductionDateUtc == default) return "Production date is required.";
        if (request.ProductionDateUtc.Date > DateTime.UtcNow.Date) return "Production date cannot be in the future.";
        if (!await dbContext.OilGasAssets.AnyAsync(x => x.Id == request.AssetId && x.IsActive, cancellationToken)) return "Select an active Oil & Gas asset.";
        if (!await dbContext.OilGasLocations.AnyAsync(x => x.Id == request.LocationId && x.AssetId == request.AssetId && x.IsActive, cancellationToken)) return "Select an active location belonging to the chosen asset.";
        if (!await dbContext.OilGasProducts.AnyAsync(x => x.Id == request.ProductId && x.IsActive, cancellationToken)) return "Select an active petroleum product.";
        if (request.MeterId.HasValue && !await dbContext.OilGasMeters.AnyAsync(x => x.Id == request.MeterId.Value && x.LocationId == request.LocationId && x.ProductId == request.ProductId, cancellationToken)) return "Selected meter must belong to the chosen location and product.";
        var values = new[] { request.GrossOilVolume, request.NetOilVolume, request.GasProducedVolume, request.GasFlaredVolume, request.WaterProducedVolume, request.OpeningStockVolume, request.ClosingStockVolume, request.DowntimeHours };
        if (values.Any(x => x < 0)) return "Production volumes, stocks and downtime cannot be negative.";
        if (request.NetOilVolume > request.GrossOilVolume && request.GrossOilVolume > 0) return "Net oil volume cannot exceed gross oil volume.";
        if (request.GasFlaredVolume > request.GasProducedVolume && request.GasProducedVolume > 0) return "Gas flared volume cannot exceed gas produced volume.";
        if (request.DowntimeHours > 24) return "Downtime hours cannot exceed 24 for a daily production entry.";
        return null;
    }

    private static void ApplyProduction(OilGasProductionEntry entity, SaveProductionRequest request)
    {
        entity.ProductionDateUtc = request.ProductionDateUtc.Date;
        entity.AssetId = request.AssetId;
        entity.LocationId = request.LocationId;
        entity.ProductId = request.ProductId;
        entity.MeterId = request.MeterId;
        entity.GrossOilVolume = request.GrossOilVolume;
        entity.NetOilVolume = request.NetOilVolume;
        entity.GasProducedVolume = request.GasProducedVolume;
        entity.GasFlaredVolume = request.GasFlaredVolume;
        entity.WaterProducedVolume = request.WaterProducedVolume;
        entity.OpeningStockVolume = request.OpeningStockVolume;
        entity.ClosingStockVolume = request.ClosingStockVolume;
        entity.LossAdjustmentVolume = request.LossAdjustmentVolume;
        entity.DowntimeHours = request.DowntimeHours;
        entity.DowntimeReason = NormalizeOptional(request.DowntimeReason);
        entity.MeterReading = request.MeterReading;
        entity.Notes = NormalizeOptional(request.Notes);
    }

    private static (string? Value, string? Error) RequiredCode(string? value, string label)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return string.IsNullOrWhiteSpace(normalized) ? (null, $"{label} is required.") : (normalized, null);
    }

    private static (string? Value, string? Error) RequiredText(string? value, string label)
    {
        var normalized = value?.Trim();
        return string.IsNullOrWhiteSpace(normalized) ? (null, $"{label} is required.") : (normalized, null);
    }

    private static string? NormalizeOptional(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static object TenantError() => new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" };

    private async Task WriteAudit(IAuditTrailWriter writer, Guid tenantId, string entityType, Guid entityId, string action, string description, CancellationToken cancellationToken)
    {
        await writer.WriteAsync("oilgas", entityType, action, entityId, entityId.ToString(), description, User.Identity?.Name, tenantId, null, cancellationToken);
    }

    public sealed record SaveBusinessUnitRequest(string Code, string Name, string? Description, bool IsActive = true);
    public sealed record SaveAssetRequest(Guid BusinessUnitId, string Code, string Name, OilGasAssetType AssetType, string? OperatorName, decimal OwnershipPercentage, Guid? OrganizationCostCenterId, string? LocationDescription, DateTime? CommissioningDateUtc, bool IsActive, string? Notes);
    public sealed record SaveLocationRequest(Guid AssetId, Guid? ParentLocationId, string Code, string Name, OilGasLocationType LocationType, string? Coordinates, bool IsActive, string? Notes);
    public sealed record SaveProductRequest(string Code, string Name, OilGasProductCategory Category, string UnitOfMeasure, decimal? StandardDensity, bool IsActive, string? Notes);
    public sealed record SaveTankRequest(Guid LocationId, Guid ProductId, string TankCode, string TankName, decimal NominalCapacity, decimal SafeWorkingCapacity, decimal CurrentBookStock, OilGasTankStatus Status, string? Notes);
    public sealed record SaveMeterRequest(Guid LocationId, Guid ProductId, string MeterCode, string MeterName, string MeterType, string? SerialNumber, DateTime? LastCalibrationDateUtc, DateTime? NextCalibrationDateUtc, OilGasMeterStatus Status, string? Notes);
    public sealed record SavePermitRequest(Guid? AssetId, Guid? LocationId, string PermitNumber, string PermitType, string IssuingAuthority, DateTime EffectiveDateUtc, DateTime ExpiryDateUtc, OilGasPermitStatus Status, string? ResponsibleOfficer, string? Notes);
    public sealed record SavePostingSetupRequest(Guid InventoryAssetLedgerAccountId, Guid ProductionRevenueLedgerAccountId, Guid ProductionLossExpenseLedgerAccountId, Guid GasFlareExpenseLedgerAccountId, Guid? ProductionCostLedgerAccountId, string? Notes);
    public sealed record SaveProductionRequest(DateTime ProductionDateUtc, Guid AssetId, Guid LocationId, Guid ProductId, Guid? MeterId, decimal GrossOilVolume, decimal NetOilVolume, decimal GasProducedVolume, decimal GasFlaredVolume, decimal WaterProducedVolume, decimal OpeningStockVolume, decimal ClosingStockVolume, decimal LossAdjustmentVolume, decimal DowntimeHours, string? DowntimeReason, decimal? MeterReading, string? Notes);
    public sealed record RejectProductionRequest(string Reason);
}
