using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.Modules.Platform.Application.Abstractions;

namespace iBalance.Api.Middleware;

public sealed class TenantResolutionMiddleware
{
    public const string TenantHeaderName = "X-Tenant-Key";

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
        var tenantKey = context.Request.Headers[TenantHeaderName].FirstOrDefault();

        if (!string.IsNullOrWhiteSpace(tenantKey))
        {
            var tenant = await tenantLookupService.GetByKeyAsync(
                tenantKey.Trim(),
                context.RequestAborted);

            if (tenant is not null)
            {
                tenantContextAccessor.SetTenant(tenant.TenantId, tenant.TenantKey);
            }
        }

        await _next(context);
    }
}