using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class UserAccount : TenantOwnedEntity
{
    private UserAccount()
    {
    }

    public UserAccount(
        Guid id,
        Guid tenantId,
        string email,
        string firstName,
        string lastName,
        bool isActive) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("UserAccount id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email cannot be null or whitespace.", nameof(email));
        }

        if (string.IsNullOrWhiteSpace(firstName))
        {
            throw new ArgumentException("First name cannot be null or whitespace.", nameof(firstName));
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            throw new ArgumentException("Last name cannot be null or whitespace.", nameof(lastName));
        }

        Id = id;
        Email = email.Trim().ToLowerInvariant();
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        IsActive = isActive;
    }

    public Guid Id { get; private set; }

    public string Email { get; private set; } = string.Empty;

    public string FirstName { get; private set; } = string.Empty;

    public string LastName { get; private set; } = string.Empty;

    public bool IsActive { get; private set; }

    public void Activate() => IsActive = true;

    public void Deactivate() => IsActive = false;
}