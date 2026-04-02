using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace iBalance.Modules.Universities.DependencyInjection;

public static class UniversitiesModuleServiceCollectionExtensions
{
    public static IServiceCollection AddUniversitiesModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        return services;
    }
}