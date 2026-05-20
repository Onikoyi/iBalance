namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class BillingNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string SequenceCode { get; set; } = string.Empty;
    public int NextNumber { get; set; } = 1;
}
