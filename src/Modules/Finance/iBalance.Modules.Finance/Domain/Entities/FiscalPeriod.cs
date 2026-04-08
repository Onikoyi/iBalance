using iBalance.BuildingBlocks.Domain.Common;
using iBalance.Modules.Finance.Domain.Enums;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class FiscalPeriod : TenantOwnedEntity
{
    private FiscalPeriod()
    {
    }

    public FiscalPeriod(
        Guid id,
        Guid tenantId,
        string name,
        DateOnly startDate,
        DateOnly endDate,
        FiscalPeriodStatus status) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Fiscal period id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Fiscal period name cannot be null or whitespace.", nameof(name));
        }

        if (endDate < startDate)
        {
            throw new ArgumentException("Fiscal period end date cannot be earlier than start date.");
        }

        Id = id;
        Name = name.Trim();
        StartDate = startDate;
        EndDate = endDate;
        Status = status;
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public DateOnly StartDate { get; private set; }

    public DateOnly EndDate { get; private set; }

    public FiscalPeriodStatus Status { get; private set; }

    public bool Contains(DateOnly date) => date >= StartDate && date <= EndDate;

    public void Open()
    {
        Status = FiscalPeriodStatus.Open;
    }

    public void Close()
    {
        Status = FiscalPeriodStatus.Closed;
    }
}