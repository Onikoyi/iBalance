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

namespace iBalance.Api.Controllers;

[ApiController]
[Route("api/commercial")]
public sealed class CommercialController : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("subscription-packages")]
    public async Task<IActionResult> GetPublicSubscriptionPackages(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var items = await dbContext.SubscriptionPackages
            .AsNoTracking()
            .Where(x => x.IsActive && x.IsPublic)
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Description,
                x.MonthlyPrice,
                x.CurrencyCode,
                x.DisplayOrder,
                x.IsActive,
                x.IsPublic
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpGet("admin/subscription-packages")]
    public async Task<IActionResult> GetAdminSubscriptionPackages(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var items = await dbContext.SubscriptionPackages
            .AsNoTracking()
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.Name)
            .Select(x => new
            {
                x.Id,
                x.Code,
                x.Name,
                x.Description,
                x.MonthlyPrice,
                x.CurrencyCode,
                x.DisplayOrder,
                x.IsActive,
                x.IsPublic
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = items.Count,
            Items = items
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpPost("admin/subscription-packages")]
    public async Task<IActionResult> CreateSubscriptionPackage(
        [FromBody] UpsertSubscriptionPackageRequest request,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest(new { Message = "Package code is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { Message = "Package name is required." });
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        var exists = await dbContext.SubscriptionPackages
            .AsNoTracking()
            .AnyAsync(x => x.Code == normalizedCode, cancellationToken);

        if (exists)
        {
            return Conflict(new { Message = "A package with the same code already exists." });
        }

        var package = new SubscriptionPackage(
            Guid.NewGuid(),
            normalizedCode,
            request.Name,
            request.Description ?? string.Empty,
            request.MonthlyPrice,
            request.CurrencyCode ?? "NGN",
            request.DisplayOrder,
            request.IsActive,
            request.IsPublic);

        dbContext.SubscriptionPackages.Add(package);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Subscription package created successfully.",
            package.Id,
            package.Code,
            package.Name
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpPut("admin/subscription-packages/{packageId:guid}")]
    public async Task<IActionResult> UpdateSubscriptionPackage(
        Guid packageId,
        [FromBody] UpsertSubscriptionPackageRequest request,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var package = await dbContext.SubscriptionPackages
            .FirstOrDefaultAsync(x => x.Id == packageId, cancellationToken);

        if (package is null)
        {
            return NotFound(new { Message = "Subscription package was not found." });
        }

        var normalizedCode = request.Code.Trim().ToUpperInvariant();

        var duplicateCode = await dbContext.SubscriptionPackages
            .AsNoTracking()
            .AnyAsync(x => x.Id != packageId && x.Code == normalizedCode, cancellationToken);

        if (duplicateCode)
        {
            return Conflict(new { Message = "Another package with the same code already exists." });
        }

        package.Update(
            normalizedCode,
            request.Name,
            request.Description ?? string.Empty,
            request.MonthlyPrice,
            request.CurrencyCode ?? "NGN",
            request.DisplayOrder,
            request.IsActive,
            request.IsPublic);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Subscription package updated successfully.",
            package.Id,
            package.Code,
            package.Name
        });
    }

    [AllowAnonymous]
    [HttpGet("billing-settings")]
    public async Task<IActionResult> GetPublicBillingSettings(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.BillingSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return Ok(new
        {
            AccountName = settings?.AccountName ?? string.Empty,
            BankName = settings?.BankName ?? string.Empty,
            AccountNumber = settings?.AccountNumber ?? string.Empty,
            SupportEmail = settings?.SupportEmail ?? string.Empty,
            PaymentInstructions = settings?.PaymentInstructions ?? string.Empty
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpGet("admin/billing-settings")]
    public async Task<IActionResult> GetAdminBillingSettings(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.BillingSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return Ok(new
        {
            Id = settings?.Id,
            AccountName = settings?.AccountName ?? string.Empty,
            BankName = settings?.BankName ?? string.Empty,
            AccountNumber = settings?.AccountNumber ?? string.Empty,
            SupportEmail = settings?.SupportEmail ?? string.Empty,
            PaymentInstructions = settings?.PaymentInstructions ?? string.Empty
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpPut("admin/billing-settings")]
    public async Task<IActionResult> SaveBillingSettings(
        [FromBody] SaveBillingSettingsRequest request,
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var settings = await dbContext.BillingSettings.FirstOrDefaultAsync(cancellationToken);

        if (settings is null)
        {
            settings = new BillingSettings(
                Guid.NewGuid(),
                request.AccountName ?? string.Empty,
                request.BankName ?? string.Empty,
                request.AccountNumber ?? string.Empty,
                request.SupportEmail ?? string.Empty,
                request.PaymentInstructions ?? string.Empty);

            dbContext.BillingSettings.Add(settings);
        }
        else
        {
            settings.Update(
                request.AccountName ?? string.Empty,
                request.BankName ?? string.Empty,
                request.AccountNumber ?? string.Empty,
                request.SupportEmail ?? string.Empty,
                request.PaymentInstructions ?? string.Empty);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Billing settings saved successfully."
        });
    }

    [AllowAnonymous]
    [HttpPost("applications")]
    public async Task<IActionResult> CreateSubscriptionApplication(
        [FromBody] CreateTenantSubscriptionApplicationRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] PasswordHasher passwordHasher,
        [FromServices] IEmailSender emailSender,
        [FromServices] IOptions<EmailOptions> emailOptionsAccessor,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CompanyName))
        {
            return BadRequest(new { Message = "Company name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.DesiredTenantKey))
        {
            return BadRequest(new { Message = "Desired tenant key is required." });
        }

        if (string.IsNullOrWhiteSpace(request.AdminFirstName))
        {
            return BadRequest(new { Message = "Admin first name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.AdminLastName))
        {
            return BadRequest(new { Message = "Admin last name is required." });
        }

        if (string.IsNullOrWhiteSpace(request.AdminEmail))
        {
            return BadRequest(new { Message = "Admin email is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            return BadRequest(new { Message = "Password must be at least 8 characters." });
        }

        var normalizedTenantKey = request.DesiredTenantKey.Trim().ToLowerInvariant();
        var normalizedEmail = request.AdminEmail.Trim().ToLowerInvariant();

        var tenantExists = await dbContext.Tenants
            .AsNoTracking()
            .AnyAsync(x => x.Key == normalizedTenantKey, cancellationToken);

        if (tenantExists)
        {
            return Conflict(new { Message = "The desired tenant key is already in use." });
        }

        var applicationExists = await dbContext.TenantSubscriptionApplications
            .AsNoTracking()
            .AnyAsync(
                x => x.DesiredTenantKey == normalizedTenantKey &&
                     x.Status != TenantSubscriptionApplicationStatus.Rejected,
                cancellationToken);

        if (applicationExists)
        {
            return Conflict(new { Message = "A subscription application with the same tenant key is already in progress." });
        }

        var package = await dbContext.SubscriptionPackages
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.SubscriptionPackageId && x.IsActive && x.IsPublic, cancellationToken);

        if (package is null)
        {
            return BadRequest(new { Message = "Selected subscription package was not found." });
        }

        var password = passwordHasher.HashPassword(request.Password);
        var paymentReference = $"SUB-{DateTime.UtcNow:yyyyMMddHHmmss}-{Random.Shared.Next(1000, 9999)}";

        var application = new TenantSubscriptionApplication(
            Guid.NewGuid(),
            request.CompanyName,
            normalizedTenantKey,
            request.AdminFirstName,
            request.AdminLastName,
            normalizedEmail,
            password.Hash,
            password.Salt,
            package.Id,
            package.Code,
            package.Name,
            package.MonthlyPrice,
            package.CurrencyCode,
            paymentReference);

        dbContext.TenantSubscriptionApplications.Add(application);
        await dbContext.SaveChangesAsync(cancellationToken);

        var billing = await dbContext.BillingSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        var supportEmail =
            billing?.SupportEmail ??
            emailOptionsAccessor.Value.ReplyToAddress ??
            emailOptionsAccessor.Value.FromAddress;

        var applicationEmail = EmailTemplateFactory.CreateSubscriptionApplicationReceivedEmail(
            $"{request.AdminFirstName} {request.AdminLastName}".Trim(),
            request.CompanyName,
            package.Name,
            paymentReference,
            supportEmail);

        await emailSender.SendAsync(
            normalizedEmail,
            $"{request.AdminFirstName} {request.AdminLastName}".Trim(),
            "Subscription Request Received",
            applicationEmail.HtmlBody,
            applicationEmail.TextBody,
            cancellationToken);

        return Ok(new
        {
            Message = "Subscription application submitted successfully. Please complete payment and await manual confirmation.",
            ApplicationId = application.Id,
            application.CompanyName,
            application.DesiredTenantKey,
            application.AdminEmail,
            application.PackageCodeSnapshot,
            application.PackageNameSnapshot,
            application.AmountSnapshot,
            application.CurrencyCodeSnapshot,
            application.PaymentReference,
            application.Status,
            Billing = new
            {
                AccountName = billing?.AccountName ?? string.Empty,
                BankName = billing?.BankName ?? string.Empty,
                AccountNumber = billing?.AccountNumber ?? string.Empty,
                SupportEmail = billing?.SupportEmail ?? string.Empty,
                PaymentInstructions = billing?.PaymentInstructions ?? string.Empty
            }
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpGet("admin/applications")]
    public async Task<IActionResult> GetSubscriptionApplications(
        [FromServices] ApplicationDbContext dbContext,
        CancellationToken cancellationToken)
    {
        var items = await dbContext.TenantSubscriptionApplications
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedOnUtc)
            .Select(x => new
            {
                x.Id,
                x.CompanyName,
                x.DesiredTenantKey,
                x.AdminFirstName,
                x.AdminLastName,
                x.AdminEmail,
                x.PackageCodeSnapshot,
                x.PackageNameSnapshot,
                x.AmountSnapshot,
                x.CurrencyCodeSnapshot,
                x.PaymentReference,
                x.Status,
                x.PaymentConfirmationNote,
                x.RejectionReason,
                x.ConfirmedByUserId,
                x.PaymentConfirmedOnUtc,
                x.ActivatedTenantId,
                x.CreatedOnUtc
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            Count = items.Count,
            Items = items
        });
    }

    [Authorize]
    [HttpGet("current-license")]
    public async Task<IActionResult> GetCurrentTenantLicense(
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

        var tenant = await dbContext.Tenants
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == tenantContext.TenantId, cancellationToken);

        if (tenant is null)
        {
            return NotFound(new { Message = "Tenant was not found." });
        }

        var license = await dbContext.TenantLicenses
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        if (license is null)
        {
            return Ok(new
            {
                IsConfigured = false,
                TenantId = tenant.Id,
                TenantKey = tenant.Key,
                TenantName = tenant.Name,
                TenantStatus = tenant.Status,
                LicenseStatus = TenantLicenseStatus.Expired,
                Message = "Tenant license is not configured."
            });
        }

        var status = tenant.Status != TenantStatus.Active
            ? TenantLicenseStatus.Suspended
            : license.GetStatus(DateTime.UtcNow);

        return Ok(new
        {
            IsConfigured = true,
            TenantId = tenant.Id,
            TenantKey = tenant.Key,
            TenantName = tenant.Name,
            TenantStatus = tenant.Status,
            LicenseId = license.Id,
            LicenseStartDateUtc = license.LicenseStartDateUtc,
            LicenseEndDateUtc = license.LicenseEndDateUtc,
            PackageName = license.PackageName,
            AmountPaid = license.AmountPaid,
            CurrencyCode = license.CurrencyCode,
            LicenseStatus = status,
            DaysRemaining = license.GetDaysRemaining(DateTime.UtcNow)
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpPost("admin/applications/{applicationId:guid}/confirm-payment")]
    public async Task<IActionResult> ConfirmSubscriptionPayment(
        Guid applicationId,
        [FromBody] ConfirmSubscriptionPaymentRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ITenantContextAccessor tenantContextAccessor,
        [FromServices] ICurrentUserService currentUserService,
        [FromServices] IEmailSender emailSender,
        [FromServices] IOptions<EmailOptions> emailOptionsAccessor,
        [FromServices] IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var originalTenantContext = tenantContextAccessor.Current;

        var application = await dbContext.TenantSubscriptionApplications
            .FirstOrDefaultAsync(x => x.Id == applicationId, cancellationToken);

        if (application is null)
        {
            return NotFound(new { Message = "Subscription application was not found." });
        }

        if (application.Status == TenantSubscriptionApplicationStatus.Activated)
        {
            return Conflict(new { Message = "This application has already been activated." });
        }

        var tenantExists = await dbContext.Tenants
            .AsNoTracking()
            .AnyAsync(x => x.Key == application.DesiredTenantKey, cancellationToken);

        if (tenantExists)
        {
            return Conflict(new { Message = "The tenant key already exists and cannot be activated again." });
        }

        var tenant = new Tenant(
            Guid.NewGuid(),
            application.CompanyName,
            application.DesiredTenantKey,
            TenantStatus.Active);

        dbContext.Tenants.Add(tenant);
        await dbContext.SaveChangesAsync(cancellationToken);

        tenantContextAccessor.SetTenant(tenant.Id, tenant.Key);

        var user = new UserAccount(
            Guid.NewGuid(),
            tenant.Id,
            application.AdminEmail,
            application.AdminFirstName,
            application.AdminLastName,
            "TenantAdmin",
            application.AdminPasswordHash,
            application.AdminPasswordSalt,
            true);

        dbContext.UserAccounts.Add(user);

        var licenseStart = DateTime.UtcNow.Date;
        var licenseEnd = licenseStart.AddYears(1).AddDays(-1);

        var license = new TenantLicense(
            Guid.NewGuid(),
            licenseStart,
            licenseEnd,
            application.PackageNameSnapshot,
            application.AmountSnapshot,
            application.CurrencyCodeSnapshot);

        dbContext.TenantLicenses.Add(license);

        application.Activate(
            tenant.Id,
            currentUserService.UserId,
            DateTime.UtcNow,
            request.Note);

        await dbContext.SaveChangesAsync(cancellationToken);

        if (originalTenantContext.IsAvailable)
        {
            tenantContextAccessor.SetTenant(originalTenantContext.TenantId, originalTenantContext.TenantKey);
        }

        var webBaseUrl =
            configuration["App:WebBaseUrl"] ??
            configuration["Application:WebBaseUrl"] ??
            "http://localhost:5173";

        var supportEmail =
            emailOptionsAccessor.Value.ReplyToAddress ??
            emailOptionsAccessor.Value.FromAddress;

        var activationEmail = EmailTemplateFactory.CreateSubscriptionActivatedEmail(
            $"{application.AdminFirstName} {application.AdminLastName}".Trim(),
            application.CompanyName,
            application.PackageNameSnapshot,
            tenant.Key,
            $"{webBaseUrl.TrimEnd('/')}/login",
            supportEmail);

        await emailSender.SendAsync(
            application.AdminEmail,
            $"{application.AdminFirstName} {application.AdminLastName}".Trim(),
            "Subscription Activated",
            activationEmail.HtmlBody,
            activationEmail.TextBody,
            cancellationToken);

        return Ok(new
        {
            Message = "Payment confirmed, tenant activated, and annual license created successfully.",
            tenant.Id,
            tenant.Name,
            tenant.Key,
            tenant.Status,
            TenantAdminEmail = user.Email,
            LicenseStartDateUtc = license.LicenseStartDateUtc,
            LicenseEndDateUtc = license.LicenseEndDateUtc
        });
    }

    [Authorize(Roles = "PlatformAdmin,TenantAdmin")]
    [HttpPost("admin/applications/{applicationId:guid}/reject")]
    public async Task<IActionResult> RejectSubscriptionApplication(
        Guid applicationId,
        [FromBody] RejectSubscriptionApplicationRequest request,
        [FromServices] ApplicationDbContext dbContext,
        [FromServices] ICurrentUserService currentUserService,
        CancellationToken cancellationToken)
    {
        var application = await dbContext.TenantSubscriptionApplications
            .FirstOrDefaultAsync(x => x.Id == applicationId, cancellationToken);

        if (application is null)
        {
            return NotFound(new { Message = "Subscription application was not found." });
        }

        if (application.Status == TenantSubscriptionApplicationStatus.Activated)
        {
            return Conflict(new { Message = "Activated applications cannot be rejected." });
        }

        application.Reject(currentUserService.UserId, request.Reason);
        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            Message = "Subscription application rejected successfully."
        });
    }

    public sealed record UpsertSubscriptionPackageRequest(
        string Code,
        string Name,
        string? Description,
        decimal MonthlyPrice,
        string? CurrencyCode,
        int DisplayOrder,
        bool IsActive,
        bool IsPublic);

    public sealed record SaveBillingSettingsRequest(
        string? AccountName,
        string? BankName,
        string? AccountNumber,
        string? SupportEmail,
        string? PaymentInstructions);

    public sealed record CreateTenantSubscriptionApplicationRequest(
        string CompanyName,
        string DesiredTenantKey,
        string AdminFirstName,
        string AdminLastName,
        string AdminEmail,
        string Password,
        Guid SubscriptionPackageId);

    public sealed record ConfirmSubscriptionPaymentRequest(string? Note);

    public sealed record RejectSubscriptionApplicationRequest(string Reason);
}