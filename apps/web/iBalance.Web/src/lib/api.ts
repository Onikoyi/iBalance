import axios from 'axios';

export const tenantStorageKey = 'ibalance.tenantKey';
export const tenantLogoStorageKey = 'ibalance.tenantLogo';
export const companyLogoStorageKey = 'ibalance.companyLogo';

const authStorageKey = 'ibalance.auth.session';

export function getTenantKey(): string {
  const stored = localStorage.getItem(tenantStorageKey);
  if (stored && stored.trim().length > 0) return stored;
  return import.meta.env.VITE_DEFAULT_TENANT_KEY || 'demo-tenant';
}

export function setTenantKey(value: string): void {
  localStorage.setItem(tenantStorageKey, value.trim());
}

export function getTenantLogoDataUrl(): string {
  return localStorage.getItem(tenantLogoStorageKey) || '';
}

export function setTenantLogoDataUrl(value: string): void {
  localStorage.setItem(tenantLogoStorageKey, value);
}

export function getCompanyLogoDataUrl(): string {
  return localStorage.getItem(companyLogoStorageKey) || '';
}

export function setCompanyLogoDataUrl(value: string): void {
  localStorage.setItem(companyLogoStorageKey, value);
}

function getStoredAccessToken(): string | null {
  const raw =
    localStorage.getItem(authStorageKey) ||
    sessionStorage.getItem(authStorageKey);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken || null;
  } catch {
    return null;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const tenantKey = getTenantKey();
  if (tenantKey) config.headers['X-Tenant-Key'] = tenantKey;

  const accessToken = getStoredAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

type ApiErrorShape = {
  Message?: string;
  message?: string;
  RequiredHeader?: string;
  Reference?: string;
  [key: string]: unknown;
};

export function getTenantReadableError(error: unknown, fallback: string) {
  const anyErr = error as any;
  const data: ApiErrorShape | undefined = anyErr?.response?.data;

  const msg =
    (typeof data?.Message === 'string' && data.Message.trim()) ||
    (typeof data?.message === 'string' && data.message.trim()) ||
    (typeof anyErr?.message === 'string' && anyErr.message.trim());

  if (msg) return msg;
  return fallback;
}

export type DashboardSummaryResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  snapshotUtc: string;
  totalAccounts: number;
  totalPostedJournals: number;
  totalDraftJournals: number;
  totalVoidedJournals: number;
  totalReversedJournals: number;
  totalOpeningBalanceJournals: number;
  totalLedgerMovements: number;
  totalDebit: number;
  totalCredit: number;
  openFiscalPeriod: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: number;
  } | null;
};

export type CurrentTenantLicenseResponse = {
  isConfigured: boolean;
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  tenantStatus: number;
  licenseId?: string | null;
  licenseStartDateUtc?: string | null;
  licenseEndDateUtc?: string | null;
  packageName?: string | null;
  amountPaid?: number;
  currencyCode?: string | null;
  licenseStatus: number;
  daysRemaining?: number | null;
  message?: string | null;
};

export type ListEnvelope<T> = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: T[];
};

export type LedgerAccountDto = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  purpose?: string | null;
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  isActive: boolean;
  isCashOrBankAccount: boolean;
  parentLedgerAccountId: string | null;
  parentCode: string | null;
  parentName: string | null;
};

export type LedgerStatementLineDto = {
  id: string;
  journalEntryId: string;
  journalEntryLineId: string;
  movementDateUtc: string;
  reference: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalanceDebit: number;
  runningBalanceCredit: number;
};

export type LedgerAccountStatementResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  ledgerAccount: {
    id: string;
    code: string;
    name: string;
    category: number;
    normalBalance: number;
    isHeader: boolean;
    isPostingAllowed: boolean;
    isActive: boolean;
    isCashOrBankAccount: boolean;
  };
  fromUtc: string | null;
  toUtc: string | null;
  count: number;
  totalDebit: number;
  totalCredit: number;
  closingBalanceDebit: number;
  closingBalanceCredit: number;
  items: LedgerStatementLineDto[];
};

export type CashbookAccountDto = {
  id: string;
  code: string;
  name: string;
  category: number;
  normalBalance: number;
  isCashOrBankAccount: boolean;
};

export type CashbookLineDto = {
  id: string;
  journalEntryId: string;
  journalEntryLineId: string;
  movementDateUtc: string;
  reference: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  runningBalanceDebit: number;
  runningBalanceCredit: number;
};

export type CashbookResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  cashOrBankAccounts: CashbookAccountDto[];
  selectedLedgerAccount: {
    id: string;
    code: string;
    name: string;
    category: number;
    normalBalance: number;
    isHeader: boolean;
    isPostingAllowed: boolean;
    isActive: boolean;
    isCashOrBankAccount: boolean;
  } | null;
  openingBalanceDebit: number;
  openingBalanceCredit: number;
  totalDebit: number;
  totalCredit: number;
  closingBalanceDebit: number;
  closingBalanceCredit: number;
  count: number;
  items: CashbookLineDto[];
};

export type CashbookSummaryRowDto = {
  ledgerAccountId: string;
  code: string;
  name: string;
  category: number;
  normalBalance: number;
  openingBalanceDebit: number;
  openingBalanceCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingBalanceDebit: number;
  closingBalanceCredit: number;
};

export type CashbookSummaryResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  count: number;
  totalOpeningBalanceDebit: number;
  totalOpeningBalanceCredit: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  totalClosingBalanceDebit: number;
  totalClosingBalanceCredit: number;
  items: CashbookSummaryRowDto[];
};

export type BankReconciliationListItemDto = {
  id: string;
  tenantId: string;
  ledgerAccountId: string;
  ledgerAccountCode?: string | null;
  ledgerAccountName?: string | null;
  statementFromUtc: string;
  statementToUtc: string;
  statementClosingBalance: number;
  bookClosingBalance: number;
  differenceAmount: number;
  status: number;
  notes?: string | null;
  completedOnUtc?: string | null;
  cancelledOnUtc?: string | null;
};

export type BankReconciliationsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: BankReconciliationListItemDto[];
};

export type BankReconciliationMatchDto = {
  id: string;
  bankReconciliationId: string;
  bankReconciliationLineId: string;
  bankStatementImportLineId: string;
  matchedOnUtc: string;
  notes?: string | null;
};

export type BankReconciliationDetailLineDto = {
  id: string;
  bankReconciliationId: string;
  ledgerMovementId: string;
  isReconciled: boolean;
  notes?: string | null;
  journalEntryId: string;
  journalEntryLineId: string;
  movementDateUtc: string;
  reference: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  match?: BankReconciliationMatchDto | null;
};

export type BankReconciliationDetailResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  reconciliation: {
    id: string;
    tenantId: string;
    ledgerAccountId: string;
    ledgerAccountCode?: string | null;
    ledgerAccountName?: string | null;
    statementFromUtc: string;
    statementToUtc: string;
    statementClosingBalance: number;
    bookClosingBalance: number;
    differenceAmount: number;
    status: number;
    notes?: string | null;
    completedOnUtc?: string | null;
    cancelledOnUtc?: string | null;
  };
  matchCount: number;
  count: number;
  reconciledCount: number;
  unreconciledCount: number;
  items: BankReconciliationDetailLineDto[];
};

export type CreateBankReconciliationRequest = {
  ledgerAccountId: string;
  statementFromUtc: string;
  statementToUtc: string;
  statementClosingBalance: number;
  notes?: string | null;
};


export type SetBankReconciliationLineReconciledStateRequest = {
  isReconciled: boolean;
  notes?: string | null;
};

export type UploadBankStatementImportLineRequest = {
  transactionDateUtc: string;
  valueDateUtc?: string | null;
  reference: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance?: number | null;
  externalReference?: string | null;
};

export type UploadBankStatementImportRequest = {
  ledgerAccountId: string;
  statementFromUtc: string;
  statementToUtc: string;
  sourceReference?: string | null;
  fileName?: string | null;
  notes?: string | null;
  lines: UploadBankStatementImportLineRequest[];
};

export type CreateApiPlaceholderBankStatementImportRequest = {
  ledgerAccountId: string;
  statementFromUtc: string;
  statementToUtc: string;
  sourceReference: string;
  notes?: string | null;
};

export type BankStatementImportListItemDto = {
  id: string;
  tenantId: string;
  ledgerAccountId: string;
  ledgerAccountCode?: string | null;
  ledgerAccountName?: string | null;
  statementFromUtc: string;
  statementToUtc: string;
  sourceType: number;
  sourceReference: string;
  fileName?: string | null;
  notes?: string | null;
  importedOnUtc: string;
  lineCount: number;
};

export type BankStatementImportsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: BankStatementImportListItemDto[];
};

export type BankStatementImportDetailLineDto = {
  id: string;
  bankStatementImportId: string;
  transactionDateUtc: string;
  valueDateUtc?: string | null;
  reference: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  balance?: number | null;
  externalReference?: string | null;
  match?: BankReconciliationMatchDto | null;
};

export type BankStatementImportDetailResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  bankStatementImport: {
    id: string;
    tenantId: string;
    ledgerAccountId: string;
    ledgerAccountCode?: string | null;
    ledgerAccountName?: string | null;
    statementFromUtc: string;
    statementToUtc: string;
    sourceType: number;
    sourceReference: string;
    fileName?: string | null;
    notes?: string | null;
    importedOnUtc: string;
  };
  matchCount: number;
  count: number;
  totalDebit: number;
  totalCredit: number;
  items: BankStatementImportDetailLineDto[];
};

export type CreateBankReconciliationMatchRequest = {
  bankReconciliationLineId: string;
  bankStatementImportLineId: string;
  notes?: string | null;
};

export type JournalEntryDto = {
  id: string;
  tenantId: string;
  entryDateUtc: string;
  reference: string;
  description: string;
  status: number;
  type: number;
  postingRequiresApproval?: boolean;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  postedAtUtc: string | null;
  reversedAtUtc: string | null;
  reversalJournalEntryId: string | null;
  reversedJournalEntryId: string | null;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
  lines: {
    id: string;
    ledgerAccountId: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
  }[];
};

export type FiscalPeriodDto = {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: number;
};

export type ReportLineDto = {
  ledgerAccountId: string;
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance?: number;
  amount?: number;
};

export type BalanceSheetResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  asOfUtc: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  assets: ReportLineDto[];
  liabilities: ReportLineDto[];
  equity: ReportLineDto[];
};

export type IncomeStatementResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  income: ReportLineDto[];
  expenses: ReportLineDto[];
};

export type TrialBalanceRowDto = {
  ledgerAccountId: string;
  code: string;
  name: string;
  category: number;
  normalBalance: number;
  totalDebit: number;
  totalCredit: number;
  balanceDebit: number;
  balanceCredit: number;
};

export type TrialBalanceResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  count: number;
  totalDebit: number;
  totalCredit: number;
  items: TrialBalanceRowDto[];
};

export type SubscriptionPackageDto = {
  id: string;
  code: string;
  name: string;
  description: string;
  monthlyPrice: number;
  currencyCode: string;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
};

export type BillingSettingsDto = {
  id?: string | null;
  accountName: string;
  bankName: string;
  accountNumber: string;
  supportEmail: string;
  paymentInstructions: string;
};

export type TenantSubscriptionApplicationDto = {
  id: string;
  companyName: string;
  desiredTenantKey: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  packageCodeSnapshot: string;
  packageNameSnapshot: string;
  amountSnapshot: number;
  currencyCodeSnapshot: string;
  paymentReference: string;
  status: number;
  paymentConfirmationNote: string | null;
  rejectionReason: string | null;
  confirmedByUserId: string | null;
  paymentConfirmedOnUtc: string | null;
  activatedTenantId: string | null;
  createdOnUtc: string;
};

export type SubscriptionApplicationCreateResponse = {
  message: string;
  applicationId: string;
  companyName: string;
  desiredTenantKey: string;
  adminEmail: string;
  packageCodeSnapshot: string;
  packageNameSnapshot: string;
  amountSnapshot: number;
  currencyCodeSnapshot: string;
  paymentReference: string;
  status: number;
  billing: BillingSettingsDto;
};

export type AdminUserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  isActive: boolean;
  passwordResetTokenExpiresOnUtc?: string | null;
  createdOnUtc: string;
  createdBy?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
};

export type AdminUsersResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: AdminUserDto[];
};

export type AssignableRolesResponse = {
  count: number;
  items: string[];
};

export type CreateAdminUserRequest = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password: string;
  isActive: boolean;
};

export type UpdateAdminUserRequest = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
};

export type TenantOverviewResponse = {
  tenantId: string;
  tenantKey: string;
  tenantName: string;
  tenantStatus: number;
  packageName?: string | null;
  amountPaid?: number | null;
  currencyCode?: string | null;
  licenseStartDateUtc?: string | null;
  licenseEndDateUtc?: string | null;
  licenseStatus: number;
  daysRemaining?: number | null;
  renewalWarning: string;
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: {
      platformAdmin: number;
      tenantAdmin: number;
      accountant: number;
      approver: number;
      viewer: number;
    };
  };
};

export type PlatformAdminTenantSummaryDto = {
  tenantId: string;
  tenantName: string;
  tenantKey: string;
  tenantStatus: number;
  license: {
    isConfigured: boolean;
    packageName?: string | null;
    amountPaid?: number | null;
    currencyCode?: string | null;
    licenseStartDateUtc?: string | null;
    licenseEndDateUtc?: string | null;
    licenseStatus: number;
    daysRemaining?: number | null;
    renewalWarning: string;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: {
      platformAdmin: number;
      tenantAdmin: number;
      accountant: number;
      approver: number;
      viewer: number;
    };
  };
};

export type PlatformAdminTenantsResponse = {
  count: number;
  items: PlatformAdminTenantSummaryDto[];
};

export type PlatformAdminTenantDetailResponse = {
  tenant: {
    id: string;
    name: string;
    key: string;
    status: number;
  };
  license: {
    isConfigured: boolean;
    packageName?: string | null;
    amountPaid?: string | null;
    currencyCode?: string | null;
    licenseStartDateUtc?: string | null;
    licenseEndDateUtc?: string | null;
    licenseStatus: number;
    daysRemaining?: number | null;
  };
  users: {
    count: number;
    items: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      displayName: string;
      role: string;
      isActive: boolean;
      createdOnUtc: string;
      lastModifiedOnUtc?: string | null;
    }[];
  };
};

export type RenewTenantLicenseRequest = {
  newStartDateUtc: string;
  newEndDateUtc: string;
  amountPaid: number;
  currencyCode: string;
};

export type ChangeTenantPackageRequest = {
  subscriptionPackageId: string;
};

export type CustomerDto = {
  id: string;
  customerCode: string;
  customerName: string;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
  createdOnUtc: string;
};

export type CustomersResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: CustomerDto[];
};

export type CreateCustomerRequest = {
  customerCode: string;
  customerName: string;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
};

export type SalesInvoiceLineDto = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type SalesInvoiceDto = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  status: number;
  totalAmount: number;
  taxAdditionAmount: number;
  taxDeductionAmount: number;
  grossAmount: number;
  netReceivableAmount: number;
  amountPaid: number;
  balanceAmount: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  lineCount: number;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  };

export type SalesInvoicesResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: SalesInvoiceDto[];
};

export type CreateSalesInvoiceRequest = {
  customerId: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  lines: SalesInvoiceLineDto[];
  taxCodeIds?: string[] | null;
};

export type PostSalesInvoiceRequest = {
  receivableLedgerAccountId: string;
  revenueLedgerAccountId: string;
};

export type RejectedSalesInvoiceLineDto = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type RejectedSalesInvoiceTaxLineDto = {
  id: string;
  taxCodeId: string;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxableAmount: number;
  taxAmount: number;
  taxLedgerAccountId: string;
  description: string;
};

export type RejectedSalesInvoiceDto = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  status: number;
  totalAmount: number;
  taxAdditionAmount: number;
  taxDeductionAmount: number;
  grossAmount: number;
  netReceivableAmount: number;
  amountPaid: number;
  balanceAmount: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  submittedBy?: string | null;
  submittedByDisplayName?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedByDisplayName?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedByDisplayName?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string | null;
  createdBy?: string | null;
  createdByDisplayName?: string | null;
  preparedByDisplayName?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedByDisplayName?: string | null;
  lines: RejectedSalesInvoiceLineDto[];
  taxLines: RejectedSalesInvoiceTaxLineDto[];
};

export type UpdateSalesInvoiceRequest = {
  customerId: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  lines: SalesInvoiceLineDto[];
  taxCodeIds?: string[];
};

export type CustomerReceiptDto = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  receiptDateUtc: string;
  receiptNumber: string;
  description: string;
  amount: number;
  status: number;
  postingRequiresApproval?: boolean;
  submittedBy?: string | null;
  submittedByDisplayName?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedByDisplayName?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedByDisplayName?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string;
  createdBy?: string | null;
  createdByDisplayName?: string | null;
  preparedByDisplayName?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedByDisplayName?: string | null;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
};

export type CustomerReceiptsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: CustomerReceiptDto[];
};

export type CustomerReceiptDetailResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  receipt: {
    id: string;
    customerId: string;
    customerCode: string;
    customerName: string;
    customerEmail?: string | null;
    customerPhoneNumber?: string | null;
    customerBillingAddress?: string | null;
    salesInvoiceId: string;
    invoiceNumber: string;
    invoiceDescription: string;
    invoiceDateUtc?: string | null;
    invoiceTotalAmount: number;
    invoiceTaxAdditionAmount: number;
    invoiceTaxDeductionAmount: number;
    invoiceGrossAmount: number;
    invoiceNetReceivableAmount: number;
    invoiceAmountPaid: number;
    invoiceBalanceAmount: number;
    receiptDateUtc: string;
    receiptNumber: string;
    description: string;
    amount: number;
    status: number;
    postingRequiresApproval?: boolean;
    submittedBy?: string | null;
    submittedByDisplayName?: string | null;
    submittedOnUtc?: string | null;
    approvedBy?: string | null;
    approvedByDisplayName?: string | null;
    approvedOnUtc?: string | null;
    rejectedBy?: string | null;
    rejectedByDisplayName?: string | null;
    rejectedOnUtc?: string | null;
    rejectionReason?: string | null;
    journalEntryId?: string | null;
    postedOnUtc?: string | null;
    createdOnUtc: string;
    createdBy?: string | null;
    createdByDisplayName?: string | null;
    preparedByDisplayName?: string | null;
    lastModifiedOnUtc?: string | null;
    lastModifiedBy?: string | null;
    lastModifiedByDisplayName?: string | null;
    invoiceLines: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  };
};

export type VendorStatementResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  vendor: {
    id: string;
    vendorCode: string;
    vendorName: string;
    email?: string | null;
    phoneNumber?: string | null;
    billingAddress?: string | null;
    isActive: boolean;
  };
  fromUtc?: string | null;
  toUtc?: string | null;
  totalInvoices: number;
  totalPayments: number;
  totalInvoiced: number;
  totalPaid: number;
  closingBalance: number;
  totalBaseAmount: number;
  totalTaxAdditions: number;
  totalTaxDeductions: number;
  totalGrossAmount: number;
  count: number;
  items: {
    type: string;
    dateUtc: string;
    reference: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    invoiceAmount: number;
    baseAmount: number;
    taxAdditionAmount: number;
    taxDeductionAmount: number;
    grossAmount: number;
    netPayableAmount: number;
    paymentAmount: number;
    runningBalance: number;
    status: number;
  }[];
};

export type CreateCustomerReceiptRequest = {
  customerId: string;
  salesInvoiceId: string;
  receiptDateUtc: string;
  receiptNumber: string;
  description: string;
  amount: number;
};

export type PostCustomerReceiptRequest = {
  cashOrBankLedgerAccountId: string;
  receivableLedgerAccountId: string;
};

export type RejectCustomerReceiptRequest = {
  reason: string;
};


export type RejectedCustomerReceiptDto = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  invoiceDescription: string;
  invoiceDateUtc?: string | null;
  invoiceTotalAmount: number;
  invoiceTaxAdditionAmount: number;
  invoiceTaxDeductionAmount: number;
  invoiceGrossAmount: number;
  invoiceNetReceivableAmount: number;
  invoiceAmountPaid: number;
  invoiceBalanceAmount: number;
  receiptDateUtc: string;
  receiptNumber: string;
  description: string;
  amount: number;
  status: number;
  postingRequiresApproval: boolean;
  submittedBy?: string | null;
  submittedByDisplayName?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedByDisplayName?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedByDisplayName?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string | null;
  createdBy?: string | null;
  createdByDisplayName?: string | null;
  preparedByDisplayName?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedByDisplayName?: string | null;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
};

export type UpdateCustomerReceiptRequest = {
  customerId: string;
  salesInvoiceId: string;
  receiptDateUtc: string;
  receiptNumber: string;
  description: string;
  amount: number;
};


export type VendorDto = {
  id: string;
  vendorCode: string;
  vendorName: string;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
  createdOnUtc: string;
};

export type VendorsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: VendorDto[];
};

export type CreateVendorRequest = {
  vendorCode: string;
  vendorName: string;
  email?: string | null;
  phoneNumber?: string | null;
  billingAddress?: string | null;
  isActive: boolean;
};

export type PurchaseInvoiceLineDto = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type PurchaseInvoiceDto = {
  id: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  status: number;
  totalAmount: number;
  taxAdditionAmount: number;
  taxDeductionAmount: number;
  grossAmount: number;
  netPayableAmount: number;
  amountPaid: number;
  balanceAmount: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  lineCount: number;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  };

export type PurchaseInvoicesResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PurchaseInvoiceDto[];
};

export type CreatePurchaseInvoiceRequest = {
  vendorId: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  lines: PurchaseInvoiceLineDto[];
  taxCodeIds?: string[] | null;
};

export type PostPurchaseInvoiceRequest = {
  payableLedgerAccountId: string;
  expenseLedgerAccountId: string;
};


export type RejectedPurchaseInvoiceLineDto = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type RejectedPurchaseInvoiceTaxLineDto = {
  id: string;
  taxCodeId: string;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxableAmount: number;
  taxAmount: number;
  taxLedgerAccountId: string;
  description: string;
};

export type RejectedPurchaseInvoiceDto = {
  id: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  status: number;
  totalAmount: number;
  taxAdditionAmount: number;
  taxDeductionAmount: number;
  grossAmount: number;
  netPayableAmount: number;
  amountPaid: number;
  balanceAmount: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  submittedBy?: string | null;
  submittedByDisplayName?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedByDisplayName?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedByDisplayName?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string | null;
  createdBy?: string | null;
  createdByDisplayName?: string | null;
  preparedByDisplayName?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedByDisplayName?: string | null;
  lines: RejectedPurchaseInvoiceLineDto[];
  taxLines: RejectedPurchaseInvoiceTaxLineDto[];
};

export type UpdatePurchaseInvoiceRequest = {
  vendorId: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  lines: PurchaseInvoiceLineDto[];
  taxCodeIds?: string[];
};



export type VendorPaymentDto = {
  id: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  purchaseInvoiceId: string;
  invoiceNumber: string;
  paymentDateUtc: string;
  paymentNumber: string;
  description: string;
  amount: number;
  status: number;
  postingRequiresApproval?: boolean;
  submittedBy?: string | null;
  submittedByDisplayName?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedByDisplayName?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedByDisplayName?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string;
  createdBy?: string | null;
  createdByDisplayName?: string | null;
  preparedByDisplayName?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedByDisplayName?: string | null;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
};

export type VendorPaymentsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: VendorPaymentDto[];
};

export type VendorPaymentDetailResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  payment: {
    id: string;
    vendorId: string;
    vendorCode: string;
    vendorName: string;
    vendorEmail?: string | null;
    vendorPhoneNumber?: string | null;
    vendorBillingAddress?: string | null;
    purchaseInvoiceId: string;
    invoiceNumber: string;
    invoiceDescription: string;
    invoiceDateUtc?: string | null;
    invoiceTotalAmount: number;
    invoiceTaxAdditionAmount: number;
    invoiceTaxDeductionAmount: number;
    invoiceGrossAmount: number;
    invoiceNetPayableAmount: number;
    invoiceAmountPaid: number;
    invoiceBalanceAmount: number;
    paymentDateUtc: string;
    paymentNumber: string;
    description: string;
    amount: number;
    status: number;
    postingRequiresApproval?: boolean;
    submittedBy?: string | null;
    submittedByDisplayName?: string | null;
    submittedOnUtc?: string | null;
    approvedBy?: string | null;
    approvedByDisplayName?: string | null;
    approvedOnUtc?: string | null;
    rejectedBy?: string | null;
    rejectedByDisplayName?: string | null;
    rejectedOnUtc?: string | null;
    rejectionReason?: string | null;
    journalEntryId?: string | null;
    journalEntryReference?: string | null;
    journalEntryDescription?: string | null;
    journalEntryDateUtc?: string | null;
    journalEntryStatus?: number | null;
    journalEntryPostedAtUtc?: string | null;
    postedOnUtc?: string | null;
    createdOnUtc: string;
    createdBy?: string | null;
    createdByDisplayName?: string | null;
    preparedByDisplayName?: string | null;
    lastModifiedOnUtc?: string | null;
    lastModifiedBy?: string | null;
    lastModifiedByDisplayName?: string | null;
    invoiceLines: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }[];
  };
};

export type CreateVendorPaymentRequest = {
  vendorId: string;
  purchaseInvoiceId: string;
  paymentDateUtc: string;
  paymentNumber: string;
  description: string;
  amount: number;
};

export type PostVendorPaymentRequest = {
  cashOrBankLedgerAccountId: string;
  payableLedgerAccountId: string;
};

export type RejectVendorPaymentRequest = {
  reason: string;
};

export type RejectedVendorPaymentDto = {
  id: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  purchaseInvoiceId: string;
  invoiceNumber: string;
  invoiceDescription: string;
  invoiceDateUtc?: string | null;
  invoiceTotalAmount: number;
  invoiceTaxAdditionAmount: number;
  invoiceTaxDeductionAmount: number;
  invoiceGrossAmount: number;
  invoiceNetPayableAmount: number;
  invoiceAmountPaid: number;
  invoiceBalanceAmount: number;
  paymentDateUtc: string;
  paymentNumber: string;
  description: string;
  amount: number;
  status: number;
  postingRequiresApproval: boolean;
  submittedBy?: string | null;
  submittedByDisplayName?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedByDisplayName?: string | null;
  approvedOnUtc?: string | null;
  rejectedBy?: string | null;
  rejectedByDisplayName?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  createdOnUtc?: string | null;
  createdBy?: string | null;
  createdByDisplayName?: string | null;
  preparedByDisplayName?: string | null;
  lastModifiedOnUtc?: string | null;
  lastModifiedBy?: string | null;
  lastModifiedByDisplayName?: string | null;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
};

export type UpdateVendorPaymentRequest = {
  vendorId: string;
  purchaseInvoiceId: string;
  paymentDateUtc: string;
  paymentNumber: string;
  description: string;
  amount: number;
};

export type RejectJournalEntryRequest = {
  reason: string;
};

export async function getVendors() {
  const response = await api.get<VendorsResponse>('/api/finance/ap/vendors');
  return response.data;
}

export async function createVendor(payload: CreateVendorRequest) {
  const response = await api.post('/api/finance/ap/vendors', payload);
  return response.data;
}

export async function getPurchaseInvoices() {
  const response = await api.get<PurchaseInvoicesResponse>('/api/finance/ap/purchase-invoices');
  return response.data;
}

export async function createPurchaseInvoice(payload: CreatePurchaseInvoiceRequest) {
  const response = await api.post('/api/finance/ap/purchase-invoices', payload);
  return response.data;
}


export async function submitPurchaseInvoiceForApproval(purchaseInvoiceId: string) {
  const response = await api.post(`/api/finance/ap/purchase-invoices/${purchaseInvoiceId}/submit`);
  return response.data;
}

export async function approvePurchaseInvoice(purchaseInvoiceId: string) {
  const response = await api.post(`/api/finance/ap/purchase-invoices/${purchaseInvoiceId}/approve`);
  return response.data;
}

export async function rejectPurchaseInvoice(purchaseInvoiceId: string, payload: { reason: string }) {
  const response = await api.post(`/api/finance/ap/purchase-invoices/${purchaseInvoiceId}/reject`, payload);
  return response.data;
}


export async function postPurchaseInvoice(purchaseInvoiceId: string, payload: PostPurchaseInvoiceRequest) {
  const response = await api.post(
    `/api/finance/ap/purchase-invoices/${encodeURIComponent(purchaseInvoiceId)}/post`,
    payload
  );
  return response.data;
}


export async function getRejectedPurchaseInvoices(): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  items: RejectedPurchaseInvoiceDto[];
}> {
  const response = await api.get('/api/finance/ap/purchase-invoices/rejected');
  return response.data;
}

export async function updateRejectedPurchaseInvoice(
  purchaseInvoiceId: string,
  payload: UpdatePurchaseInvoiceRequest
) {
  const response = await api.put(`/api/finance/ap/purchase-invoices/${purchaseInvoiceId}`, payload);
  return response.data;
}

export async function deleteRejectedPurchaseInvoice(purchaseInvoiceId: string) {
  const response = await api.delete(`/api/finance/ap/purchase-invoices/${purchaseInvoiceId}`);
  return response.data;
}

export async function getVendorPayments() {
  const response = await api.get<VendorPaymentsResponse>('/api/finance/ap/vendor-payments');
  return response.data;
}

export async function getVendorPaymentDetail(vendorPaymentId: string) {
  const response = await api.get<VendorPaymentDetailResponse>(
    `/api/finance/ap/vendor-payments/${encodeURIComponent(vendorPaymentId)}`
  );
  return response.data;
}

export async function getVendorStatement(
  vendorId: string,
  fromUtc?: string | null,
  toUtc?: string | null
) {
  const response = await api.get<VendorStatementResponse>(
    `/api/finance/ap/vendors/${encodeURIComponent(vendorId)}/statement`,
    {
      params: {
        ...(fromUtc ? { fromUtc } : {}),
        ...(toUtc ? { toUtc } : {}),
      },
    }
  );

  return response.data;
}

export async function createVendorPayment(payload: CreateVendorPaymentRequest) {
  const response = await api.post('/api/finance/ap/vendor-payments', payload);
  return response.data;
}

export async function submitVendorPaymentForApproval(vendorPaymentId: string) {
  const response = await api.post(
    `/api/finance/ap/vendor-payments/${encodeURIComponent(vendorPaymentId)}/submit`,
    {}
  );
  return response.data;
}

export async function approveVendorPayment(vendorPaymentId: string) {
  const response = await api.post(
    `/api/finance/ap/vendor-payments/${encodeURIComponent(vendorPaymentId)}/approve`,
    {}
  );
  return response.data;
}

export async function rejectVendorPayment(vendorPaymentId: string, payload: RejectVendorPaymentRequest) {
  const response = await api.post(
    `/api/finance/ap/vendor-payments/${encodeURIComponent(vendorPaymentId)}/reject`,
    payload
  );
  return response.data;
}


export async function getRejectedVendorPayments(): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  items: RejectedVendorPaymentDto[];
}> {
  const response = await api.get('/api/finance/ap/vendor-payments/rejected');
  return response.data;
}

export async function updateRejectedVendorPayment(
  vendorPaymentId: string,
  payload: UpdateVendorPaymentRequest
) {
  const response = await api.put(`/api/finance/ap/vendor-payments/${vendorPaymentId}`, payload);
  return response.data;
}

export async function deleteRejectedVendorPayment(vendorPaymentId: string) {
  const response = await api.delete(`/api/finance/ap/vendor-payments/${vendorPaymentId}`);
  return response.data;
}

export async function postVendorPayment(vendorPaymentId: string, payload: PostVendorPaymentRequest) {
  const response = await api.post(
    `/api/finance/ap/vendor-payments/${encodeURIComponent(vendorPaymentId)}/post`,
    payload
  );
  return response.data;
}

export async function getTrialBalance(fromUtc?: string | null, toUtc?: string | null) {
  const response = await api.get<TrialBalanceResponse>('/api/finance/trial-balance', {
    params: {
      ...(fromUtc ? { fromUtc } : {}),
      ...(toUtc ? { toUtc } : {}),
    },
  });

  return response.data;
}

// ----------- COMMERCIAL -----------

export async function getPublicSubscriptionPackages() {
  const response = await api.get<{ count: number; items: SubscriptionPackageDto[] }>('/api/commercial/subscription-packages');
  return response.data;
}

export async function getAdminSubscriptionPackages() {
  const response = await api.get<{ count: number; items: SubscriptionPackageDto[] }>('/api/commercial/admin/subscription-packages');
  return response.data;
}

export async function getCurrentTenantLicense() {
  const response = await api.get<CurrentTenantLicenseResponse>('/api/commercial/current-license');
  return response.data;
}

export type UpsertSubscriptionPackageRequest = {
  code: string;
  name: string;
  description?: string;
  monthlyPrice: number;
  currencyCode?: string;
  displayOrder: number;
  isActive: boolean;
  isPublic: boolean;
};

export async function createSubscriptionPackage(payload: UpsertSubscriptionPackageRequest) {
  const response = await api.post('/api/commercial/admin/subscription-packages', payload);
  return response.data;
}

export async function updateSubscriptionPackage(packageId: string, payload: UpsertSubscriptionPackageRequest) {
  const response = await api.put(`/api/commercial/admin/subscription-packages/${encodeURIComponent(packageId)}`, payload);
  return response.data;
}

export async function getPublicBillingSettings() {
  const response = await api.get<BillingSettingsDto>('/api/commercial/billing-settings');
  return response.data;
}

export async function getAdminBillingSettings() {
  const response = await api.get<BillingSettingsDto>('/api/commercial/admin/billing-settings');
  return response.data;
}

export async function saveBillingSettings(payload: BillingSettingsDto) {
  const response = await api.put('/api/commercial/admin/billing-settings', payload);
  return response.data;
}

export type CreateTenantSubscriptionApplicationRequest = {
  companyName: string;
  desiredTenantKey: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  password: string;
  subscriptionPackageId: string;
};

export async function createTenantSubscriptionApplication(payload: CreateTenantSubscriptionApplicationRequest) {
  const response = await api.post<SubscriptionApplicationCreateResponse>('/api/commercial/applications', payload);
  return response.data;
}

export async function getSubscriptionApplications() {
  const response = await api.get<{ count: number; items: TenantSubscriptionApplicationDto[] }>('/api/commercial/admin/applications');
  return response.data;
}

export async function confirmSubscriptionApplicationPayment(applicationId: string, note?: string) {
  const response = await api.post(
    `/api/commercial/admin/applications/${encodeURIComponent(applicationId)}/confirm-payment`,
    { note: note || '' }
  );
  return response.data;
}

export async function rejectSubscriptionApplication(applicationId: string, reason: string) {
  const response = await api.post(
    `/api/commercial/admin/applications/${encodeURIComponent(applicationId)}/reject`,
    { reason }
  );
  return response.data;
}

// ----------- ADMIN USERS -----------

export async function getAdminUsers() {
  const response = await api.get<AdminUsersResponse>('/api/admin/users');
  return response.data;
}

export async function getAdminAssignableRoles() {
  const response = await api.get<AssignableRolesResponse>('/api/admin/users/roles');
  return response.data;
}

export async function createAdminUser(payload: CreateAdminUserRequest) {
  const response = await api.post('/api/admin/users', payload);
  return response.data;
}

export async function updateAdminUser(userId: string, payload: UpdateAdminUserRequest) {
  const response = await api.put(`/api/admin/users/${encodeURIComponent(userId)}`, payload);
  return response.data;
}

export async function activateAdminUser(userId: string) {
  const response = await api.post(`/api/admin/users/${encodeURIComponent(userId)}/activate`, {});
  return response.data;
}

export async function deactivateAdminUser(userId: string) {
  const response = await api.post(`/api/admin/users/${encodeURIComponent(userId)}/deactivate`, {});
  return response.data;
}

export async function issueAdminUserPasswordReset(userId: string) {
  const response = await api.post(`/api/admin/users/${encodeURIComponent(userId)}/issue-password-reset`, {});
  return response.data as {
    message: string;
    userId: string;
    email: string;
    expiresAtUtc: string;
  };
}

// ----------- ADMIN TENANT OVERVIEW -----------

export async function getAdminTenantOverview() {
  const response = await api.get<TenantOverviewResponse>('/api/admin/tenant-overview');
  return response.data;
}

// ----------- PLATFORM ADMIN TENANTS -----------

export async function getPlatformAdminTenants() {
  const response = await api.get<PlatformAdminTenantsResponse>('/api/admin/platform/tenants');
  return response.data;
}

export async function getPlatformAdminTenantDetail(tenantId: string) {
  const response = await api.get<PlatformAdminTenantDetailResponse>(
    `/api/admin/platform/tenants/${encodeURIComponent(tenantId)}`
  );
  return response.data;
}

export async function renewPlatformTenantLicense(tenantId: string, payload: RenewTenantLicenseRequest) {
  const response = await api.post(
    `/api/admin/platform/tenants/${encodeURIComponent(tenantId)}/renew-license`,
    payload
  );
  return response.data;
}

export async function changePlatformTenantPackage(tenantId: string, payload: ChangeTenantPackageRequest) {
  const response = await api.post(
    `/api/admin/platform/tenants/${encodeURIComponent(tenantId)}/change-package`,
    payload
  );
  return response.data;
}

export async function suspendPlatformTenant(tenantId: string) {
  const response = await api.post(
    `/api/admin/platform/tenants/${encodeURIComponent(tenantId)}/suspend`,
    {}
  );
  return response.data;
}

export async function reactivatePlatformTenant(tenantId: string) {
  const response = await api.post(
    `/api/admin/platform/tenants/${encodeURIComponent(tenantId)}/reactivate`,
    {}
  );
  return response.data;
}

// ----------- ACCOUNTS RECEIVABLE -----------

export async function getCustomers() {
  const response = await api.get<CustomersResponse>('/api/finance/ar/customers');
  return response.data;
}

export async function createCustomer(payload: CreateCustomerRequest) {
  const response = await api.post('/api/finance/ar/customers', payload);
  return response.data;
}

export async function getSalesInvoices() {
  const response = await api.get<SalesInvoicesResponse>('/api/finance/ar/sales-invoices');
  return response.data;
}

export async function createSalesInvoice(payload: CreateSalesInvoiceRequest) {
  const response = await api.post('/api/finance/ar/sales-invoices', payload);
  return response.data;
}

export async function postSalesInvoice(salesInvoiceId: string, payload: PostSalesInvoiceRequest) {
  const response = await api.post(
    `/api/finance/ar/sales-invoices/${encodeURIComponent(salesInvoiceId)}/post`,
    payload
  );
  return response.data;
}

export async function submitSalesInvoiceForApproval(salesInvoiceId: string) {
  const response = await api.post(`/api/finance/ar/sales-invoices/${salesInvoiceId}/submit`);
  return response.data;
}

export async function approveSalesInvoice(salesInvoiceId: string) {
  const response = await api.post(`/api/finance/ar/sales-invoices/${salesInvoiceId}/approve`);
  return response.data;
}

export async function rejectSalesInvoice(salesInvoiceId: string, payload: { reason: string }) {
  const response = await api.post(`/api/finance/ar/sales-invoices/${salesInvoiceId}/reject`, payload);
  return response.data;
}

export async function getRejectedSalesInvoices(): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  items: RejectedSalesInvoiceDto[];
}> {
  const response = await api.get('/api/finance/ar/sales-invoices/rejected');
  return response.data;
}

export async function updateRejectedSalesInvoice(
  salesInvoiceId: string,
  payload: UpdateSalesInvoiceRequest
) {
  const response = await api.put(`/api/finance/ar/sales-invoices/${salesInvoiceId}`, payload);
  return response.data;
}

export async function deleteRejectedSalesInvoice(salesInvoiceId: string) {
  const response = await api.delete(`/api/finance/ar/sales-invoices/${salesInvoiceId}`);
  return response.data;
}

export async function getRejectedCustomerReceipts(): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  items: RejectedCustomerReceiptDto[];
}> {
  const response = await api.get('/api/finance/ar/customer-receipts/rejected');
  return response.data;
}

export async function updateRejectedCustomerReceipt(
  customerReceiptId: string,
  payload: UpdateCustomerReceiptRequest
) {
  const response = await api.put(`/api/finance/ar/customer-receipts/${customerReceiptId}`, payload);
  return response.data;
}

export async function deleteRejectedCustomerReceipt(customerReceiptId: string) {
  const response = await api.delete(`/api/finance/ar/customer-receipts/${customerReceiptId}`);
  return response.data;
}

export async function getCustomerReceipts() {
  const response = await api.get<CustomerReceiptsResponse>('/api/finance/ar/customer-receipts');
  return response.data;
}

export async function getCustomerReceiptDetail(customerReceiptId: string) {
  const response = await api.get<CustomerReceiptDetailResponse>(
    `/api/finance/ar/customer-receipts/${encodeURIComponent(customerReceiptId)}`
  );
  return response.data;
}

export async function createCustomerReceipt(payload: CreateCustomerReceiptRequest) {
  const response = await api.post('/api/finance/ar/customer-receipts', payload);
  return response.data;
}

export async function submitCustomerReceiptForApproval(customerReceiptId: string) {
  const response = await api.post(
    `/api/finance/ar/customer-receipts/${encodeURIComponent(customerReceiptId)}/submit`,
    {}
  );
  return response.data;
}

export async function approveCustomerReceipt(customerReceiptId: string) {
  const response = await api.post(
    `/api/finance/ar/customer-receipts/${encodeURIComponent(customerReceiptId)}/approve`,
    {}
  );
  return response.data;
}

export async function rejectCustomerReceipt(customerReceiptId: string, payload: RejectCustomerReceiptRequest) {
  const response = await api.post(
    `/api/finance/ar/customer-receipts/${encodeURIComponent(customerReceiptId)}/reject`,
    payload
  );
  return response.data;
}

export async function postCustomerReceipt(customerReceiptId: string, payload: PostCustomerReceiptRequest) {
  const response = await api.post(
    `/api/finance/ar/customer-receipts/${encodeURIComponent(customerReceiptId)}/post`,
    payload
  );
  return response.data;
}

// ----------- READS -----------

export async function getDashboardSummary() {
  const response = await api.get<DashboardSummaryResponse>('/api/finance/dashboard-summary');
  return response.data;
}

export async function getAccounts() {
  const response = await api.get<ListEnvelope<LedgerAccountDto>>('/api/finance/accounts');
  return response.data;
}

export async function getLedgerAccountStatement(
  ledgerAccountId: string,
  fromUtc?: string | null,
  toUtc?: string | null
) {
  const response = await api.get<LedgerAccountStatementResponse>(
    `/api/finance/accounts/${encodeURIComponent(ledgerAccountId)}/ledger`,
    {
      params: {
        ...(fromUtc ? { fromUtc } : {}),
        ...(toUtc ? { toUtc } : {}),
      },
    }
  );

  return response.data;
}

export async function getCashbook(
  ledgerAccountId?: string | null,
  fromUtc?: string | null,
  toUtc?: string | null
) {
  const response = await api.get<CashbookResponse>('/api/finance/reports/cashbook', {
    params: {
      ...(ledgerAccountId ? { ledgerAccountId } : {}),
      ...(fromUtc ? { fromUtc } : {}),
      ...(toUtc ? { toUtc } : {}),
    },
  });

  return response.data;
}

export async function getCashbookSummary(
  fromUtc?: string | null,
  toUtc?: string | null
) {
  const response = await api.get<CashbookSummaryResponse>('/api/finance/reports/cashbook-summary', {
    params: {
      ...(fromUtc ? { fromUtc } : {}),
      ...(toUtc ? { toUtc } : {}),
    },
  });

  return response.data;
}

export async function createBankReconciliation(payload: CreateBankReconciliationRequest) {
  const response = await api.post('/api/finance/reconciliations', payload);
  return response.data;
}

export async function getBankReconciliations(ledgerAccountId?: string | null) {
  const response = await api.get<BankReconciliationsResponse>('/api/finance/reconciliations', {
    params: {
      ...(ledgerAccountId ? { ledgerAccountId } : {}),
    },
  });

  return response.data;
}

export async function getBankReconciliationDetail(bankReconciliationId: string) {
  const response = await api.get<BankReconciliationDetailResponse>(
    `/api/finance/reconciliations/${encodeURIComponent(bankReconciliationId)}`
  );

  return response.data;
}

export async function setBankReconciliationLineReconciledState(
  bankReconciliationId: string,
  bankReconciliationLineId: string,
  payload: SetBankReconciliationLineReconciledStateRequest
) {
  const response = await api.post(
    `/api/finance/reconciliations/${encodeURIComponent(bankReconciliationId)}/lines/${encodeURIComponent(bankReconciliationLineId)}/set-reconciled`,
    payload
  );

  return response.data;
}


export async function completeBankReconciliation(bankReconciliationId: string) {
  const response = await api.post(
    `/api/finance/reconciliations/${encodeURIComponent(bankReconciliationId)}/complete`,
    {}
  );

  return response.data;
}

export async function cancelBankReconciliation(bankReconciliationId: string) {
  const response = await api.post(
    `/api/finance/reconciliations/${encodeURIComponent(bankReconciliationId)}/cancel`,
    {}
  );

  return response.data;
}


export async function uploadBankStatementImport(payload: UploadBankStatementImportRequest) {
  const response = await api.post('/api/finance/bank-statements/imports/upload', payload);
  return response.data;
}

export async function createApiPlaceholderBankStatementImport(
  payload: CreateApiPlaceholderBankStatementImportRequest
) {
  const response = await api.post('/api/finance/bank-statements/imports/api-placeholder', payload);
  return response.data;
}

export async function getBankStatementImports(ledgerAccountId?: string | null) {
  const response = await api.get<BankStatementImportsResponse>('/api/finance/bank-statements/imports', {
    params: {
      ...(ledgerAccountId ? { ledgerAccountId } : {}),
    },
  });

  return response.data;
}

export async function getBankStatementImportDetail(bankStatementImportId: string) {
  const response = await api.get<BankStatementImportDetailResponse>(
    `/api/finance/bank-statements/imports/${encodeURIComponent(bankStatementImportId)}`
  );

  return response.data;
}


export async function createBankReconciliationMatch(
  bankReconciliationId: string,
  payload: CreateBankReconciliationMatchRequest
) {
  const response = await api.post(
    `/api/finance/reconciliations/${encodeURIComponent(bankReconciliationId)}/matches`,
    payload
  );

  return response.data;
}

export async function removeBankReconciliationMatch(
  bankReconciliationId: string,
  bankReconciliationMatchId: string
) {
  const response = await api.post(
    `/api/finance/reconciliations/${encodeURIComponent(bankReconciliationId)}/matches/${encodeURIComponent(bankReconciliationMatchId)}/remove`,
    {}
  );

  return response.data;
}


export async function getJournalEntries() {
  const response = await api.get<ListEnvelope<JournalEntryDto>>('/api/finance/journal-entries');
  return response.data;
}

export async function getFiscalPeriods() {
  const response = await api.get<ListEnvelope<FiscalPeriodDto>>('/api/finance/fiscal-periods');
  return response.data;
}

export async function getBalanceSheet() {
  const response = await api.get<BalanceSheetResponse>('/api/finance/reports/balance-sheet');
  return response.data;
}

export async function getIncomeStatement(fromUtc?: string | null, toUtc?: string | null) {
  const response = await api.get<IncomeStatementResponse>('/api/finance/reports/income-statement', {
    params: {
      ...(fromUtc ? { fromUtc } : {}),
      ...(toUtc ? { toUtc } : {}),
    },
  });
  return response.data;
}

// ----------- WRITES -----------

export type CreateLedgerAccountRequest = {
  code: string;
  name: string;
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  parentLedgerAccountId?: string | null;
  purpose?: string | null;
  isCashOrBankAccount: boolean;
};

export type UpdateLedgerAccountRequest = {
  name: string;
  purpose?: string | null;
  isActive: boolean;
  isCashOrBankAccount: boolean;
};

export type TaxCodeDto = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxLedgerAccountId: string;
  taxLedgerAccountCode?: string | null;
  taxLedgerAccountName?: string | null;
  isActive: boolean;
  effectiveFromUtc: string;
  effectiveToUtc?: string | null;
};

export type TaxCodesResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: TaxCodeDto[];
};

export type CreateTaxCodeRequest = {
  code: string;
  name: string;
  description?: string | null;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxLedgerAccountId: string;
  isActive: boolean;
  effectiveFromUtc: string;
  effectiveToUtc?: string | null;
};

export type PreviewTaxCalculationRequest = {
  transactionDateUtc: string;
  transactionScope: number;
  taxableAmount: number;
  taxCodeIds: string[];
};

export type PreviewTaxCalculationLineDto = {
  taxCodeId: string;
  code: string;
  name: string;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxLedgerAccountId: string;
  taxLedgerAccountCode?: string | null;
  taxLedgerAccountName?: string | null;
  taxableAmount: number;
  taxAmount: number;
  isAddition: boolean;
  isDeduction: boolean;
};

export type PreviewTaxCalculationResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  transactionDateUtc: string;
  transactionScope: number;
  taxableAmount: number;
  totalAdditions: number;
  totalDeductions: number;
  grossAmount: number;
  netAmount: number;
  count: number;
  items: PreviewTaxCalculationLineDto[];
};


export type TaxReportByComponentKindDto = {
  componentKind: number;
  count: number;
  totalTaxableAmount: number;
  totalTaxAmount: number;
};

export type TaxReportByTaxCodeDto = {
  taxCodeId: string;
  taxCode?: string | null;
  taxCodeName?: string | null;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxLedgerAccountId: string;
  taxLedgerAccountCode?: string | null;
  taxLedgerAccountName?: string | null;
  count: number;
  totalTaxableAmount: number;
  totalTaxAmount: number;
};

export type TaxReportLineDto = {
  id: string;
  tenantId: string;
  taxCodeId: string;
  taxCode?: string | null;
  taxCodeName?: string | null;
  transactionDateUtc: string;
  sourceModule: string;
  sourceDocumentType: string;
  sourceDocumentId: string;
  sourceDocumentNumber: string;
  taxableAmount: number;
  taxAmount: number;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: number;
  taxLedgerAccountId: string;
  taxLedgerAccountCode?: string | null;
  taxLedgerAccountName?: string | null;
  counterpartyId?: string | null;
  counterpartyCode?: string | null;
  counterpartyName?: string | null;
  description?: string | null;
  journalEntryId?: string | null;
};

export type TaxReportResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  fromUtc: string | null;
  toUtc: string | null;
  componentKind?: number | null;
  transactionScope?: number | null;
  count: number;
  totalTaxableAmount: number;
  totalTaxAmount: number;
  totalAdditions: number;
  totalDeductions: number;
  byComponentKind: TaxReportByComponentKindDto[];
  byTaxCode: TaxReportByTaxCodeDto[];
  items: TaxReportLineDto[];
};


export async function createLedgerAccount(payload: CreateLedgerAccountRequest) {
  const response = await api.post('/api/finance/accounts', payload);
  return response.data;
}

export async function updateLedgerAccount(ledgerAccountId: string, payload: UpdateLedgerAccountRequest) {
  const response = await api.put(
    `/api/finance/accounts/${encodeURIComponent(ledgerAccountId)}`,
    payload
  );
  return response.data;
}

export async function getTaxCodes(
  componentKind?: number | null,
  transactionScope?: number | null,
  activeOnly?: boolean | null
) {
  const response = await api.get<TaxCodesResponse>('/api/finance/tax-codes', {
    params: {
      ...(componentKind ? { componentKind } : {}),
      ...(transactionScope ? { transactionScope } : {}),
      ...(activeOnly !== null && activeOnly !== undefined ? { activeOnly } : {}),
    },
  });

  return response.data;
}

export async function createTaxCode(payload: CreateTaxCodeRequest) {
  const response = await api.post('/api/finance/tax-codes', payload);
  return response.data;
}


export async function previewTaxCalculation(payload: PreviewTaxCalculationRequest) {
  const response = await api.post<PreviewTaxCalculationResponse>(
    '/api/finance/tax-calculations/preview',
    payload
  );

  return response.data;
}


export async function getTaxReport(
  fromUtc?: string | null,
  toUtc?: string | null,
  componentKind?: number | null,
  transactionScope?: number | null
) {
  const response = await api.get<TaxReportResponse>('/api/finance/reports/taxes', {
    params: {
      ...(fromUtc ? { fromUtc } : {}),
      ...(toUtc ? { toUtc } : {}),
      ...(componentKind ? { componentKind } : {}),
      ...(transactionScope ? { transactionScope } : {}),
    },
  });

  return response.data;
}


export type JournalLineRequest = {
  ledgerAccountId: string;
  description?: string | null;
  debitAmount: number;
  creditAmount: number;
};

export type CreateJournalEntryRequest = {
  entryDateUtc: string;
  reference?: string | null;
  description: string;
  lines: JournalLineRequest[];
};

export async function createJournalEntry(payload: CreateJournalEntryRequest) {
  const response = await api.post('/api/finance/journal-entries', payload);
  return response.data;
}

export async function submitJournalEntryForApproval(journalEntryId: string) {
  const response = await api.post(`/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/submit`, {});
  return response.data;
}

export async function approveJournalEntry(journalEntryId: string) {
  const response = await api.post(`/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/approve`, {});
  return response.data;
}

export async function rejectJournalEntry(journalEntryId: string, payload: RejectJournalEntryRequest) {
  const response = await api.post(
    `/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/reject`,
    payload
  );
  return response.data;
}

export async function postJournalEntry(journalEntryId: string) {
  const response = await api.post(`/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/post`, {});
  return response.data;
}

export async function voidJournalEntry(journalEntryId: string) {
  const response = await api.post(`/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/void`, {});
  return response.data;
}

export type ReverseJournalEntryRequest = {
  reversalDateUtc: string;
  reference: string;
  description: string;
};

export async function reverseJournalEntry(journalEntryId: string, payload: ReverseJournalEntryRequest) {
  const response = await api.post(`/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/reverse`, payload);
  return response.data;
}

export type CreateOpeningBalanceRequest = {
  entryDateUtc: string;
  reference?: string | null;
  description: string;
  lines: JournalLineRequest[];
};

export async function createOpeningBalance(payload: CreateOpeningBalanceRequest) {
  const response = await api.post('/api/finance/opening-balances', payload);
  return response.data;
}

export type CreateFiscalPeriodRequest = {
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

export async function createFiscalPeriod(payload: CreateFiscalPeriodRequest) {
  const response = await api.post('/api/finance/fiscal-periods', payload);
  return response.data;
}

export async function openFiscalPeriod(fiscalPeriodId: string) {
  const response = await api.post(`/api/finance/fiscal-periods/${encodeURIComponent(fiscalPeriodId)}/open`, {});
  return response.data;
}

export async function closeFiscalPeriod(fiscalPeriodId: string) {
  const response = await api.post(`/api/finance/fiscal-periods/${encodeURIComponent(fiscalPeriodId)}/close`, {});
  return response.data;
}