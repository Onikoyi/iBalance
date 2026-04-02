using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace iBalance.Modules.OilAndGas.DependencyInjection;

public static class OilAndGasModuleServiceCollectionExtensions
{
    public static IServiceCollection AddOilAndGasModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        return services;
    }
}