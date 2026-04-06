using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

    [HttpGet("tenant-context")]
    public IActionResult GetTenantContext([FromServices] ITenantContextAccessor tenantContextAccessor)
    {
        var tenantContext = tenantContextAccessor.Current;

        return Ok(new
        {
            IsAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null
        });
    }

    [HttpPost("test-user-accounts")]
    public async Task<IActionResult> CreateTestUserAccount(
        [FromBody] CreateTestUserAccountRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        if (!tenantContext.IsAvailable)
        {
            return BadRequest(new
            {
                Message = "Tenant context is required.",
                RequiredHeader = "X-Tenant-Key"
            });
        }

        var userAccount = new UserAccount(
            Guid.NewGuid(),
            tenantContext.TenantId,
            request.Email,
            request.FirstName,
            request.LastName,
            true);

        dbContext.UserAccounts.Add(userAccount);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Test user account created successfully.",
            UserAccountId = userAccount.Id,
            TenantId = userAccount.TenantId,
            Email = userAccount.Email,
            FirstName = userAccount.FirstName,
            LastName = userAccount.LastName,
            IsActive = userAccount.IsActive
        });
    }

    [HttpGet("test-user-accounts")]
    public async Task<IActionResult> GetTestUserAccounts(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        CancellationToken cancellationToken)
    {
        var tenantContext = tenantContextAccessor.Current;

        var userAccounts = await dbContext.UserAccounts
            .AsNoTracking()
            .OrderBy(x => x.Email)
            .Select(x => new
            {
                x.Id,
                x.TenantId,
                x.Email,
                x.FirstName,
                x.LastName,
                x.IsActive
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            TenantContextAvailable = tenantContext.IsAvailable,
            TenantId = tenantContext.IsAvailable ? tenantContext.TenantId : (Guid?)null,
            TenantKey = tenantContext.IsAvailable ? tenantContext.TenantKey : null,
            Count = userAccounts.Count,
            Items = userAccounts
        });
    }

    public sealed record CreateTestUserAccountRequest(
        string Email,
        string FirstName,
        string LastName);
}