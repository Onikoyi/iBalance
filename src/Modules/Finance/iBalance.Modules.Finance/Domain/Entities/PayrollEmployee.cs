namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollEmployee
{
    private PayrollEmployee()
    {
    }

    public PayrollEmployee(
        Guid id,
        Guid tenantId,
        string employeeNumber,
        string firstName,
        string? middleName,
        string lastName,
        string? email,
        string? phoneNumber,
        string? department,
        string? jobTitle,
        DateTime hireDateUtc,
        string? bankName,
        string? bankAccountNumber,
        string? pensionNumber,
        string? taxIdentificationNumber,
        bool isActive,
        string? notes)
    {
        Id = id;
        TenantId = tenantId;
        EmployeeNumber = employeeNumber.Trim();
        FirstName = firstName.Trim();
        MiddleName = string.IsNullOrWhiteSpace(middleName) ? null : middleName.Trim();
        LastName = lastName.Trim();
        Email = email?.Trim();
        PhoneNumber = phoneNumber?.Trim();
        Department = department?.Trim();
        JobTitle = jobTitle?.Trim();
        HireDateUtc = hireDateUtc;
        BankName = bankName?.Trim();
        BankAccountNumber = bankAccountNumber?.Trim();
        PensionNumber = pensionNumber?.Trim();
        TaxIdentificationNumber = taxIdentificationNumber?.Trim();
        IsActive = isActive;
        Notes = notes?.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string EmployeeNumber { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string? MiddleName { get; private set; }
    public string LastName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? Department { get; private set; }
    public string? JobTitle { get; private set; }
    public DateTime HireDateUtc { get; private set; }
    public string? BankName { get; private set; }
    public string? BankAccountNumber { get; private set; }
    public string? PensionNumber { get; private set; }
    public string? TaxIdentificationNumber { get; private set; }
    public bool IsActive { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }

    public string FullName =>
        string.Join(
            " ",
            new[] { FirstName?.Trim(), MiddleName?.Trim(), LastName?.Trim() }
                .Where(x => !string.IsNullOrWhiteSpace(x)));

    public string DisplayName => FullName;

    public void Update(
        string firstName,
        string? middleName,
        string lastName,
        string? email,
        string? phoneNumber,
        string? department,
        string? jobTitle,
        DateTime hireDateUtc,
        string? bankName,
        string? bankAccountNumber,
        string? pensionNumber,
        string? taxIdentificationNumber,
        bool isActive,
        string? notes)
    {
        FirstName = firstName.Trim();
        MiddleName = string.IsNullOrWhiteSpace(middleName) ? null : middleName.Trim();
        LastName = lastName.Trim();
        Email = email?.Trim();
        PhoneNumber = phoneNumber?.Trim();
        Department = department?.Trim();
        JobTitle = jobTitle?.Trim();
        HireDateUtc = hireDateUtc;
        BankName = bankName?.Trim();
        BankAccountNumber = bankAccountNumber?.Trim();
        PensionNumber = pensionNumber?.Trim();
        TaxIdentificationNumber = taxIdentificationNumber?.Trim();
        IsActive = isActive;
        Notes = notes?.Trim();
    }
}
