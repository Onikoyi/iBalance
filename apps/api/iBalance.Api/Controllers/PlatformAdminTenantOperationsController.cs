using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace iBalance.Api.Controllers;

[ApiController]
[Authorize(Roles = "PlatformAdmin")]
[ApiExplorerSettings(IgnoreApi = true)]
[Route("api/admin/platform/tenant-operations-legacy")]
public sealed class PlatformAdminTenantOperationsController : ControllerBase
{
    [NonAction]
    public void LegacyControllerDisabled()
    {
    }
}