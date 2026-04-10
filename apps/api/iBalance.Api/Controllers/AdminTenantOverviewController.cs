using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin,TenantAdmin")]
[Route("api/admin/tenant-overview")]
public sealed class AdminTenantOverviewController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetTenantOverview(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new
            {
                Message = "Tenant context is required.",
                RequiredHeader = "X-Tenant-Key"
            });
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantContext.TenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "Tenant was not found."
            });
        }

        var license = await dbContext.TenantLicenses
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        var users = await dbContext.UserAccounts
            .AsNoTracking()
            .Select(x => new
            {
                x.Id,
                x.Role,
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        var userCount = users.Count;
        var activeUserCount = users.Count(x => x.IsActive);
        var inactiveUserCount = users.Count(x => !x.IsActive);

        var tenantAdminCount = users.Count(x => x.Role == "TenantAdmin");
        var accountantCount = users.Count(x => x.Role == "Accountant");
        var approverCount = users.Count(x => x.Role == "Approver");
        var viewerCount = users.Count(x => x.Role == "Viewer");
        var platformAdminCount = users.Count(x => x.Role == "PlatformAdmin");

        TenantLicenseStatus computedLicenseStatus;
        int? daysRemaining = null;

        if (license is null)
        {
            computedLicenseStatus = TenantLicenseStatus.Expired;
        }
        else if (tenant.Status != TenantStatus.Active)
        {
            computedLicenseStatus = TenantLicenseStatus.Suspended;
            daysRemaining = license.GetDaysRemaining(DateTime.UtcNow);
        }
        else
        {
            computedLicenseStatus = license.GetStatus(DateTime.UtcNow);
            daysRemaining = license.GetDaysRemaining(DateTime.UtcNow);
        }

        var renewalWarning = license is null
            ? "Tenant license is not configured."
            : computedLicenseStatus switch
            {
                TenantLicenseStatus.Active => "Tenant license is active.",
                TenantLicenseStatus.ExpiringSoon => "Tenant license is approaching expiry and requires renewal planning.",
                TenantLicenseStatus.Expired => "Tenant license has expired and tenant access should be treated as blocked.",
                TenantLicenseStatus.Suspended => "Tenant license is suspended or tenant status is not active.",
                _ => "Tenant license status is unknown."
            };

        return Ok(new
        {
            TenantId = tenant.Id,
            TenantKey = tenant.Key,
            TenantName = tenant.Name,
            TenantStatus = tenant.Status,
            PackageName = license?.PackageName,
            AmountPaid = license?.AmountPaid,
            CurrencyCode = license?.CurrencyCode,
            LicenseStartDateUtc = license?.LicenseStartDateUtc,
            LicenseEndDateUtc = license?.LicenseEndDateUtc,
            LicenseStatus = computedLicenseStatus,
            DaysRemaining = daysRemaining,
            RenewalWarning = renewalWarning,
            Users = new
            {
                Total = userCount,
                Active = activeUserCount,
                Inactive = inactiveUserCount,
                ByRole = new
                {
                    PlatformAdmin = platformAdminCount,
                    TenantAdmin = tenantAdminCount,
                    Accountant = accountantCount,
                    Approver = approverCount,
                    Viewer = viewerCount
                }
            }
        });
    }
}