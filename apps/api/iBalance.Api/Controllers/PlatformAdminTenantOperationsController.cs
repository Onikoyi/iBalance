
using iBalance.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("api/admin/platform/tenant-operations-legacy")]
public sealed class PlatformAdminTenantOperationsController : ControllerBase
{
    [Authorize(Policy = AuthorizationPolicies.AdminAccess)]
    [NonAction]
    public void LegacyControllerDisabled()
    {
    }
}
