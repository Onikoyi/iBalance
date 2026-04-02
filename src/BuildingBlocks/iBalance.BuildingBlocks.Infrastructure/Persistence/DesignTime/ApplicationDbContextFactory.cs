using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.DesignTime;

public sealed class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();

        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5432;Database=ibalance;Username=postgres;Password=postgres");

        return new ApplicationDbContext(
            optionsBuilder.Options,
            new DesignTimeTenantContextAccessor(),
            new DesignTimeCurrentUserService());
    }
}