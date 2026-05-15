using iBalance.Api.Security;
using iBalance.Api.Services.Audit;
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
[Route("api/finance/fleet")]
public sealed class FleetManagementController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.FleetView)]
    [HttpGet("dashboard-summary")]
    public async Task<IActionResult> GetDashboardSummary(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var totalVehicles = await dbContext.Set<FleetVehicle>().CountAsync(cancellationToken);
        var totalActiveVehicles = await dbContext.Set<FleetVehicle>().CountAsync(x => x.IsActive, cancellationToken);
        var totalDrivers = await dbContext.Set<FleetDriver>().CountAsync(x => x.IsActive, cancellationToken);
        var openTrips = await dbContext.Set<FleetTrip>()
            .CountAsync(x => x.Status == FleetTripStatus.Submitted || x.Status == FleetTripStatus.Approved, cancellationToken);
        var fuelAmount = await dbContext.Set<FleetFuelLog>()
        .Where(x => x.Status == FleetPostingStatus.Posted)
        .Select(x => x.QuantityLitres * x.UnitPrice)
        .SumAsync(x => (decimal?)x, cancellationToken) ?? 0m;

        var maintenanceAmount = await dbContext.Set<FleetMaintenanceWorkOrder>()
            .Where(x => x.Status == FleetPostingStatus.Posted)
            .Select(x => x.ActualAmount ?? x.EstimatedAmount)
            .SumAsync(x => (decimal?)x, cancellationToken) ?? 0m;

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            TotalVehicles = totalVehicles,
            TotalActiveVehicles = totalActiveVehicles,
            TotalDrivers = totalDrivers,
            OpenTrips = openTrips,
            TotalFuelPostedAmount = fuelAmount,
            TotalMaintenancePostedAmount = maintenanceAmount
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetView)]
    [HttpGet("vehicles")]
    public async Task<IActionResult> GetVehicles(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<FleetVehicle>()
            .AsNoTracking()
            .OrderBy(x => x.VehicleCode)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.VehicleCode,
                x.RegistrationNumber,
                x.VehicleName,
                x.VehicleType,
                x.Make,
                x.Model,
                x.YearOfManufacture,
                x.ChassisNumber,
                x.EngineNumber,
                x.FuelType,
                x.CurrentOdometerKm,
                x.DefaultDriverId,
                x.OrganizationDepartmentId,
                x.OrganizationBranchId,
                x.OrganizationCostCenterId,
                x.Status,
                x.IsActive,
                x.CreatedOnUtc,
                x.LastModifiedOnUtc
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

    [Authorize(Policy = AuthorizationPolicies.FleetVehicleManage)]
    [HttpPost("vehicles")]
    public async Task<IActionResult> CreateVehicle(
        [FromBody] CreateFleetVehicleRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var code = request.VehicleCode?.Trim().ToUpperInvariant();
        var reg = request.RegistrationNumber?.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { Message = "Vehicle code is required." });
        if (string.IsNullOrWhiteSpace(reg)) return BadRequest(new { Message = "Registration number is required." });

        var duplicateCode = await dbContext.Set<FleetVehicle>()
            .AsNoTracking()
            .AnyAsync(x => x.VehicleCode == code, cancellationToken);
        if (duplicateCode) return Conflict(new { Message = "A fleet vehicle with the same code already exists.", VehicleCode = code });

        var duplicateReg = await dbContext.Set<FleetVehicle>()
            .AsNoTracking()
            .AnyAsync(x => x.RegistrationNumber == reg, cancellationToken);
        if (duplicateReg) return Conflict(new { Message = "A fleet vehicle with the same registration number already exists.", RegistrationNumber = reg });

        var entity = new FleetVehicle(
            Guid.NewGuid(),
            tenantContext.TenantId,
            code,
            reg,
            request.VehicleName,
            request.VehicleType,
            request.Make ?? string.Empty,
            request.Model ?? string.Empty,
            request.YearOfManufacture,
            request.OrganizationDepartmentId,
            request.OrganizationBranchId,
            request.OrganizationCostCenterId,
            request.Notes);

        entity.Update(
            request.VehicleName,
            request.VehicleType,
            request.Make ?? string.Empty,
            request.Model ?? string.Empty,
            request.YearOfManufacture,
            request.DefaultDriverId,
            request.OrganizationDepartmentId,
            request.OrganizationBranchId,
            request.OrganizationCostCenterId,
            request.ChassisNumber,
            request.EngineNumber,
            request.FuelType,
            request.InsuranceExpiryUtc,
            request.RoadWorthinessExpiryUtc,
            request.LicenseExpiryUtc,
            request.Notes);

        dbContext.Set<FleetVehicle>().Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetVehicle",
            "Created",
            entity.Id,
            entity.VehicleCode,
            $"Fleet vehicle '{entity.VehicleCode}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                entity.VehicleCode,
                entity.RegistrationNumber,
                entity.VehicleName,
                entity.VehicleType,
                entity.Status
            },
            cancellationToken);

        return Ok(new { Message = "Fleet vehicle created successfully.", Vehicle = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetDriverManage)]
    [HttpGet("drivers")]
    public async Task<IActionResult> GetDrivers(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<FleetDriver>()
            .AsNoTracking()
            .OrderBy(x => x.DriverCode)
            .Select(x => new
            {
                x.Id,
                x.DriverCode,
                x.FullName,
                x.LicenseNumber,
                x.PhoneNumber,
                x.LicenseExpiryUtc,
                x.UserAccountId,
                x.OrganizationDepartmentId,
                x.OrganizationBranchId,
                x.OrganizationCostCenterId,
                x.IsActive,
                x.CreatedOnUtc
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

    [Authorize(Policy = AuthorizationPolicies.FleetDriverManage)]
    [HttpPost("drivers")]
    public async Task<IActionResult> CreateDriver(
        [FromBody] CreateFleetDriverRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var code = request.DriverCode?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code)) return BadRequest(new { Message = "Driver code is required." });

        var duplicateCode = await dbContext.Set<FleetDriver>()
            .AsNoTracking()
            .AnyAsync(x => x.DriverCode == code, cancellationToken);
        if (duplicateCode) return Conflict(new { Message = "A fleet driver with the same code already exists.", DriverCode = code });

        var entity = new FleetDriver(
            Guid.NewGuid(),
            tenantContext.TenantId,
            code,
            request.FullName,
            request.LicenseNumber ?? string.Empty,
            request.PhoneNumber ?? string.Empty,
            request.UserAccountId,
            request.OrganizationDepartmentId,
            request.OrganizationBranchId,
            request.OrganizationCostCenterId,
            request.Notes);

        entity.Update(
            request.FullName,
            request.LicenseNumber ?? string.Empty,
            request.PhoneNumber ?? string.Empty,
            request.LicenseExpiryUtc,
            request.UserAccountId,
            request.OrganizationDepartmentId,
            request.OrganizationBranchId,
            request.OrganizationCostCenterId,
            request.Notes);

        dbContext.Set<FleetDriver>().Add(entity);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetDriver",
            "Created",
            entity.Id,
            entity.DriverCode,
            $"Fleet driver '{entity.DriverCode}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { entity.DriverCode, entity.FullName, entity.LicenseNumber, entity.IsActive },
            cancellationToken);

        return Ok(new { Message = "Fleet driver created successfully.", Driver = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetPolicyManage)]
    [HttpGet("policy")]
    public async Task<IActionResult> GetPolicy(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var item = await dbContext.Set<FleetPolicySetting>().AsNoTracking().FirstOrDefaultAsync(cancellationToken);
        return Ok(new
        {
            tenantContextAvailable = true,
            tenantId = tenantContext.TenantId,
            tenantKey = tenantContext.TenantKey,
            item
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetPolicyManage)]
    [HttpPost("policy")]
    public async Task<IActionResult> SavePolicy(
        [FromBody] SaveFleetPolicyRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(
            dbContext,
            new[]
            {
                request.FuelExpenseLedgerAccountId,
                request.MaintenanceExpenseLedgerAccountId,
                request.TripExpenseLedgerAccountId,
                request.PayableOrCashLedgerAccountId
            },
            cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var policy = await dbContext.Set<FleetPolicySetting>().FirstOrDefaultAsync(cancellationToken);

        if (policy is null)
        {
            policy = new FleetPolicySetting(
                Guid.NewGuid(),
                tenantContext.TenantId,
                request.FuelExpenseLedgerAccountId,
                request.MaintenanceExpenseLedgerAccountId,
                request.TripExpenseLedgerAccountId,
                request.PayableOrCashLedgerAccountId,
                request.RequiresMakerCheckerForFuel,
                request.RequiresMakerCheckerForMaintenance,
                request.RequiresTripApproval,
                request.MaxFuelAmountPerEntry,
                request.Notes);

            dbContext.Set<FleetPolicySetting>().Add(policy);
        }
        else
        {
            policy.Update(
                request.FuelExpenseLedgerAccountId,
                request.MaintenanceExpenseLedgerAccountId,
                request.TripExpenseLedgerAccountId,
                request.PayableOrCashLedgerAccountId,
                request.RequiresMakerCheckerForFuel,
                request.RequiresMakerCheckerForMaintenance,
                request.RequiresTripApproval,
                request.MaxFuelAmountPerEntry,
                request.Notes);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetPolicySetting",
            "Saved",
            policy.Id,
            "FLEET-POLICY",
            "Fleet policy setting saved.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                request.FuelExpenseLedgerAccountId,
                request.MaintenanceExpenseLedgerAccountId,
                request.TripExpenseLedgerAccountId,
                request.PayableOrCashLedgerAccountId
            },
            cancellationToken);

        return Ok(new { Message = "Fleet policy saved successfully.", Item = policy });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetTripCreate)]
    [HttpGet("trips")]
    public async Task<IActionResult> GetTrips(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<FleetTrip>()
            .AsNoTracking()
            .OrderByDescending(x => x.TripDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
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

    [Authorize(Policy = AuthorizationPolicies.FleetTripCreate)]
    [HttpPost("trips")]
    public async Task<IActionResult> CreateTrip(
        [FromBody] CreateFleetTripRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();
        if (request.VehicleId == Guid.Empty) return BadRequest(new { Message = "Vehicle is required." });
        if (request.DriverId == Guid.Empty) return BadRequest(new { Message = "Driver is required." });

        var vehicle = await dbContext.Set<FleetVehicle>().FirstOrDefaultAsync(x => x.Id == request.VehicleId, cancellationToken);
        if (vehicle is null) return NotFound(new { Message = "Vehicle was not found.", request.VehicleId });

        var driver = await dbContext.Set<FleetDriver>().FirstOrDefaultAsync(x => x.Id == request.DriverId, cancellationToken);
        if (driver is null) return NotFound(new { Message = "Driver was not found.", request.DriverId });

        var tripNumber = string.IsNullOrWhiteSpace(request.TripNumber)
            ? $"TRIP-{DateTime.UtcNow:yyyyMMddHHmmss}"
            : request.TripNumber.Trim().ToUpperInvariant();

        var duplicate = await dbContext.Set<FleetTrip>()
            .AsNoTracking()
            .AnyAsync(x => x.TripNumber == tripNumber, cancellationToken);
        if (duplicate) return Conflict(new { Message = "A trip with the same number already exists.", TripNumber = tripNumber });

        var entity = new FleetTrip(
            Guid.NewGuid(),
            tenantContext.TenantId,
            tripNumber,
            request.VehicleId,
            request.DriverId,
            request.TripDateUtc == default ? DateTime.UtcNow : request.TripDateUtc,
            request.Origin,
            request.Destination,
            request.StartOdometerKm,
            request.Purpose,
            request.OrganizationDepartmentId,
            request.OrganizationBranchId,
            request.OrganizationCostCenterId,
            request.Notes);

        entity.Update(
            entity.TripDateUtc,
            request.Origin,
            request.Destination,
            request.StartOdometerKm,
            request.EndOdometerKm,
            request.Purpose,
            request.Notes);

        dbContext.Set<FleetTrip>().Add(entity);
        vehicle.SetOdometer(Math.Max(vehicle.CurrentOdometerKm, request.StartOdometerKm));
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetTrip",
            "Created",
            entity.Id,
            entity.TripNumber,
            $"Fleet trip '{entity.TripNumber}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { entity.TripNumber, entity.VehicleId, entity.DriverId, entity.TripDateUtc, entity.Status },
            cancellationToken);

        return Ok(new { Message = "Fleet trip created successfully.", Trip = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetTripSubmit)]
    [HttpPost("trips/{tripId:guid}/submit")]
    public async Task<IActionResult> SubmitTrip(
        Guid tripId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var trip = await dbContext.Set<FleetTrip>().FirstOrDefaultAsync(x => x.Id == tripId, cancellationToken);
        if (trip is null) return NotFound(new { Message = "Trip was not found.", TripId = tripId });

        try
        {
            trip.Submit(User.Identity?.Name ?? "system");
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "fleet",
                "FleetTrip",
                "Submitted",
                trip.Id,
                trip.TripNumber,
                $"Fleet trip '{trip.TripNumber}' submitted.",
                User.Identity?.Name,
                tenantContext.TenantId,
                new { trip.TripNumber, trip.Status, trip.SubmittedBy, trip.SubmittedOnUtc },
                cancellationToken);

            return Ok(new { Message = "Fleet trip submitted successfully.", Trip = trip });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, TripId = tripId, trip.Status });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FleetTripApprove)]
    [HttpPost("trips/{tripId:guid}/approve")]
    public async Task<IActionResult> ApproveTrip(
        Guid tripId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var trip = await dbContext.Set<FleetTrip>().FirstOrDefaultAsync(x => x.Id == tripId, cancellationToken);
        if (trip is null) return NotFound(new { Message = "Trip was not found.", TripId = tripId });

        if (string.Equals(trip.SubmittedBy, User.Identity?.Name, StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { Message = "Maker-checker rule violation. The same user cannot approve this trip.", TripId = tripId });
        }

        try
        {
            trip.Approve(User.Identity?.Name ?? "system");
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "fleet",
                "FleetTrip",
                "Approved",
                trip.Id,
                trip.TripNumber,
                $"Fleet trip '{trip.TripNumber}' approved.",
                User.Identity?.Name,
                tenantContext.TenantId,
                new { trip.TripNumber, trip.Status, trip.ApprovedBy, trip.ApprovedOnUtc },
                cancellationToken);

            return Ok(new { Message = "Fleet trip approved successfully.", Trip = trip });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, TripId = tripId, trip.Status });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FleetTripReject)]
    [HttpPost("trips/{tripId:guid}/reject")]
    public async Task<IActionResult> RejectTrip(
        Guid tripId,
        [FromBody] RejectFleetDocumentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var trip = await dbContext.Set<FleetTrip>().FirstOrDefaultAsync(x => x.Id == tripId, cancellationToken);
        if (trip is null) return NotFound(new { Message = "Trip was not found.", TripId = tripId });

        try
        {
            trip.Reject(User.Identity?.Name ?? "system", request.Reason);
            await dbContext.SaveChangesAsync(cancellationToken);

            await auditTrailWriter.WriteAsync(
                "fleet",
                "FleetTrip",
                "Rejected",
                trip.Id,
                trip.TripNumber,
                $"Fleet trip '{trip.TripNumber}' rejected.",
                User.Identity?.Name,
                tenantContext.TenantId,
                new { trip.TripNumber, trip.Status, trip.RejectedBy, trip.RejectedOnUtc, trip.RejectionReason },
                cancellationToken);

            return Ok(new { Message = "Fleet trip rejected successfully.", Trip = trip });
        }
        catch (Exception ex) when (ex is InvalidOperationException or ArgumentException)
        {
            return Conflict(new { Message = ex.Message, TripId = tripId, trip.Status });
        }
    }

    [Authorize(Policy = AuthorizationPolicies.FleetFuelManage)]
    [HttpGet("fuel-logs")]
    public async Task<IActionResult> GetFuelLogs(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<FleetFuelLog>()
            .AsNoTracking()
            .OrderByDescending(x => x.FuelDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            tenantContextAvailable = true,
            tenantId = tenantContext.TenantId,
            tenantKey = tenantContext.TenantKey,
            count = items.Count,
            items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetFuelManage)]
    [HttpPost("fuel-logs")]
    public async Task<IActionResult> CreateFuelLog(
        [FromBody] CreateFleetFuelLogRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var policy = await dbContext.Set<FleetPolicySetting>().FirstOrDefaultAsync(cancellationToken);
        if (policy is null) return Conflict(new { Message = "Fleet policy must be setup before fuel logs can be created." });

        var vehicle = await dbContext.Set<FleetVehicle>().FirstOrDefaultAsync(x => x.Id == request.VehicleId, cancellationToken);
        if (vehicle is null) return NotFound(new { Message = "Vehicle was not found.", request.VehicleId });

        var logNumber = string.IsNullOrWhiteSpace(request.FuelLogNumber)
            ? $"FUEL-{DateTime.UtcNow:yyyyMMddHHmmss}"
            : request.FuelLogNumber.Trim().ToUpperInvariant();

        if (request.QuantityLitres * request.UnitPrice > policy.MaxFuelAmountPerEntry && policy.MaxFuelAmountPerEntry > 0m)
        {
            return Conflict(new { Message = "Fuel amount exceeds the configured fleet policy maximum per entry.", policy.MaxFuelAmountPerEntry });
        }

        var duplicate = await dbContext.Set<FleetFuelLog>()
            .AsNoTracking()
            .AnyAsync(x => x.FuelLogNumber == logNumber, cancellationToken);
        if (duplicate) return Conflict(new { Message = "A fuel log with the same number already exists.", FuelLogNumber = logNumber });

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(
            dbContext,
            new[]
            {
                request.ExpenseLedgerAccountId == Guid.Empty ? policy.FuelExpenseLedgerAccountId : request.ExpenseLedgerAccountId,
                request.OffsetLedgerAccountId == Guid.Empty ? policy.PayableOrCashLedgerAccountId : request.OffsetLedgerAccountId
            },
            cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var entity = new FleetFuelLog(
            Guid.NewGuid(),
            tenantContext.TenantId,
            logNumber,
            request.VehicleId,
            request.FuelDateUtc == default ? DateTime.UtcNow : request.FuelDateUtc,
            request.QuantityLitres,
            request.UnitPrice,
            request.OdometerKm,
            request.ExpenseLedgerAccountId == Guid.Empty ? policy.FuelExpenseLedgerAccountId : request.ExpenseLedgerAccountId,
            request.OffsetLedgerAccountId == Guid.Empty ? policy.PayableOrCashLedgerAccountId : request.OffsetLedgerAccountId,
            request.VendorName,
            request.Notes);

        dbContext.Set<FleetFuelLog>().Add(entity);
        vehicle.SetOdometer(Math.Max(vehicle.CurrentOdometerKm, request.OdometerKm));
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetFuelLog",
            "Created",
            entity.Id,
            entity.FuelLogNumber,
            $"Fleet fuel log '{entity.FuelLogNumber}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { entity.FuelLogNumber, entity.VehicleId, entity.QuantityLitres, entity.UnitPrice, entity.TotalAmount, entity.Status },
            cancellationToken);

        return Ok(new { Message = "Fleet fuel log created successfully.", FuelLog = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetFuelManage)]
    [HttpPost("fuel-logs/{fuelLogId:guid}/submit")]
    public async Task<IActionResult> SubmitFuelLog(
        Guid fuelLogId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetFuelLog>().FirstOrDefaultAsync(x => x.Id == fuelLogId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Fuel log was not found.", FuelLogId = fuelLogId });

        entity.Submit(User.Identity?.Name ?? "system");
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Fleet fuel log submitted successfully.", FuelLog = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetFuelApprove)]
    [HttpPost("fuel-logs/{fuelLogId:guid}/approve")]
    public async Task<IActionResult> ApproveFuelLog(
        Guid fuelLogId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetFuelLog>().FirstOrDefaultAsync(x => x.Id == fuelLogId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Fuel log was not found.", FuelLogId = fuelLogId });

        if (string.Equals(entity.SubmittedBy, User.Identity?.Name, StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { Message = "Maker-checker rule violation. The same user cannot approve this fuel log.", FuelLogId = fuelLogId });
        }

        entity.Approve(User.Identity?.Name ?? "system");
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Fleet fuel log approved successfully.", FuelLog = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetFuelManage)]
    [HttpPost("fuel-logs/{fuelLogId:guid}/reject")]
    public async Task<IActionResult> RejectFuelLog(
        Guid fuelLogId,
        [FromBody] RejectFleetDocumentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetFuelLog>().FirstOrDefaultAsync(x => x.Id == fuelLogId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Fuel log was not found.", FuelLogId = fuelLogId });

        entity.Reject(User.Identity?.Name ?? "system", request.Reason);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Fleet fuel log rejected successfully.", FuelLog = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetFuelPost)]
    [HttpPost("fuel-logs/{fuelLogId:guid}/post")]
    public async Task<IActionResult> PostFuelLog(
        Guid fuelLogId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetFuelLog>().FirstOrDefaultAsync(x => x.Id == fuelLogId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Fuel log was not found.", FuelLogId = fuelLogId });


        var journalReference = $"FLT-FUEL-{entity.FuelLogNumber}";
        var duplicateJournal = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == journalReference, cancellationToken);
        if (duplicateJournal) return Conflict(new { Message = "A journal entry with the same fleet fuel reference already exists.", Reference = journalReference });

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            entity.FuelDateUtc,
            journalReference,
            $"Fleet fuel posting - {entity.FuelLogNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new List<JournalEntryLine>
            {
                new(Guid.NewGuid(), entity.ExpenseLedgerAccountId, $"Fleet fuel expense - {entity.FuelLogNumber}", entity.TotalAmount, 0m),
                new(Guid.NewGuid(), entity.OffsetLedgerAccountId, $"Fleet fuel offset - {entity.FuelLogNumber}", 0m, entity.TotalAmount)
            },
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);

        var movements = journalEntry.Lines
            .Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount))
            .ToList();

        entity.MarkPosted(journalEntry.Id);
        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetFuelLog",
            "Posted",
            entity.Id,
            entity.FuelLogNumber,
            $"Fleet fuel log '{entity.FuelLogNumber}' posted.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { entity.FuelLogNumber, entity.TotalAmount, JournalEntryId = journalEntry.Id, journalEntry.Reference },
            cancellationToken);

        return Ok(new
        {
            Message = "Fleet fuel log posted successfully.",
            FuelLog = entity,
            JournalEntry = new { journalEntry.Id, journalEntry.Reference, journalEntry.TotalDebit, journalEntry.TotalCredit }
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetMaintenanceManage)]
    [HttpGet("maintenance-work-orders")]
    public async Task<IActionResult> GetMaintenanceWorkOrders(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var items = await dbContext.Set<FleetMaintenanceWorkOrder>()
            .AsNoTracking()
            .OrderByDescending(x => x.WorkOrderDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            tenantContextAvailable = true,
            tenantId = tenantContext.TenantId,
            tenantKey = tenantContext.TenantKey,
            count = items.Count,
            items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetMaintenanceManage)]
    [HttpPost("maintenance-work-orders")]
    public async Task<IActionResult> CreateMaintenanceWorkOrder(
        [FromBody] CreateFleetMaintenanceWorkOrderRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var policy = await dbContext.Set<FleetPolicySetting>().FirstOrDefaultAsync(cancellationToken);
        if (policy is null) return Conflict(new { Message = "Fleet policy must be setup before maintenance work orders can be created." });

        var vehicle = await dbContext.Set<FleetVehicle>().FirstOrDefaultAsync(x => x.Id == request.VehicleId, cancellationToken);
        if (vehicle is null) return NotFound(new { Message = "Vehicle was not found.", request.VehicleId });

        var orderNumber = string.IsNullOrWhiteSpace(request.WorkOrderNumber)
            ? $"MNT-{DateTime.UtcNow:yyyyMMddHHmmss}"
            : request.WorkOrderNumber.Trim().ToUpperInvariant();

        var duplicate = await dbContext.Set<FleetMaintenanceWorkOrder>()
            .AsNoTracking()
            .AnyAsync(x => x.WorkOrderNumber == orderNumber, cancellationToken);
        if (duplicate) return Conflict(new { Message = "A work order with the same number already exists.", WorkOrderNumber = orderNumber });

        var ledgerValidation = await ValidatePostingLedgerAccountsAsync(
            dbContext,
            new[]
            {
                request.ExpenseLedgerAccountId == Guid.Empty ? policy.MaintenanceExpenseLedgerAccountId : request.ExpenseLedgerAccountId,
                request.OffsetLedgerAccountId == Guid.Empty ? policy.PayableOrCashLedgerAccountId : request.OffsetLedgerAccountId
            },
            cancellationToken);
        if (ledgerValidation is not null) return ledgerValidation;

        var entity = new FleetMaintenanceWorkOrder(
            Guid.NewGuid(),
            tenantContext.TenantId,
            orderNumber,
            request.VehicleId,
            request.WorkOrderDateUtc == default ? DateTime.UtcNow : request.WorkOrderDateUtc,
            request.IssueDescription,
            request.EstimatedAmount,
            request.ExpenseLedgerAccountId == Guid.Empty ? policy.MaintenanceExpenseLedgerAccountId : request.ExpenseLedgerAccountId,
            request.OffsetLedgerAccountId == Guid.Empty ? policy.PayableOrCashLedgerAccountId : request.OffsetLedgerAccountId,
            request.WorkshopVendorName,
            request.Notes);

        entity.Update(
            request.IssueDescription,
            request.EstimatedAmount,
            request.ActualAmount,
            request.WorkshopVendorName,
            request.Notes);

        dbContext.Set<FleetMaintenanceWorkOrder>().Add(entity);
        vehicle.MarkUnderMaintenance();
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetMaintenanceWorkOrder",
            "Created",
            entity.Id,
            entity.WorkOrderNumber,
            $"Fleet maintenance work order '{entity.WorkOrderNumber}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { entity.WorkOrderNumber, entity.VehicleId, entity.EstimatedAmount, entity.ActualAmount, entity.Status },
            cancellationToken);

        return Ok(new { Message = "Fleet maintenance work order created successfully.", WorkOrder = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetMaintenanceSubmit)]
    [HttpPost("maintenance-work-orders/{workOrderId:guid}/submit")]
    public async Task<IActionResult> SubmitMaintenanceWorkOrder(
        Guid workOrderId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetMaintenanceWorkOrder>().FirstOrDefaultAsync(x => x.Id == workOrderId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Work order was not found.", WorkOrderId = workOrderId });

        entity.Submit(User.Identity?.Name ?? "system");
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Fleet maintenance work order submitted successfully.", WorkOrder = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetMaintenanceApprove)]
    [HttpPost("maintenance-work-orders/{workOrderId:guid}/approve")]
    public async Task<IActionResult> ApproveMaintenanceWorkOrder(
        Guid workOrderId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetMaintenanceWorkOrder>().FirstOrDefaultAsync(x => x.Id == workOrderId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Work order was not found.", WorkOrderId = workOrderId });

        if (string.Equals(entity.SubmittedBy, User.Identity?.Name, StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { Message = "Maker-checker rule violation. The same user cannot approve this work order.", WorkOrderId = workOrderId });
        }

        entity.Approve(User.Identity?.Name ?? "system");
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Fleet maintenance work order approved successfully.", WorkOrder = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetMaintenanceReject)]
    [HttpPost("maintenance-work-orders/{workOrderId:guid}/reject")]
    public async Task<IActionResult> RejectMaintenanceWorkOrder(
        Guid workOrderId,
        [FromBody] RejectFleetDocumentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetMaintenanceWorkOrder>().FirstOrDefaultAsync(x => x.Id == workOrderId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Work order was not found.", WorkOrderId = workOrderId });

        entity.Reject(User.Identity?.Name ?? "system", request.Reason);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Fleet maintenance work order rejected successfully.", WorkOrder = entity });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetMaintenancePost)]
    [HttpPost("maintenance-work-orders/{workOrderId:guid}/post")]
    public async Task<IActionResult> PostMaintenanceWorkOrder(
        Guid workOrderId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var entity = await dbContext.Set<FleetMaintenanceWorkOrder>().FirstOrDefaultAsync(x => x.Id == workOrderId, cancellationToken);
        if (entity is null) return NotFound(new { Message = "Work order was not found.", WorkOrderId = workOrderId });

        var postingAmount = entity.ResolvePostingAmount();
        if (postingAmount <= 0m)
        {
            return Conflict(new { Message = "Maintenance work order posting amount must be greater than zero.", WorkOrderId = workOrderId });
        }


        var journalReference = $"FLT-MNT-{entity.WorkOrderNumber}";
        var duplicateJournal = await dbContext.JournalEntries
            .AsNoTracking()
            .AnyAsync(x => x.Reference == journalReference, cancellationToken);
        if (duplicateJournal) return Conflict(new { Message = "A journal entry with the same fleet maintenance reference already exists.", Reference = journalReference });

        var journalEntry = new JournalEntry(
            Guid.NewGuid(),
            tenantContext.TenantId,
            entity.WorkOrderDateUtc,
            journalReference,
            $"Fleet maintenance posting - {entity.WorkOrderNumber}",
            JournalEntryStatus.Draft,
            JournalEntryType.Normal,
            new List<JournalEntryLine>
            {
                new(Guid.NewGuid(), entity.ExpenseLedgerAccountId, $"Fleet maintenance expense - {entity.WorkOrderNumber}", postingAmount, 0m),
                new(Guid.NewGuid(), entity.OffsetLedgerAccountId, $"Fleet maintenance offset - {entity.WorkOrderNumber}", 0m, postingAmount)
            },
            postingRequiresApproval: false);

        journalEntry.MarkPosted(DateTime.UtcNow);

        var movements = journalEntry.Lines
            .Select(line => new LedgerMovement(
                Guid.NewGuid(),
                tenantContext.TenantId,
                journalEntry.Id,
                line.Id,
                line.LedgerAccountId,
                journalEntry.EntryDateUtc,
                journalEntry.Reference,
                line.Description,
                line.DebitAmount,
                line.CreditAmount))
            .ToList();

        entity.MarkPosted(journalEntry.Id);
        dbContext.JournalEntries.Add(journalEntry);
        dbContext.LedgerMovements.AddRange(movements);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "fleet",
            "FleetMaintenanceWorkOrder",
            "Posted",
            entity.Id,
            entity.WorkOrderNumber,
            $"Fleet maintenance work order '{entity.WorkOrderNumber}' posted.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new { entity.WorkOrderNumber, PostingAmount = postingAmount, JournalEntryId = journalEntry.Id, journalEntry.Reference },
            cancellationToken);

        return Ok(new
        {
            Message = "Fleet maintenance work order posted successfully.",
            WorkOrder = entity,
            JournalEntry = new { journalEntry.Id, journalEntry.Reference, journalEntry.TotalDebit, journalEntry.TotalCredit }
        });
    }

    [Authorize(Policy = AuthorizationPolicies.FleetReportsView)]
    [HttpGet("reports/vehicle-costing")]
    public async Task<IActionResult> GetVehicleCostingReport(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable) return TenantRequired();

        var vehicles = await dbContext.Set<FleetVehicle>().AsNoTracking().ToDictionaryAsync(x => x.Id, cancellationToken);
        var fuel = await dbContext.Set<FleetFuelLog>().AsNoTracking().Where(x => x.Status == FleetPostingStatus.Posted).ToListAsync(cancellationToken);
        var maintenance = await dbContext.Set<FleetMaintenanceWorkOrder>().AsNoTracking().Where(x => x.Status == FleetPostingStatus.Posted).ToListAsync(cancellationToken);
        var trips = await dbContext.Set<FleetTrip>().AsNoTracking().Where(x => x.Status == FleetTripStatus.Posted).ToListAsync(cancellationToken);

        var items = vehicles.Values
            .OrderBy(x => x.VehicleCode)
            .Select(vehicle => new
            {
                vehicle.Id,
                vehicle.VehicleCode,
                vehicle.RegistrationNumber,
                vehicle.VehicleName,
                FuelAmount = fuel.Where(x => x.VehicleId == vehicle.Id).Sum(x => x.TotalAmount),
                MaintenanceAmount = maintenance.Where(x => x.VehicleId == vehicle.Id).Sum(x => x.ResolvePostingAmount()),
                TripCount = trips.Count(x => x.VehicleId == vehicle.Id),
                DistanceKm = trips.Where(x => x.VehicleId == vehicle.Id).Sum(x => x.DistanceKm)
            })
            .ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            Count = items.Count,
            TotalFuelAmount = items.Sum(x => x.FuelAmount),
            TotalMaintenanceAmount = items.Sum(x => x.MaintenanceAmount),
            TotalTripCount = items.Sum(x => x.TripCount),
            TotalDistanceKm = items.Sum(x => x.DistanceKm),
            Items = items
        });
    }

    private static async Task<ObjectResult?> ValidatePostingLedgerAccountsAsync(
        ApplicationDbContext dbContext,
        IEnumerable<Guid> ledgerAccountIds,
        CancellationToken cancellationToken)
    {
        var requested = ledgerAccountIds.Where(x => x != Guid.Empty).Distinct().ToList();
        var items = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requested.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (items.Count != requested.Count)
        {
            return new BadRequestObjectResult(new { Message = "One or more posting ledger accounts were not found for the current tenant." });
        }

        foreach (var account in items)
        {
            if (!account.IsActive || account.IsHeader || !account.IsPostingAllowed)
            {
                return new BadRequestObjectResult(new
                {
                    Message = "All posting ledger accounts must be active, non-header, posting-enabled ledger accounts.",
                    account.Id,
                    account.Code
                });
            }
        }

        return null;
    }

    private IActionResult TenantRequired() =>
        BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });

    public sealed record CreateFleetVehicleRequest(
        string VehicleCode,
        string RegistrationNumber,
        string VehicleName,
        string VehicleType,
        string? Make,
        string? Model,
        int YearOfManufacture,
        string? ChassisNumber,
        string? EngineNumber,
        string? FuelType,
        Guid? DefaultDriverId,
        Guid? OrganizationDepartmentId,
        Guid? OrganizationBranchId,
        Guid? OrganizationCostCenterId,
        DateTime? InsuranceExpiryUtc,
        DateTime? RoadWorthinessExpiryUtc,
        DateTime? LicenseExpiryUtc,
        string? Notes);

    public sealed record CreateFleetDriverRequest(
        string DriverCode,
        string FullName,
        string? LicenseNumber,
        string? PhoneNumber,
        DateTime? LicenseExpiryUtc,
        Guid? UserAccountId,
        Guid? OrganizationDepartmentId,
        Guid? OrganizationBranchId,
        Guid? OrganizationCostCenterId,
        string? Notes);

    public sealed record SaveFleetPolicyRequest(
        Guid FuelExpenseLedgerAccountId,
        Guid MaintenanceExpenseLedgerAccountId,
        Guid TripExpenseLedgerAccountId,
        Guid PayableOrCashLedgerAccountId,
        bool RequiresMakerCheckerForFuel,
        bool RequiresMakerCheckerForMaintenance,
        bool RequiresTripApproval,
        decimal MaxFuelAmountPerEntry,
        string? Notes);

    public sealed record CreateFleetTripRequest(
        string? TripNumber,
        Guid VehicleId,
        Guid DriverId,
        DateTime TripDateUtc,
        string Origin,
        string Destination,
        decimal StartOdometerKm,
        decimal? EndOdometerKm,
        string Purpose,
        Guid? OrganizationDepartmentId,
        Guid? OrganizationBranchId,
        Guid? OrganizationCostCenterId,
        string? Notes);

    public sealed record CreateFleetFuelLogRequest(
        string? FuelLogNumber,
        Guid VehicleId,
        DateTime FuelDateUtc,
        decimal QuantityLitres,
        decimal UnitPrice,
        decimal OdometerKm,
        Guid ExpenseLedgerAccountId,
        Guid OffsetLedgerAccountId,
        string? VendorName,
        string? Notes);

    public sealed record CreateFleetMaintenanceWorkOrderRequest(
        string? WorkOrderNumber,
        Guid VehicleId,
        DateTime WorkOrderDateUtc,
        string IssueDescription,
        decimal EstimatedAmount,
        decimal? ActualAmount,
        Guid ExpenseLedgerAccountId,
        Guid OffsetLedgerAccountId,
        string? WorkshopVendorName,
        string? Notes);

    public sealed record RejectFleetDocumentRequest(string Reason);
}
