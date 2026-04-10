using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Platform.Domain.Enums;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class TenantSubscriptionApplication : AuditableEntity
{
    private TenantSubscriptionApplication()
    {
    }

    public TenantSubscriptionApplication(
        Guid id,
        string companyName,
        string desiredTenantKey,
        string adminFirstName,
        string adminLastName,
        string adminEmail,
        string adminPasswordHash,
        string adminPasswordSalt,
        Guid subscriptionPackageId,
        string packageCodeSnapshot,
        string packageNameSnapshot,
        decimal amountSnapshot,
        string currencyCodeSnapshot,
        string paymentReference)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Application id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(companyName))
        {
            throw new ArgumentException("Company name is required.", nameof(companyName));
        }

        if (string.IsNullOrWhiteSpace(desiredTenantKey))
        {
            throw new ArgumentException("Desired tenant key is required.", nameof(desiredTenantKey));
        }

        if (string.IsNullOrWhiteSpace(adminFirstName))
        {
            throw new ArgumentException("Admin first name is required.", nameof(adminFirstName));
        }

        if (string.IsNullOrWhiteSpace(adminLastName))
        {
            throw new ArgumentException("Admin last name is required.", nameof(adminLastName));
        }

        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            throw new ArgumentException("Admin email is required.", nameof(adminEmail));
        }

        if (string.IsNullOrWhiteSpace(adminPasswordHash))
        {
            throw new ArgumentException("Admin password hash is required.", nameof(adminPasswordHash));
        }

        if (string.IsNullOrWhiteSpace(adminPasswordSalt))
        {
            throw new ArgumentException("Admin password salt is required.", nameof(adminPasswordSalt));
        }

        if (subscriptionPackageId == Guid.Empty)
        {
            throw new ArgumentException("Subscription package is required.", nameof(subscriptionPackageId));
        }

        if (string.IsNullOrWhiteSpace(packageCodeSnapshot))
        {
            throw new ArgumentException("Package code is required.", nameof(packageCodeSnapshot));
        }

        if (string.IsNullOrWhiteSpace(packageNameSnapshot))
        {
            throw new ArgumentException("Package name is required.", nameof(packageNameSnapshot));
        }

        if (string.IsNullOrWhiteSpace(paymentReference))
        {
            throw new ArgumentException("Payment reference is required.", nameof(paymentReference));
        }

        Id = id;
        CompanyName = companyName.Trim();
        DesiredTenantKey = desiredTenantKey.Trim().ToLowerInvariant();
        AdminFirstName = adminFirstName.Trim();
        AdminLastName = adminLastName.Trim();
        AdminEmail = adminEmail.Trim().ToLowerInvariant();
        AdminPasswordHash = adminPasswordHash.Trim();
        AdminPasswordSalt = adminPasswordSalt.Trim();
        SubscriptionPackageId = subscriptionPackageId;
        PackageCodeSnapshot = packageCodeSnapshot.Trim().ToUpperInvariant();
        PackageNameSnapshot = packageNameSnapshot.Trim();
        AmountSnapshot = amountSnapshot;
        CurrencyCodeSnapshot = string.IsNullOrWhiteSpace(currencyCodeSnapshot) ? "NGN" : currencyCodeSnapshot.Trim().ToUpperInvariant();
        PaymentReference = paymentReference.Trim().ToUpperInvariant();
        Status = TenantSubscriptionApplicationStatus.PendingPayment;
    }

    public Guid Id { get; private set; }

    public string CompanyName { get; private set; } = string.Empty;

    public string DesiredTenantKey { get; private set; } = string.Empty;

    public string AdminFirstName { get; private set; } = string.Empty;

    public string AdminLastName { get; private set; } = string.Empty;

    public string AdminEmail { get; private set; } = string.Empty;

    public string AdminPasswordHash { get; private set; } = string.Empty;

    public string AdminPasswordSalt { get; private set; } = string.Empty;

    public Guid SubscriptionPackageId { get; private set; }

    public string PackageCodeSnapshot { get; private set; } = string.Empty;

    public string PackageNameSnapshot { get; private set; } = string.Empty;

    public decimal AmountSnapshot { get; private set; }

    public string CurrencyCodeSnapshot { get; private set; } = "NGN";

    public string PaymentReference { get; private set; } = string.Empty;

    public TenantSubscriptionApplicationStatus Status { get; private set; }

    public string? PaymentConfirmationNote { get; private set; }

    public string? RejectionReason { get; private set; }

    public string? ConfirmedByUserId { get; private set; }

    public DateTime? PaymentConfirmedOnUtc { get; private set; }

    public Guid? ActivatedTenantId { get; private set; }

    public void MarkPendingVerification(string? note = null)
    {
        Status = TenantSubscriptionApplicationStatus.PendingVerification;
        PaymentConfirmationNote = note?.Trim();
    }

    public void Activate(Guid tenantId, string? confirmedByUserId, DateTime confirmedOnUtc, string? note = null)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Activated tenant id cannot be empty.", nameof(tenantId));
        }

        Status = TenantSubscriptionApplicationStatus.Activated;
        ActivatedTenantId = tenantId;
        ConfirmedByUserId = confirmedByUserId?.Trim();
        PaymentConfirmedOnUtc = confirmedOnUtc;
        PaymentConfirmationNote = note?.Trim();
        RejectionReason = null;
    }

    public void Reject(string? confirmedByUserId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Rejection reason is required.", nameof(reason));
        }

        Status = TenantSubscriptionApplicationStatus.Rejected;
        ConfirmedByUserId = confirmedByUserId?.Trim();
        RejectionReason = reason.Trim();
    }
}