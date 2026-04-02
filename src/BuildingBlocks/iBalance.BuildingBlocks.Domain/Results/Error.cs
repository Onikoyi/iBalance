namespace iBalance.BuildingBlocks.Domain.Results;

public sealed record Error(string Code, string Message)
{
    public static readonly Error None = new(string.Empty, string.Empty);
    public static readonly Error NullValue = new("General.Null", "A required value was null.");
}