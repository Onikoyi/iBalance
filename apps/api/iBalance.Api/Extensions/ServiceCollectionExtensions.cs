using iBalance.Api.Security;
using iBalance.BuildingBlocks.Infrastructure.DependencyInjection;
using iBalance.Modules.Finance.DependencyInjection;
using iBalance.Modules.OilAndGas.DependencyInjection;
using iBalance.Modules.Platform.DependencyInjection;
using iBalance.Modules.Universities.DependencyInjection;

namespace iBalance.Api.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApiServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddInfrastructureServices(configuration);
        services.AddPlatformModule(configuration);
        services.AddFinanceModule(configuration);
        services.AddUniversitiesModule(configuration);
        services.AddOilAndGasModule(configuration);

        services.AddAuthorization(options =>
        {
            options.AddPolicy(AuthorizationPolicies.AdminAccess, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceView, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant", "Approver", "Viewer");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceSetupManage, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceJournalsCreate, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceJournalsPost, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant", "Approver");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceJournalsReverse, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant", "Approver");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceFiscalPeriodsManage, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant");
            });

            options.AddPolicy(AuthorizationPolicies.FinanceReportsView, policy =>
            {
                policy.RequireAuthenticatedUser();
                policy.RequireRole("PlatformAdmin", "TenantAdmin", "Accountant", "Approver", "Viewer");
            });
        });

        services.AddCors(options =>
        {
            options.AddPolicy("WebClient", policy =>
            {
                policy
                    .WithOrigins("http://localhost:5173")
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
        services.AddControllers();

        return services;
    }
}