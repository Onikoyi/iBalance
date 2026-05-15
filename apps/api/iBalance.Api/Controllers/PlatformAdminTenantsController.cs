using iBalance.Api.Security;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/admin/platform/tenants")]
public sealed class PlatformAdminTenantsController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
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

            var platformAdmins = tenantUsers.Count(x => x.Role == "PlatformAdmin");
            var tenantAdmins = tenantUsers.Count(x => x.Role == "TenantAdmin");
            var financeControllers = tenantUsers.Count(x => x.Role == "FinanceController");
            var accountants = tenantUsers.Count(x => x.Role == "Accountant");
            var approvers = tenantUsers.Count(x => x.Role == "Approver");
            var viewers = tenantUsers.Count(x => x.Role == "Viewer");
            var auditors = tenantUsers.Count(x => x.Role == "Auditor");
            var budgetOfficers = tenantUsers.Count(x => x.Role == "BudgetOfficer");
            var budgetOwners = tenantUsers.Count(x => x.Role == "BudgetOwner");
            var payrollOfficers = tenantUsers.Count(x => x.Role == "PayrollOfficer");
            var hrOfficers = tenantUsers.Count(x => x.Role == "HrOfficer");
            var procurementOfficers = tenantUsers.Count(x => x.Role == "ProcurementOfficer");
            var treasuryOfficers = tenantUsers.Count(x => x.Role == "TreasuryOfficer");
            var inventoryOfficers = tenantUsers.Count(x => x.Role == "InventoryOfficer");
            var apOfficers = tenantUsers.Count(x => x.Role == "ApOfficer");
            var arOfficers = tenantUsers.Count(x => x.Role == "ArOfficer");
            var fixedAssetOfficers = tenantUsers.Count(x => x.Role == "FixedAssetOfficer");
            var expenseAdvanceOfficers = tenantUsers.Count(x => x.Role == "ExpenseAdvanceOfficer");
            var expenseAdvanceApprovers = tenantUsers.Count(x => x.Role == "ExpenseAdvanceApprover");
            var expenseAdvanceReviewers = tenantUsers.Count(x => x.Role == "ExpenseAdvanceReviewer");
            var expenseAdvanceViewers = tenantUsers.Count(x => x.Role == "ExpenseAdvanceViewer");
            var fleetOfficers = tenantUsers.Count(x => x.Role == "FleetOfficer");
            var fleetApprovers = tenantUsers.Count(x => x.Role == "FleetApprover");
            var fleetReviewers = tenantUsers.Count(x => x.Role == "FleetReviewer");
            var fleetViewers = tenantUsers.Count(x => x.Role == "FleetViewer");

            var (licenseStatus, daysRemaining, renewalWarning) =
                ComputeLicenseSummary(tenant.Status, tenantLicense, utcNow);

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
                        FinanceController = financeControllers,
                        Accountant = accountants,
                        Approver = approvers,
                        Viewer = viewers,
                        Auditor = auditors,
                        BudgetOfficer = budgetOfficers,
                        BudgetOwner = budgetOwners,
                        PayrollOfficer = payrollOfficers,
                        HrOfficer = hrOfficers,
                        ProcurementOfficer = procurementOfficers,
                        TreasuryOfficer = treasuryOfficers,
                        InventoryOfficer = inventoryOfficers,
                        ApOfficer = apOfficers,
                        ArOfficer = arOfficers,
                        FixedAssetOfficer = fixedAssetOfficers,
                        ExpenseAdvanceOfficer = expenseAdvanceOfficers,
                        ExpenseAdvanceApprover = expenseAdvanceApprovers,
                        ExpenseAdvanceReviewer = expenseAdvanceReviewers,
                        ExpenseAdvanceViewer = expenseAdvanceViewers,
                        FleetOfficer = fleetOfficers,
                        FleetApprover = fleetApprovers,
                        FleetReviewer = fleetReviewers,
                        FleetViewer = fleetViewers
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

    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
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
                Message = "Tenant was not found.",
                TenantId = tenantId
            });
        }

        var license = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var userRows = await dbContext.UserAccounts
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.FirstName)
            .ThenBy(x => x.LastName)
            .ThenBy(x => x.Email)
            .Select(x => new
            {
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                x.Role,
                x.IsActive,
                x.CreatedOnUtc,
                x.LastModifiedOnUtc
            })
            .ToListAsync(cancellationToken);

        var users = userRows
            .Select(x => new
            {
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                DisplayName = $"{x.FirstName} {x.LastName}".Trim(),
                x.Role,
                x.IsActive,
                x.CreatedOnUtc,
                x.LastModifiedOnUtc
            })
            .ToList();

        var (licenseStatus, daysRemaining, _) =
            ComputeLicenseSummary(tenant.Status, license, DateTime.UtcNow);

        return Ok(new
        {
            Tenant = new
            {
                Id = tenant.Id,
                Name = tenant.Name,
                Key = tenant.Key,
                Status = tenant.Status
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

    [Authorize(Policy = AuthorizationPolicies.AdminSettingsManage)]
    [HttpPost("{tenantId:guid}/renew-license")]
    public async Task<IActionResult> RenewLicense(
        Guid tenantId,
        [FromBody] RenewTenantLicenseRequest request,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CurrencyCode))
        {
            return BadRequest(new { Message = "Currency code is required." });
        }

        if (request.NewEndDateUtc < request.NewStartDateUtc)
        {
            return BadRequest(new { Message = "The subscription end date must be later than the start date." });
        }

        if (request.AmountPaid < 0m)
        {
            return BadRequest(new { Message = "Amount paid cannot be negative." });
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "Tenant was not found.",
                TenantId = tenantId
            });
        }

        var existingLicense = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingLicense is null)
        {
            return NotFound(new
            {
                Message = "Tenant license was not found.",
                TenantId = tenantId
            });
        }

        existingLicense.Renew(
            request.NewStartDateUtc,
            request.NewEndDateUtc,
            existingLicense.PackageName,
            request.AmountPaid,
            request.CurrencyCode.Trim().ToUpperInvariant());

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Tenant subscription renewed successfully.",
            TenantId = tenant.Id,
            PackageName = existingLicense.PackageName,
            LicenseStartDateUtc = existingLicense.LicenseStartDateUtc,
            LicenseEndDateUtc = existingLicense.LicenseEndDateUtc,
            AmountPaid = existingLicense.AmountPaid,
            CurrencyCode = existingLicense.CurrencyCode
        });
    }

    [Authorize(Policy = AuthorizationPolicies.AdminSettingsManage)]
    [HttpPost("{tenantId:guid}/change-package")]
    public async Task<IActionResult> ChangePackage(
        Guid tenantId,
        [FromBody] ChangeTenantPackageRequest request,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (request.SubscriptionPackageId == Guid.Empty)
        {
            return BadRequest(new { Message = "Subscription package is required." });
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new
            {
                Message = "Tenant was not found.",
                TenantId = tenantId
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
                Message = "Subscription package was not found.",
                SubscriptionPackageId = request.SubscriptionPackageId
            });
        }

        var existingLicense = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (existingLicense is null)
        {
            return NotFound(new
            {
                Message = "Tenant license was not found.",
                TenantId = tenantId
            });
        }

        existingLicense.Renew(
            existingLicense.LicenseStartDateUtc,
            existingLicense.LicenseEndDateUtc,
            package.Name,
            existingLicense.AmountPaid,
            existingLicense.CurrencyCode);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Tenant subscription package updated successfully.",
            TenantId = tenant.Id,
            PackageName = existingLicense.PackageName,
            LicenseStartDateUtc = existingLicense.LicenseStartDateUtc,
            LicenseEndDateUtc = existingLicense.LicenseEndDateUtc,
            AmountPaid = existingLicense.AmountPaid,
            CurrencyCode = existingLicense.CurrencyCode
        });
    }

    [Authorize(Policy = AuthorizationPolicies.AdminSettingsManage)]
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
                Message = "Tenant was not found.",
                TenantId = tenantId
            });
        }

        var license = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        tenant.Suspend();
        license?.Suspend();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Tenant suspended successfully.",
            TenantId = tenant.Id,
            TenantStatus = tenant.Status
        });
    }

    [Authorize(Policy = AuthorizationPolicies.AdminSettingsManage)]
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
                Message = "Tenant was not found.",
                TenantId = tenantId
            });
        }

        var license = await dbContext.TenantLicenses
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId)
            .OrderByDescending(x => x.LicenseEndDateUtc)
            .FirstOrDefaultAsync(cancellationToken);

        tenant.Activate();
        license?.Unsuspend();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Tenant reactivated successfully.",
            TenantId = tenant.Id,
            TenantStatus = tenant.Status
        });
    }

    private static (TenantLicenseStatus LicenseStatus, int? DaysRemaining, string RenewalWarning) ComputeLicenseSummary(
        TenantStatus tenantStatus,
        TenantLicense? tenantLicense,
        DateTime utcNow)
    {
        TenantLicenseStatus licenseStatus;
        int? daysRemaining = null;

        if (tenantLicense is null)
        {
            licenseStatus = TenantLicenseStatus.Expired;
        }
        else if (tenantStatus != TenantStatus.Active)
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

        return (licenseStatus, daysRemaining, renewalWarning);
    }

    public sealed record RenewTenantLicenseRequest(
        DateTime NewStartDateUtc,
        DateTime NewEndDateUtc,
        decimal AmountPaid,
        string CurrencyCode);

    public sealed record ChangeTenantPackageRequest(
        Guid SubscriptionPackageId);
}
