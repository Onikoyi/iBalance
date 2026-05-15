using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public class FleetDriver
{
    private FleetDriver() { }

    public FleetDriver(
        Guid id,
        Guid tenantId,
        string driverCode,
        string fullName,
        string licenseNumber,
        string phoneNumber,
        Guid? userAccountId,
        Guid? organizationDepartmentId,
        Guid? organizationBranchId,
        Guid? organizationCostCenterId,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(driverCode))
        {
            throw new ArgumentException("Driver code is required.", nameof(driverCode));
        }

        if (string.IsNullOrWhiteSpace(fullName))
        {
            throw new ArgumentException("Driver name is required.", nameof(fullName));
        }

        Id = id;
        TenantId = tenantId;
        DriverCode = driverCode.Trim().ToUpperInvariant();
        FullName = fullName.Trim();
        LicenseNumber = licenseNumber?.Trim().ToUpperInvariant() ?? string.Empty;
        PhoneNumber = phoneNumber?.Trim() ?? string.Empty;
        UserAccountId = userAccountId;
        OrganizationDepartmentId = organizationDepartmentId;
        OrganizationBranchId = organizationBranchId;
        OrganizationCostCenterId = organizationCostCenterId;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = true;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string DriverCode { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string LicenseNumber { get; private set; } = string.Empty;
    public string PhoneNumber { get; private set; } = string.Empty;
    public DateTime? LicenseExpiryUtc { get; private set; }
    public Guid? UserAccountId { get; private set; }
    public Guid? OrganizationDepartmentId { get; private set; }
    public Guid? OrganizationBranchId { get; private set; }
    public Guid? OrganizationCostCenterId { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }

    public void Update(
        string fullName,
        string licenseNumber,
        string phoneNumber,
        DateTime? licenseExpiryUtc,
        Guid? userAccountId,
        Guid? organizationDepartmentId,
        Guid? organizationBranchId,
        Guid? organizationCostCenterId,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(fullName))
        {
            throw new ArgumentException("Driver name is required.", nameof(fullName));
        }

        FullName = fullName.Trim();
        LicenseNumber = licenseNumber?.Trim().ToUpperInvariant() ?? string.Empty;
        PhoneNumber = phoneNumber?.Trim() ?? string.Empty;
        LicenseExpiryUtc = licenseExpiryUtc;
        UserAccountId = userAccountId;
        OrganizationDepartmentId = organizationDepartmentId;
        OrganizationBranchId = organizationBranchId;
        OrganizationCostCenterId = organizationCostCenterId;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
