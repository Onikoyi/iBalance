namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollRunLine
{
    private PayrollRunLine()
    {
    }

    public PayrollRunLine(
        Guid id,
        Guid tenantId,
        Guid payrollRunId,
        Guid employeeId)
    {
        Id = id;
        TenantId = tenantId;
        PayrollRunId = payrollRunId;
        EmployeeId = employeeId;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid PayrollRunId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public decimal GrossPay { get; private set; }
    public decimal TotalDeductions { get; private set; }
    public decimal NetPay { get; private set; }

    public void SetValues(decimal grossPay, decimal totalDeductions)
    {
        GrossPay = grossPay;
        TotalDeductions = totalDeductions;
        NetPay = grossPay - totalDeductions;
    }
}
