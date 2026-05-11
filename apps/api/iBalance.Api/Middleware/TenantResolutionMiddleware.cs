using System.Security.Claims;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.Modules.Platform.Application.Abstractions;
using Microsoft.AspNetCore.Http;

namespace iBalance.Api.Middleware;

public sealed class TenantResolutionMiddleware
{
    public const string TenantHeaderName = "X-Tenant-Key";

    private const string TenantIdClaimType = "tenant_id";
    private const string TenantKeyClaimType = "tenant_key";

    private readonly RequestDelegate _next;

    public TenantResolutionMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task Invoke(
        HttpContext context,
        ITenantContextAccessor tenantContextAccessor,
        ITenantLookupService tenantLookupService)
    {
        tenantContextAccessor.Clear();

        var requestedTenantKey = context.Request.Headers[TenantHeaderName].FirstOrDefault()?.Trim();

        if (context.User.Identity?.IsAuthenticated == true)
        {
            var currentRole = context.User.FindFirstValue(ClaimTypes.Role);
            var isPlatformAdmin = string.Equals(currentRole, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);

            var claimedTenantIdRaw = context.User.FindFirstValue(TenantIdClaimType);
            var claimedTenantKey = context.User.FindFirstValue(TenantKeyClaimType)?.Trim();

            if (!isPlatformAdmin)
            {
                if (!Guid.TryParse(claimedTenantIdRaw, out var claimedTenantId) ||
                    claimedTenantId == Guid.Empty ||
                    string.IsNullOrWhiteSpace(claimedTenantKey))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        Message = "Authenticated tenant context is not available."
                    });
                    return;
                }

                if (!string.IsNullOrWhiteSpace(requestedTenantKey) &&
                    !string.Equals(requestedTenantKey, claimedTenantKey, StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        Message = "You are not allowed to switch tenant context."
                    });
                    return;
                }

                tenantContextAccessor.SetTenant(claimedTenantId, claimedTenantKey);
                await _next(context);
                return;
            }

            if (!string.IsNullOrWhiteSpace(requestedTenantKey))
            {
                var requestedTenant = await tenantLookupService.GetByKeyAsync(
                    requestedTenantKey,
                    context.RequestAborted);

                if (requestedTenant is null)
                {
                    context.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await context.Response.WriteAsJsonAsync(new
                    {
                        Message = "The supplied tenant key was not found.",
                        RequiredHeader = TenantHeaderName
                    });
                    return;
                }

                tenantContextAccessor.SetTenant(requestedTenant.TenantId, requestedTenant.TenantKey);
                await _next(context);
                return;
            }

            if (Guid.TryParse(claimedTenantIdRaw, out var platformTenantId) &&
                platformTenantId != Guid.Empty &&
                !string.IsNullOrWhiteSpace(claimedTenantKey))
            {
                tenantContextAccessor.SetTenant(platformTenantId, claimedTenantKey);
            }

            await _next(context);
            return;
        }

        if (!string.IsNullOrWhiteSpace(requestedTenantKey))
        {
            var tenant = await tenantLookupService.GetByKeyAsync(
                requestedTenantKey,
                context.RequestAborted);

            if (tenant is not null)
            {
                tenantContextAccessor.SetTenant(tenant.TenantId, tenant.TenantKey);
            }
        }

        await _next(context);
    }
}
