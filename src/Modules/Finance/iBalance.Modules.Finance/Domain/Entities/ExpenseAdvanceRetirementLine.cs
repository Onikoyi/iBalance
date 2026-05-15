namespace iBalance.Modules.Finance.Domain.Entities;

public sealed class ExpenseAdvanceRetirementLine
{
    private ExpenseAdvanceRetirementLine() { }

    public ExpenseAdvanceRetirementLine(Guid id, Guid retirementId, Guid expenseCategoryId, string description, decimal amount)
    {
        Id = id;
        ExpenseAdvanceRetirementId = retirementId;
        ExpenseCategoryId = expenseCategoryId;
        Description = description.Trim();
        Amount = amount;
    }

    public Guid Id { get; private set; }
    public Guid ExpenseAdvanceRetirementId { get; private set; }
    public Guid ExpenseCategoryId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public ExpenseAdvanceRetirement ExpenseAdvanceRetirement { get; private set; } = null!;
}

