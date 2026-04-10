using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin")]
[Route("api/admin/platform/tenants")]
public sealed class PlatformAdminTenantsController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetTenants(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var tenants = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Name,
                x.Key,
                x.Status
            })
            .ToListAsync(cancellationToken);

        var licenses = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var users = await dbContext.UserAccounts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Select(x => new
            {
                x.TenantId,
                x.Role,
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        var utcNow = DateTime.UtcNow;

        var items = tenants.Select(tenant =>
        {
            var tenantLicense = licenses
                .Where(x => x.TenantId == tenant.Id)
                .OrderByDescending(x => x.LicenseEndDateUtc)
                .FirstOrDefault();

            var tenantUsers = users
                .Where(x => x.TenantId == tenant.Id)
                .ToList();

            var totalUsers = tenantUsers.Count;
            var activeUsers = tenantUsers.Count(x => x.IsActive);
            var inactiveUsers = tenantUsers.Count(x => !x.IsActive);

            var tenantAdmins = tenantUsers.Count(x => x.Role == "TenantAdmin");
            var accountants = tenantUsers.Count(x => x.Role == "Accountant");
            var approvers = tenantUsers.Count(x => x.Role == "Approver");
            var viewers = tenantUsers.Count(x => x.Role == "Viewer");
            var platformAdmins = tenantUsers.Count(x => x.Role == "PlatformAdmin");

            TenantLicenseStatus licenseStatus;
            int? daysRemaining = null;

            if (tenantLicense is null)
            {
                licenseStatus = TenantLicenseStatus.Expired;
            }
            else if (tenant.Status != TenantStatus.Active)
            {
                licenseStatus = TenantLicenseStatus.Suspended;
                daysRemaining = tenantLicense.GetDaysRemaining(utcNow);
            }
            else
            {
                licenseStatus = tenantLicense.GetStatus(utcNow);
                daysRemaining = tenantLicense.GetDaysRemaining(utcNow);
            }

            var renewalWarning = tenantLicense is null
                ? "License record not configured."
                : licenseStatus switch
                {
                    TenantLicenseStatus.Active => "Subscription is active.",
                    TenantLicenseStatus.ExpiringSoon => "Subscription renewal is due soon.",
                    TenantLicenseStatus.Expired => "Subscription has expired.",
                    TenantLicenseStatus.Suspended => "Subscription is suspended or tenant access is not active.",
                    _ => "Subscription status is unavailable."
                };

            return new
            {
                TenantId = tenant.Id,
                TenantName = tenant.Name,
                TenantKey = tenant.Key,
                TenantStatus = tenant.Status,
                License = new
                {
                    IsConfigured = tenantLicense is not null,
                    PackageName = tenantLicense?.PackageName,
                    AmountPaid = tenantLicense?.AmountPaid,
                    CurrencyCode = tenantLicense?.CurrencyCode,
                    LicenseStartDateUtc = tenantLicense?.LicenseStartDateUtc,
                    LicenseEndDateUtc = tenantLicense?.LicenseEndDateUtc,
                    LicenseStatus = licenseStatus,
                    DaysRemaining = daysRemaining,
                    RenewalWarning = renewalWarning
                },
                Users = new
                {
                    Total = totalUsers,
                    Active = activeUsers,
                    Inactive = inactiveUsers,
                    ByRole = new
                    {
                        PlatformAdmin = platformAdmins,
                        TenantAdmin = tenantAdmins,
                        Accountant = accountants,
                        Approver = approvers,
                        Viewer = viewers
                    }
                }
            };
        }).ToList();

        return Ok(new
        {
            Count = items.Count,
            Items = items
        });
    }
}