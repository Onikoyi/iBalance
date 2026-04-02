using Microsoft.AspNetCore.Mvc;

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/system")]
public sealed class SystemController : ControllerBase
{
    [HttpGet("ping")]
    public IActionResult Ping()
    {
        return Ok(new
        {
            Name = "iBalance API",
            Message = "Pong",
            TimestampUtc = DateTime.UtcNow
        });
    }
}