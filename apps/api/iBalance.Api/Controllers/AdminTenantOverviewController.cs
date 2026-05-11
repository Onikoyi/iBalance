using iBalance.Api.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/admin/tenant-overview")]
public sealed class AdminTenantOverviewController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
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

        var platformAdminCount = users.Count(x => x.Role == "PlatformAdmin");
        var tenantAdminCount = users.Count(x => x.Role == "TenantAdmin");
        var financeControllerCount = users.Count(x => x.Role == "FinanceController");
        var accountantCount = users.Count(x => x.Role == "Accountant");
        var approverCount = users.Count(x => x.Role == "Approver");
        var viewerCount = users.Count(x => x.Role == "Viewer");
        var auditorCount = users.Count(x => x.Role == "Auditor");
        var budgetOfficerCount = users.Count(x => x.Role == "BudgetOfficer");
        var budgetOwnerCount = users.Count(x => x.Role == "BudgetOwner");
        var payrollOfficerCount = users.Count(x => x.Role == "PayrollOfficer");
        var hrOfficerCount = users.Count(x => x.Role == "HrOfficer");
        var procurementOfficerCount = users.Count(x => x.Role == "ProcurementOfficer");
        var treasuryOfficerCount = users.Count(x => x.Role == "TreasuryOfficer");
        var inventoryOfficerCount = users.Count(x => x.Role == "InventoryOfficer");
        var apOfficerCount = users.Count(x => x.Role == "ApOfficer");
        var arOfficerCount = users.Count(x => x.Role == "ArOfficer");
        var fixedAssetOfficerCount = users.Count(x => x.Role == "FixedAssetOfficer");

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
                    FinanceController = financeControllerCount,
                    Accountant = accountantCount,
                    Approver = approverCount,
                    Viewer = viewerCount,
                    Auditor = auditorCount,
                    BudgetOfficer = budgetOfficerCount,
                    BudgetOwner = budgetOwnerCount,
                    PayrollOfficer = payrollOfficerCount,
                    HrOfficer = hrOfficerCount,
                    ProcurementOfficer = procurementOfficerCount,
                    TreasuryOfficer = treasuryOfficerCount,
                    InventoryOfficer = inventoryOfficerCount,
                    ApOfficer = apOfficerCount,
                    ArOfficer = arOfficerCount,
                    FixedAssetOfficer = fixedAssetOfficerCount
                }
            }
        });
    }
}
