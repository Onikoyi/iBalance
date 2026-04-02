using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace iBalance.Modules.Finance.DependencyInjection;

public static class FinanceModuleServiceCollectionExtensions
{
    public static IServiceCollection AddFinanceModule(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        return services;
    }
}