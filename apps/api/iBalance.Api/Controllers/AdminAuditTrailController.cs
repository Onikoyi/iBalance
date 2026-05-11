using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin,TenantAdmin")]
[Route("api/admin/audit-trail")]
public sealed class AdminAuditTrailController : ControllerBase
{
    private const int DefaultTake = 200;
    private const int MaxTake = 500;
    private const int DefaultLookbackDays = 90;
    private const int SearchLookbackDays = 180;
    private const int MaxLookbackDays = 365;

    [HttpGet]
    public async Task<IActionResult> GetAuditTrail(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken,
        [FromQuery] string? moduleCode = null,
        [FromQuery] string? search = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        [FromQuery] int? take = null,
        [FromQuery] bool includeAllTenants = false,
        [FromQuery] string? tenantKey = null)
    {
        var isPlatformAdmin = User.IsInRole("PlatformAdmin");
        var tenantContext = tenantContextAccessor.Current;

        if (!isPlatformAdmin && !tenantContext.IsAvailable)
        {
            return BadRequest(new { Message = "Tenant context is required.", RequiredHeader = "X-Tenant-Key" });
        }

        var effectiveTake = Math.Clamp(take ?? DefaultTake, 50, MaxTake);
        var effectiveToUtc = toUtc ?? DateTime.UtcNow;
        var effectiveFromUtc = fromUtc ?? effectiveToUtc.AddDays(string.IsNullOrWhiteSpace(search) ? -DefaultLookbackDays : -SearchLookbackDays);
        var hardMinUtc = effectiveToUtc.AddDays(-MaxLookbackDays);

        if (effectiveFromUtc < hardMinUtc) effectiveFromUtc = hardMinUtc;
        if (effectiveFromUtc > effectiveToUtc) return BadRequest(new { Message = "From date cannot be later than To date." });

        Guid? tenantFilter = null;

        if (isPlatformAdmin && includeAllTenants && string.IsNullOrWhiteSpace(tenantKey))
        {
            tenantFilter = null;
        }
        else if (!string.IsNullOrWhiteSpace(tenantKey))
        {
            var tenant = await dbContext.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Key == tenantKey.Trim(), cancellationToken);

            if (tenant is null) return NotFound(new { Message = "Tenant was not found.", TenantKey = tenantKey });
            tenantFilter = tenant.Id;
        }
        else if (tenantContext.IsAvailable)
        {
            tenantFilter = tenantContext.TenantId;
        }

        var query = dbContext.AuditEvents
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => x.OccurredOnUtc >= effectiveFromUtc && x.OccurredOnUtc <= effectiveToUtc);

        if (tenantFilter.HasValue) query = query.Where(x => x.TenantId == tenantFilter.Value);

        if (!string.IsNullOrWhiteSpace(moduleCode))
        {
            var normalizedModule = moduleCode.Trim().ToLowerInvariant();
            query = query.Where(x => x.ModuleCode == normalizedModule);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(x =>
                EF.Functions.ILike(x.EntityName, pattern) ||
                EF.Functions.ILike(x.Action, pattern) ||
                (x.Reference != null && EF.Functions.ILike(x.Reference, pattern)) ||
                (x.Description != null && EF.Functions.ILike(x.Description, pattern)) ||
                (x.ActorIdentifier != null && EF.Functions.ILike(x.ActorIdentifier, pattern)));
        }

        var rows = await query
            .OrderByDescending(x => x.OccurredOnUtc)
            .Take(effectiveTake)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.ModuleCode,
                x.EntityName,
                x.EntityId,
                x.Action,
                x.Reference,
                x.Description,
                x.ActorUserId,
                x.ActorIdentifier,
                x.MetadataJson,
                x.OccurredOnUtc
            })
            .ToListAsync(cancellationToken);

        var tenantIds = rows.Select(x => x.TenantId).Distinct().ToList();

        var tenants = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(x => tenantIds.Contains(x.Id))
            .Select(x => new { x.Id, x.Key, x.Name })
            .ToListAsync(cancellationToken);

        var tenantMap = tenants.ToDictionary(x => x.Id, x => x);

        var items = rows.Select(x =>
        {
            tenantMap.TryGetValue(x.TenantId, out var tenant);

            return new
            {
                x.Id,
                x.TenantId,
                TenantKey = tenant?.Key,
                TenantName = tenant?.Name,
                x.ModuleCode,
                x.EntityName,
                x.EntityId,
                x.Action,
                x.Reference,
                x.Description,
                x.ActorUserId,
                x.ActorIdentifier,
                x.MetadataJson,
                x.OccurredOnUtc
            };
        }).ToList();

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            WholePlatformMode = isPlatformAdmin && includeAllTenants && !tenantFilter.HasValue,
            FromUtc = effectiveFromUtc,
            ToUtc = effectiveToUtc,
            Take = effectiveTake,
            HardMaxRows = MaxTake,
            HardMaxLookbackDays = MaxLookbackDays,
            Count = items.Count,
            Items = items
        });
    }
}
