using iBalance.Modules.HumanResources.Domain.Enums;

namespace iBalance.Modules.HumanResources.Domain.Entities;

public sealed class HrEmployee
{
    private HrEmployee() { }

    public HrEmployee(
        Guid id,
        Guid tenantId,
        string employeeNumber,
        string firstName,
        string? middleName,
        string lastName,
        string? email,
        string? phoneNumber,
        Guid? departmentId,
        Guid? designationId,
        Guid? gradeId,
        HrGender gender,
        HrEmploymentType employmentType,
        HrEmployeeStatus status,
        DateTime hireDateUtc,
        DateTime? dateOfBirthUtc,
        string? bankName,
        string? bankAccountNumber,
        string? pensionNumber,
        string? taxIdentificationNumber,
        string? address,
        string? emergencyContactName,
        string? emergencyContactPhone,
        string? notes)
    {
        if (id == Guid.Empty) throw new ArgumentException("Employee id is required.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(employeeNumber)) throw new ArgumentException("Employee number is required.", nameof(employeeNumber));
        if (string.IsNullOrWhiteSpace(firstName)) throw new ArgumentException("First name is required.", nameof(firstName));
        if (string.IsNullOrWhiteSpace(lastName)) throw new ArgumentException("Last name is required.", nameof(lastName));

        Id = id;
        TenantId = tenantId;
        EmployeeNumber = employeeNumber.Trim().ToUpperInvariant();
        FirstName = firstName.Trim();
        MiddleName = string.IsNullOrWhiteSpace(middleName) ? null : middleName.Trim();
        LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        DepartmentId = departmentId;
        DesignationId = designationId;
        GradeId = gradeId;
        Gender = gender;
        EmploymentType = employmentType;
        Status = status;
        HireDateUtc = hireDateUtc;
        DateOfBirthUtc = dateOfBirthUtc;
        BankName = string.IsNullOrWhiteSpace(bankName) ? null : bankName.Trim();
        BankAccountNumber = string.IsNullOrWhiteSpace(bankAccountNumber) ? null : bankAccountNumber.Trim();
        PensionNumber = string.IsNullOrWhiteSpace(pensionNumber) ? null : pensionNumber.Trim();
        TaxIdentificationNumber = string.IsNullOrWhiteSpace(taxIdentificationNumber) ? null : taxIdentificationNumber.Trim();
        Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim();
        EmergencyContactName = string.IsNullOrWhiteSpace(emergencyContactName) ? null : emergencyContactName.Trim();
        EmergencyContactPhone = string.IsNullOrWhiteSpace(emergencyContactPhone) ? null : emergencyContactPhone.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string EmployeeNumber { get; private set; } = string.Empty;
    public string FirstName { get; private set; } = string.Empty;
    public string? MiddleName { get; private set; }
    public string LastName { get; private set; } = string.Empty;
    public string FullName => string.Join(" ", new[] { FirstName, MiddleName, LastName }.Where(x => !string.IsNullOrWhiteSpace(x)));
    public string? Email { get; private set; }
    public string? PhoneNumber { get; private set; }
    public Guid? DepartmentId { get; private set; }
    public Guid? DesignationId { get; private set; }
    public Guid? GradeId { get; private set; }
    public HrGender Gender { get; private set; }
    public HrEmploymentType EmploymentType { get; private set; }
    public HrEmployeeStatus Status { get; private set; }
    public DateTime HireDateUtc { get; private set; }
    public DateTime? DateOfBirthUtc { get; private set; }
    public DateTime? TerminatedOnUtc { get; private set; }
    public string? TerminationReason { get; private set; }
    public string? BankName { get; private set; }
    public string? BankAccountNumber { get; private set; }
    public string? PensionNumber { get; private set; }
    public string? TaxIdentificationNumber { get; private set; }
    public string? Address { get; private set; }
    public string? EmergencyContactName { get; private set; }
    public string? EmergencyContactPhone { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }

    public HrDepartment? Department { get; private set; }
    public HrDesignation? Designation { get; private set; }
    public HrGrade? Grade { get; private set; }

    public void Update(
        string firstName,
        string? middleName,
        string lastName,
        string? email,
        string? phoneNumber,
        Guid? departmentId,
        Guid? designationId,
        Guid? gradeId,
        HrGender gender,
        HrEmploymentType employmentType,
        HrEmployeeStatus status,
        DateTime hireDateUtc,
        DateTime? dateOfBirthUtc,
        string? bankName,
        string? bankAccountNumber,
        string? pensionNumber,
        string? taxIdentificationNumber,
        string? address,
        string? emergencyContactName,
        string? emergencyContactPhone,
        string? notes)
    {
        if (string.IsNullOrWhiteSpace(firstName)) throw new ArgumentException("First name is required.", nameof(firstName));
        if (string.IsNullOrWhiteSpace(lastName)) throw new ArgumentException("Last name is required.", nameof(lastName));

        FirstName = firstName.Trim();
        MiddleName = string.IsNullOrWhiteSpace(middleName) ? null : middleName.Trim();
        LastName = lastName.Trim();
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim();
        DepartmentId = departmentId;
        DesignationId = designationId;
        GradeId = gradeId;
        Gender = gender;
        EmploymentType = employmentType;
        Status = status;
        HireDateUtc = hireDateUtc;
        DateOfBirthUtc = dateOfBirthUtc;
        BankName = string.IsNullOrWhiteSpace(bankName) ? null : bankName.Trim();
        BankAccountNumber = string.IsNullOrWhiteSpace(bankAccountNumber) ? null : bankAccountNumber.Trim();
        PensionNumber = string.IsNullOrWhiteSpace(pensionNumber) ? null : pensionNumber.Trim();
        TaxIdentificationNumber = string.IsNullOrWhiteSpace(taxIdentificationNumber) ? null : taxIdentificationNumber.Trim();
        Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim();
        EmergencyContactName = string.IsNullOrWhiteSpace(emergencyContactName) ? null : emergencyContactName.Trim();
        EmergencyContactPhone = string.IsNullOrWhiteSpace(emergencyContactPhone) ? null : emergencyContactPhone.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

        Touch();
    }

    public void Terminate(DateTime terminatedOnUtc, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason)) throw new ArgumentException("Termination reason is required.", nameof(reason));
        Status = HrEmployeeStatus.Terminated;
        TerminatedOnUtc = terminatedOnUtc;
        TerminationReason = reason.Trim();
        Touch();
    }

    public void SetAudit(string? createdBy, string? lastModifiedBy)
    {
        if (!string.IsNullOrWhiteSpace(createdBy) && string.IsNullOrWhiteSpace(CreatedBy)) CreatedBy = createdBy.Trim();
        if (!string.IsNullOrWhiteSpace(lastModifiedBy))
        {
            LastModifiedBy = lastModifiedBy.Trim();
            LastModifiedOnUtc = DateTime.UtcNow;
        }
    }

    private void Touch() => LastModifiedOnUtc = DateTime.UtcNow;
}
