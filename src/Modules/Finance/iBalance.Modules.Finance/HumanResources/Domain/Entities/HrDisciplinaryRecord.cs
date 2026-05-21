namespace iBalance.Modules.HumanResources.Domain.Entities;

public sealed class HrDisciplinaryRecord
{
    private HrDisciplinaryRecord() { }

    public HrDisciplinaryRecord(Guid id, Guid tenantId, Guid employeeId, DateTime incidentDateUtc, string category, string description, string actionTaken, string? notes)
    {
        if (id == Guid.Empty) throw new ArgumentException("Disciplinary record id is required.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (employeeId == Guid.Empty) throw new ArgumentException("Employee is required.", nameof(employeeId));
        if (string.IsNullOrWhiteSpace(category)) throw new ArgumentException("Disciplinary category is required.", nameof(category));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Disciplinary description is required.", nameof(description));

        Id = id;
        TenantId = tenantId;
        EmployeeId = employeeId;
        IncidentDateUtc = incidentDateUtc;
        Category = category.Trim();
        Description = description.Trim();
        ActionTaken = string.IsNullOrWhiteSpace(actionTaken) ? string.Empty : actionTaken.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public DateTime IncidentDateUtc { get; private set; }
    public string Category { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string ActionTaken { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }
    public HrEmployee? Employee { get; private set; }

    public void Update(DateTime incidentDateUtc, string category, string description, string actionTaken, string? notes)
    {
        if (string.IsNullOrWhiteSpace(category)) throw new ArgumentException("Disciplinary category is required.", nameof(category));
        if (string.IsNullOrWhiteSpace(description)) throw new ArgumentException("Disciplinary description is required.", nameof(description));
        IncidentDateUtc = incidentDateUtc;
        Category = category.Trim();
        Description = description.Trim();
        ActionTaken = string.IsNullOrWhiteSpace(actionTaken) ? string.Empty : actionTaken.Trim();
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
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
