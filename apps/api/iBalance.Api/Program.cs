using iBalance.Api.Extensions;
using iBalance.Api.Health;
using iBalance.Api.Middleware;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Platform.Seeding;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApiServices(builder.Configuration);

builder.Services
    .AddHealthChecks()
    .AddCheck<ApiHealthCheck>("api_health_check");

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<PlatformDatabaseSeeder>();
    await seeder.SeedAsync();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("WebClient");

app.UseRouting();

app.UseAuthentication();
app.UseMiddleware<TenantResolutionMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.MapGet("/", (HttpContext httpContext) => Results.Ok(new
{
    Application = "iBalance API",
    Status = "Running",
    TimestampUtc = DateTime.UtcNow,
    CorrelationId = httpContext.Items[CorrelationIdMiddleware.HeaderName]?.ToString()
}));

app.MapGet("/diagnostics/tenant", (ITenantContextAccessor tenantContextAccessor) =>
{
    var tenantContext = tenantContextAccessor.Current;
    var isResolved =
        tenantContext.TenantId != Guid.Empty &&
        !string.IsNullOrWhiteSpace(tenantContext.TenantKey);

    return Results.Ok(new
    {
        Resolved = isResolved,
        TenantId = isResolved ? tenantContext.TenantId : (Guid?)null,
        TenantKey = isResolved ? tenantContext.TenantKey : null
    });
});

app.Run();
