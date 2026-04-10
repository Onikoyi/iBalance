using System.Text;
using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Email;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.BuildingBlocks.Infrastructure.Platform.Seeding;
using iBalance.BuildingBlocks.Infrastructure.Platform.Services;
using iBalance.BuildingBlocks.Infrastructure.Security;
using iBalance.BuildingBlocks.Infrastructure.Tenancy;
using iBalance.Modules.Platform.Application.Abstractions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace iBalance.BuildingBlocks.Infrastructure.DependencyInjection;

public static class InfrastructureServiceCollectionExtensions
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddHttpContextAccessor();

        services.AddScoped<ITenantContextAccessor, TenantContextAccessor>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<ITenantLookupService, TenantLookupService>();
        services.AddScoped<PlatformDatabaseSeeder>();
        services.AddScoped<PasswordHasher>();

        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection was not configured.");

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .PostConfigure(options =>
            {
                if (string.IsNullOrWhiteSpace(options.Issuer))
                {
                    options.Issuer = "iBalance";
                }

                if (string.IsNullOrWhiteSpace(options.Audience))
                {
                    options.Audience = "iBalance.Web";
                }

                if (string.IsNullOrWhiteSpace(options.SecretKey) || options.SecretKey.Length < 32)
                {
                    options.SecretKey = "iBalance-Dev-Secret-Key-Change-In-Production-123456789";
                }

                if (options.ExpiryMinutes <= 0)
                {
                    options.ExpiryMinutes = 480;
                }
            });

        var jwtOptions = new JwtOptions();
        configuration.GetSection(JwtOptions.SectionName).Bind(jwtOptions);

        if (string.IsNullOrWhiteSpace(jwtOptions.Issuer))
        {
            jwtOptions.Issuer = "iBalance";
        }

        if (string.IsNullOrWhiteSpace(jwtOptions.Audience))
        {
            jwtOptions.Audience = "iBalance.Web";
        }

        if (string.IsNullOrWhiteSpace(jwtOptions.SecretKey) || jwtOptions.SecretKey.Length < 32)
        {
            jwtOptions.SecretKey = "iBalance-Dev-Secret-Key-Change-In-Production-123456789";
        }

        if (jwtOptions.ExpiryMinutes <= 0)
        {
            jwtOptions.ExpiryMinutes = 480;
        }

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SecretKey));

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtOptions.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = signingKey,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(1)
                };
            });

        services.AddAuthorization();
        services.AddHealthChecks();

        return services;
    }
}