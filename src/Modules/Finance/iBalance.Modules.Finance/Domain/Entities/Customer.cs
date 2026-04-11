namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class Customer
{
    private Customer()
    {
    }

    public Customer(
        Guid id,
        Guid tenantId,
        string customerCode,
        string customerName,
        string? email,
        string? phoneNumber,
        string? billingAddress,
        bool isActive)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Customer id is required.", nameof(id));
        }

        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        }

        if (string.IsNullOrWhiteSpace(customerCode))
        {
            throw new ArgumentException("Customer code is required.", nameof(customerCode));
        }

        if (string.IsNullOrWhiteSpace(customerName))
        {
            throw new ArgumentException("Customer name is required.", nameof(customerName));
        }

        Id = id;
        TenantId = tenantId;
        CustomerCode = customerCode.Trim().ToUpperInvariant();
        CustomerName = customerName.Trim();
        Email = NormalizeOptional(email);
        PhoneNumber = NormalizeOptional(phoneNumber);
        BillingAddress = NormalizeOptional(billingAddress);
        IsActive = isActive;
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }

    public string CustomerCode { get; private set; } = string.Empty;
    public string CustomerName { get; private set; } = string.Empty;

    public string? Email { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? BillingAddress { get; private set; }

    public bool IsActive { get; private set; }

    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }

    public ICollection<SalesInvoice> SalesInvoices { get; private set; } = new List<SalesInvoice>();

    public void UpdateProfile(
        string customerCode,
        string customerName,
        string? email,
        string? phoneNumber,
        string? billingAddress)
    {
        if (string.IsNullOrWhiteSpace(customerCode))
        {
            throw new ArgumentException("Customer code is required.", nameof(customerCode));
        }

        if (string.IsNullOrWhiteSpace(customerName))
        {
            throw new ArgumentException("Customer name is required.", nameof(customerName));
        }

        CustomerCode = customerCode.Trim().ToUpperInvariant();
        CustomerName = customerName.Trim();
        Email = NormalizeOptional(email);
        PhoneNumber = NormalizeOptional(phoneNumber);
        BillingAddress = NormalizeOptional(billingAddress);

        Touch();
    }

    public void Activate()
    {
        if (!IsActive)
        {
            IsActive = true;
            Touch();
        }
    }

    public void Deactivate()
    {
        if (IsActive)
        {
            IsActive = false;
            Touch();
        }
    }

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        if (!string.IsNullOrWhiteSpace(createdBy) && string.IsNullOrWhiteSpace(CreatedBy))
        {
            CreatedBy = createdBy.Trim();
        }

        if (!string.IsNullOrWhiteSpace(lastModifiedBy))
        {
            LastModifiedBy = lastModifiedBy.Trim();
            LastModifiedOnUtc = DateTime.UtcNow;
        }
    }

    private void Touch()
    {
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? null
            : value.Trim();
    }
}