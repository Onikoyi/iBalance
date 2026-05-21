namespace iBalance.Modules.HumanResources.Domain.Entities;

public sealed class HrTrainingRecord
{
    private HrTrainingRecord() { }

    public HrTrainingRecord(Guid id, Guid tenantId, Guid employeeId, string trainingTitle, string provider, DateTime trainingDateUtc, decimal costAmount, string? notes)
    {
        if (id == Guid.Empty) throw new ArgumentException("Training record id is required.", nameof(id));
        if (tenantId == Guid.Empty) throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (employeeId == Guid.Empty) throw new ArgumentException("Employee is required.", nameof(employeeId));
        if (string.IsNullOrWhiteSpace(trainingTitle)) throw new ArgumentException("Training title is required.", nameof(trainingTitle));
        if (costAmount < 0m) throw new ArgumentException("Training cost cannot be negative.", nameof(costAmount));

        Id = id;
        TenantId = tenantId;
        EmployeeId = employeeId;
        TrainingTitle = trainingTitle.Trim();
        Provider = string.IsNullOrWhiteSpace(provider) ? string.Empty : provider.Trim();
        TrainingDateUtc = trainingDateUtc;
        CostAmount = costAmount;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        CreatedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public string TrainingTitle { get; private set; } = string.Empty;
    public string Provider { get; private set; } = string.Empty;
    public DateTime TrainingDateUtc { get; private set; }
    public decimal CostAmount { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTime? LastModifiedOnUtc { get; private set; }
    public string? LastModifiedBy { get; private set; }
    public HrEmployee? Employee { get; private set; }

    public void Update(string trainingTitle, string provider, DateTime trainingDateUtc, decimal costAmount, string? notes)
    {
        if (string.IsNullOrWhiteSpace(trainingTitle)) throw new ArgumentException("Training title is required.", nameof(trainingTitle));
        if (costAmount < 0m) throw new ArgumentException("Training cost cannot be negative.", nameof(costAmount));
        TrainingTitle = trainingTitle.Trim();
        Provider = string.IsNullOrWhiteSpace(provider) ? string.Empty : provider.Trim();
        TrainingDateUtc = trainingDateUtc;
        CostAmount = costAmount;
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
