namespace iBalance.Modules.Finance.Domain.Enums;

public enum JournalEntryStatus
{
    Draft = 1,
    SubmittedForApproval = 2,
    Approved = 3,
    Rejected = 4,
    Posted = 5,
    Voided = 6,
    Reversed = 7
}