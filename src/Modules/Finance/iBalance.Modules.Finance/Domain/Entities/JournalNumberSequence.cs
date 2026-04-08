using iBalance.BuildingBlocks.Domain.Common;

namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class JournalNumberSequence : TenantOwnedEntity
{
    private JournalNumberSequence()
    {
    }

    public JournalNumberSequence(
        Guid id,
        Guid tenantId,
        string prefix,
        int nextNumber,
        int padding,
        bool isActive) : base(tenantId)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Journal number sequence id cannot be empty.", nameof(id));
        }

        if (string.IsNullOrWhiteSpace(prefix))
        {
            throw new ArgumentException("Prefix cannot be null or whitespace.", nameof(prefix));
        }

        if (nextNumber <= 0)
        {
            throw new ArgumentException("Next number must be greater than zero.", nameof(nextNumber));
        }

        if (padding < 1 || padding > 12)
        {
            throw new ArgumentException("Padding must be between 1 and 12.", nameof(padding));
        }

        Id = id;
        Prefix = prefix.Trim().ToUpperInvariant();
        NextNumber = nextNumber;
        Padding = padding;
        IsActive = isActive;
    }

    public Guid Id { get; private set; }

    public string Prefix { get; private set; } = string.Empty;

    public int NextNumber { get; private set; }

    public int Padding { get; private set; }

    public bool IsActive { get; private set; }

    public string PeekNextReference()
    {
        return $"{Prefix}-{NextNumber.ToString().PadLeft(Padding, '0')}";
    }

    public string ConsumeNextReference()
    {
        var reference = PeekNextReference();
        NextNumber++;
        return reference;
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }
}