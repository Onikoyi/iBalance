using iBalance.BuildingBlocks.Application.Security;

namespace iBalance.BuildingBlocks.Infrastructure.Persistence.DesignTime;

internal sealed class DesignTimeCurrentUserService : ICurrentUserService
{
    public string? UserId => "design-time";
    public string? UserName => "design-time";
    public bool IsAuthenticated => false;
}