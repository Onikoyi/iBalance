// using iBalance.BuildingBlocks.Application.Security;
// using iBalance.BuildingBlocks.Application.Tenancy;
// using iBalance.BuildingBlocks.Infrastructure.Persistence;
// using iBalance.BuildingBlocks.Infrastructure.Security;
// using iBalance.BuildingBlocks.Infrastructure.Tenancy;
// using Microsoft.EntityFrameworkCore;
// using Microsoft.Extensions.Configuration;
// using Microsoft.Extensions.DependencyInjection;

// namespace iBalance.BuildingBlocks.Infrastructure.DependencyInjection;

// public static class InfrastructureServiceCollectionExtensions
// {
//     public static IServiceCollection AddInfrastructureServices(
//         this IServiceCollection services,
//         IConfiguration configuration)
//     {
//         ArgumentNullException.ThrowIfNull(services);
//         ArgumentNullException.ThrowIfNull(configuration);

//         services.AddHttpContextAccessor();

//         services.AddScoped<ITenantContextAccessor, TenantContextAccessor>();
//         services.AddScoped<ICurrentUserService, CurrentUserService>();

//         var connectionString = configuration.GetConnectionString("DefaultConnection")
//             ?? throw new InvalidOperationException("DefaultConnection was not configured.");

//         services.AddDbContext<ApplicationDbContext>(options =>
//             options.UseNpgsql(connectionString));

//         services.AddHealthChecks()
//             .AddDbContextCheck<ApplicationDbContext>();

//         return services;
//     }
// }

using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.BuildingBlocks.Infrastructure.Platform.Seeding;
using iBalance.BuildingBlocks.Infrastructure.Platform.Services;
using iBalance.BuildingBlocks.Infrastructure.Security;
using iBalance.BuildingBlocks.Infrastructure.Tenancy;
using iBalance.Modules.Platform.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace iBalance.BuildingBlocks.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddHttpContextAccessor();

        services.AddScoped<ITenantContextAccessor, TenantContextAccessor>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ITenantLookupService, TenantLookupService>();
        services.AddScoped<PlatformDatabaseSeeder>();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection was not configured.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddHealthChecks();

        return services;
    }
}