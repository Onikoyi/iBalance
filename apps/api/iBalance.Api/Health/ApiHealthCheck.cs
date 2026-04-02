using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace iBalance.Api.Health;

public sealed class ApiHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(
            HealthCheckResult.Healthy("iBalance API is healthy."));
    }
}