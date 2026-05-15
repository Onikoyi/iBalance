using System.Runtime.Serialization;
using System.Security.Claims;
using iBalance.Api.Security;
using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Finance.Domain.Entities;
using iBalance.Modules.Finance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/finance/eam")]
public sealed class ExpenseAdvanceManagementController : ControllerBase
{
    private static string? Actor(ClaimsPrincipal user, ICurrentUserService currentUserService)
        => user.Identity?.Name ?? currentUserService.Email ?? currentUserService.UserName ?? currentUserService.UserId;

    private static async Task<string> NextNumberAsync(
        ApplicationDbContext dbContext,
        Guid tenantId,
        string sequenceCode,
        string fallbackPrefix,
        CancellationToken cancellationToken)
    {
        var sequence = await dbContext.Set<JournalNumberSequence>()
            .FirstOrDefaultAsync(
                x => x.TenantId == tenantId &&
                     x.IsActive &&
                     (x.Prefix == sequenceCode || x.Prefix == fallbackPrefix),
                cancellationToken);

        if (sequence is not null)
        {
            return sequence.ConsumeNextReference();
        }

        return $"{fallbackPrefix}-{DateTime.UtcNow:yyyyMMddHHmmss}";
    }

    private static bool IsPostingReady(LedgerAccount? account)
        => account is not null && account.IsActive && !account.IsHeader && account.IsPostingAllowed;

    private static T CreateUninitialized<T>() where T : class
        => (T)FormatterServices.GetUninitializedObject(typeof(T));

    private static void SetProperty<TEntity>(
        ApplicationDbContext dbContext,
        TEntity entity,
        string propertyName,
        object? value) where TEntity : class
    {
        dbContext.Entry(entity).Property(propertyName).CurrentValue = value;
    }

    private static object ToEnumValue(PropertyEntry propertyEntry, int numericValue)
        => Enum.ToObject(propertyEntry.Metadata.ClrType, numericValue);

    private static void SetEnumProperty<TEntity>(
        ApplicationDbContext dbContext,
        TEntity entity,
        string propertyName,
        int numericValue) where TEntity : class
    {
        var property = dbContext.Entry(entity).Property(propertyName);
        property.CurrentValue = ToEnumValue(property, numericValue);
    }

    private async Task<ExpenseAdvancePolicy?> GetPolicyAsync(
        ApplicationDbContext dbContext,
        Guid tenantId,
        CancellationToken cancellationToken)
        => await dbContext.Set<ExpenseAdvancePolicy>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenantId && x.IsActive, cancellationToken);

    private static decimal SafeDecimal(object? value)
        => value is decimal amount ? amount : 0m;

    private static string? SafeString(object? value)
        => value?.ToString();

    private static DateTime? SafeDateTimeNullable(object? value)
        => value as DateTime? ?? (value is DateTime date ? date : null);

    private static Guid SafeGuid(object? value)
        => value is Guid guid ? guid : Guid.Empty;

    private async Task<IActionResult?> EnsureTenantAsync(
        ITenantContextAccessor tenantContextAccessor)
    {
        var tenant = tenantContextAccessor.Current;
        if (!tenant.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        return null;
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseAdvanceRequest>()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var overdueCount = items.Count(x =>
            x.ExpectedRetirementDateUtc.HasValue &&
            x.ExpectedRetirementDateUtc.Value.Date < DateTime.UtcNow.Date &&
            (x.Status == AdvanceRequestStatus.Disbursed ||
             x.Status == AdvanceRequestStatus.PartiallyRetired ||
             x.Status == AdvanceRequestStatus.Overdue));

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            TotalRequests = items.Count,
            Drafts = items.Count(x => x.Status == AdvanceRequestStatus.Draft),
            Submitted = items.Count(x => x.Status == AdvanceRequestStatus.Submitted),
            Approved = items.Count(x => x.Status == AdvanceRequestStatus.Approved),
            Disbursed = items.Count(x =>
                x.Status == AdvanceRequestStatus.Disbursed ||
                x.Status == AdvanceRequestStatus.PartiallyRetired ||
                x.Status == AdvanceRequestStatus.FullyRetired ||
                x.Status == AdvanceRequestStatus.Overdue ||
                x.Status == AdvanceRequestStatus.Closed),
            OutstandingCount = items.Count(x => x.OutstandingAmount > 0m),
            OverdueCount = overdueCount,
            TotalRequested = items.Sum(x => x.RequestedAmount),
            TotalOutstanding = items.Sum(x => x.OutstandingAmount),
            TotalRetired = items.Sum(x => x.RetiredAmount)
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseAdvanceRequest>()
            .AsNoTracking()
            .OrderByDescending(x => x.RequestDateUtc)
            .ThenByDescending(x => x.CreatedOnUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("requests/rejected")]
    public async Task<IActionResult> GetRejectedRequests(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseAdvanceRequest>()
            .AsNoTracking()
            .Where(x => x.Status == AdvanceRequestStatus.Rejected)
            .OrderByDescending(x => x.RejectedOnUtc)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRequestCreate)]
    [HttpPost("requests")]
    public async Task<IActionResult> CreateRequest(
        [FromBody] CreateExpenseAdvanceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var employee = await dbContext.PayrollEmployees
            .FirstOrDefaultAsync(x => x.Id == request.EmployeeId && x.TenantId == tenant.TenantId, cancellationToken);

        if (employee is null)
        {
            return NotFound(new { Message = "Employee was not found.", request.EmployeeId });
        }

        var advanceType = await dbContext.Set<ExpenseAdvanceType>()
            .FirstOrDefaultAsync(
                x => x.Id == request.AdvanceTypeId &&
                     x.TenantId == tenant.TenantId &&
                     x.IsActive,
                cancellationToken);

        if (advanceType is null)
        {
            return NotFound(new { Message = "Advance type was not found or inactive.", request.AdvanceTypeId });
        }

        var policy = await GetPolicyAsync(dbContext, tenant.TenantId, cancellationToken);
        if (policy?.MaxAmount is decimal maxAmount && request.RequestedAmount > maxAmount)
        {
            return Conflict(new
            {
                Message = "Requested amount exceeds configured policy maximum.",
                MaxAmount = maxAmount,
                RequestedAmount = request.RequestedAmount
            });
        }

        var requestNumber = await NextNumberAsync(
            dbContext,
            tenant.TenantId,
            "ADV_REQ",
            "EAM-REQ",
            cancellationToken);

        var item = new ExpenseAdvanceRequest(
            Guid.NewGuid(),
            tenant.TenantId,
            request.AdvanceTypeId,
            request.EmployeeId,
            requestNumber,
            request.RequestDateUtc,
            request.Purpose,
            request.RequestedAmount,
            request.Department ?? employee.Department,
            request.Branch,
            request.CostCenter,
            request.Destination,
            request.ExpectedRetirementDateUtc,
            request.Notes);

        item.UpdateEditableDetails(
            request.AdvanceTypeId,
            request.EmployeeId,
            request.RequestDateUtc,
            request.Purpose,
            request.RequestedAmount,
            request.Department ?? employee.Department,
            request.Branch,
            request.CostCenter,
            request.Destination,
            request.ExpectedRetirementDateUtc,
            request.Notes,
            Actor(User, currentUserService));

        dbContext.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "Created",
            item.Id,
            item.RequestNumber,
            $"Advance request '{item.RequestNumber}' created.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { item.EmployeeId, item.AdvanceTypeId, item.RequestedAmount },
            cancellationToken);

        return Ok(new { Message = "Expense advance request created successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRequestUpdate)]
    [HttpPut("requests/{requestId:guid}")]
    public async Task<IActionResult> UpdateRequest(
        Guid requestId,
        [FromBody] CreateExpenseAdvanceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == requestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", RequestId = requestId });
        }

        item.UpdateEditableDetails(
            request.AdvanceTypeId,
            request.EmployeeId,
            request.RequestDateUtc,
            request.Purpose,
            request.RequestedAmount,
            request.Department,
            request.Branch,
            request.CostCenter,
            request.Destination,
            request.ExpectedRetirementDateUtc,
            request.Notes,
            Actor(User, currentUserService));

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "Updated",
            item.Id,
            item.RequestNumber,
            $"Advance request '{item.RequestNumber}' updated.",
            Actor(User, currentUserService),
            tenant.TenantId,
            null,
            cancellationToken);

        return Ok(new { Message = "Expense advance request updated successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRequestSubmit)]
    [HttpPost("requests/{requestId:guid}/submit")]
    public async Task<IActionResult> SubmitRequest(
        Guid requestId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == requestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", RequestId = requestId });
        }

        item.Submit(Actor(User, currentUserService) ?? "System");
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "Submitted",
            item.Id,
            item.RequestNumber,
            $"Advance request '{item.RequestNumber}' submitted.",
            Actor(User, currentUserService),
            tenant.TenantId,
            null,
            cancellationToken);

        return Ok(new { Message = "Expense advance request submitted successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRequestApprove)]
    [HttpPost("requests/{requestId:guid}/approve")]
    public async Task<IActionResult> ApproveRequest(
        Guid requestId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == requestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", RequestId = requestId });
        }

        var policy = await GetPolicyAsync(dbContext, tenant.TenantId, cancellationToken);
        var actor = Actor(User, currentUserService) ?? "System";

        if ((policy?.BlockSelfApproval ?? true) &&
            !string.IsNullOrWhiteSpace(item.CreatedBy) &&
            string.Equals(item.CreatedBy, actor, StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new
            {
                Message = "Maker-checker policy blocks same-user approval.",
                item.RequestNumber
            });
        }

        item.Approve(actor);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "Approved",
            item.Id,
            item.RequestNumber,
            $"Advance request '{item.RequestNumber}' approved.",
            actor,
            tenant.TenantId,
            null,
            cancellationToken);

        return Ok(new { Message = "Expense advance request approved successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRequestReject)]
    [HttpPost("requests/{requestId:guid}/reject")]
    public async Task<IActionResult> RejectRequest(
        Guid requestId,
        [FromBody] RejectWorkflowRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == requestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", RequestId = requestId });
        }

        item.Reject(Actor(User, currentUserService) ?? "System", request.Reason);
        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "Rejected",
            item.Id,
            item.RequestNumber,
            $"Advance request '{item.RequestNumber}' rejected.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.Reason },
            cancellationToken);

        return Ok(new { Message = "Expense advance request rejected successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("policy")]
    public async Task<IActionResult> GetPolicy(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var policy = await dbContext.Set<ExpenseAdvancePolicy>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.TenantId, cancellationToken);

        if (policy is null)
        {
            return Ok(new
            {
                Id = Guid.Empty,
                TenantId = tenant.TenantId,
                MaxAmount = 0m,
                AllowedOpenAdvancesPerStaff = 1,
                RetirementDueDays = 0,
                AttachmentRequired = false,
                BlockSelfApproval = true,
                AllowExcessReimbursement = false,
                AllowSalaryRecovery = false,
                RequireDepartmentScope = false,
                RequireBranchScope = false,
                RequireCostCenterScope = false,
                TravelAdvanceRequiresDestination = false,
                ImprestRequiresRetirement = true,
                IsActive = true
            });
        }

        return Ok(policy);
    }

    [Authorize(Policy = AuthorizationPolicies.EamPolicyManage)]
    [HttpPut("policy")]
    public async Task<IActionResult> UpsertPolicy(
        [FromBody] UpsertExpenseAdvancePolicyRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        if (request.MaxAmount < 0m)
        {
            return BadRequest(new { Message = "Maximum amount cannot be negative." });
        }

        if (request.AllowedOpenAdvancesPerStaff < 0)
        {
            return BadRequest(new { Message = "Allowed open advances per staff cannot be negative." });
        }

        if (request.RetirementDueDays < 0)
        {
            return BadRequest(new { Message = "Retirement due days cannot be negative." });
        }

        var policy = await dbContext.Set<ExpenseAdvancePolicy>()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.TenantId, cancellationToken);

        if (policy is null)
        {
            policy = CreateUninitialized<ExpenseAdvancePolicy>();
            dbContext.Set<ExpenseAdvancePolicy>().Add(policy);
            SetProperty(dbContext, policy, "Id", Guid.NewGuid());
            SetProperty(dbContext, policy, "TenantId", tenant.TenantId);
            SetProperty(dbContext, policy, "CreatedOnUtc", DateTime.UtcNow);
        }

        SetProperty(dbContext, policy, "MaxAmount", request.MaxAmount);
        SetProperty(dbContext, policy, "AllowedOpenAdvancesPerStaff", request.AllowedOpenAdvancesPerStaff);
        SetProperty(dbContext, policy, "RetirementDueDays", request.RetirementDueDays);
        SetProperty(dbContext, policy, "AttachmentRequired", request.AttachmentRequired);
        SetProperty(dbContext, policy, "BlockSelfApproval", request.BlockSelfApproval);
        SetProperty(dbContext, policy, "AllowExcessReimbursement", request.AllowExcessReimbursement);
        SetProperty(dbContext, policy, "AllowSalaryRecovery", request.AllowSalaryRecovery);
        SetProperty(dbContext, policy, "RequireDepartmentScope", request.RequireDepartmentScope);
        SetProperty(dbContext, policy, "RequireBranchScope", request.RequireBranchScope);
        SetProperty(dbContext, policy, "RequireCostCenterScope", request.RequireCostCenterScope);
        SetProperty(dbContext, policy, "TravelAdvanceRequiresDestination", request.TravelAdvanceRequiresDestination);
        SetProperty(dbContext, policy, "ImprestRequiresRetirement", request.ImprestRequiresRetirement);
        SetProperty(dbContext, policy, "IsActive", request.IsActive);
        SetProperty(dbContext, policy, "LastModifiedOnUtc", DateTime.UtcNow);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvancePolicy",
            "Saved",
            SafeGuid(dbContext.Entry(policy).Property("Id").CurrentValue),
            "eam-policy",
            "Expense & Advance policy saved successfully.",
            User.Identity?.Name,
            tenant.TenantId,
            new
            {
                request.MaxAmount,
                request.AllowedOpenAdvancesPerStaff,
                request.RetirementDueDays,
                request.AttachmentRequired,
                request.BlockSelfApproval,
                request.AllowExcessReimbursement,
                request.AllowSalaryRecovery
            },
            cancellationToken);

        return Ok(new
        {
            Message = "Expense & Advance policy saved successfully.",
            Policy = policy
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("setup/advance-types")]
    public async Task<IActionResult> GetAdvanceTypes(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseAdvanceType>()
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamPolicyManage)]
    [HttpPost("setup/advance-types")]
    public async Task<IActionResult> CreateAdvanceType(
        [FromBody] UpsertExpenseAdvanceTypeRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(normalizedCode) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Advance type code and name are required." });
        }

        var exists = await dbContext.Set<ExpenseAdvanceType>()
            .AsNoTracking()
            .AnyAsync(x => x.TenantId == tenant.TenantId && x.Code == normalizedCode, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "An advance type with the same code already exists.", Code = normalizedCode });
        }

        var item = CreateUninitialized<ExpenseAdvanceType>();
        dbContext.Set<ExpenseAdvanceType>().Add(item);

        SetProperty(dbContext, item, "Id", Guid.NewGuid());
        SetProperty(dbContext, item, "TenantId", tenant.TenantId);
        SetProperty(dbContext, item, "Code", normalizedCode);
        SetProperty(dbContext, item, "Name", request.Name.Trim());
        SetProperty(dbContext, item, "IsSystemDefined", request.IsSystemDefined);
        SetProperty(dbContext, item, "IsActive", request.IsActive);
        SetProperty(dbContext, item, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());
        SetProperty(dbContext, item, "CreatedOnUtc", DateTime.UtcNow);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceType",
            "Created",
            SafeGuid(dbContext.Entry(item).Property("Id").CurrentValue),
            normalizedCode,
            $"Expense advance type '{normalizedCode}' created.",
            User.Identity?.Name,
            tenant.TenantId,
            new { request.Name, request.IsActive },
            cancellationToken);

        return Ok(new { Message = "Advance type saved successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamPolicyManage)]
    [HttpPut("setup/advance-types/{advanceTypeId:guid}")]
    public async Task<IActionResult> UpdateAdvanceType(
        Guid advanceTypeId,
        [FromBody] UpsertExpenseAdvanceTypeRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        var item = await dbContext.Set<ExpenseAdvanceType>()
            .FirstOrDefaultAsync(x => x.Id == advanceTypeId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance type was not found.", AdvanceTypeId = advanceTypeId });
        }

        SetProperty(dbContext, item, "Code", normalizedCode);
        SetProperty(dbContext, item, "Name", request.Name.Trim());
        SetProperty(dbContext, item, "IsSystemDefined", request.IsSystemDefined);
        SetProperty(dbContext, item, "IsActive", request.IsActive);
        SetProperty(dbContext, item, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceType",
            "Updated",
            advanceTypeId,
            normalizedCode,
            $"Expense advance type '{normalizedCode}' updated.",
            User.Identity?.Name,
            tenant.TenantId,
            new { request.Name, request.IsActive },
            cancellationToken);

        return Ok(new { Message = "Advance type updated successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("setup/expense-categories")]
    public async Task<IActionResult> GetExpenseCategories(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseCategory>()
            .AsNoTracking()
            .OrderBy(x => x.Code)
            .ToListAsync(cancellationToken);

        var accountIds = items
            .Select(x => x.DefaultExpenseLedgerAccountId)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var accounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => accountIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var projected = items.Select(x => new
        {
            x.Id,
            x.Code,
            x.Name,
            x.DefaultExpenseLedgerAccountId,
            DefaultExpenseLedgerAccountCode = x.DefaultExpenseLedgerAccountId.HasValue && accounts.TryGetValue(x.DefaultExpenseLedgerAccountId.Value, out var acct) ? acct.Code : null,
            DefaultExpenseLedgerAccountName = x.DefaultExpenseLedgerAccountId.HasValue && accounts.TryGetValue(x.DefaultExpenseLedgerAccountId.Value, out acct) ? acct.Name : null,
            x.IsActive
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            Count = projected.Count,
            Items = projected
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamPolicyManage)]
    [HttpPost("setup/expense-categories")]
    public async Task<IActionResult> CreateExpenseCategory(
        [FromBody] UpsertExpenseCategoryRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(normalizedCode) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Expense category code and name are required." });
        }

        if (request.DefaultExpenseLedgerAccountId.HasValue)
        {
            var account = await dbContext.LedgerAccounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.DefaultExpenseLedgerAccountId.Value, cancellationToken);

            if (!IsPostingReady(account))
            {
                return BadRequest(new { Message = "Default expense ledger account must be an active posting ledger account." });
            }
        }

        var exists = await dbContext.Set<ExpenseCategory>()
            .AsNoTracking()
            .AnyAsync(x => x.TenantId == tenant.TenantId && x.Code == normalizedCode, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "An expense category with the same code already exists.", Code = normalizedCode });
        }

        var item = CreateUninitialized<ExpenseCategory>();
        dbContext.Set<ExpenseCategory>().Add(item);

        SetProperty(dbContext, item, "Id", Guid.NewGuid());
        SetProperty(dbContext, item, "TenantId", tenant.TenantId);
        SetProperty(dbContext, item, "Code", normalizedCode);
        SetProperty(dbContext, item, "Name", request.Name.Trim());
        SetProperty(dbContext, item, "DefaultExpenseLedgerAccountId", request.DefaultExpenseLedgerAccountId);
        SetProperty(dbContext, item, "IsActive", request.IsActive);
        SetProperty(dbContext, item, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());
        SetProperty(dbContext, item, "CreatedOnUtc", DateTime.UtcNow);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseCategory",
            "Created",
            SafeGuid(dbContext.Entry(item).Property("Id").CurrentValue),
            normalizedCode,
            $"Expense category '{normalizedCode}' created.",
            User.Identity?.Name,
            tenant.TenantId,
            new { request.Name, request.DefaultExpenseLedgerAccountId, request.IsActive },
            cancellationToken);

        return Ok(new { Message = "Expense category saved successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamPolicyManage)]
    [HttpPut("setup/expense-categories/{expenseCategoryId:guid}")]
    public async Task<IActionResult> UpdateExpenseCategory(
        Guid expenseCategoryId,
        [FromBody] UpsertExpenseCategoryRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;
        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        var item = await dbContext.Set<ExpenseCategory>()
            .FirstOrDefaultAsync(x => x.Id == expenseCategoryId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Expense category was not found.", ExpenseCategoryId = expenseCategoryId });
        }

        SetProperty(dbContext, item, "Code", normalizedCode);
        SetProperty(dbContext, item, "Name", request.Name.Trim());
        SetProperty(dbContext, item, "DefaultExpenseLedgerAccountId", request.DefaultExpenseLedgerAccountId);
        SetProperty(dbContext, item, "IsActive", request.IsActive);
        SetProperty(dbContext, item, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseCategory",
            "Updated",
            expenseCategoryId,
            normalizedCode,
            $"Expense category '{normalizedCode}' updated.",
            User.Identity?.Name,
            tenant.TenantId,
            new { request.Name, request.DefaultExpenseLedgerAccountId, request.IsActive },
            cancellationToken);

        return Ok(new { Message = "Expense category updated successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("setup/posting")]
    public async Task<IActionResult> GetPostingSetup(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var setup = await dbContext.Set<ExpenseAdvancePostingSetup>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.TenantId, cancellationToken);

        if (setup is null)
        {
            return Ok(new
            {
                TenantId = tenant.TenantId,
                AdvanceControlLedgerAccountId = (Guid?)null,
                RefundLedgerAccountId = (Guid?)null,
                SalaryRecoveryLedgerAccountId = (Guid?)null,
                ReimbursementPayableLedgerAccountId = (Guid?)null,
                RecoveryClearingLedgerAccountId = (Guid?)null,
                DefaultCashBankLedgerAccountId = (Guid?)null
            });
        }

        return Ok(setup);
    }

    [Authorize(Policy = AuthorizationPolicies.EamPolicyManage)]
    [HttpPut("setup/posting")]
    public async Task<IActionResult> UpsertPostingSetup(
        [FromBody] UpsertExpenseAdvancePostingSetupRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var requestedAccountIds = new[]
            {
                request.AdvanceControlLedgerAccountId,
                request.RefundLedgerAccountId,
                request.SalaryRecoveryLedgerAccountId,
                request.ReimbursementPayableLedgerAccountId,
                request.RecoveryClearingLedgerAccountId,
                request.DefaultCashBankLedgerAccountId
            }
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();

        var accounts = await dbContext.LedgerAccounts
            .AsNoTracking()
            .Where(x => requestedAccountIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (accounts.Count != requestedAccountIds.Count || accounts.Any(x => !IsPostingReady(x)))
        {
            return BadRequest(new { Message = "All selected posting setup accounts must be active posting ledger accounts." });
        }

        var setup = await dbContext.Set<ExpenseAdvancePostingSetup>()
            .FirstOrDefaultAsync(x => x.TenantId == tenant.TenantId, cancellationToken);

        if (setup is null)
        {
            setup = CreateUninitialized<ExpenseAdvancePostingSetup>();
            dbContext.Set<ExpenseAdvancePostingSetup>().Add(setup);
            SetProperty(dbContext, setup, "Id", Guid.NewGuid());
            SetProperty(dbContext, setup, "TenantId", tenant.TenantId);
            SetProperty(dbContext, setup, "CreatedOnUtc", DateTime.UtcNow);
        }

        SetProperty(dbContext, setup, "AdvanceControlLedgerAccountId", request.AdvanceControlLedgerAccountId);
        SetProperty(dbContext, setup, "RefundLedgerAccountId", request.RefundLedgerAccountId);
        SetProperty(dbContext, setup, "SalaryRecoveryLedgerAccountId", request.SalaryRecoveryLedgerAccountId);
        SetProperty(dbContext, setup, "ReimbursementPayableLedgerAccountId", request.ReimbursementPayableLedgerAccountId);
        SetProperty(dbContext, setup, "RecoveryClearingLedgerAccountId", request.RecoveryClearingLedgerAccountId);
        SetProperty(dbContext, setup, "DefaultCashBankLedgerAccountId", request.DefaultCashBankLedgerAccountId);
        SetProperty(dbContext, setup, "LastModifiedOnUtc", DateTime.UtcNow);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvancePostingSetup",
            "Saved",
            SafeGuid(dbContext.Entry(setup).Property("Id").CurrentValue),
            "eam-posting-setup",
            "Expense & Advance posting setup saved successfully.",
            User.Identity?.Name,
            tenant.TenantId,
            request,
            cancellationToken);

        return Ok(new { Message = "Posting setup saved successfully.", Setup = setup });
    }

    [Authorize(Policy = AuthorizationPolicies.EamDisburse)]
    [HttpPost("requests/{requestId:guid}/disburse")]
    public async Task<IActionResult> DisburseRequest(
        Guid requestId,
        [FromBody] DisburseExpenseAdvanceRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == requestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", RequestId = requestId });
        }

        if (item.Status != AdvanceRequestStatus.Approved)
        {
            return Conflict(new { Message = "Only approved requests can be disbursed.", item.Status, item.RequestNumber });
        }

        var account = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.CashOrBankLedgerAccountId, cancellationToken);

        if (!IsPostingReady(account) || account is null || !account.IsCashOrBankAccount)
        {
            return BadRequest(new { Message = "Cash / bank ledger account must be an active posting cash or bank account." });
        }

        SetProperty(dbContext, item, "OutstandingAmount", item.RequestedAmount);
        SetProperty(dbContext, item, "RetiredAmount", 0m);
        SetProperty(dbContext, item, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, item, "LastModifiedBy", Actor(User, currentUserService));
        SetProperty(dbContext, item, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? item.Notes : request.Notes.Trim());
        SetProperty(dbContext, item, "ApprovedOnUtc", item.ApprovedOnUtc ?? DateTime.UtcNow);
        SetEnumProperty(dbContext, item, "Status", (int)AdvanceRequestStatus.Disbursed);

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "Disbursed",
            item.Id,
            item.RequestNumber,
            $"Advance request '{item.RequestNumber}' disbursed.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.CashOrBankLedgerAccountId, request.Notes, item.RequestedAmount },
            cancellationToken);

        return Ok(new { Message = "Advance disbursed successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("retirements")]
    public async Task<IActionResult> GetRetirements(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseAdvanceRetirement>()
            .AsNoTracking()
            .OrderByDescending(x => x.RetirementDateUtc)
            .ToListAsync(cancellationToken);

        var retirementIds = items.Select(x => x.Id).ToList();
        var lines = await dbContext.Set<ExpenseAdvanceRetirementLine>()
            .AsNoTracking()
            .Where(x => retirementIds.Contains(x.ExpenseAdvanceRetirementId))
            .ToListAsync(cancellationToken);

        var projected = items.Select(item => new
        {
            item.Id,
            RequestId = EF.Property<Guid>(item, "RequestId"),
            item.RetirementNumber,
            item.RetirementDateUtc,
            TotalRetiredAmount = EF.Property<decimal>(item, "TotalRetiredAmount"),
            item.RefundAmount,
            ReimbursementAmount = EF.Property<decimal>(item, "ReimbursementAmount"),
            item.Status,
            item.Notes,
            item.RejectionReason,
            Lines = lines
                .Where(x => x.ExpenseAdvanceRetirementId == item.Id)
                .Select(x => new
                {
                    x.Id,
                    x.ExpenseCategoryId,
                    x.Description,
                    x.Amount
                })
                .ToList()
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            Count = projected.Count,
            Items = projected
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamView)]
    [HttpGet("retirements/rejected")]
    public async Task<IActionResult> GetRejectedRetirements(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var items = await dbContext.Set<ExpenseAdvanceRetirement>()
            .AsNoTracking()
            .Where(x => EF.Property<int>(x, "Status") == 4)
            .OrderByDescending(x => x.RetirementDateUtc)
            .ToListAsync(cancellationToken);

        var retirementIds = items.Select(x => x.Id).ToList();
        var lines = await dbContext.Set<ExpenseAdvanceRetirementLine>()
            .AsNoTracking()
            .Where(x => retirementIds.Contains(x.ExpenseAdvanceRetirementId))
            .ToListAsync(cancellationToken);

        var projected = items.Select(item => new
        {
            item.Id,
            RequestId = EF.Property<Guid>(item, "RequestId"),
            item.RetirementNumber,
            item.RetirementDateUtc,
            TotalRetiredAmount = EF.Property<decimal>(item, "TotalRetiredAmount"),
            item.RefundAmount,
            ReimbursementAmount = EF.Property<decimal>(item, "ReimbursementAmount"),
            item.Status,
            item.Notes,
            item.RejectionReason,
            Lines = lines
                .Where(x => x.ExpenseAdvanceRetirementId == item.Id)
                .Select(x => new
                {
                    x.Id,
                    x.ExpenseCategoryId,
                    x.Description,
                    x.Amount
                })
                .ToList()
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = true,
            tenant.TenantId,
            tenant.TenantKey,
            Count = projected.Count,
            Items = projected
        });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRetirementCreate)]
    [HttpPost("retirements")]
    public async Task<IActionResult> CreateRetirement(
        [FromBody] SaveExpenseAdvanceRetirementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var advanceRequest = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == request.RequestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (advanceRequest is null)
        {
            return NotFound(new { Message = "Advance request was not found.", request.RequestId });
        }

        if (advanceRequest.Status != AdvanceRequestStatus.Disbursed &&
            advanceRequest.Status != AdvanceRequestStatus.PartiallyRetired &&
            advanceRequest.Status != AdvanceRequestStatus.Overdue)
        {
            return Conflict(new { Message = "Only disbursed or open retirement requests can be retired.", advanceRequest.Status });
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            return BadRequest(new { Message = "At least one retirement line is required." });
        }

        var totalRetired = request.Lines.Sum(x => x.Amount);
        if (totalRetired <= 0m)
        {
            return BadRequest(new { Message = "Retirement total must be greater than zero." });
        }

        var outstandingBefore = advanceRequest.OutstandingAmount > 0m ? advanceRequest.OutstandingAmount : advanceRequest.RequestedAmount;
        var refundAmount = totalRetired < outstandingBefore ? outstandingBefore - totalRetired : 0m;
        var reimbursementAmount = totalRetired > outstandingBefore ? totalRetired - outstandingBefore : 0m;

        var retirementNumber = await NextNumberAsync(
            dbContext,
            tenant.TenantId,
            "ADV_RET",
            "EAM-RET",
            cancellationToken);

        var retirement = CreateUninitialized<ExpenseAdvanceRetirement>();
        dbContext.Set<ExpenseAdvanceRetirement>().Add(retirement);

        var retirementId = Guid.NewGuid();
        SetProperty(dbContext, retirement, "Id", retirementId);
        SetProperty(dbContext, retirement, "TenantId", tenant.TenantId);
        SetProperty(dbContext, retirement, "RequestId", request.RequestId);
        SetProperty(dbContext, retirement, "RetirementNumber", retirementNumber);
        SetProperty(dbContext, retirement, "RetirementDateUtc", request.RetirementDateUtc);
        SetProperty(dbContext, retirement, "TotalRetiredAmount", totalRetired);
        SetProperty(dbContext, retirement, "RefundAmount", refundAmount);
        SetProperty(dbContext, retirement, "ReimbursementAmount", reimbursementAmount);
        SetProperty(dbContext, retirement, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());
        SetProperty(dbContext, retirement, "RejectionReason", null);
        SetEnumProperty(dbContext, retirement, "Status", 1);
        SetProperty(dbContext, retirement, "CreatedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, retirement, "CreatedBy", Actor(User, currentUserService));

        foreach (var line in request.Lines)
        {
            var retirementLine = CreateUninitialized<ExpenseAdvanceRetirementLine>();
            dbContext.Set<ExpenseAdvanceRetirementLine>().Add(retirementLine);
            SetProperty(dbContext, retirementLine, "Id", Guid.NewGuid());
            SetProperty(dbContext, retirementLine, "TenantId", tenant.TenantId);
            SetProperty(dbContext, retirementLine, "ExpenseAdvanceRetirementId", retirementId);
            SetProperty(dbContext, retirementLine, "ExpenseCategoryId", line.ExpenseCategoryId);
            SetProperty(dbContext, retirementLine, "Description", line.Description.Trim());
            SetProperty(dbContext, retirementLine, "Amount", line.Amount);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRetirement",
            "Created",
            retirementId,
            retirementNumber,
            $"Retirement '{retirementNumber}' created.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.RequestId, TotalRetired = totalRetired, RefundAmount = refundAmount, ReimbursementAmount = reimbursementAmount },
            cancellationToken);

        return Ok(new { Message = "Retirement saved successfully.", Retirement = retirement });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRetirementUpdate)]
    [HttpPut("retirements/{retirementId:guid}")]
    public async Task<IActionResult> UpdateRetirement(
        Guid retirementId,
        [FromBody] SaveExpenseAdvanceRetirementRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var retirement = await dbContext.Set<ExpenseAdvanceRetirement>()
            .FirstOrDefaultAsync(x => x.Id == retirementId && x.TenantId == tenant.TenantId, cancellationToken);

        if (retirement is null)
        {
            return NotFound(new { Message = "Retirement was not found.", RetirementId = retirementId });
        }

        if (request.Lines is null || request.Lines.Count == 0)
        {
            return BadRequest(new { Message = "At least one retirement line is required." });
        }

        var advanceRequest = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == request.RequestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (advanceRequest is null)
        {
            return NotFound(new { Message = "Advance request was not found.", request.RequestId });
        }

        var totalRetired = request.Lines.Sum(x => x.Amount);
        var outstandingBefore = advanceRequest.OutstandingAmount > 0m ? advanceRequest.OutstandingAmount : advanceRequest.RequestedAmount;
        var refundAmount = totalRetired < outstandingBefore ? outstandingBefore - totalRetired : 0m;
        var reimbursementAmount = totalRetired > outstandingBefore ? totalRetired - outstandingBefore : 0m;

        SetProperty(dbContext, retirement, "RequestId", request.RequestId);
        SetProperty(dbContext, retirement, "RetirementDateUtc", request.RetirementDateUtc);
        SetProperty(dbContext, retirement, "TotalRetiredAmount", totalRetired);
        SetProperty(dbContext, retirement, "RefundAmount", refundAmount);
        SetProperty(dbContext, retirement, "ReimbursementAmount", reimbursementAmount);
        SetProperty(dbContext, retirement, "Notes", string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim());
        SetProperty(dbContext, retirement, "RejectionReason", null);
        SetProperty(dbContext, retirement, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, retirement, "LastModifiedBy", Actor(User, currentUserService));

        var existingLines = await dbContext.Set<ExpenseAdvanceRetirementLine>()
            .Where(x => x.ExpenseAdvanceRetirementId == retirementId)
            .ToListAsync(cancellationToken);

        dbContext.Set<ExpenseAdvanceRetirementLine>().RemoveRange(existingLines);

        foreach (var line in request.Lines)
        {
            var retirementLine = CreateUninitialized<ExpenseAdvanceRetirementLine>();
            dbContext.Set<ExpenseAdvanceRetirementLine>().Add(retirementLine);
            SetProperty(dbContext, retirementLine, "Id", Guid.NewGuid());
            SetProperty(dbContext, retirementLine, "TenantId", tenant.TenantId);
            SetProperty(dbContext, retirementLine, "ExpenseAdvanceRetirementId", retirementId);
            SetProperty(dbContext, retirementLine, "ExpenseCategoryId", line.ExpenseCategoryId);
            SetProperty(dbContext, retirementLine, "Description", line.Description.Trim());
            SetProperty(dbContext, retirementLine, "Amount", line.Amount);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRetirement",
            "Updated",
            retirementId,
            SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue),
            $"Retirement '{SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue)}' updated.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.RequestId, TotalRetired = totalRetired },
            cancellationToken);

        return Ok(new { Message = "Retirement updated successfully.", Retirement = retirement });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRetirementSubmit)]
    [HttpPost("retirements/{retirementId:guid}/submit")]
    public async Task<IActionResult> SubmitRetirement(
        Guid retirementId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var retirement = await dbContext.Set<ExpenseAdvanceRetirement>()
            .FirstOrDefaultAsync(x => x.Id == retirementId && x.TenantId == tenant.TenantId, cancellationToken);

        if (retirement is null)
        {
            return NotFound(new { Message = "Retirement was not found.", RetirementId = retirementId });
        }

        SetEnumProperty(dbContext, retirement, "Status", 2);
        SetProperty(dbContext, retirement, "RejectionReason", null);
        SetProperty(dbContext, retirement, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, retirement, "LastModifiedBy", Actor(User, currentUserService));

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRetirement",
            "Submitted",
            retirementId,
            SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue),
            $"Retirement '{SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue)}' submitted.",
            Actor(User, currentUserService),
            tenant.TenantId,
            null,
            cancellationToken);

        return Ok(new { Message = "Retirement submitted successfully.", Retirement = retirement });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRetirementApprove)]
    [HttpPost("retirements/{retirementId:guid}/approve")]
    public async Task<IActionResult> ApproveRetirement(
        Guid retirementId,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var retirement = await dbContext.Set<ExpenseAdvanceRetirement>()
            .FirstOrDefaultAsync(x => x.Id == retirementId && x.TenantId == tenant.TenantId, cancellationToken);

        if (retirement is null)
        {
            return NotFound(new { Message = "Retirement was not found.", RetirementId = retirementId });
        }

        var retirementRequestId = EF.Property<Guid>(retirement, "RequestId");

        var advanceRequest = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == retirementRequestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (advanceRequest is null)
        {
            return NotFound(new { Message = "Related advance request was not found.", RequestId = retirementRequestId });
        }

        var actor = Actor(User, currentUserService) ?? "System";
        var policy = await GetPolicyAsync(dbContext, tenant.TenantId, cancellationToken);

        if ((policy?.BlockSelfApproval ?? true) &&
            !string.IsNullOrWhiteSpace(SafeString(dbContext.Entry(retirement).Property("CreatedBy").CurrentValue)) &&
            string.Equals(SafeString(dbContext.Entry(retirement).Property("CreatedBy").CurrentValue), actor, StringComparison.OrdinalIgnoreCase))
        {
            return Conflict(new { Message = "Maker-checker policy blocks same-user approval.", retirementId });
        }

        var totalRetired = SafeDecimal(dbContext.Entry(retirement).Property("TotalRetiredAmount").CurrentValue);
        var outstandingBefore = advanceRequest.OutstandingAmount > 0m ? advanceRequest.OutstandingAmount : advanceRequest.RequestedAmount;
        var newRetired = Math.Min(advanceRequest.RequestedAmount, advanceRequest.RetiredAmount + totalRetired);
        var newOutstanding = Math.Max(0m, advanceRequest.RequestedAmount - newRetired);

        SetEnumProperty(dbContext, retirement, "Status", 3);
        SetProperty(dbContext, retirement, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, retirement, "LastModifiedBy", actor);

        SetProperty(dbContext, advanceRequest, "RetiredAmount", newRetired);
        SetProperty(dbContext, advanceRequest, "OutstandingAmount", newOutstanding);
        SetProperty(dbContext, advanceRequest, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, advanceRequest, "LastModifiedBy", actor);

        if (newOutstanding <= 0m)
        {
            SetEnumProperty(dbContext, advanceRequest, "Status", (int)AdvanceRequestStatus.FullyRetired);
        }
        else
        {
            SetEnumProperty(dbContext, advanceRequest, "Status", (int)AdvanceRequestStatus.PartiallyRetired);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRetirement",
            "Approved",
            retirementId,
            SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue),
            $"Retirement '{SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue)}' approved.",
            actor,
            tenant.TenantId,
            new { advanceRequest.Id, PreviousOutstanding = outstandingBefore, NewOutstanding = newOutstanding },
            cancellationToken);

        return Ok(new { Message = "Retirement approved successfully.", Retirement = retirement, AdvanceRequest = advanceRequest });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRetirementReject)]
    [HttpPost("retirements/{retirementId:guid}/reject")]
    public async Task<IActionResult> RejectRetirement(
        Guid retirementId,
        [FromBody] RejectWorkflowRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        var retirement = await dbContext.Set<ExpenseAdvanceRetirement>()
            .FirstOrDefaultAsync(x => x.Id == retirementId && x.TenantId == tenant.TenantId, cancellationToken);

        if (retirement is null)
        {
            return NotFound(new { Message = "Retirement was not found.", RetirementId = retirementId });
        }

        SetEnumProperty(dbContext, retirement, "Status", 4);
        SetProperty(dbContext, retirement, "RejectionReason", request.Reason.Trim());
        SetProperty(dbContext, retirement, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, retirement, "LastModifiedBy", Actor(User, currentUserService));

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRetirement",
            "Rejected",
            retirementId,
            SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue),
            $"Retirement '{SafeString(dbContext.Entry(retirement).Property("RetirementNumber").CurrentValue)}' rejected.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.Reason },
            cancellationToken);

        return Ok(new { Message = "Retirement rejected successfully.", Retirement = retirement });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRefundRecord)]
    [HttpPost("refunds")]
    public async Task<IActionResult> RecordRefund(
        [FromBody] RecordExpenseAdvanceRefundRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        if (request.Amount <= 0m)
        {
            return BadRequest(new { Message = "Refund amount must be greater than zero." });
        }

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == request.RequestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", request.RequestId });
        }

        if (request.Amount > item.OutstandingAmount)
        {
            return Conflict(new { Message = "Refund cannot exceed outstanding balance.", item.OutstandingAmount, request.Amount });
        }

        var account = await dbContext.LedgerAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.CashOrBankLedgerAccountId, cancellationToken);

        if (!IsPostingReady(account) || account is null || !account.IsCashOrBankAccount)
        {
            return BadRequest(new { Message = "Cash / bank ledger account must be an active posting cash or bank account." });
        }

        var newOutstanding = item.OutstandingAmount - request.Amount;
        SetProperty(dbContext, item, "OutstandingAmount", newOutstanding);
        SetProperty(dbContext, item, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, item, "LastModifiedBy", Actor(User, currentUserService));

        if (newOutstanding <= 0m)
        {
            SetEnumProperty(dbContext, item, "Status", (int)AdvanceRequestStatus.Closed);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "RefundRecorded",
            item.Id,
            item.RequestNumber,
            $"Refund recorded for advance request '{item.RequestNumber}'.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.Amount, request.CashOrBankLedgerAccountId, request.Notes },
            cancellationToken);

        return Ok(new { Message = "Refund recorded successfully.", Item = item });
    }

    [Authorize(Policy = AuthorizationPolicies.EamRecoveryManage)]
    [HttpPost("recoveries")]
    public async Task<IActionResult> RecordRecovery(
        [FromBody] RecordExpenseAdvanceRecoveryRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        var tenantGuard = await EnsureTenantAsync(tenantContextAccessor);
        if (tenantGuard is not null)
        {
            return tenantGuard;
        }

        var tenant = tenantContextAccessor.Current;

        if (request.Amount <= 0m)
        {
            return BadRequest(new { Message = "Recovery amount must be greater than zero." });
        }

        var item = await dbContext.Set<ExpenseAdvanceRequest>()
            .FirstOrDefaultAsync(x => x.Id == request.RequestId && x.TenantId == tenant.TenantId, cancellationToken);

        if (item is null)
        {
            return NotFound(new { Message = "Advance request was not found.", request.RequestId });
        }

        if (request.Amount > item.OutstandingAmount)
        {
            return Conflict(new { Message = "Recovery cannot exceed unrecovered outstanding balance.", item.OutstandingAmount, request.Amount });
        }

        var normalizedMethod = string.IsNullOrWhiteSpace(request.Method) ? "Salary Recovery" : request.Method.Trim();

        var newOutstanding = item.OutstandingAmount - request.Amount;
        SetProperty(dbContext, item, "OutstandingAmount", newOutstanding);
        SetProperty(dbContext, item, "LastModifiedOnUtc", DateTime.UtcNow);
        SetProperty(dbContext, item, "LastModifiedBy", Actor(User, currentUserService));

        if (newOutstanding <= 0m)
        {
            SetEnumProperty(dbContext, item, "Status", (int)AdvanceRequestStatus.Closed);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        await auditTrailWriter.WriteAsync(
            "eam",
            "ExpenseAdvanceRequest",
            "RecoveryRecorded",
            item.Id,
            item.RequestNumber,
            $"Recovery recorded for advance request '{item.RequestNumber}'.",
            Actor(User, currentUserService),
            tenant.TenantId,
            new { request.Amount, Method = normalizedMethod, request.Notes },
            cancellationToken);

        return Ok(new { Message = "Recovery recorded successfully.", Item = item });
    }

    public sealed record CreateExpenseAdvanceRequest(
        Guid AdvanceTypeId,
        Guid EmployeeId,
        DateTime RequestDateUtc,
        string Purpose,
        decimal RequestedAmount,
        string? Department,
        string? Branch,
        string? CostCenter,
        string? Destination,
        DateTime? ExpectedRetirementDateUtc,
        string? Notes);

    public sealed record RejectWorkflowRequest(string Reason);

    public sealed record UpsertExpenseAdvancePolicyRequest(
        decimal MaxAmount,
        int AllowedOpenAdvancesPerStaff,
        int RetirementDueDays,
        bool AttachmentRequired,
        bool BlockSelfApproval,
        bool AllowExcessReimbursement,
        bool AllowSalaryRecovery,
        bool RequireDepartmentScope,
        bool RequireBranchScope,
        bool RequireCostCenterScope,
        bool TravelAdvanceRequiresDestination,
        bool ImprestRequiresRetirement,
        bool IsActive);

    public sealed record UpsertExpenseAdvanceTypeRequest(
        string Code,
        string Name,
        bool IsSystemDefined,
        bool IsActive,
        string? Notes);

    public sealed record UpsertExpenseCategoryRequest(
        string Code,
        string Name,
        Guid? DefaultExpenseLedgerAccountId,
        bool IsActive,
        string? Notes);

    public sealed record UpsertExpenseAdvancePostingSetupRequest(
        Guid? AdvanceControlLedgerAccountId,
        Guid? RefundLedgerAccountId,
        Guid? SalaryRecoveryLedgerAccountId,
        Guid? ReimbursementPayableLedgerAccountId,
        Guid? RecoveryClearingLedgerAccountId,
        Guid? DefaultCashBankLedgerAccountId);

    public sealed record DisburseExpenseAdvanceRequest(
        Guid CashOrBankLedgerAccountId,
        string? Notes);

    public sealed record SaveExpenseAdvanceRetirementRequest(
        Guid RequestId,
        DateTime RetirementDateUtc,
        string? Notes,
        List<SaveExpenseAdvanceRetirementLineRequest> Lines);

    public sealed record SaveExpenseAdvanceRetirementLineRequest(
        Guid ExpenseCategoryId,
        string Description,
        decimal Amount);

    public sealed record RecordExpenseAdvanceRefundRequest(
        Guid RequestId,
        Guid CashOrBankLedgerAccountId,
        decimal Amount,
        string? Notes);

    public sealed record RecordExpenseAdvanceRecoveryRequest(
        Guid RequestId,
        string Method,
        decimal Amount,
        string? Notes);
}
