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
        string role,
        string passwordHash,
        string passwordSalt,
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

        if (string.IsNullOrWhiteSpace(role))
        {
            throw new ArgumentException("Role cannot be null or whitespace.", nameof(role));
        }

        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash cannot be null or whitespace.", nameof(passwordHash));
        }

        if (string.IsNullOrWhiteSpace(passwordSalt))
        {
            throw new ArgumentException("Password salt cannot be null or whitespace.", nameof(passwordSalt));
        }

        Id = id;
        Email = email.Trim().ToLowerInvariant();
        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Role = role.Trim();
        PasswordHash = passwordHash.Trim();
        PasswordSalt = passwordSalt.Trim();
        IsActive = isActive;
    }

    public Guid Id { get; private set; }

    public string Email { get; private set; } = string.Empty;

    public string FirstName { get; private set; } = string.Empty;

    public string LastName { get; private set; } = string.Empty;

    public string Role { get; private set; } = string.Empty;

    public string PasswordHash { get; private set; } = string.Empty;

    public string PasswordSalt { get; private set; } = string.Empty;

    public string? PasswordResetTokenHash { get; private set; }

    public DateTime? PasswordResetTokenExpiresOnUtc { get; private set; }

    public bool IsActive { get; private set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    public void UpdateProfile(string firstName, string lastName)
    {
        if (string.IsNullOrWhiteSpace(firstName))
        {
            throw new ArgumentException("First name cannot be null or whitespace.", nameof(firstName));
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            throw new ArgumentException("Last name cannot be null or whitespace.", nameof(lastName));
        }

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
    }

    public void UpdateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email cannot be null or whitespace.", nameof(email));
        }

        Email = email.Trim().ToLowerInvariant();
    }

    public void Activate() => IsActive = true;

    public void Deactivate() => IsActive = false;

    public void AssignRole(string role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            throw new ArgumentException("Role cannot be null or whitespace.", nameof(role));
        }

        Role = role.Trim();
    }

    public void SetPassword(string passwordHash, string passwordSalt)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash cannot be null or whitespace.", nameof(passwordHash));
        }

        if (string.IsNullOrWhiteSpace(passwordSalt))
        {
            throw new ArgumentException("Password salt cannot be null or whitespace.", nameof(passwordSalt));
        }

        PasswordHash = passwordHash.Trim();
        PasswordSalt = passwordSalt.Trim();
    }

    public void IssuePasswordResetToken(string passwordResetTokenHash, DateTime expiresOnUtc)
    {
        if (string.IsNullOrWhiteSpace(passwordResetTokenHash))
        {
            throw new ArgumentException("Password reset token hash cannot be null or whitespace.", nameof(passwordResetTokenHash));
        }

        PasswordResetTokenHash = passwordResetTokenHash.Trim();
        PasswordResetTokenExpiresOnUtc = expiresOnUtc;
    }

    public bool IsPasswordResetTokenValid(string passwordResetTokenHash, DateTime utcNow)
    {
        return
            !string.IsNullOrWhiteSpace(PasswordResetTokenHash) &&
            string.Equals(PasswordResetTokenHash, passwordResetTokenHash, StringComparison.Ordinal) &&
            PasswordResetTokenExpiresOnUtc.HasValue &&
            PasswordResetTokenExpiresOnUtc.Value >= utcNow;
    }

    public void ClearPasswordResetToken()
    {
        PasswordResetTokenHash = null;
        PasswordResetTokenExpiresOnUtc = null;
    }
}