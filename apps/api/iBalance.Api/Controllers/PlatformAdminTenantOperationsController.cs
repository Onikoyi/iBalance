using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin")]
[Route("api/admin/platform/tenants")]
public sealed class PlatformAdminTenantOperationsController : ControllerBase
{
    [HttpGet("{tenantId:guid}")]
    public async Task<IActionResult> GetTenantDetail(
        Guid tenantId,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "The selected tenant was not found."
            });
        }

        var license = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var users = await dbContext.UserAccounts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderBy(x => x.FirstName)
            .ThenBy(x => x.LastName)
            .Select(x => new
            {
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                DisplayName = x.FullName,
                x.Role,
                x.IsActive,
                x.CreatedOnUtc,
                x.LastModifiedOnUtc
            })
            .ToListAsync(cancellationToken);

        var utcNow = DateTime.UtcNow;

        TenantLicenseStatus licenseStatus;
        int? daysRemaining = null;

        if (license is null)
        {
            licenseStatus = TenantLicenseStatus.Expired;
        }
        else if (tenant.Status != TenantStatus.Active)
        {
            licenseStatus = TenantLicenseStatus.Suspended;
            daysRemaining = license.GetDaysRemaining(utcNow);
        }
        else
        {
            licenseStatus = license.GetStatus(utcNow);
            daysRemaining = license.GetDaysRemaining(utcNow);
        }

        return Ok(new
        {
            Tenant = new
            {
                tenant.Id,
                tenant.Name,
                tenant.Key,
                tenant.Status
            },
            License = new
            {
                IsConfigured = license is not null,
                PackageName = license?.PackageName,
                AmountPaid = license?.AmountPaid,
                CurrencyCode = license?.CurrencyCode,
                LicenseStartDateUtc = license?.LicenseStartDateUtc,
                LicenseEndDateUtc = license?.LicenseEndDateUtc,
                LicenseStatus = licenseStatus,
                DaysRemaining = daysRemaining
            },
            Users = new
            {
                Count = users.Count,
                Items = users
            }
        });
    }

    [HttpPost("{tenantId:guid}/renew-license")]
    public async Task<IActionResult> RenewLicense(
        Guid tenantId,
        [FromBody] RenewTenantLicenseRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "The selected tenant was not found."
            });
        }

        var license = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (license is null)
        {
            return NotFound(new
            {
                Message = "No subscription record was found for the selected tenant."
            });
        }

        if (request.NewEndDateUtc <= request.NewStartDateUtc)
        {
            return BadRequest(new
            {
                Message = "The subscription end date must be later than the start date."
            });
        }

        if (request.AmountPaid < 0m)
        {
            return BadRequest(new
            {
                Message = "The subscription amount cannot be negative."
            });
        }

        var originalTenantContext = tenantContextAccessor.Current;

        tenantContextAccessor.SetTenant(tenant.Id, tenant.Key);

        dbContext.Entry(license).Property(nameof(license.LicenseStartDateUtc)).CurrentValue = request.NewStartDateUtc;
        dbContext.Entry(license).Property(nameof(license.LicenseEndDateUtc)).CurrentValue = request.NewEndDateUtc;
        dbContext.Entry(license).Property(nameof(license.AmountPaid)).CurrentValue = request.AmountPaid;
        dbContext.Entry(license).Property(nameof(license.CurrencyCode)).CurrentValue =
            string.IsNullOrWhiteSpace(request.CurrencyCode)
                ? "NGN"
                : request.CurrencyCode.Trim().ToUpperInvariant();

        if (tenant.Status != TenantStatus.Active)
        {
            tenant.Activate();
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        if (originalTenantContext.IsAvailable)
        {
            tenantContextAccessor.SetTenant(originalTenantContext.TenantId, originalTenantContext.TenantKey);
        }

        return Ok(new
        {
            Message = "The tenant subscription has been renewed successfully.",
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            TenantKey = tenant.Key,
            tenant.Status,
            license.PackageName,
            license.AmountPaid,
            license.CurrencyCode,
            license.LicenseStartDateUtc,
            license.LicenseEndDateUtc,
            LicenseStatus = license.GetStatus(DateTime.UtcNow),
            DaysRemaining = license.GetDaysRemaining(DateTime.UtcNow)
        });
    }

    [HttpPost("{tenantId:guid}/change-package")]
    public async Task<IActionResult> ChangePackage(
        Guid tenantId,
        [FromBody] ChangeTenantPackageRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "The selected tenant was not found."
            });
        }

        var license = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (license is null)
        {
            return NotFound(new
            {
                Message = "No subscription record was found for the selected tenant."
            });
        }

        var package = await dbContext.SubscriptionPackages
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.SubscriptionPackageId, cancellationToken);

        if (package is null)
        {
            return NotFound(new
            {
                Message = "The selected subscription package was not found."
            });
        }

        var originalTenantContext = tenantContextAccessor.Current;

        tenantContextAccessor.SetTenant(tenant.Id, tenant.Key);

        dbContext.Entry(license).Property(nameof(license.PackageName)).CurrentValue = package.Name;
        dbContext.Entry(license).Property(nameof(license.AmountPaid)).CurrentValue = package.MonthlyPrice;
        dbContext.Entry(license).Property(nameof(license.CurrencyCode)).CurrentValue = package.CurrencyCode;

        await dbContext.SaveChangesAsync(cancellationToken);

        if (originalTenantContext.IsAvailable)
        {
            tenantContextAccessor.SetTenant(originalTenantContext.TenantId, originalTenantContext.TenantKey);
        }

        return Ok(new
        {
            Message = "The tenant subscription package has been updated successfully.",
            TenantId = tenant.Id,
            TenantName = tenant.Name,
            TenantKey = tenant.Key,
            PackageName = package.Name,
            AmountPaid = license.AmountPaid,
            CurrencyCode = license.CurrencyCode,
            LicenseStartDateUtc = license.LicenseStartDateUtc,
            LicenseEndDateUtc = license.LicenseEndDateUtc
        });
    }

    [HttpPost("{tenantId:guid}/suspend")]
    public async Task<IActionResult> SuspendTenant(
        Guid tenantId,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "The selected tenant was not found."
            });
        }

        tenant.Suspend();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "The tenant has been suspended successfully.",
            tenant.Id,
            tenant.Name,
            tenant.Key,
            tenant.Status
        });
    }

    [HttpPost("{tenantId:guid}/reactivate")]
    public async Task<IActionResult> ReactivateTenant(
        Guid tenantId,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "The selected tenant was not found."
            });
        }

        tenant.Activate();
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "The tenant has been reactivated successfully.",
            tenant.Id,
            tenant.Name,
            tenant.Key,
            tenant.Status
        });
    }

    public sealed record RenewTenantLicenseRequest(
        DateTime NewStartDateUtc,
        DateTime NewEndDateUtc,
        decimal AmountPaid,
        string CurrencyCode);

    public sealed record ChangeTenantPackageRequest(
        Guid SubscriptionPackageId);
}