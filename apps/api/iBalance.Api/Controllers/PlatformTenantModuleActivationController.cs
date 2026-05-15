using iBalance.Api.Services.Audit;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin")]
[Route("api/admin/platform/tenant-modules")]
public sealed class PlatformTenantModuleActivationController : ControllerBase
{
    private static readonly ModuleDefinition[] ModuleDefinitions =
    [
        new("admin", "Administration", 5),
        new("finance", "General Ledger & Finance", 10),
        new("budget", "Budget", 20),
        new("payroll", "Payroll", 30),
        new("procurement", "Procurement", 40),
        new("ap", "Accounts Payable", 50),
        new("ar", "Accounts Receivable", 60),
        new("treasury", "Treasury & Banking", 70),
        new("inventory", "Inventory", 80),
        new("fixedassets", "Fixed Assets", 90),
        new("eam", "Expense & Advance Management", 100),
        new("reports", "Reports", 110),
        new("workingcapital", "Working Capital", 120),
        new("fleet", "Fleet Management", 95),
    ];


    [HttpGet("{tenantId:guid}")]
    public async Task<IActionResult> GetTenantModuleActivation(
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
            return NotFound(new { Message = "Tenant was not found.", TenantId = tenantId });
        }

        var moduleCodes = ModuleDefinitions.Select(m => m.Code).ToArray();

        var permissions = await dbContext.Set<SecurityPermission>()
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.TenantId == tenantId && moduleCodes.Contains(x.Module))
            .ToListAsync(cancellationToken);

        var items = ModuleDefinitions
            .OrderBy(x => x.DisplayOrder)
            .Select(module =>
            {
                var modulePermissions = permissions
                    .Where(x => string.Equals(x.Module, module.Code, StringComparison.OrdinalIgnoreCase))
                    .ToList();

                var total = modulePermissions.Count;
                var active = modulePermissions.Count(x => x.IsActive);

                return new
                {
                    module.Code,
                    module.Name,
                    module.DisplayOrder,
                    IsEnabled = total > 0 && active > 0,
                    TotalPermissionCount = total,
                    ActivePermissionCount = active,
                    CanBeManaged = total > 0
                };
            })
            .ToList();

        return Ok(new
        {
            Tenant = new
            {
                tenant.Id,
                tenant.Name,
                tenant.Key,
                tenant.Status
            },
            Count = items.Count,
            Items = items
        });
    }

    [HttpPut("{tenantId:guid}")]
    public async Task<IActionResult> SaveTenantModuleActivation(
        Guid tenantId,
        [FromBody] SaveTenantModuleActivationRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] IAuditTrailWriter auditTrailWriter,
        CancellationToken cancellationToken)
    {
        if (request.Items is null || request.Items.Count == 0)
        {
            return BadRequest(new { Message = "At least one module activation item is required." });
        }

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new { Message = "Tenant was not found.", TenantId = tenantId });
        }

        var normalizedRequestedCodes = request.Items
            .Select(x => x.ModuleCode?.Trim().ToLowerInvariant())
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct()
            .ToList();

        var allowedCodes = ModuleDefinitions.Select(x => x.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (normalizedRequestedCodes.Any(code => code is null || !allowedCodes.Contains(code)))
        {
            return BadRequest(new { Message = "One or more module codes are invalid." });
        }

        var permissions = await dbContext.Set<SecurityPermission>()
            .IgnoreQueryFilters()
            .Where(x => x.TenantId == tenantId && normalizedRequestedCodes.Contains(x.Module))
            .ToListAsync(cancellationToken);

        var grouped = permissions
            .GroupBy(x => x.Module, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.ToList(), StringComparer.OrdinalIgnoreCase);

        var missing = normalizedRequestedCodes
            .Where(code => code is not null && !grouped.ContainsKey(code))
            .ToList();

        if (missing.Count > 0)
        {
            return Conflict(new
            {
                Message = "One or more modules cannot be managed because permissions have not been seeded for that tenant.",
                MissingModules = missing
            });
        }

        foreach (var item in request.Items)
        {
            var code = item.ModuleCode.Trim().ToLowerInvariant();
            var modulePermissions = grouped[code];

            foreach (var permission in modulePermissions)
            {
                permission.Update(
                    permission.Module,
                    permission.Action,
                    permission.Name,
                    permission.Description,
                    item.IsEnabled);
            }

            await auditTrailWriter.WriteAsync(
                "admin",
                "TenantModuleActivation",
                item.IsEnabled ? "ModuleEnabled" : "ModuleDisabled",
                tenantId,
                code,
                $"Module '{code}' {(item.IsEnabled ? "enabled" : "disabled")} for tenant '{tenant.Key}'.",
                User.Identity?.Name,
                tenantId,
                new
                {
                    ModuleCode = code,
                    item.IsEnabled,
                    PermissionCount = modulePermissions.Count
                },
                cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Tenant module activation updated successfully.",
            TenantId = tenantId,
            UpdatedCount = request.Items.Count
        });
    }

    public sealed record SaveTenantModuleActivationRequest(List<SaveTenantModuleActivationItem> Items);
    public sealed record SaveTenantModuleActivationItem(string ModuleCode, bool IsEnabled);
    private sealed record ModuleDefinition(string Code, string Name, int DisplayOrder);
}
