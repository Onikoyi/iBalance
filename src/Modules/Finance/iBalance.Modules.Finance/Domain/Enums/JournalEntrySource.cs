namespace iBalance.Modules.Finance.Domain.Enums;

public enum JournalEntrySource
{
    ManualJournal = 1,
    OpeningBalance = 2,
    Reversal = 3,
    SalesInvoice = 4,
    CustomerReceipt = 5,
    PurchaseInvoice = 6,
    VendorPayment = 7
}