using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin,TenantAdmin")]
[Route("api/admin/access-control")]
public sealed class AccessControlController : ControllerBase
{
    private static bool IsProtectedRoleCode(string code)
    {
        return string.Equals(code, "PLATFORM_ADMIN", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsCurrentUserPlatformAdmin(ClaimsPrincipal user)
    {
        return user.IsInRole("PlatformAdmin");
    }

    [HttpPost("seed-defaults")]
    public async Task<IActionResult> SeedDefaults(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var permissionSeed = new[]
        {
            new { Code = "admin.access", Module = "admin", Action = "access", Name = "Administration Access", Description = "Access administration workspace." },
            new { Code = "admin.users.manage", Module = "admin", Action = "manage", Name = "Manage Users", Description = "Manage user accounts." },
            new { Code = "admin.roles.manage", Module = "admin", Action = "manage", Name = "Manage Roles", Description = "Manage enterprise roles." },
            new { Code = "admin.permissions.manage", Module = "admin", Action = "manage", Name = "Manage Permissions", Description = "Manage enterprise permissions." },
            new { Code = "admin.scopes.manage", Module = "admin", Action = "manage", Name = "Manage Scopes", Description = "Manage departments, branches, and cost centers." },
            new { Code = "finance.view", Module = "finance", Action = "view", Name = "View Finance", Description = "Access finance workspaces." },
            new { Code = "finance.setup.manage", Module = "finance", Action = "manage", Name = "Manage Finance Setup", Description = "Maintain finance setup." },
            new { Code = "finance.transactions.create", Module = "finance", Action = "create", Name = "Create Finance Transactions", Description = "Create finance transactions." },
            new { Code = "finance.transactions.submit", Module = "finance", Action = "submit", Name = "Submit Finance Transactions", Description = "Submit finance transactions." },
            new { Code = "finance.transactions.approve", Module = "finance", Action = "approve", Name = "Approve Finance Transactions", Description = "Approve finance transactions." },
            new { Code = "finance.transactions.reject", Module = "finance", Action = "reject", Name = "Reject Finance Transactions", Description = "Reject finance transactions." },
            new { Code = "finance.transactions.post", Module = "finance", Action = "post", Name = "Post Finance Transactions", Description = "Post finance transactions." },
            new { Code = "finance.transactions.delete", Module = "finance", Action = "delete", Name = "Delete Finance Transactions", Description = "Delete finance transactions." },
            new { Code = "finance.reports.view", Module = "finance", Action = "report", Name = "View Finance Reports", Description = "View and print finance reports." },
            new { Code = "payroll.view", Module = "payroll", Action = "view", Name = "View Payroll", Description = "Access payroll workspace." },
            new { Code = "payroll.manage", Module = "payroll", Action = "manage", Name = "Manage Payroll Setup", Description = "Manage payroll masters and setup." },
            new { Code = "payroll.run.submit", Module = "payroll", Action = "submit", Name = "Submit Payroll Runs", Description = "Submit payroll runs." },
            new { Code = "payroll.run.approve", Module = "payroll", Action = "approve", Name = "Approve Payroll Runs", Description = "Approve payroll runs." },
            new { Code = "payroll.run.reject", Module = "payroll", Action = "reject", Name = "Reject Payroll Runs", Description = "Reject payroll runs." },
            new { Code = "payroll.run.post", Module = "payroll", Action = "post", Name = "Post Payroll Runs", Description = "Post payroll runs." },
            new { Code = "procurement.view", Module = "procurement", Action = "view", Name = "View Procurement", Description = "Access procurement workspaces." },
            new { Code = "procurement.requisition.create", Module = "procurement", Action = "create", Name = "Create Requisitions", Description = "Create requisitions." },
            new { Code = "procurement.requisition.submit", Module = "procurement", Action = "submit", Name = "Submit Requisitions", Description = "Submit requisitions." },
            new { Code = "procurement.requisition.approve", Module = "procurement", Action = "approve", Name = "Approve Requisitions", Description = "Approve requisitions." },
            new { Code = "procurement.po.create", Module = "procurement", Action = "create", Name = "Create Purchase Orders", Description = "Create purchase orders." },
            new { Code = "procurement.receipt.create", Module = "procurement", Action = "create", Name = "Create Receipts", Description = "Create receipts." },
            new { Code = "inventory.view", Module = "inventory", Action = "view", Name = "View Inventory", Description = "Access inventory workspaces." },
            new { Code = "inventory.manage", Module = "inventory", Action = "manage", Name = "Manage Inventory", Description = "Manage inventory." },
            new { Code = "treasury.view", Module = "treasury", Action = "view", Name = "View Treasury", Description = "Access treasury workspaces." },
            new { Code = "treasury.manage", Module = "treasury", Action = "manage", Name = "Manage Treasury", Description = "Manage treasury operations." },
            new { Code = "reports.export", Module = "reports", Action = "export", Name = "Export Reports", Description = "Export and print reports." }
        };

        foreach (var item in permissionSeed)
        {
            var exists = await dbContext.Set<SecurityPermission>()
                .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == item.Code, cancellationToken);

            if (!exists)
            {
                dbContext.Set<SecurityPermission>().Add(new SecurityPermission(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    item.Code,
                    item.Module,
                    item.Action,
                    item.Name,
                    item.Description,
                    true,
                    true));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var permissions = await dbContext.Set<SecurityPermission>()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .ToDictionaryAsync(x => x.Code, cancellationToken);

        var roleSeed = new[]
        {
            new
            {
                Code = "PLATFORM_ADMIN",
                Name = "Platform Admin",
                Description = "Platform-wide administrative access.",
                PermissionCodes = new[]
                {
                    "admin.access","admin.users.manage","admin.roles.manage","admin.permissions.manage","admin.scopes.manage",
                    "finance.view","finance.setup.manage","finance.transactions.create","finance.transactions.submit","finance.transactions.approve","finance.transactions.reject","finance.transactions.post","finance.transactions.delete","finance.reports.view",
                    "payroll.view","payroll.manage","payroll.run.submit","payroll.run.approve","payroll.run.reject","payroll.run.post",
                    "procurement.view","procurement.requisition.create","procurement.requisition.submit","procurement.requisition.approve","procurement.po.create","procurement.receipt.create",
                    "inventory.view","inventory.manage","treasury.view","treasury.manage","reports.export"
                }
            },
            new
            {
                Code = "TENANT_ADMIN",
                Name = "Tenant Admin",
                Description = "Tenant administrative access.",
                PermissionCodes = new[]
                {
                    "admin.access","admin.users.manage","admin.roles.manage","admin.permissions.manage","admin.scopes.manage",
                    "finance.view","finance.setup.manage","finance.transactions.create","finance.transactions.submit","finance.transactions.approve","finance.transactions.reject","finance.transactions.post","finance.transactions.delete","finance.reports.view",
                    "payroll.view","payroll.manage","payroll.run.submit","payroll.run.approve","payroll.run.reject","payroll.run.post",
                    "procurement.view","procurement.requisition.create","procurement.requisition.submit","procurement.requisition.approve","procurement.po.create","procurement.receipt.create",
                    "inventory.view","inventory.manage","treasury.view","treasury.manage","reports.export"
                }
            },
            new
            {
                Code = "ACCOUNTANT",
                Name = "Accountant",
                Description = "Core finance operational role.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.setup.manage","finance.transactions.create","finance.transactions.submit","finance.transactions.post","finance.reports.view","reports.export"
                }
            },
            new
            {
                Code = "APPROVER",
                Name = "Approver",
                Description = "Approval role across workflow modules.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.transactions.approve","finance.transactions.reject","finance.reports.view",
                    "payroll.view","payroll.run.approve","payroll.run.reject",
                    "procurement.view","procurement.requisition.approve","reports.export"
                }
            },
            new
            {
                Code = "VIEWER",
                Name = "Viewer",
                Description = "Read-only access.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.reports.view","reports.export"
                }
            },
            new
            {
                Code = "PROCUREMENT_OFFICER",
                Name = "Procurement Officer",
                Description = "Departmental procurement processing.",
                PermissionCodes = new[]
                {
                    "procurement.view","procurement.requisition.create","procurement.requisition.submit","procurement.po.create","procurement.receipt.create","reports.export"
                }
            },
            new
            {
                Code = "PAYROLL_OFFICER",
                Name = "Payroll Officer",
                Description = "Departmental payroll processing.",
                PermissionCodes = new[]
                {
                    "payroll.view","payroll.manage","payroll.run.submit","reports.export"
                }
            },
            new
            {
                Code = "TREASURY_OFFICER",
                Name = "Treasury Officer",
                Description = "Departmental treasury processing.",
                PermissionCodes = new[]
                {
                    "treasury.view","treasury.manage","reports.export"
                }
            },
            new
            {
                Code = "HR_OFFICER",
                Name = "HR Officer",
                Description = "Human resource administrative role.",
                PermissionCodes = new[]
                {
                    "payroll.view","payroll.manage","reports.export"
                }
            },
            new
            {
                Code = "INVENTORY_OFFICER",
                Name = "Inventory Officer",
                Description = "Departmental inventory control role.",
                PermissionCodes = new[]
                {
                    "inventory.view","inventory.manage","reports.export"
                }
            },
            new
            {
                Code = "BUDGET_OWNER",
                Name = "Budget Owner",
                Description = "Departmental budget ownership role.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.reports.view","reports.export"
                }
            },
            new
            {
                Code = "AUDITOR",
                Name = "Auditor",
                Description = "Read-only cross-functional audit role.",
                PermissionCodes = new[]
                {
                    "finance.view","finance.reports.view","payroll.view","procurement.view","inventory.view","treasury.view","reports.export"
                }
            }
        };

        foreach (var item in roleSeed)
        {
            var role = await dbContext.Set<SecurityRole>()
                .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId && x.Code == item.Code, cancellationToken);

            if (role is null)
            {
                role = new SecurityRole(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    item.Code,
                    item.Name,
                    item.Description,
                    true,
                    true);

                dbContext.Set<SecurityRole>().Add(role);
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            var existingPermissionIds = await dbContext.Set<SecurityRolePermission>()
                .Where(x => x.TenantId == tenantContext.TenantId && x.SecurityRoleId == role.Id)
                .Select(x => x.SecurityPermissionId)
                .ToListAsync(cancellationToken);

            foreach (var permissionCode in item.PermissionCodes)
            {
                if (!permissions.TryGetValue(permissionCode, out var permission))
                {
                    continue;
                }

                if (existingPermissionIds.Contains(permission.Id))
                {
                    continue;
                }

                dbContext.Set<SecurityRolePermission>().Add(new SecurityRolePermission(
                    Guid.NewGuid(),
                    tenantContext.TenantId,
                    role.Id,
                    permission.Id));
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Default enterprise access roles and permissions seeded successfully." });
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<SecurityRole>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Description,
                x.IsSystemDefined,
                x.IsActive,
                IsProtected = IsProtectedRoleCode(x.Code),
                PermissionCount = dbContext.Set<SecurityRolePermission>().Count(m => m.SecurityRoleId == x.Id),
                PermissionIds = dbContext.Set<SecurityRolePermission>()
                    .Where(m => m.SecurityRoleId == x.Id)
                    .Select(m => m.SecurityPermissionId)
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("roles")]
    public async Task<IActionResult> CreateRole([FromBody] UpsertSecurityRoleRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Role code and name are required." });
        }

        var exists = await dbContext.Set<SecurityRole>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A role with the same code already exists." });
        }

        var role = new SecurityRole(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, false, request.IsActive);
        dbContext.Set<SecurityRole>().Add(role);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Role created successfully.",
            Role = new { role.Id, role.Code, role.Name, role.Description, role.IsActive }
        });
    }

    [HttpPut("roles/{roleId:guid}")]
    public async Task<IActionResult> UpdateRole(
        Guid roleId,
        [FromBody] UpsertSecurityRoleRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var role = await dbContext.Set<SecurityRole>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId && x.Id == roleId, cancellationToken);

        if (role is null)
        {
            return NotFound(new { Message = "Role was not found." });
        }

        if (IsProtectedRoleCode(role.Code) && !IsCurrentUserPlatformAdmin(User))
        {
            return Forbid();
        }

        role.Update(request.Name, request.Description, request.IsActive);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Role updated successfully." });
    }

    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<SecurityPermission>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Module)
            .ThenBy(x => x.Action)
            .Select(x => new { x.Id, x.Code, x.Module, x.Action, x.Name, x.Description, x.IsSystemDefined, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("permissions")]
    public async Task<IActionResult> CreatePermission([FromBody] UpsertSecurityPermissionRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Module) || string.IsNullOrWhiteSpace(request.Action) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Permission code, module, action, and name are required." });
        }

        var exists = await dbContext.Set<SecurityPermission>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToLowerInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A permission with the same code already exists." });
        }

        var item = new SecurityPermission(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Module, request.Action, request.Name, request.Description, false, request.IsActive);
        dbContext.Set<SecurityPermission>().Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Permission created successfully." });
    }

    [HttpPut("roles/{roleId:guid}/permissions")]
    public async Task<IActionResult> SetRolePermissions(Guid roleId, [FromBody] SetRolePermissionsRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var role = await dbContext.Set<SecurityRole>()
            .FirstOrDefaultAsync(x => x.TenantId == tenantContext.TenantId && x.Id == roleId, cancellationToken);

        if (role is null)
        {
            return NotFound(new { Message = "Role was not found." });
        }

        if (IsProtectedRoleCode(role.Code) && !IsCurrentUserPlatformAdmin(User))
        {
            return Forbid();
        }

        if (IsProtectedRoleCode(role.Code))
        {
            return BadRequest(new
            {
                Message = "Platform Admin permissions are system-protected and cannot be modified."
            });
        }

        var existing = await dbContext.Set<SecurityRolePermission>()
            .Where(x => x.TenantId == tenantContext.TenantId && x.SecurityRoleId == roleId)
            .ToListAsync(cancellationToken);

        dbContext.Set<SecurityRolePermission>().RemoveRange(existing);

        foreach (var permissionId in request.PermissionIds ?? new List<Guid>())
        {
            dbContext.Set<SecurityRolePermission>().Add(new SecurityRolePermission(Guid.NewGuid(), tenantContext.TenantId, roleId, permissionId));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Role permissions updated successfully." });
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<OrganizationDepartment>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.Description, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("departments")]
    public async Task<IActionResult> CreateDepartment([FromBody] UpsertScopeMasterRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Department code and name are required." });
        }

        var exists = await dbContext.Set<OrganizationDepartment>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A department with the same code already exists." });
        }

        dbContext.Set<OrganizationDepartment>().Add(new OrganizationDepartment(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, request.IsActive));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Department created successfully." });
    }

    [HttpGet("branches")]
    public async Task<IActionResult> GetBranches([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<OrganizationBranch>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.Description, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("branches")]
    public async Task<IActionResult> CreateBranch([FromBody] UpsertScopeMasterRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Branch code and name are required." });
        }

        var exists = await dbContext.Set<OrganizationBranch>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A branch with the same code already exists." });
        }

        dbContext.Set<OrganizationBranch>().Add(new OrganizationBranch(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, request.IsActive));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Branch created successfully." });
    }

    [HttpGet("cost-centers")]
    public async Task<IActionResult> GetCostCenters([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<OrganizationCostCenter>()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantContext.TenantId)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.Description, x.IsActive })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("cost-centers")]
    public async Task<IActionResult> CreateCostCenter([FromBody] UpsertScopeMasterRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Cost center code and name are required." });
        }

        var exists = await dbContext.Set<OrganizationCostCenter>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.Code == request.Code.Trim().ToUpperInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A cost center with the same code already exists." });
        }

        dbContext.Set<OrganizationCostCenter>().Add(new OrganizationCostCenter(Guid.NewGuid(), tenantContext.TenantId, request.Code, request.Name, request.Description, request.IsActive));
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { Message = "Cost center created successfully." });
    }

    [HttpGet("users/access-assignments")]
    public async Task<IActionResult> GetUserAccessAssignments([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var users = await dbContext.UserAccounts
            .AsNoTracking()
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
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        var roleAssignments = await dbContext.Set<UserSecurityRoleAssignment>()
            .AsNoTracking()
            .Join(
                dbContext.Set<SecurityRole>().AsNoTracking(),
                a => a.SecurityRoleId,
                r => r.Id,
                (a, r) => new
                {
                    a.UserAccountId,
                    Role = new
                    {
                        r.Id,
                        r.Code,
                        r.Name,
                        a.IsPrimary
                    }
                })
            .ToListAsync(cancellationToken);

        var scopeAssignments = await dbContext.Set<UserScopeAssignment>()
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var items = users.Select(user => new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.DisplayName,
            user.Role,
            user.IsActive,
            Roles = roleAssignments.Where(x => x.UserAccountId == user.Id).Select(x => x.Role).ToList(),
            Scopes = scopeAssignments.Where(x => x.UserAccountId == user.Id).Select(x => new
            {
                x.Id,
                x.ScopeType,
                x.ScopeEntityId,
                x.ScopeCode,
                x.ScopeName
            }).ToList()
        }).ToList();

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPut("users/{userId:guid}/access-assignments")]
    public async Task<IActionResult> SetUserAccessAssignments(Guid userId, [FromBody] SetUserAccessAssignmentsRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var roleIds = (request.RoleIds ?? new List<Guid>()).Distinct().ToList();

        var validRoleCount = await dbContext.Set<SecurityRole>()
            .CountAsync(x => x.TenantId == tenantContext.TenantId && roleIds.Contains(x.Id), cancellationToken);

        if (validRoleCount != roleIds.Count)
        {
            return BadRequest(new { Message = "One or more selected roles were not found." });
        }

        var selectedRoles = await dbContext.Set<SecurityRole>()
            .Where(x => x.TenantId == tenantContext.TenantId && roleIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        if (!IsCurrentUserPlatformAdmin(User) && selectedRoles.Any(x => IsProtectedRoleCode(x.Code)))
        {
            return Forbid();
        }

        var existingRoles = await dbContext.Set<UserSecurityRoleAssignment>()
            .Where(x => x.TenantId == tenantContext.TenantId && x.UserAccountId == userId)
            .ToListAsync(cancellationToken);

        dbContext.Set<UserSecurityRoleAssignment>().RemoveRange(existingRoles);

        for (var i = 0; i < roleIds.Count; i++)
        {
            dbContext.Set<UserSecurityRoleAssignment>().Add(new UserSecurityRoleAssignment(
                Guid.NewGuid(),
                tenantContext.TenantId,
                userId,
                roleIds[i],
                i == 0));
        }

        var existingScopes = await dbContext.Set<UserScopeAssignment>()
            .Where(x => x.TenantId == tenantContext.TenantId && x.UserAccountId == userId)
            .ToListAsync(cancellationToken);

        dbContext.Set<UserScopeAssignment>().RemoveRange(existingScopes);

        foreach (var scope in request.Scopes ?? new List<UserScopeAssignmentRequest>())
        {
            if (scope.ScopeEntityId == Guid.Empty || string.IsNullOrWhiteSpace(scope.ScopeType))
            {
                continue;
            }

            dbContext.Set<UserScopeAssignment>().Add(new UserScopeAssignment(
                Guid.NewGuid(),
                tenantContext.TenantId,
                userId,
                scope.ScopeType,
                scope.ScopeEntityId,
                scope.ScopeCode,
                scope.ScopeName));
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "User access assignments updated successfully." });
    }

    [HttpGet("workflow-policies")]
    public async Task<IActionResult> GetWorkflowPolicies([FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var items = await dbContext.Set<DepartmentWorkflowPolicy>()
            .AsNoTracking()
            .Join(
                dbContext.Set<OrganizationDepartment>().AsNoTracking(),
                p => p.OrganizationDepartmentId,
                d => d.Id,
                (p, d) => new
                {
                    p.Id,
                    p.ModuleCode,
                    p.OrganizationDepartmentId,
                    DepartmentCode = d.Code,
                    DepartmentName = d.Name,
                    p.MakerCheckerRequired,
                    p.EnforceSegregationOfDuties,
                    p.MinimumApproverCount,
                    p.Notes,
                    p.IsActive
                })
            .OrderBy(x => x.ModuleCode)
            .ThenBy(x => x.DepartmentName)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            Count = items.Count,
            Items = items
        });
    }

    [HttpPost("workflow-policies")]
    public async Task<IActionResult> CreateWorkflowPolicy([FromBody] UpsertDepartmentWorkflowPolicyRequest request, [FromServices] ApplicationDbContext dbContext, [FromServices] ITenantContextAccessor tenantContextAccessor, CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;
        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        if (request.OrganizationDepartmentId == Guid.Empty || string.IsNullOrWhiteSpace(request.ModuleCode))
        {
            return BadRequest(new { Message = "Department and module code are required." });
        }

        var exists = await dbContext.Set<DepartmentWorkflowPolicy>()
            .AnyAsync(x => x.TenantId == tenantContext.TenantId && x.OrganizationDepartmentId == request.OrganizationDepartmentId && x.ModuleCode == request.ModuleCode.Trim().ToLowerInvariant(), cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A workflow policy already exists for this department and module." });
        }

        dbContext.Set<DepartmentWorkflowPolicy>().Add(new DepartmentWorkflowPolicy(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.ModuleCode,
            request.OrganizationDepartmentId,
            request.MakerCheckerRequired,
            request.EnforceSegregationOfDuties,
            request.MinimumApproverCount,
            request.Notes,
            request.IsActive));

        await dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { Message = "Department workflow policy created successfully." });
    }

    public sealed record UpsertSecurityRoleRequest(string Code, string Name, string? Description, bool IsActive);
    public sealed record UpsertSecurityPermissionRequest(string Code, string Module, string Action, string Name, string? Description, bool IsActive);
    public sealed record SetRolePermissionsRequest(List<Guid>? PermissionIds);
    public sealed record UpsertScopeMasterRequest(string Code, string Name, string? Description, bool IsActive);
    public sealed record UserScopeAssignmentRequest(string ScopeType, Guid ScopeEntityId, string? ScopeCode, string? ScopeName);
    public sealed record SetUserAccessAssignmentsRequest(List<Guid>? RoleIds, List<UserScopeAssignmentRequest>? Scopes);
    public sealed record UpsertDepartmentWorkflowPolicyRequest(string ModuleCode, Guid OrganizationDepartmentId, bool MakerCheckerRequired, bool EnforceSegregationOfDuties, int MinimumApproverCount, string? Notes, bool IsActive);
}