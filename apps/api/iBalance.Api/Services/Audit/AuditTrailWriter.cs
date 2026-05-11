using System.Text.Json;
using iBalance.BuildingBlocks.Application.Security;
using iBalance.BuildingBlocks.Application.Tenancy;
using iBalance.BuildingBlocks.Infrastructure.Persistence;
using iBalance.Modules.Platform.Domain.Entities;

namespace iBalance.Api.Services.Audit;

public sealed class AuditTrailWriter : IAuditTrailWriter
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ITenantContextAccessor _tenantContextAccessor;
    private readonly ICurrentUserService _currentUserService;

    public AuditTrailWriter(
        ApplicationDbContext dbContext,
        ITenantContextAccessor tenantContextAccessor,
        ICurrentUserService currentUserService)
    {
        _dbContext = dbContext;
        _tenantContextAccessor = tenantContextAccessor;
        _currentUserService = currentUserService;
    }

    public async Task WriteAsync(
        string moduleCode,
        string entityName,
        string action,
        Guid? entityId = null,
        string? reference = null,
        string? description = null,
        string? actorIdentifier = null,
        Guid? tenantId = null,
        object? metadata = null,
        CancellationToken cancellationToken = default)
    {
        var effectiveTenantId =
            tenantId ??
            (_tenantContextAccessor.Current.IsAvailable ? _tenantContextAccessor.Current.TenantId : (Guid?)null);

        if (!effectiveTenantId.HasValue || effectiveTenantId.Value == Guid.Empty)
        {
            return;
        }

        var metadataJson = metadata is null
            ? null
            : JsonSerializer.Serialize(metadata);

        var resolvedActorIdentifier =
            FirstNonEmpty(
                actorIdentifier,
                _currentUserService.Email,
                _currentUserService.UserName,
                _currentUserService.UserId)
            ?? "System";

        var auditEvent = new AuditEvent(
            Guid.NewGuid(),
            effectiveTenantId.Value,
            moduleCode,
            entityName,
            action,
            DateTime.UtcNow,
            entityId,
            reference,
            description,
            _currentUserService.UserId,
            resolvedActorIdentifier,
            metadataJson);

        _dbContext.AuditEvents.Add(auditEvent);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }
        }

        return null;
    }
}
