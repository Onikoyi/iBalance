using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class Vendor : TenantOwnedEntity
{
    private Vendor()
    {
    }

    public Vendor(
        Guid id,
        Guid tenantId,
        string vendorCode,
        string vendorName,
        string? email,
        string? phoneNumber,
        string? billingAddress,
        bool isActive)
        
    {
        
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Vendor id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (string.IsNullOrWhiteSpace(vendorCode))
        {
            throw new ArgumentException("Vendor code is required.", nameof(vendorCode));
        }

        if (string.IsNullOrWhiteSpace(vendorName))
        {
            throw new ArgumentException("Vendor name is required.", nameof(vendorName));
        }

        Id = id;
        AssignTenant(tenantId);
        VendorCode = vendorCode.Trim().ToUpperInvariant();
        VendorName = vendorName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        BillingAddress = string.IsNullOrWhiteSpace(billingAddress) ? null : billingAddress.Trim();
        IsActive = isActive;
    }
    public Guid Id { get; private set; }

    public string VendorCode { get; private set; } = string.Empty;

    public string VendorName { get; private set; } = string.Empty;

    public string? Email { get; private set; }

    public string? PhoneNumber { get; private set; }

    public string? BillingAddress { get; private set; }

    public bool IsActive { get; private set; }

    public ICollection<PurchaseInvoice> PurchaseInvoices { get; } = new List<PurchaseInvoice>();

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        SetCreated(createdBy);
        SetModified(lastModifiedBy);
    }

    public void UpdateProfile(
        string vendorName,
        string? email,
        string? phoneNumber,
        string? billingAddress,
        bool isActive)
        
    {
        if (string.IsNullOrWhiteSpace(vendorName))
        {
            throw new ArgumentException("Vendor name is required.", nameof(vendorName));
        }

        VendorName = vendorName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        BillingAddress = string.IsNullOrWhiteSpace(billingAddress) ? null : billingAddress.Trim();
        IsActive = isActive;
    }
}