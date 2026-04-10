using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Platform.Domain.Enums;

namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class TenantLicense : TenantOwnedEntity
{
    private TenantLicense()
    {
    }

    public TenantLicense(
        Guid id,
        DateTime licenseStartDateUtc,
        DateTime licenseEndDateUtc,
        string packageName,
        decimal amountPaid,
        string currencyCode)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("License id cannot be empty.", nameof(id));
        }

        if (licenseEndDateUtc < licenseStartDateUtc)
        {
            throw new ArgumentException("License end date cannot be earlier than start date.", nameof(licenseEndDateUtc));
        }

        Id = id;
        LicenseStartDateUtc = licenseStartDateUtc;
        LicenseEndDateUtc = licenseEndDateUtc;
        PackageName = packageName?.Trim() ?? string.Empty;
        AmountPaid = amountPaid;
        CurrencyCode = string.IsNullOrWhiteSpace(currencyCode) ? "NGN" : currencyCode.Trim().ToUpperInvariant();
        IsSuspended = false;
    }

    public Guid Id { get; private set; }

    public DateTime LicenseStartDateUtc { get; private set; }

    public DateTime LicenseEndDateUtc { get; private set; }

    public string PackageName { get; private set; } = string.Empty;

    public decimal AmountPaid { get; private set; }

    public string CurrencyCode { get; private set; } = "NGN";

    public bool IsSuspended { get; private set; }

    public void Renew(DateTime newStartDateUtc, DateTime newEndDateUtc, string packageName, decimal amountPaid, string currencyCode)
    {
        if (newEndDateUtc < newStartDateUtc)
        {
            throw new ArgumentException("License end date cannot be earlier than start date.", nameof(newEndDateUtc));
        }

        LicenseStartDateUtc = newStartDateUtc;
        LicenseEndDateUtc = newEndDateUtc;
        PackageName = packageName?.Trim() ?? string.Empty;
        AmountPaid = amountPaid;
        CurrencyCode = string.IsNullOrWhiteSpace(currencyCode) ? "NGN" : currencyCode.Trim().ToUpperInvariant();
        IsSuspended = false;
    }

    public void Suspend()
    {
        IsSuspended = true;
    }

    public void Unsuspend()
    {
        IsSuspended = false;
    }

    public TenantLicenseStatus GetStatus(DateTime asOfUtc)
    {
        if (IsSuspended)
        {
            return TenantLicenseStatus.Suspended;
        }

        var today = asOfUtc.Date;
        var end = LicenseEndDateUtc.Date;

        if (today > end)
        {
            return TenantLicenseStatus.Expired;
        }

        var daysRemaining = (end - today).Days;

        if (daysRemaining <= 30)
        {
            return TenantLicenseStatus.ExpiringSoon;
        }

        return TenantLicenseStatus.Active;
    }

    public int GetDaysRemaining(DateTime asOfUtc)
    {
        var today = asOfUtc.Date;
        var end = LicenseEndDateUtc.Date;

        return (end - today).Days;
    }
}