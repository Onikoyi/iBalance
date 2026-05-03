namespace iBalance.Modules.Platform.Domain.Entities;

public sealed class DepartmentWorkflowPolicy
{
    private DepartmentWorkflowPolicy()
    {
    }

    public DepartmentWorkflowPolicy(
        Guid id,
        Guid tenantId,
        string moduleCode,
        Guid organizationDepartmentId,
        bool makerCheckerRequired,
        bool enforceSegregationOfDuties,
        int minimumApproverCount,
        string? notes,
        bool isActive)
    {
        Id = id;
        TenantId = tenantId;
        ModuleCode = moduleCode.Trim().ToLowerInvariant();
        OrganizationDepartmentId = organizationDepartmentId;
        MakerCheckerRequired = makerCheckerRequired;
        EnforceSegregationOfDuties = enforceSegregationOfDuties;
        MinimumApproverCount = minimumApproverCount < 1 ? 1 : minimumApproverCount;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = isActive;
        CreatedOnUtc = DateTime.UtcNow;
        LastModifiedOnUtc = DateTime.UtcNow;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string ModuleCode { get; private set; } = string.Empty;
    public Guid OrganizationDepartmentId { get; private set; }
    public bool MakerCheckerRequired { get; private set; }
    public bool EnforceSegregationOfDuties { get; private set; }
    public int MinimumApproverCount { get; private set; }
    public string? Notes { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedOnUtc { get; private set; }
    public DateTime LastModifiedOnUtc { get; private set; }

    public void Update(bool makerCheckerRequired, bool enforceSegregationOfDuties, int minimumApproverCount, string? notes, bool isActive)
    {
        MakerCheckerRequired = makerCheckerRequired;
        EnforceSegregationOfDuties = enforceSegregationOfDuties;
        MinimumApproverCount = minimumApproverCount < 1 ? 1 : minimumApproverCount;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        IsActive = isActive;
        LastModifiedOnUtc = DateTime.UtcNow;
    }
}
