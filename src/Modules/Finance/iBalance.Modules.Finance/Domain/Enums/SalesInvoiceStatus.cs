namespace iBalance.Modules.Finance.Domain.Enums;

public enum SalesInvoiceStatus
{
    Draft = 1,
    SubmittedForApproval = 2,
    Approved = 3,
    Posted = 4,
    PartPaid = 5,
    Paid = 6,
    Rejected = 7,
    Cancelled = 8
}