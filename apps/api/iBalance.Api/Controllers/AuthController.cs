using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Email;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.BuildingBlocks.Infrastructure.Security;
using iBalance.Modules.Platform.Domain.Entities;
using iBalance.Modules.Platform.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(
        [FromBody] RegisterRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] PasswordHasher passwordHasher,
        [FromServices] IOptions<JwtOptions> jwtOptionsAccessor,
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

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { Message = "Email is required." });
        }

        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            return BadRequest(new { Message = "First name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.LastName))
        {
            return BadRequest(new { Message = "Last name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { Message = "Password is required." });
        }

        if (request.Password.Length < 8)
        {
            return BadRequest(new { Message = "Password must be at least 8 characters." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var exists = await dbContext.UserAccounts
            .AnyAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (exists)
        {
            return Conflict(new
            {
                Message = "A user account with this email already exists for the current tenant."
            });
        }

        var password = passwordHasher.HashPassword(request.Password);

        var user = new UserAccount(
            Guid.NewGuid(),
            tenantContext.TenantId,
            normalizedEmail,
            request.FirstName,
            request.LastName,
            "TenantAdmin",
            password.Hash,
            password.Salt,
            true);

        dbContext.UserAccounts.Add(user);
        await dbContext.SaveChangesAsync(cancellationToken);

        var jwtOptions = jwtOptionsAccessor.Value;
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(jwtOptions.ExpiryMinutes);

        var token = BuildAccessToken(
            user,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            jwtOptions,
            expiresAtUtc);

        return Ok(new
        {
            Message = "Registration successful.",
            AccessToken = token,
            TokenType = "Bearer",
            ExpiresAtUtc = expiresAtUtc,
            LicenseBypassApplied = false,
            User = new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                DisplayName = user.FullName,
                user.Role,
                TenantId = tenantContext.TenantId,
                TenantKey = tenantContext.TenantKey
            }
        });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] PasswordHasher passwordHasher,
        [FromServices] IOptions<JwtOptions> jwtOptionsAccessor,
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

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { Message = "Email is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { Message = "Password is required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (user is null || !user.IsActive)
        {
            return Unauthorized(new
            {
                Message = "Invalid email or password."
            });
        }

        var isPasswordValid = passwordHasher.VerifyPassword(
            request.Password,
            user.PasswordHash,
            user.PasswordSalt);

        if (!isPasswordValid)
        {
            return Unauthorized(new
            {
                Message = "Invalid email or password."
            });
        }

        var isPlatformAdmin = string.Equals(user.Role, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);

        if (!isPlatformAdmin)
        {
            var license = await dbContext.TenantLicenses
                .AsNoTracking()
                .FirstOrDefaultAsync(cancellationToken);

            if (license is null)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Message = "Your tenant license is not configured. Please contact support."
                });
            }

            var tenant = await dbContext.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == tenantContext.TenantId, cancellationToken);

            if (tenant is null)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Message = "Tenant was not found."
                });
            }

            var licenseStatus = tenant.Status != TenantStatus.Active
                ? TenantLicenseStatus.Suspended
                : license.GetStatus(DateTime.UtcNow);

            if (licenseStatus == TenantLicenseStatus.Expired)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Message = "Your tenant license has expired. Please renew your license to continue."
                });
            }

            if (licenseStatus == TenantLicenseStatus.Suspended)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    Message = "Your tenant license is suspended. Please contact support."
                });
            }
        }

        var jwtOptions = jwtOptionsAccessor.Value;
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(jwtOptions.ExpiryMinutes);

        var token = BuildAccessToken(
            user,
            tenantContext.TenantId,
            tenantContext.TenantKey,
            jwtOptions,
            expiresAtUtc);

        return Ok(new
        {
            Message = isPlatformAdmin
                ? "Login successful. Platform administrative recovery access is active."
                : "Login successful.",
            AccessToken = token,
            TokenType = "Bearer",
            ExpiresAtUtc = expiresAtUtc,
            LicenseBypassApplied = isPlatformAdmin,
            User = new
            {
                user.Id,
                user.Email,
                user.FirstName,
                user.LastName,
                DisplayName = user.FullName,
                user.Role,
                TenantId = tenantContext.TenantId,
                TenantKey = tenantContext.TenantKey
            }
        });
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(
        [FromBody] ForgotPasswordRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] PasswordHasher passwordHasher,
        [FromServices] IEmailSender emailSender,
        [FromServices] IOptions<EmailOptions> emailOptionsAccessor,
        [FromServices] IConfiguration configuration,
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

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { Message = "Email is required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (user is not null && user.IsActive)
        {
            var rawToken = passwordHasher.GenerateSecureToken();
            var tokenHash = passwordHasher.ComputeSha256(rawToken);
            var expiresAtUtc = DateTime.UtcNow.AddMinutes(30);

            user.IssuePasswordResetToken(tokenHash, expiresAtUtc);
            await dbContext.SaveChangesAsync(cancellationToken);

            var tenant = await dbContext.Tenants
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == tenantContext.TenantId, cancellationToken);

            var webBaseUrl =
                configuration["App:WebBaseUrl"] ??
                configuration["Application:WebBaseUrl"] ??
                "http://localhost:5173";

            var resetLink =
                $"{webBaseUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(user.Email)}&token={Uri.EscapeDataString(rawToken)}";

            var supportEmail =
                emailOptionsAccessor.Value.ReplyToAddress ??
                emailOptionsAccessor.Value.FromAddress;

            var emailBody = EmailTemplateFactory.CreatePasswordResetEmail(
                user.FullName,
                tenant?.Name ?? tenantContext.TenantKey,
                resetLink,
                supportEmail);

            await emailSender.SendAsync(
                user.Email,
                user.FullName,
                "Password Reset Request",
                emailBody.HtmlBody,
                emailBody.TextBody,
                cancellationToken);
        }

        return Ok(new
        {
            Message = "If an account exists for that email, password reset instructions will be sent."
        });
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(
        [FromBody] ResetPasswordRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] PasswordHasher passwordHasher,
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

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { Message = "Email is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { Message = "Reset token is required." });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { Message = "New password is required." });
        }

        if (request.NewPassword.Length < 8)
        {
            return BadRequest(new { Message = "New password must be at least 8 characters." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await dbContext.UserAccounts
            .FirstOrDefaultAsync(x => x.Email == normalizedEmail, cancellationToken);

        if (user is null || !user.IsActive)
        {
            return BadRequest(new { Message = "Invalid reset request." });
        }

        var tokenHash = passwordHasher.ComputeSha256(request.Token.Trim());

        if (!user.IsPasswordResetTokenValid(tokenHash, DateTime.UtcNow))
        {
            return BadRequest(new { Message = "Reset token is invalid or has expired." });
        }

        var password = passwordHasher.HashPassword(request.NewPassword);
        user.SetPassword(password.Hash, password.Salt);
        user.ClearPasswordResetToken();

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Password reset successful."
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser(
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
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

        if (!currentUserService.IsAuthenticated ||
            !Guid.TryParse(currentUserService.UserId, out var userId))
        {
            return Unauthorized(new
            {
                Message = "Authenticated user context is not available."
            });
        }

        var user = await dbContext.UserAccounts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken);

        if (user is null)
        {
            return NotFound(new
            {
                Message = "User account was not found for the current tenant."
            });
        }

        var isPlatformAdmin = string.Equals(user.Role, "PlatformAdmin", StringComparison.OrdinalIgnoreCase);

        return Ok(new
        {
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            DisplayName = user.FullName,
            user.Role,
            user.IsActive,
            TenantId = tenantContext.TenantId,
            TenantKey = tenantContext.TenantKey,
            LicenseBypassAllowed = isPlatformAdmin
        });
    }

    private static string BuildAccessToken(
        UserAccount user,
        Guid tenantId,
        string tenantKey,
        JwtOptions jwtOptions,
        DateTime expiresAtUtc)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role),
            new("tenant_id", tenantId.ToString()),
            new("tenant_key", tenantKey)
        };

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SecretKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtOptions.Issuer,
            audience: jwtOptions.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public sealed record RegisterRequest(
        string Email,
        string FirstName,
        string LastName,
        string Password);

    public sealed record LoginRequest(string Email, string Password);

    public sealed record ForgotPasswordRequest(string Email);

    public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);
}