namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class PayrollRun
{
    private readonly List<PayrollRunLine> _lines = new();

    private PayrollRun()
    {
    }

    public PayrollRun(
        Guid id,
        Guid tenantId,
        string payrollPeriod)
    {
        Id = id;
        TenantId = tenantId;
        PayrollPeriod = payrollPeriod.Trim();
        RunDateUtc = DateTime.UtcNow;
        Status = 0;
    }

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string PayrollPeriod { get; private set; } = string.Empty;
    public DateTime RunDateUtc { get; private set; }
    public int Status { get; private set; }
    public Guid? JournalEntryId { get; private set; }
    public DateTime? PostedOnUtc { get; private set; }

    public IReadOnlyCollection<PayrollRunLine> Lines => _lines;

    public void AddLine(PayrollRunLine line)
    {
        _lines.Add(line);
    }

    public void MarkProcessed()
    {
        Status = 1;
    }

    public void MarkPosted(Guid journalEntryId)
    {
        Status = 2; // Posted
        JournalEntryId = journalEntryId;
        PostedOnUtc = DateTime.UtcNow;
    }
}
