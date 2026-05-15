using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Email;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.BuildingBlocks.Infrastructure.Security;
using iBalance.Modules.Platform.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using iBalance.Api.Services.Audit;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin,TenantAdmin")]
[Route("api/admin/users")]
public sealed class AdminUsersController : ControllerBase
{
        private static readonly string[] SupportedRoles =
    [
        "PlatformAdmin",
        "TenantAdmin",
        "FinanceController",
        "Accountant",
        "Approver",
        "Viewer",
        "Auditor",
        "BudgetOfficer",
        "BudgetOwner",
        "PayrollOfficer",
        "HrOfficer",
        "ProcurementOfficer",
        "TreasuryOfficer",
        "InventoryOfficer",
        "ApOfficer",
        "ArOfficer",
        "FixedAssetOfficer",
        "ExpenseAdvanceOfficer",
        "ExpenseAdvanceApprover",
        "ExpenseAdvanceReviewer",
        "ExpenseAdvanceViewer",
        "FleetOfficer",
        "FleetApprover",
        "FleetReviewer",
        "FleetViewer"
    ];

    [HttpGet]
    public async Task<IActionResult> GetUsers(
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

        var items = await dbContext.UserAccounts
            .AsNoTracking()
            .OrderByDescending(x => x.IsActive)
            .ThenBy(x => x.FirstName)
            .ThenBy(x => x.LastName)
            .ThenBy(x => x.Email)
            .Select(x => new UserListItemResponse(
                x.Id,
                x.Email,
                x.FirstName,
                x.LastName,
                x.FullName,
                x.Role,
                x.IsActive,
                x.PasswordResetTokenExpiresOnUtc,
                x.CreatedOnUtc,
                x.CreatedBy,
                x.LastModifiedOnUtc,
                x.LastModifiedBy))
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpGet("roles")]
    public IActionResult GetAssignableRoles(
        [FromServices] ICurrentUserService currentUserService)
    {
        var isPlatformAdmin = currentUserService.HasAnyRole("PlatformAdmin");
        var items = isPlatformAdmin
            ? SupportedRoles
            : SupportedRoles.Where(x => !string.Equals(x, "PlatformAdmin", StringComparison.OrdinalIgnoreCase)).ToArray();

        return Ok(new
        {
            Count = items.Length,
            Items = items
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser(
        [FromBody] CreateUserRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] PasswordHasher passwordHasher,
        [FromServices] IAuditTrailWriter auditTrailWriter,
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

        var validationError = ValidateCreateOrUpdateRequest(
            request.Email,
            request.FirstName,
            request.LastName,
            request.Role);

        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { Message = "Password is required." });
        }

        if (request.Password.Trim().Length < 8)
        {
            return BadRequest(new { Message = "Password must be at least 8 characters." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedRole = NormalizeRole(request.Role);

        var exists = await dbContext.UserAccounts
            .AnyAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (exists)
        {
            return Conflict(new
            {
                Message = "A user account with this email already exists for the current tenant."
            });
        }

        var password = passwordHasher.HashPassword(request.Password.Trim());

        var user = new UserAccount(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedEmail,
            request.FirstName.Trim(),
            request.LastName.Trim(),
            normalizedRole,
            password.Hash,
            password.Salt,
            request.IsActive);

        dbContext.UserAccounts.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        await SyncPrimaryEnterpriseRoleAssignmentAsync(
            dbContext,
            tenantContext.TenantId,
            user,
            normalizedRole,
            cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "UserAccount",
            "UserCreated",
            user.Id,
            user.Email,
            $"User '{user.Email}' created.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                user.Email,
                user.FirstName,
                user.LastName,
                user.Role,
                user.IsActive
            },
            cancellationToken);

        return Ok(new
        {
            Message = "User created successfully.",
            User = new UserListItemResponse(
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                user.FullName,
                user.Role,
                user.IsActive,
                user.PasswordResetTokenExpiresOnUtc,
                user.CreatedOnUtc,
                user.CreatedBy,
                user.LastModifiedOnUtc,
                user.LastModifiedBy)
        });
    }

    [HttpPut("{userId:guid}")]
    public async Task<IActionResult> UpdateUser(
        Guid userId,
        [FromBody] UpdateUserRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var validationError = ValidateCreateOrUpdateRequest(
            request.Email,
            request.FirstName,
            request.LastName,
            request.Role);

        if (validationError is not null)
        {
            return BadRequest(new { Message = validationError });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var normalizedRole = NormalizeRole(request.Role);

        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new { Message = "User account was not found for the current tenant." });
        }

        var duplicateEmail = await dbContext.UserAccounts
            .AsNoTracking()
            .AnyAsync(x => x.Id != userId && x.Email == normalizedEmail, cancellationToken);

        if (duplicateEmail)
        {
            return Conflict(new
            {
                Message = "Another user account with this email already exists for the current tenant."
            });
        }

        if (IsSelfDemotionOrDeactivation(user, normalizedRole, request.IsActive, currentUserService))
        {
            return BadRequest(new
            {
                Message = "You cannot remove your own tenant administrative access or deactivate your own account."
            });
        }

        user.UpdateEmail(normalizedEmail);
        user.UpdateProfile(request.FirstName.Trim(), request.LastName.Trim());
        user.AssignRole(normalizedRole);

        if (request.IsActive)
        {
            user.Activate();
        }
        else
        {
            user.Deactivate();
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await SyncPrimaryEnterpriseRoleAssignmentAsync(
            dbContext,
            user.TenantId,
            user,
            normalizedRole,
            cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "UserAccount",
            "UserUpdated",
            user.Id,
            user.Email,
            $"User '{user.Email}' updated.",
            User.Identity?.Name,
            user.TenantId,
            new
            {
                user.Email,
                user.FirstName,
                user.LastName,
                user.Role,
                user.IsActive
            },
            cancellationToken);

        return Ok(new
        {
            Message = "User updated successfully.",
            User = new UserListItemResponse(
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                user.FullName,
                user.Role,
                user.IsActive,
                user.PasswordResetTokenExpiresOnUtc,
                user.CreatedOnUtc,
                user.CreatedBy,
                user.LastModifiedOnUtc,
                user.LastModifiedBy)
        });
    }

    [HttpPost("{userId:guid}/activate")]
    public async Task<IActionResult> ActivateUser(
        Guid userId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new { Message = "User account was not found for the current tenant." });
        }

        user.Activate();
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "UserAccount",
            "UserActivated",
            user.Id,
            user.Email,
            $"User '{user.Email}' activated.",
            User.Identity?.Name,
            user.TenantId,
            new
            {
                user.Email,
                user.Role,
                user.IsActive
            },
            cancellationToken);

        return Ok(new
        {
            Message = "User activated successfully."
        });
    }

    [HttpPost("{userId:guid}/deactivate")]
    public async Task<IActionResult> DeactivateUser(
        Guid userId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new { Message = "User account was not found for the current tenant." });
        }

        if (IsSelfDemotionOrDeactivation(user, user.Role, false, currentUserService))
        {
            return BadRequest(new
            {
                Message = "You cannot deactivate your own account."
            });
        }

        user.Deactivate();
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "UserAccount",
            "UserDeactivated",
            user.Id,
            user.Email,
            $"User '{user.Email}' deactivated.",
            User.Identity?.Name,
            user.TenantId,
            new
            {
                user.Email,
                user.Role,
                user.IsActive
            },
            cancellationToken);

        return Ok(new
        {
            Message = "User deactivated successfully."
        });
    }

    [HttpPost("{userId:guid}/issue-password-reset")]
    public async Task<IActionResult> IssuePasswordReset(
        Guid userId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] PasswordHasher passwordHasher,
        [FromServices] IEmailSender emailSender,
        [FromServices] IOptions<EmailOptions> emailOptionsAccessor,
        [FromServices] IConfiguration configuration,
        [FromServices] IAuditTrailWriter auditTrailWriter,
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

        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new { Message = "User account was not found for the current tenant." });
        }

        if (!user.IsActive)
        {
            return BadRequest(new
            {
                Message = "Password reset cannot be issued for an inactive user."
            });
        }

        var rawToken = passwordHasher.GenerateSecureToken();
        var tokenHash = passwordHasher.ComputeSha256(rawToken);
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(30);

        user.IssuePasswordResetToken(tokenHash, expiresAtUtc);
        await dbContext.SaveChangesAsync(cancellationToken);

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantContext.TenantId, cancellationToken);

        var webBaseUrl =
            configuration["App:WebBaseUrl"] ??
            configuration["Application:WebBaseUrl"] ??
            "http://localhost:5173";

        var resetLink =
            $"{webBaseUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(rawToken)}";

        var supportEmail =
            emailOptionsAccessor.Value.ReplyToAddress ??
            emailOptionsAccessor.Value.FromAddress;

        var emailBody = EmailTemplateFactory.CreatePasswordResetEmail(
            user.FullName,
            tenant?.Name ?? tenantContext.TenantKey,
            resetLink,
            supportEmail);

        await emailSender.SendAsync(
            user.Email,
            user.FullName,
            "Password Reset Request",
            emailBody.HtmlBody,
            emailBody.TextBody,
            cancellationToken);

        await auditTrailWriter.WriteAsync(
            "admin",
            "UserAccount",
            "PasswordResetIssued",
            user.Id,
            user.Email,
            $"Password reset instructions issued for user '{user.Email}'.",
            User.Identity?.Name,
            tenantContext.TenantId,
            new
            {
                user.Email,
                ExpiresAtUtc = expiresAtUtc
            },
            cancellationToken);

        return Ok(new
        {
            Message = "Password reset instructions have been sent successfully.",
            UserId = user.Id,
            user.Email,
            ExpiresAtUtc = expiresAtUtc
        });
    }

    private static string? ValidateCreateOrUpdateRequest(
        string email,
        string firstName,
        string lastName,
        string role)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return "Email is required.";
        }

        if (string.IsNullOrWhiteSpace(firstName))
        {
            return "First name is required.";
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            return "Last name is required.";
        }

        if (string.IsNullOrWhiteSpace(role))
        {
            return "Role is required.";
        }

        if (!SupportedRoles.Contains(role.Trim(), StringComparer.OrdinalIgnoreCase))
        {
            return "The selected role is not supported.";
        }

        return null;
    }

    private static string NormalizeRole(string role)
    {
        return SupportedRoles.First(x => string.Equals(x, role.Trim(), StringComparison.OrdinalIgnoreCase));
    }

private static async Task SyncPrimaryEnterpriseRoleAssignmentAsync(
    ApplicationDbContext dbContext,
    Guid tenantId,
    UserAccount user,
    string normalizedRole,
    CancellationToken cancellationToken)
{
    var targetRoleCode = normalizedRole.Trim().ToUpperInvariant() switch
    {
        "PLATFORMADMIN" => "PLATFORM_ADMIN",
        "TENANTADMIN" => "TENANT_ADMIN",
        "FINANCECONTROLLER" => "FINANCE_CONTROLLER",
        "BUDGETOFFICER" => "BUDGET_OFFICER",
        "BUDGETOWNER" => "BUDGET_OWNER",
        "PAYROLLOFFICER" => "PAYROLL_OFFICER",
        "HROFFICER" => "HR_OFFICER",
        "PROCUREMENTOFFICER" => "PROCUREMENT_OFFICER",
        "TREASURYOFFICER" => "TREASURY_OFFICER",
        "INVENTORYOFFICER" => "INVENTORY_OFFICER",
        "APOFFICER" => "AP_OFFICER",
        "AROFFICER" => "AR_OFFICER",
        "FIXEDASSETOFFICER" => "FIXED_ASSET_OFFICER",
        "EXPENSEADVANCEOFFICER" => "EXPENSE_ADVANCE_OFFICER",
        "EXPENSEADVANCEAPPROVER" => "EXPENSE_ADVANCE_APPROVER",
        "EXPENSEADVANCEREVIEWER" => "EXPENSE_ADVANCE_REVIEWER",
        "EXPENSEADVANCEVIEWER" => "EXPENSE_ADVANCE_VIEWER",
        "FLEETOFFICER" => "FLEET_OFFICER",
        "FLEETAPPROVER" => "FLEET_APPROVER",
        "FLEETREVIEWER" => "FLEET_REVIEWER",
        "FLEETVIEWER" => "FLEET_VIEWER",
        _ => normalizedRole.Trim().Replace(" ", "_").ToUpperInvariant()
    };

    var securityRole = await dbContext.Set<SecurityRole>()
        .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.Code == targetRoleCode, cancellationToken);

    if (securityRole is null)
    {
        return;
    }

    var existingAssignments = await dbContext.Set<UserSecurityRoleAssignment>()
        .Where(x => x.TenantId == tenantId && x.UserAccountId == user.Id)
        .ToListAsync(cancellationToken);

    if (existingAssignments.Count == 1 &&
        existingAssignments[0].SecurityRoleId == securityRole.Id &&
        existingAssignments[0].IsPrimary)
    {
        return;
    }

    dbContext.Set<UserSecurityRoleAssignment>().RemoveRange(existingAssignments);

    dbContext.Set<UserSecurityRoleAssignment>().Add(new UserSecurityRoleAssignment(
        Guid.NewGuid(),
        tenantId,
        user.Id,
        securityRole.Id,
        true));

    await dbContext.SaveChangesAsync(cancellationToken);
}

        private static bool IsSelfDemotionOrDeactivation(
        UserAccount targetUser,
        string requestedRole,
        bool requestedIsActive,
        ICurrentUserService currentUserService)
    {
        if (!Guid.TryParse(currentUserService.UserId, out var currentUserId))
        {
            return false;
        }

        if (targetUser.Id != currentUserId)
        {
            return false;
        }

        if (!requestedIsActive)
        {
            return true;
        }

        var currentUserRoles = currentUserService.Roles;

        var currentlyHasProtectedAdministrativeAccess =
            currentUserRoles.Any(x => string.Equals(x, "PlatformAdmin", StringComparison.OrdinalIgnoreCase)) ||
            currentUserRoles.Any(x => string.Equals(x, "TenantAdmin", StringComparison.OrdinalIgnoreCase)) ||
            string.Equals(targetUser.Role, "PlatformAdmin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(targetUser.Role, "TenantAdmin", StringComparison.OrdinalIgnoreCase);

        if (!currentlyHasProtectedAdministrativeAccess)
        {
            return false;
        }

        return !string.Equals(requestedRole, "TenantAdmin", StringComparison.OrdinalIgnoreCase) &&
               !string.Equals(requestedRole, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);
    }

    public sealed record CreateUserRequest(
        string Email,
        string FirstName,
        string LastName,
        string Role,
        string Password,
        bool IsActive);

    public sealed record UpdateUserRequest(
        string Email,
        string FirstName,
        string LastName,
        string Role,
        bool IsActive);

    public sealed record UserListItemResponse(
        Guid Id,
        string Email,
        string FirstName,
        string LastName,
        string DisplayName,
        string Role,
        bool IsActive,
        DateTime? PasswordResetTokenExpiresOnUtc,
        DateTime CreatedOnUtc,
        string? CreatedBy,
        DateTime? LastModifiedOnUtc,
        string? LastModifiedBy);
}