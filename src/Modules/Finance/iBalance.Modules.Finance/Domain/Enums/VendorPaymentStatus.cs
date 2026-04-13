namespace iBalance.Modules.Finance.Domain.Enums;

public enum VendorPaymentStatus
{
    Draft = 1,
    SubmittedForApproval = 2,
    Approved = 3,
    Rejected = 4,
    Posted = 5,
    Cancelled = 6
}