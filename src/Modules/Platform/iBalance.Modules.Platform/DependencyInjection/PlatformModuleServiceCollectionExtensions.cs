using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace iBalance.Modules.Platform.DependencyInjection;

public static class PlatformModuleServiceCollectionExtensions
{
    public static IServiceCollection AddPlatformModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        return services;
    }
}