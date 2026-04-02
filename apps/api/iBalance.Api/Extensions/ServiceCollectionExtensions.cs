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

        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();
        services.AddControllers();

        return services;
    }
}