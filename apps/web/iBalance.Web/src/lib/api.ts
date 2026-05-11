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

export type BudgetAwareApiResponse = {
  message?: string;
  Message?: string;
  budgetWarning?: string | null;
  BudgetWarning?: string | null;
  budgetId?: string | null;
  BudgetId?: string | null;
  budgetLineId?: string | null;
  BudgetLineId?: string | null;
  budgetNumber?: string | null;
  BudgetNumber?: string | null;
  budgetName?: string | null;
  BudgetName?: string | null;
  budgetAmount?: number | null;
  BudgetAmount?: number | null;
  actualAmount?: number | null;
  ActualAmount?: number | null;
  projectedAmount?: number | null;
  ProjectedAmount?: number | null;
  remainingAmount?: number | null;
  RemainingAmount?: number | null;
  overrunPolicy?: number | null;
  OverrunPolicy?: number | null;
};

function pickBudgetValue<T>(camelValue: T | undefined, pascalValue: T | undefined): T | undefined {
  return camelValue ?? pascalValue;
}

export function formatBudgetAwareSuccessMessage(
  response: BudgetAwareApiResponse | undefined,
  fallback: string
) {
  const baseMessage =
    (typeof response?.message === 'string' && response.message.trim()) ||
    (typeof response?.Message === 'string' && response.Message.trim()) ||
    fallback;

  const budgetWarning =
    (typeof response?.budgetWarning === 'string' && response.budgetWarning.trim()) ||
    (typeof response?.BudgetWarning === 'string' && response.BudgetWarning.trim()) ||
    '';

  if (!budgetWarning) {
    return baseMessage;
  }

  return `${baseMessage} Budget warning: ${budgetWarning}`;
}

export function getBudgetAwareReadableError(error: unknown, fallback: string) {
  const anyErr = error as any;
  const data: BudgetAwareApiResponse | undefined = anyErr?.response?.data;

  const message = getTenantReadableError(error, fallback);

  const budgetNumber = pickBudgetValue(data?.budgetNumber, data?.BudgetNumber);
  const budgetName = pickBudgetValue(data?.budgetName, data?.BudgetName);
  const budgetAmount = pickBudgetValue(data?.budgetAmount, data?.BudgetAmount);
  const actualAmount = pickBudgetValue(data?.actualAmount, data?.ActualAmount);
  const projectedAmount = pickBudgetValue(data?.projectedAmount, data?.ProjectedAmount);
  const remainingAmount = pickBudgetValue(data?.remainingAmount, data?.RemainingAmount);

  const detailParts: string[] = [];

  if (budgetNumber || budgetName) {
    detailParts.push(
      [budgetNumber, budgetName].filter(Boolean).join(' - ')
    );
  }

  if (typeof budgetAmount === 'number') {
    detailParts.push(`Budget ${budgetAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  if (typeof actualAmount === 'number') {
    detailParts.push(`Actual ${actualAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  if (typeof projectedAmount === 'number') {
    detailParts.push(`Projected ${projectedAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  if (typeof remainingAmount === 'number') {
    detailParts.push(`Remaining ${remainingAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  if (detailParts.length === 0) {
    return message;
  }

  return `${message} (${detailParts.join(' | ')})`;
}

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
  sourceCode?: string | null;
  sourceLabel?: string | null;
  postingRequiresApproval?: boolean;
  submittedByDisplayName?: string | null;
  approvedByDisplayName?: string | null;
  rejectedByDisplayName?: string | null;
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

export type CreateFiscalYearRequest = {
  fiscalYearName: string;
  fiscalYearStartDate: string;
  createMonthsOpen: boolean;
};

export type CreateFiscalYearResponse = {
  message?: string;
  tenantId: string;
  tenantKey: string;
  fiscalYearName: string;
  fiscalYearStartDate: string;
  fiscalYearEndDate: string;
  count: number;
  items: FiscalPeriodDto[];
};

export type YearEndCloseRequest = {
  fiscalYearStartDate: string;
  fiscalYearEndDate: string;
  retainedEarningsLedgerAccountId: string;
  reference?: string | null;
  description?: string | null;
};

export type YearEndCloseResponse = {
  message?: string;
  id: string;
  reference: string;
  description: string;
  entryDateUtc: string;
  status: number;
  type: number;
  totalDebit: number;
  totalCredit: number;
  movementCount: number;
  fiscalYearStartDate: string;
  fiscalYearEndDate: string;
  retainedEarningsLedgerAccount: {
    id: string;
    code: string;
    name: string;
  };
  totalIncomeClosed: number;
  totalExpenseClosed: number;
  netIncome: number;
  closedAccountCount: number;
  periodCount: number;
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

export type AdminRoleBreakdownDto = {
  platformAdmin: number;
  tenantAdmin: number;
  financeController: number;
  accountant: number;
  approver: number;
  viewer: number;
  auditor: number;
  budgetOfficer: number;
  budgetOwner: number;
  payrollOfficer: number;
  hrOfficer: number;
  procurementOfficer: number;
  treasuryOfficer: number;
  inventoryOfficer: number;
  apOfficer: number;
  arOfficer: number;
  fixedAssetOfficer: number;
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
    byRole: AdminRoleBreakdownDto;
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
    byRole: AdminRoleBreakdownDto;
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
  receiptMatches?: PurchaseInvoiceReceiptMatchDto[];
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

export type PurchaseInvoiceReceiptMatchDto = {
  purchaseOrderReceiptId: string;
  receiptNumber?: string | null;
  matchedBaseAmount: number;
};

export type PurchaseOrderReceiptMatchingDto = {
  id: string;
  receiptNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber?: string | null;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  receiptDateUtc: string;
  status: number;
  notes?: string | null;
  totalAmount: number;
  matchedAmount: number;
  availableAmount: number;
};

export type PurchaseOrderReceiptMatchingResponse = ListEnvelope<PurchaseOrderReceiptMatchingDto>;

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
  receiptMatches?: PurchaseInvoiceReceiptMatchDto[];
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
  purchaseOrderReceiptIds?: string[] | null;
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
  receiptMatches?: PurchaseInvoiceReceiptMatchDto[];
};

export type UpdatePurchaseInvoiceRequest = {
  vendorId: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  lines: PurchaseInvoiceLineDto[];
  taxCodeIds?: string[];
  purchaseOrderReceiptIds?: string[];
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

// -----------------------------
// Budgets
// -----------------------------

export type BudgetStatus = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type BudgetType = 1 | 2 | 3 | 4;

export type BudgetOverrunPolicy = 1 | 2 | 3 | 4;

export type BudgetLineDto = {
  id: string;
  ledgerAccountId: string;
  ledgerAccountCode: string;
  ledgerAccountName: string;
  category: number;
  normalBalance: number;
  periodStartUtc: string;
  periodEndUtc: string;
  budgetAmount: number;
  notes?: string | null;
};

export type BudgetDto = {
  id: string;
  budgetNumber: string;
  name: string;
  description: string;
  type: BudgetType;
  periodStartUtc: string;
  periodEndUtc: string;
  status: BudgetStatus;
  overrunPolicy: BudgetOverrunPolicy;
  allowOverrun: boolean;
  notes?: string | null;
  submittedBy?: string | null;
  submittedOnUtc?: string | null;
  approvedBy?: string | null;
  approvedOnUtc?: string | null;
  submittedByDisplayName?: string | null;
  approvedByDisplayName?: string | null;
  rejectedByDisplayName?: string | null;
  lockedByDisplayName?: string | null;
  closedByDisplayName?: string | null;
  rejectedBy?: string | null;
  rejectedOnUtc?: string | null;
  rejectionReason?: string | null;
  lockedBy?: string | null;
  lockedOnUtc?: string | null;
  closedBy?: string | null;
  closedOnUtc?: string | null;
  closureReason?: string | null;
  cancelledOnUtc?: string | null;
  lineCount: number;
  totalAmount: number;
};

export type BudgetDetailDto = BudgetDto & {
  lines: BudgetLineDto[];
};

export type BudgetTransferDto = {
  id: string;
  budgetId: string;
  fromBudgetLineId: string;
  toBudgetLineId: string;
  amount: number;
  reason: string;
  transferredBy?: string | null;
  transferredByDisplayName?: string | null;
  transferredOnUtc: string;
};

export type BudgetLineRequest = {
  id?: string | null;
  ledgerAccountId: string;
  periodStartUtc: string;
  periodEndUtc: string;
  budgetAmount: number;
  notes?: string | null;
};

export type CreateBudgetRequest = {
  budgetNumber: string;
  name: string;
  description: string;
  type: BudgetType;
  periodStartUtc: string;
  periodEndUtc: string;
  notes?: string | null;
  overrunPolicy?: BudgetOverrunPolicy | null;
  lines: BudgetLineRequest[];
};

export type RejectBudgetRequest = {
  reason: string;
};

export type CloseBudgetRequest = {
  reason: string;
};

export type SetBudgetOverrunPolicyRequest = {
  overrunPolicy: BudgetOverrunPolicy;
};

export type TransferBudgetRequest = {
  fromBudgetLineId: string;
  toBudgetLineId: string;
  amount: number;
  reason: string;
};

export type UploadBudgetRowRequest = {
  budgetNumber: string;
  budgetName: string;
  description: string;
  budgetType: string;
  periodStart: string;
  periodEnd: string;
  overrunPolicy: string;
  ledgerAccountCode: string;
  linePeriodStart: string;
  linePeriodEnd: string;
  budgetAmount: number;
  notes?: string | null;
};

export type UploadBudgetRequest = {
  notes?: string | null;
  rows: UploadBudgetRowRequest[];
};

export type BudgetVsActualItemDto = {
  budgetLineId: string;
  ledgerAccountId: string;
  ledgerAccountCode: string;
  ledgerAccountName: string;
  category: number;
  normalBalance: number;
  periodStartUtc: string;
  periodEndUtc: string;
  budgetAmount: number;
  actualAmount: number;
  varianceAmount: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  budgetOverrunPolicy: BudgetOverrunPolicy;
  overrunStatus: string;
  notes?: string | null;
};

export type BudgetVsActualResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  budget: BudgetDto;
  totalBudgetAmount: number;
  totalActualAmount: number;
  totalVarianceAmount: number;
  overBudgetLineCount: number;
  count: number;
  items: BudgetVsActualItemDto[];
};

export type ConsolidatedBudgetVsActualBudgetDto = {
  id: string;
  budgetNumber: string;
  name: string;
  description: string;
  type: BudgetType;
  budgetTypeName: string;
  periodStartUtc: string;
  periodEndUtc: string;
  status: BudgetStatus;
  overrunPolicy: BudgetOverrunPolicy;
  allowOverrun: boolean;
  notes?: string | null;
  lineCount: number;
  totalBudgetAmount: number;
  totalActualAmount: number;
  totalVarianceAmount: number;
  overBudgetLineCount: number;
  items: BudgetVsActualItemDto[];
};

export type ConsolidatedBudgetVsActualSectionDto = {
  budgetType: BudgetType;
  budgetTypeName: string;
  budgetCount: number;
  totalBudgetAmount: number;
  totalActualAmount: number;
  totalVarianceAmount: number;
  overBudgetLineCount: number;
  budgets: ConsolidatedBudgetVsActualBudgetDto[];
};

export type ConsolidatedBudgetVsActualResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  periodStartUtc: string;
  periodEndUtc: string;
  sectionCount: number;
  budgetCount: number;
  totalBudgetAmount: number;
  totalActualAmount: number;
  totalVarianceAmount: number;
  overBudgetLineCount: number;
  sections: ConsolidatedBudgetVsActualSectionDto[];
};

export type UpdateJournalEntryRequest = CreateJournalEntryRequest;


export type PayrollSalaryStructureOverrideDto = {
  id: string;
  tenantId: string;
  payrollSalaryStructureId: string;
  employeeId: string;
  payGroupId: string;
  payElementId: string;
  payElementCode: string;
  payElementName: string;
  elementKind: number;
  calculationMode: number;
  defaultAmount: number;
  defaultRate: number;
  amountOverride?: number | null;
  rateOverride?: number | null;
  isExcluded: boolean;
  isActive: boolean;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  notes?: string | null;
  createdOnUtc: string;
};

export type PayrollSalaryStructureOverridesResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollSalaryStructureOverrideDto[];
};

export type CreatePayrollSalaryStructureOverrideRequest = {
  payrollSalaryStructureId: string;
  payElementId: string;
  amountOverride?: number | null;
  rateOverride?: number | null;
  isExcluded: boolean;
  isActive: boolean;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  notes?: string | null;
};

export type UpdatePayrollSalaryStructureOverrideRequest = {
  amountOverride?: number | null;
  rateOverride?: number | null;
  isExcluded: boolean;
  isActive: boolean;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  notes?: string | null;
};

export async function getPayrollSalaryStructureOverrides(salaryStructureId: string) {
  const response = await api.get<PayrollSalaryStructureOverridesResponse>(`/api/payroll/salary-structure-overrides/${salaryStructureId}`);
  return response.data;
}

export async function createPayrollSalaryStructureOverride(payload: CreatePayrollSalaryStructureOverrideRequest) {
  const response = await api.post('/api/payroll/salary-structure-overrides', payload);
  return response.data;
}

export async function updatePayrollSalaryStructureOverride(salaryStructureOverrideId: string, payload: UpdatePayrollSalaryStructureOverrideRequest) {
  const response = await api.put(`/api/payroll/salary-structure-overrides/${salaryStructureOverrideId}`, payload);
  return response.data;
}

export async function deletePayrollSalaryStructureOverride(salaryStructureOverrideId: string) {
  const response = await api.delete(`/api/payroll/salary-structure-overrides/${salaryStructureOverrideId}`);
  return response.data;
}


export async function updateJournalEntry(
  journalEntryId: string,
  payload: UpdateJournalEntryRequest
) {
  const response = await api.put(
    `/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}`,
    payload
  );

  return response.data;
}

export async function getRejectedJournalEntries() {
  const response = await api.get<ListEnvelope<JournalEntryDto>>('/api/finance/journal-entries');

  const items = response.data.items.filter((item) => item.status === 4);

  return {
    ...response.data,
    count: items.length,
    items,
  };
}

export async function getConsolidatedBudgetVsActual(
  periodStartUtc: string,
  periodEndUtc: string,
  budgetType?: BudgetType | null
): Promise<ConsolidatedBudgetVsActualResponse> {
  const response = await api.get('/api/finance/budgets/reports/budget-vs-actual-consolidated', {
    params: {
      periodStartUtc,
      periodEndUtc,
      budgetType: budgetType ?? undefined,
    },
  });

  return response.data;
}

export async function getBudgets(): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  items: BudgetDto[];
}> {
  const response = await api.get('/api/finance/budgets');
  return response.data;
}

export async function getRejectedBudgets(): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  items: BudgetDetailDto[];
}> {
  const response = await api.get('/api/finance/budgets/rejected');
  return response.data;
}

export async function getBudgetDetail(budgetId: string): Promise<{
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  budget: BudgetDetailDto;
  transfers: BudgetTransferDto[];
}> {
  const response = await api.get(`/api/finance/budgets/${budgetId}`);
  return response.data;
}

export async function createBudget(payload: CreateBudgetRequest) {
  const response = await api.post('/api/finance/budgets', payload);
  return response.data;
}

export async function updateBudget(budgetId: string, payload: CreateBudgetRequest) {
  const response = await api.put(`/api/finance/budgets/${budgetId}`, payload);
  return response.data;
}

export async function deleteBudget(budgetId: string) {
  const response = await api.delete(`/api/finance/budgets/${budgetId}`);
  return response.data;
}

export async function submitBudgetForApproval(budgetId: string) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/submit`);
  return response.data;
}

export async function approveBudget(budgetId: string) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/approve`);
  return response.data;
}

export async function rejectBudget(budgetId: string, payload: RejectBudgetRequest) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/reject`, payload);
  return response.data;
}

export async function lockBudget(budgetId: string) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/lock`);
  return response.data;
}

export async function closeBudget(budgetId: string, payload: CloseBudgetRequest) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/close`, payload);
  return response.data;
}

export async function setBudgetOverrunPolicy(
  budgetId: string,
  payload: SetBudgetOverrunPolicyRequest
) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/overrun-policy`, payload);
  return response.data;
}

export async function transferBudgetAmount(
  budgetId: string,
  payload: TransferBudgetRequest
) {
  const response = await api.post(`/api/finance/budgets/${budgetId}/transfers`, payload);
  return response.data;
}

export async function uploadBudget(payload: UploadBudgetRequest) {
  const response = await api.post('/api/finance/budgets/upload', payload);
  return response.data;
}

export async function getBudgetVsActual(budgetId: string): Promise<BudgetVsActualResponse> {
  const response = await api.get('/api/finance/budgets/reports/budget-vs-actual', {
    params: { budgetId },
  });
  return response.data;
}

export async function downloadBudgetUploadTemplate() {
  const response = await api.get('/api/finance/budgets/upload-template', {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.setAttribute('download', 'ibalance-budget-upload-template.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

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


export async function getPurchaseOrderReceiptsForInvoiceMatching(vendorId?: string | null) {
  const response = await api.get<PurchaseOrderReceiptMatchingResponse>('/api/finance/ap/purchase-order-receipts/matching', {
    params: {
      ...(vendorId ? { vendorId } : {}),
    },
  });
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


export async function postPurchaseInvoice(
  purchaseInvoiceId: string,
  payload: PostPurchaseInvoiceRequest
): Promise<BudgetAwareApiResponse> {
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

export async function postVendorPayment(
  vendorPaymentId: string,
  payload: PostVendorPaymentRequest
): Promise<BudgetAwareApiResponse> {
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

export async function postSalesInvoice(
  salesInvoiceId: string,
  payload: PostSalesInvoiceRequest
): Promise<BudgetAwareApiResponse> {
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

export async function postCustomerReceipt(
  customerReceiptId: string,
  payload: PostCustomerReceiptRequest
): Promise<BudgetAwareApiResponse> {
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

export async function postJournalEntry(
  journalEntryId: string
): Promise<BudgetAwareApiResponse> {
  const response = await api.post(
    `/api/finance/journal-entries/${encodeURIComponent(journalEntryId)}/post`,
    {}
  );
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

export async function createFiscalYear(payload: CreateFiscalYearRequest) {
  const response = await api.post<CreateFiscalYearResponse>('/api/finance/fiscal-years', payload);
  return response.data;
}

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

export async function runYearEndClose(payload: YearEndCloseRequest) {
  const response = await api.post<YearEndCloseResponse>('/api/finance/fiscal-periods/year-end-close', payload);
  return response.data;
}
// ----------- FIXED ASSETS -----------

export type FixedAssetClassStatus = 1 | 2;
export type FixedAssetStatus = 1 | 2 | 3 | 4 | 5 | 6;
export type FixedAssetDepreciationMethod = 1 | 2 | 3;
export type FixedAssetTransactionType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type FixedAssetDisposalType = 1 | 2 | 3 | 4;

export type FixedAssetClassDto = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  capitalizationThreshold: number;
  residualValuePercentDefault: number;
  usefulLifeMonthsDefault: number;
  depreciationMethodDefault: FixedAssetDepreciationMethod;
  assetCostLedgerAccountId: string;
  accumulatedDepreciationLedgerAccountId: string;
  depreciationExpenseLedgerAccountId: string;
  disposalGainLossLedgerAccountId: string;
  status: FixedAssetClassStatus;
};

export type FixedAssetDto = {
  id: string;
  tenantId: string;
  fixedAssetClassId: string;
  assetNumber: string;
  assetName: string;
  description?: string | null;
  acquisitionDateUtc: string;
  capitalizationDateUtc?: string | null;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: FixedAssetDepreciationMethod;
  accumulatedDepreciationAmount: number;
  impairmentAmount: number;
  netBookValue: number;
  status: FixedAssetStatus;
  assetCostLedgerAccountId: string;
  accumulatedDepreciationLedgerAccountId: string;
  depreciationExpenseLedgerAccountId: string;
  disposalGainLossLedgerAccountId: string;
  vendorId?: string | null;
  purchaseInvoiceId?: string | null;
  location?: string | null;
  custodian?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  lastDepreciationPostedOnUtc?: string | null;
  disposedOnUtc?: string | null;
  disposalProceedsAmount?: number | null;
};

export type FixedAssetRegisterItemDto = FixedAssetDto & {
  fixedAssetClassCode?: string | null;
  fixedAssetClassName?: string | null;
};

export type FixedAssetTransactionDto = {
  id: string;
  tenantId: string;
  fixedAssetId: string;
  transactionType: FixedAssetTransactionType;
  transactionTypeName: string;
  transactionDateUtc: string;
  amount: number;
  description: string;
  journalEntryId?: string | null;
  reference?: string | null;
  notes?: string | null;
};

export type FixedAssetDepreciationLineDto = {
  id: string;
  tenantId: string;
  depreciationRunId: string;
  fixedAssetId: string;
  depreciationPeriodStartUtc: string;
  depreciationPeriodEndUtc: string;
  depreciationAmount: number;
  journalEntryId?: string | null;
};

export type FixedAssetDisposalDto = {
  id: string;
  tenantId: string;
  fixedAssetId: string;
  disposalType: FixedAssetDisposalType;
  disposalDateUtc: string;
  disposalProceedsAmount: number;
  netBookValueAtDisposal: number;
  gainOrLossAmount: number;
  notes?: string | null;
  journalEntryId?: string | null;
};

export type FixedAssetDetailResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  fixedAsset: FixedAssetDto;
  transactions: FixedAssetTransactionDto[];
  depreciationLines: FixedAssetDepreciationLineDto[];
  disposal?: FixedAssetDisposalDto | null;
};

export type FixedAssetDepreciationPreviewItemDto = {
  fixedAssetId: string;
  assetNumber: string;
  assetName: string;
  periodStartUtc: string;
  periodEndUtc: string;
  depreciationAmount: number;
  projectedAccumulatedDepreciationAmount: number;
  projectedNetBookValue: number;
  depreciationExpenseLedgerAccountId: string;
  accumulatedDepreciationLedgerAccountId: string;
};

export type FixedAssetDepreciationPreviewResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  periodStartUtc: string;
  periodEndUtc: string;
  count: number;
  totalDepreciationAmount: number;
  items: FixedAssetDepreciationPreviewItemDto[];
};

export type FixedAssetDepreciationRunDto = {
  id: string;
  tenantId: string;
  periodStartUtc: string;
  periodEndUtc: string;
  runDateUtc: string;
  description: string;
  journalEntryId?: string | null;
  lineCount: number;
  totalDepreciationAmount: number;
};

export type FixedAssetClassesResponse = ListEnvelope<FixedAssetClassDto>;
export type FixedAssetsResponse = ListEnvelope<FixedAssetDto>;
export type FixedAssetRegisterResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  count: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalImpairment: number;
  totalNetBookValue: number;
  items: FixedAssetRegisterItemDto[];
};
export type FixedAssetDepreciationRunsResponse = ListEnvelope<FixedAssetDepreciationRunDto>;

export type CreateFixedAssetClassRequest = {
  code: string;
  name: string;
  description?: string | null;
  capitalizationThreshold: number;
  residualValuePercentDefault: number;
  usefulLifeMonthsDefault: number;
  depreciationMethodDefault: FixedAssetDepreciationMethod;
  assetCostLedgerAccountId: string;
  accumulatedDepreciationLedgerAccountId: string;
  depreciationExpenseLedgerAccountId: string;
  disposalGainLossLedgerAccountId: string;
};

export type CreateFixedAssetRequest = {
  fixedAssetClassId: string;
  assetNumber: string;
  assetName: string;
  description?: string | null;
  acquisitionDateUtc: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  depreciationMethod: FixedAssetDepreciationMethod;
  assetCostLedgerAccountId?: string | null;
  accumulatedDepreciationLedgerAccountId?: string | null;
  depreciationExpenseLedgerAccountId?: string | null;
  disposalGainLossLedgerAccountId?: string | null;
  vendorId?: string | null;
  purchaseInvoiceId?: string | null;
  location?: string | null;
  custodian?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
};

export type CapitalizeFixedAssetRequest = {
  capitalizationDateUtc: string;
  creditLedgerAccountId: string;
  reference?: string | null;
  description?: string | null;
};

export type FixedAssetDepreciationPeriodRequest = {
  periodStartUtc: string;
  periodEndUtc: string;
};

export type RunFixedAssetDepreciationRequest = {
  periodStartUtc: string;
  periodEndUtc: string;
  runDateUtc: string;
  reference?: string | null;
  description?: string | null;
};

export type FixedAssetImprovementRequest = {
  transactionDateUtc: string;
  amount: number;
  creditLedgerAccountId: string;
  usefulLifeMonthsOverride?: number | null;
  reference?: string | null;
  description?: string | null;
};

export type TransferFixedAssetRequest = {
  transactionDateUtc: string;
  location?: string | null;
  custodian?: string | null;
  notes?: string | null;
};

export type ReclassifyFixedAssetRequest = {
  transactionDateUtc: string;
  targetFixedAssetClassId: string;
  notes?: string | null;
};

export type ImpairFixedAssetRequest = {
  transactionDateUtc: string;
  amount: number;
  reference?: string | null;
  description?: string | null;
};

export type DisposeFixedAssetRequest = {
  disposalDateUtc: string;
  disposalType: FixedAssetDisposalType;
  disposalProceedsAmount: number;
  cashOrBankLedgerAccountId?: string | null;
  reference?: string | null;
  description?: string | null;
  notes?: string | null;
};

export async function getFixedAssetClasses(): Promise<FixedAssetClassesResponse> {
  const response = await api.get('/api/finance/fixed-assets/classes');
  return response.data;
}

export async function createFixedAssetClass(payload: CreateFixedAssetClassRequest) {
  const response = await api.post('/api/finance/fixed-assets/classes', payload);
  return response.data;
}

export async function getFixedAssets(): Promise<FixedAssetsResponse> {
  const response = await api.get('/api/finance/fixed-assets');
  return response.data;
}

export async function getFixedAssetRegister(
  status?: number | null,
  fixedAssetClassId?: string | null
): Promise<FixedAssetRegisterResponse> {
  const response = await api.get('/api/finance/fixed-assets/reports/register', {
    params: {
      ...(typeof status === 'number' ? { status } : {}),
      ...(fixedAssetClassId ? { fixedAssetClassId } : {}),
    },
  });
  return response.data;
}

export async function createFixedAsset(payload: CreateFixedAssetRequest) {
  const response = await api.post('/api/finance/fixed-assets', payload);
  return response.data;
}

export async function getFixedAssetDetail(fixedAssetId: string): Promise<FixedAssetDetailResponse> {
  const response = await api.get(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}`);
  return response.data;
}

export async function capitalizeFixedAsset(fixedAssetId: string, payload: CapitalizeFixedAssetRequest) {
  const response = await api.post(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}/capitalize`, payload);
  return response.data;
}

export async function previewFixedAssetDepreciation(
  payload: FixedAssetDepreciationPeriodRequest
): Promise<FixedAssetDepreciationPreviewResponse> {
  const response = await api.post('/api/finance/fixed-assets/depreciation/preview', payload);
  return response.data;
}

export async function getFixedAssetDepreciationRuns(): Promise<FixedAssetDepreciationRunsResponse> {
  const response = await api.get('/api/finance/fixed-assets/depreciation-runs');
  return response.data;
}

export async function runFixedAssetDepreciation(payload: RunFixedAssetDepreciationRequest) {
  const response = await api.post('/api/finance/fixed-assets/depreciation-runs', payload);
  return response.data;
}

export async function recordFixedAssetImprovement(fixedAssetId: string, payload: FixedAssetImprovementRequest) {
  const response = await api.post(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}/improvements`, payload);
  return response.data;
}

export async function transferFixedAsset(fixedAssetId: string, payload: TransferFixedAssetRequest) {
  const response = await api.post(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}/transfer`, payload);
  return response.data;
}

export async function reclassifyFixedAsset(fixedAssetId: string, payload: ReclassifyFixedAssetRequest) {
  const response = await api.post(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}/reclassify`, payload);
  return response.data;
}

export async function impairFixedAsset(fixedAssetId: string, payload: ImpairFixedAssetRequest) {
  const response = await api.post(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}/impair`, payload);
  return response.data;
}

export async function disposeFixedAsset(fixedAssetId: string, payload: DisposeFixedAssetRequest) {
  const response = await api.post(`/api/finance/fixed-assets/${encodeURIComponent(fixedAssetId)}/dispose`, payload);
  return response.data;
}

// ==========================================
// FIXED ASSETS — AP CAPITALIZATION (ADDITIVE)
// ==========================================

export type CapitalizeFromPurchaseInvoiceRequest = {
  purchaseInvoiceId: string;
  fixedAssetClassId: string;
  assetNumber: string;
  assetName: string;
  description?: string | null;
  usefulLifeMonths: number;
  residualValue: number;
  depreciationStartDateUtc: string;
  capitalizationDateUtc?: string | null;
};

export async function capitalizeFromPurchaseInvoice(
  request: CapitalizeFromPurchaseInvoiceRequest
) {
  const { data } = await api.post(
    '/api/finance/fixed-assets/capitalize-from-purchase-invoice',
    request
  );
  return data;
}


export type CapitalizePurchaseInvoiceToFixedAssetRequest = CapitalizeFromPurchaseInvoiceRequest;

export async function capitalizePurchaseInvoiceToFixedAsset(
  payload: CapitalizePurchaseInvoiceToFixedAssetRequest
) {
  return capitalizeFromPurchaseInvoice(payload);
}

// ==========================================
// AGEING ANALYSIS — AR/AP (IFRS 9 BUCKETS)
// ==========================================

export type AgeingAnalysisSummaryRowDto = {
  partyId: string;
  partyCode: string;
  partyName: string;
  invoiceCount: number;
  invoiceAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  currentAmount: number;
  days1To30Amount: number;
  days31To60Amount: number;
  days61To90Amount: number;
  days91To120Amount: number;
  days121To180Amount: number;
  days181To360Amount: number;
  over360Amount: number;
};

export type AgeingAnalysisDetailRowDto = {
  invoiceId: string;
  partyId: string;
  partyCode: string;
  partyName: string;
  invoiceDateUtc: string;
  invoiceNumber: string;
  description: string;
  invoiceAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysOutstanding: number;
  ageBucket: string;
  currentAmount: number;
  days1To30Amount: number;
  days31To60Amount: number;
  days61To90Amount: number;
  days91To120Amount: number;
  days121To180Amount: number;
  days181To360Amount: number;
  over360Amount: number;
  status: number;
  postedOnUtc?: string | null;
  journalEntryId?: string | null;
};

export type AgeingAnalysisResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  scope: 'AR' | 'AP';
  title: string;
  asOfUtc: string;
  partyFilterId?: string | null;
  includeZeroBalances: boolean;
  summaryCount: number;
  detailCount: number;
  totalInvoiceAmount: number;
  totalPaidAmount: number;
  totalOutstandingAmount: number;
  totalCurrentAmount: number;
  totalDays1To30Amount: number;
  totalDays31To60Amount: number;
  totalDays61To90Amount: number;
  totalDays91To120Amount: number;
  totalDays121To180Amount: number;
  totalDays181To360Amount: number;
  totalOver360Amount: number;
  summaryItems: AgeingAnalysisSummaryRowDto[];
  detailItems: AgeingAnalysisDetailRowDto[];
};

export type AgeingAnalysisQuery = {
  asOfUtc?: string | null;
  customerId?: string | null;
  vendorId?: string | null;
  includeZeroBalances?: boolean;
};

function buildAgeingParams(query?: AgeingAnalysisQuery) {
  const params: Record<string, string | boolean> = {};

  if (query?.asOfUtc) params.asOfUtc = query.asOfUtc;
  if (query?.customerId) params.customerId = query.customerId;
  if (query?.vendorId) params.vendorId = query.vendorId;
  if (typeof query?.includeZeroBalances === 'boolean') {
    params.includeZeroBalances = query.includeZeroBalances;
  }

  return params;
}

export async function getAccountsReceivableAgeingAnalysis(query?: AgeingAnalysisQuery) {
  const response = await api.get<AgeingAnalysisResponse>('/api/finance/ageing-analysis/ar', {
    params: buildAgeingParams(query),
  });
  return response.data;
}

export async function getAccountsPayableAgeingAnalysis(query?: AgeingAnalysisQuery) {
  const response = await api.get<AgeingAnalysisResponse>('/api/finance/ageing-analysis/ap', {
    params: buildAgeingParams(query),
  });
  return response.data;
}


// ==========================================
// BANK & CASH SETUP
// ==========================================

export type BankAccountDto = {
  id: string;
  tenantId: string;
  name: string;
  bankName: string;
  accountNumber: string;
  branch?: string | null;
  currencyCode: string;
  ledgerAccountId: string;
  ledgerAccountCode?: string | null;
  ledgerAccountName?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdOnUtc?: string | null;
  lastModifiedOnUtc?: string | null;
};

export type BankAccountsResponse = ListEnvelope<BankAccountDto>;

export type CreateBankAccountRequest = {
  name: string;
  bankName: string;
  accountNumber: string;
  branch?: string | null;
  currencyCode: string;
  ledgerAccountId: string;
  notes?: string | null;
};

export type UpdateBankAccountRequest = {
  name: string;
  bankName: string;
  accountNumber: string;
  branch?: string | null;
  currencyCode: string;
  ledgerAccountId: string;
  isActive: boolean;
  notes?: string | null;
};

export async function getBankAccounts() {
  const { data } = await api.get<BankAccountsResponse>('/api/finance/bank-accounts');
  return data;
}

export async function createBankAccount(request: CreateBankAccountRequest) {
  const { data } = await api.post('/api/finance/bank-accounts', request);
  return data;
}

export async function updateBankAccount(bankAccountId: string, request: UpdateBankAccountRequest) {
  const { data } = await api.put(`/api/finance/bank-accounts/${bankAccountId}`, request);
  return data;
}

export async function activateBankAccount(bankAccountId: string) {
  const { data } = await api.post(`/api/finance/bank-accounts/${bankAccountId}/activate`);
  return data;
}

export async function deactivateBankAccount(bankAccountId: string) {
  const { data } = await api.post(`/api/finance/bank-accounts/${bankAccountId}/deactivate`);
  return data;
}

// ==========================================
// INVENTORY PHASE 2 — GL INTEGRATION
// Replace your existing INVENTORY PHASE 1 block in api.ts with this block.
// ==========================================

export type InventoryItemDto = {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  itemCode?: string;
  itemName?: string;
  description?: string | null;
  type: number;
  itemType?: number;
  unitOfMeasure: string;
  valuationMethod: number;
  reorderLevel?: number;
  isActive: boolean;
  notes?: string | null;
  createdOnUtc?: string | null;
  lastModifiedOnUtc?: string | null;
};

export type WarehouseDto = {
  id: string;
  tenantId?: string;
  code?: string;
  name: string;
  warehouseCode?: string;
  warehouseName?: string;
  location?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdOnUtc?: string | null;
  lastModifiedOnUtc?: string | null;
};

export type StockLedgerEntryDto = {
  id: string;
  inventoryItemId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  unitOfMeasure?: string | null;
  warehouseId: string;
  warehouseCode?: string;
  warehouseName?: string;
  warehouseLocation?: string | null;
  inventoryTransactionId?: string;
  inventoryTransactionLineId?: string | null;
  movementType: number;
  quantity: number;
  quantityIn?: number;
  quantityOut?: number;
  unitCost: number;
  totalCost: number;
  referenceType: number;
  referenceId?: string | null;
  reference?: string | null;
  description?: string | null;
  movementDateUtc: string;
};

export type StockPositionRowDto = {
  inventoryItemId?: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unitOfMeasure: string;
  reorderLevel: number;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseLocation?: string | null;
  quantityOnHand: number;
  inventoryValue: number;
  averageUnitCost: number;
  isBelowReorderLevel: boolean;
};

export type InventoryTransactionDto = {
  id: string;
  tenantId: string;
  transactionNumber: string;
  transactionType: number;
  transactionDateUtc: string;
  description: string;
  reference?: string | null;
  notes?: string | null;
  status: number;
  journalEntryId?: string | null;
  createdOnUtc?: string | null;
  lineCount: number;
  totalQuantity: number;
  totalCost: number;
};

export type InventoryItemsResponse = ListEnvelope<InventoryItemDto>;
export type WarehousesResponse = ListEnvelope<WarehouseDto>;
export type StockLedgerResponse = ListEnvelope<StockLedgerEntryDto>;
export type InventoryTransactionsResponse = ListEnvelope<InventoryTransactionDto>;
export type StockPositionResponse = ListEnvelope<StockPositionRowDto> & {
  totalQuantityOnHand?: number;
  totalInventoryValue?: number;
};

export type CreateInventoryItemRequest = {
  code: string;
  name: string;
  itemCode?: string;
  itemName?: string;
  description?: string | null;
  type: number;
  itemType?: number;
  unitOfMeasure: string;
  valuationMethod: number;
  reorderLevel?: number;
  notes?: string | null;
};

export type UpdateInventoryItemRequest = Omit<CreateInventoryItemRequest, 'code' | 'itemCode'> & {
  isActive: boolean;
};

export type CreateWarehouseRequest = {
  code?: string;
  name: string;
  warehouseCode?: string;
  warehouseName?: string;
  location?: string | null;
  notes?: string | null;
};

export type UpdateWarehouseRequest = Omit<CreateWarehouseRequest, 'code' | 'warehouseCode'> & {
  isActive: boolean;
};

export type CreateStockInRequest = {
  warehouseId: string;
  transactionNumber?: string | null;
  transactionDateUtc?: string;
  description?: string;
  reference?: string | null;
  journalReference?: string | null;
  inventoryLedgerAccountId: string;
  creditLedgerAccountId: string; 
  notes?: string | null;
  lines: {
    itemId: string;
    inventoryItemId?: string;
    warehouseId?: string;
    quantity: number;
    unitCost: number;
    description?: string | null;
  }[];
};

export type CreateStockAdjustmentRequest = {
  warehouseId: string;
  transactionNumber?: string | null;
  transactionDateUtc?: string;
  description?: string;
  reference?: string | null;
  journalReference?: string | null;
  inventoryLedgerAccountId: string;
  adjustmentLedgerAccountId: string;
  notes?: string | null;
  lines: {
    itemId: string;
    inventoryItemId?: string;
    warehouseId?: string;
    quantity: number;
    quantityChange?: number;
    unitCost: number;
    description?: string | null;
  }[];
};

export async function getInventoryItems() {
  const { data } = await api.get<InventoryItemsResponse>('/api/finance/inventory/items');
  return data;
}

export async function createInventoryItem(request: CreateInventoryItemRequest) {
  const { data } = await api.post('/api/finance/inventory/items', request);
  return data;
}

export async function updateInventoryItem(inventoryItemId: string, request: UpdateInventoryItemRequest) {
  const { data } = await api.put(`/api/finance/inventory/items/${inventoryItemId}`, request);
  return data;
}

export async function activateInventoryItem(inventoryItemId: string) {
  const { data } = await api.post(`/api/finance/inventory/items/${inventoryItemId}/activate`);
  return data;
}

export async function deactivateInventoryItem(inventoryItemId: string) {
  const { data } = await api.post(`/api/finance/inventory/items/${inventoryItemId}/deactivate`);
  return data;
}

export async function getWarehouses() {
  const { data } = await api.get<WarehousesResponse>('/api/finance/inventory/warehouses');
  return data;
}

export async function createWarehouse(request: CreateWarehouseRequest) {
  const { data } = await api.post('/api/finance/inventory/warehouses', request);
  return data;
}

export async function updateWarehouse(warehouseId: string, request: UpdateWarehouseRequest) {
  const { data } = await api.put(`/api/finance/inventory/warehouses/${warehouseId}`, request);
  return data;
}

export async function activateWarehouse(warehouseId: string) {
  const { data } = await api.post(`/api/finance/inventory/warehouses/${warehouseId}/activate`);
  return data;
}

export async function deactivateWarehouse(warehouseId: string) {
  const { data } = await api.post(`/api/finance/inventory/warehouses/${warehouseId}/deactivate`);
  return data;
}

export async function getStockPosition(itemId?: string | null, warehouseId?: string | null) {
  const { data } = await api.get<StockPositionResponse>('/api/finance/inventory/stock-position', {
    params: {
      ...(itemId ? { itemId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    },
  });
  return data;
}

export async function stockIn(request: CreateStockInRequest) {
  const { data } = await api.post('/api/finance/inventory/stock-in', request);
  return data;
}

export async function postStockIn(request: CreateStockInRequest) {
  return stockIn(request);
}

export async function stockAdjust(request: CreateStockAdjustmentRequest) {
  const { data } = await api.post('/api/finance/inventory/adjust', request);
  return data;
}

export async function postStockAdjustment(request: CreateStockAdjustmentRequest) {
  return stockAdjust(request);
}

export async function getStockLedger(itemId?: string | null, warehouseId?: string | null) {
  const { data } = await api.get<StockLedgerResponse>('/api/finance/inventory/stock-ledger', {
    params: {
      ...(itemId ? { itemId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    },
  });
  return data;
}

export async function getInventoryTransactions() {
  const { data } = await api.get<InventoryTransactionsResponse>('/api/finance/inventory/transactions');
  return data;
}

// ==========================================
// INVENTORY PHASE 3 - AP/AR INTEGRATION
// Append to apps/web/iBalance.Web/src/lib/api.ts
// ==========================================

export type ReceivePurchaseInvoiceIntoInventoryLineRequest = {
  purchaseInvoiceLineId?: string | null;
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  description?: string | null;
};

export type ReceivePurchaseInvoiceIntoInventoryRequest = {
  purchaseInvoiceId: string;
  warehouseId: string;
  inventoryLedgerAccountId: string;
  creditLedgerAccountId: string;
  transactionDateUtc?: string;
  transactionNumber?: string | null;
  journalReference?: string | null;
  description?: string | null;
  notes?: string | null;
  lines: ReceivePurchaseInvoiceIntoInventoryLineRequest[];
};

export type IssueInventoryForSalesInvoiceLineRequest = {
  salesInvoiceLineId?: string | null;
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  description?: string | null;
};

export type IssueInventoryForSalesInvoiceRequest = {
  salesInvoiceId: string;
  warehouseId: string;
  inventoryLedgerAccountId: string;
  cogsLedgerAccountId: string;
  transactionDateUtc?: string;
  transactionNumber?: string | null;
  journalReference?: string | null;
  description?: string | null;
  notes?: string | null;
  lines: IssueInventoryForSalesInvoiceLineRequest[];
};

export async function receivePurchaseInvoiceIntoInventory(request: ReceivePurchaseInvoiceIntoInventoryRequest) {
  const { data } = await api.post('/api/finance/inventory/purchase-invoice-receipts', request);
  return data;
}

export async function issueInventoryForSalesInvoice(request: IssueInventoryForSalesInvoiceRequest) {
  const { data } = await api.post('/api/finance/inventory/sales-invoice-issues', request);
  return data;
}


// ==========================================
// FINAL INVENTORY PHASE - REPORTING
// Append to apps/web/iBalance.Web/src/lib/api.ts
// ==========================================

export type InventoryValuationRowDto = {
  inventoryItemId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  unitOfMeasure: string;
  valuationMethod?: number | null;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseLocation?: string | null;
  quantityIn: number;
  quantityOut: number;
  quantityOnHand: number;
  valueIn: number;
  valueOut: number;
  inventoryValue: number;
  averageUnitCost: number;
  movementCount: number;
};

export type InventoryValuationReportResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  asOfUtc: string;
  count: number;
  totalQuantityOnHand: number;
  totalInventoryValue: number;
  items: InventoryValuationRowDto[];
};

export type InventoryGlReconciliationResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  asOfUtc: string;
  inventoryLedgerAccount: {
    id: string;
    code: string;
    name: string;
    category: number;
    normalBalance: number;
  };
  stockValue: number;
  glDebit: number;
  glCredit: number;
  glBalance: number;
  difference: number;
  isReconciled: boolean;
  stockMovementCount: number;
  ledgerMovementCount: number;
};

export type InventoryAuditTraceResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: {
    transaction: {
      id: string;
      transactionNumber: string;
      transactionType: number;
      transactionDateUtc: string;
      description: string;
      reference?: string | null;
      status: number;
      journalEntryId?: string | null;
      createdOnUtc?: string | null;
    };
    stockLedgerEntries: {
      id: string;
      inventoryTransactionId: string;
      inventoryTransactionLineId?: string | null;
      movementType: number;
      movementDateUtc: string;
      quantityIn: number;
      quantityOut: number;
      quantity: number;
      unitCost: number;
      totalCost: number;
      reference: string;
      description: string;
      inventoryItemId: string;
      itemCode: string;
      itemName: string;
      warehouseId: string;
      warehouseCode: string;
      warehouseName: string;
    }[];
    journalEntry?: {
      id: string;
      entryDateUtc: string;
      reference: string;
      description: string;
      status: number;
      type: number;
      totalDebit: number;
      totalCredit: number;
      postedAtUtc?: string | null;
    } | null;
    ledgerMovements: {
      id: string;
      journalEntryId: string;
      journalEntryLineId: string;
      movementDateUtc: string;
      reference: string;
      description: string;
      debitAmount: number;
      creditAmount: number;
      ledgerAccountId: string;
      ledgerAccountCode: string;
      ledgerAccountName: string;
    }[];
  }[];
};

export async function getInventoryValuationReport(params?: {
  asOfUtc?: string | null;
  inventoryItemId?: string | null;
  warehouseId?: string | null;
}) {
  const searchParams = new URLSearchParams();

  if (params?.asOfUtc) searchParams.set('asOfUtc', params.asOfUtc);
  if (params?.inventoryItemId) searchParams.set('inventoryItemId', params.inventoryItemId);
  if (params?.warehouseId) searchParams.set('warehouseId', params.warehouseId);

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { data } = await api.get<InventoryValuationReportResponse>(`/api/finance/inventory/reports/valuation${suffix}`);
  return data;
}

export async function getInventoryGlReconciliation(params: {
  inventoryLedgerAccountId: string;
  asOfUtc?: string | null;
}) {
  const searchParams = new URLSearchParams();

  searchParams.set('inventoryLedgerAccountId', params.inventoryLedgerAccountId);
  if (params.asOfUtc) searchParams.set('asOfUtc', params.asOfUtc);

  const { data } = await api.get<InventoryGlReconciliationResponse>(
    `/api/finance/inventory/reports/stock-gl-reconciliation?${searchParams.toString()}`
  );
  return data;
}

export async function getInventoryAuditTrace(params?: {
  inventoryTransactionId?: string | null;
  journalEntryId?: string | null;
  reference?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
}) {
  const searchParams = new URLSearchParams();

  if (params?.inventoryTransactionId) searchParams.set('inventoryTransactionId', params.inventoryTransactionId);
  if (params?.journalEntryId) searchParams.set('journalEntryId', params.journalEntryId);
  if (params?.reference) searchParams.set('reference', params.reference);
  if (params?.fromUtc) searchParams.set('fromUtc', params.fromUtc);
  if (params?.toUtc) searchParams.set('toUtc', params.toUtc);

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const { data } = await api.get<InventoryAuditTraceResponse>(`/api/finance/inventory/reports/audit-trace${suffix}`);
  return data;
}

// ==========================================
// WORKING CAPITAL
// ==========================================

export type WorkingCapitalExceptionRowDto = {
  id: string;
  reference: string;
  invoiceDateUtc: string;
  partyCode: string;
  partyName: string;
  outstandingAmount: number;
  daysOutstanding: number;
};

export type WorkingCapitalInventoryRowDto = {
  inventoryItemId: string;
  itemCode: string;
  itemName: string;
  quantityOnHand: number;
  inventoryValue: number;
};

export type WorkingCapitalDashboardResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  asOfUtc: string;
  fromUtc: string;
  toUtc: string;
  periodDays: number;
  cashBalance: number;
  accountsReceivableBalance: number;
  accountsPayableBalance: number;
  inventoryValue: number;
  operatingWorkingCapital: number;
  netWorkingCapital: number;
  periodSalesAmount: number;
  periodPurchaseAmount: number;
  periodInventoryOutValue: number;
  dsoDays: number;
  dpoDays: number;
  inventoryDays: number;
  cashConversionCycleDays: number;
  riskLevel: string;
  overdueReceivables: WorkingCapitalExceptionRowDto[];
  duePayables: WorkingCapitalExceptionRowDto[];
  topInventory: WorkingCapitalInventoryRowDto[];
};



export type WorkingCapitalCashflowForecastBucketDto = {
  bucket: string;
  startDay: number;
  endDay: number;
  expectedInflows: number;
  expectedOutflows: number;
  netCashFlow: number;
  projectedClosingCash: number;
  riskLevel: string;
};

export type WorkingCapitalCashflowForecastItemDto = {
  id: string;
  reference: string;
  partyCode: string;
  partyName: string;
  sourceType: string;
  invoiceDateUtc: string;
  outstandingAmount: number;
  daysOutstanding: number;
  forecastBucket: string;
  forecastDay: number;
  probabilityPercent: number;
  expectedAmount: number;
  recommendation: string;
};

export type WorkingCapitalCashflowAlertDto = {
  severity: string;
  title: string;
  description: string;
  recommendedAction: string;
};

export type WorkingCapitalCashflowForecastResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  asOfUtc: string;
  openingCash: number;
  totalExpectedInflows: number;
  totalExpectedOutflows: number;
  netForecastCashFlow: number;
  projectedClosingCash: number;
  riskLevel: string;
  buckets: WorkingCapitalCashflowForecastBucketDto[];
  receiptForecastItems: WorkingCapitalCashflowForecastItemDto[];
  paymentForecastItems: WorkingCapitalCashflowForecastItemDto[];
  alerts: WorkingCapitalCashflowAlertDto[];
};


export type WorkingCapitalActionDto = {
  severity: string;
  area: string;
  title: string;
  description: string;
  recommendedAction: string;
};

export type WorkingCapitalActionsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  asOfUtc: string;
  count: number;
  items: WorkingCapitalActionDto[];
};

export type WorkingCapitalReceivableHealthRowDto = {
  id: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  customerCode: string;
  customerName: string;
  balanceAmount: number;
  netReceivableAmount: number;
  status: number;
  daysOutstanding: number;
  ageBucket: string;
  riskLevel: string;
  recommendedAction: string;
};

export type WorkingCapitalReceivablesHealthResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  asOfUtc: string;
  count: number;
  totalOutstandingAmount: number;
  criticalCount: number;
  highRiskCount: number;
  items: WorkingCapitalReceivableHealthRowDto[];
};

export type WorkingCapitalPayableStrategyRowDto = {
  id: string;
  invoiceNumber: string;
  invoiceDateUtc: string;
  vendorCode: string;
  vendorName: string;
  balanceAmount: number;
  netPayableAmount: number;
  status: number;
  daysOutstanding: number;
  priority: string;
  recommendedAction: string;
};

export type WorkingCapitalPayablesStrategyResponse = {
  tenantContextAvailable: boolean;
  tenantId: string;
  tenantKey: string;
  asOfUtc: string;
  count: number;
  totalOutstandingAmount: number;
  immediateCount: number;
  highPriorityCount: number;
  items: WorkingCapitalPayableStrategyRowDto[];
};


export type WorkingCapitalDashboardQuery = {
  asOfUtc?: string | null;
  fromUtc?: string | null;
  toUtc?: string | null;
};

function buildWorkingCapitalParams(query?: WorkingCapitalDashboardQuery) {
  const params: Record<string, string> = {};

  if (query?.asOfUtc) params.asOfUtc = query.asOfUtc;
  if (query?.fromUtc) params.fromUtc = query.fromUtc;
  if (query?.toUtc) params.toUtc = query.toUtc;

  return params;
}

export async function getWorkingCapitalDashboard(query?: WorkingCapitalDashboardQuery) {
  const response = await api.get<WorkingCapitalDashboardResponse>('/api/finance/working-capital/dashboard', {
    params: buildWorkingCapitalParams(query),
  });
  return response.data;
}


export async function getReceivablesHealth(asOfUtc?: string | null) {
  const response = await api.get<WorkingCapitalReceivablesHealthResponse>('/api/finance/working-capital/receivables-health', {
    params: asOfUtc ? { asOfUtc } : {},
  });
  return response.data;
}

export async function getPayablesStrategy(asOfUtc?: string | null) {
  const response = await api.get<WorkingCapitalPayablesStrategyResponse>('/api/finance/working-capital/payables-strategy', {
    params: asOfUtc ? { asOfUtc } : {},
  });
  return response.data;
}

export async function getWorkingCapitalActions(asOfUtc?: string | null) {
  const response = await api.get<WorkingCapitalActionsResponse>('/api/finance/working-capital/actions', {
    params: asOfUtc ? { asOfUtc } : {},
  });
  return response.data;
}


export async function getWorkingCapitalCashflowForecast(asOfUtc?: string | null) {
  const response = await api.get<WorkingCapitalCashflowForecastResponse>('/api/finance/working-capital/cashflow-forecast', {
    params: asOfUtc ? { asOfUtc } : {},
  });
  return response.data;
}

export async function getWorkingCapitalOptimization(asOfUtc?: string | null) {
  const response = await api.get('/api/finance/working-capital/optimization', {
    params: asOfUtc ? { asOfUtc } : {},
  });
  return response.data;
}







// ==========================================
// PAYROLL / SALARY MANAGEMENT — PHASE 1
// ==========================================

export type PayrollEmployeeDto = {
  id: string;
  tenantId: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  fullName: string;
  displayName: string;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  hireDateUtc: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdOnUtc: string;
};


export type PayrollEmployeesResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollEmployeeDto[];
};

export type CreatePayrollEmployeeRequest = {
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  hireDateUtc: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  isActive: boolean;
  notes?: string | null;
};

export type UpdatePayrollEmployeeRequest = {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  email?: string | null;
  phoneNumber?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  hireDateUtc: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  isActive: boolean;
  notes?: string | null;
};



export type ImportPayrollEmployeesRequest = {
  items: CreatePayrollEmployeeRequest[];
};

export type PayrollPayGroupDto = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdOnUtc: string;
};

export type PayrollPayGroupsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollPayGroupDto[];
};

export type CreatePayrollPayGroupRequest = {
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export type UpdatePayrollPayGroupRequest = {
  name: string;
  description?: string | null;
  isActive: boolean;
};


export type UpdatePayrollPayElementRequest = {
  name: string;
  elementKind: number;
  calculationMode: number;
  defaultAmount: number;
  defaultRate: number;
  ledgerAccountId: string;
  isTaxable: boolean;
  isActive: boolean;
  description?: string | null;
};

export type PayrollPayElementDto = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  elementKind: number;
  calculationMode: number;
  defaultAmount: number;
  defaultRate: number;
  ledgerAccountId: string;
  ledgerAccountCode: string;
  ledgerAccountName: string;
  isTaxable: boolean;
  isActive: boolean;
  description?: string | null;
  createdOnUtc: string;
};

export type PayrollPayElementsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollPayElementDto[];
};

export type CreatePayrollPayElementRequest = {
  code: string;
  name: string;
  elementKind: number;
  calculationMode: number;
  defaultAmount: number;
  defaultRate: number;
  ledgerAccountId: string;
  isTaxable: boolean;
  isActive: boolean;
  description?: string | null;
};

export type PayrollSalaryStructureDto = {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  payGroupId: string;
  payGroupCode: string;
  payGroupName: string;
  basicSalary: number;
  currencyCode: string;
  effectiveFromUtc: string;
  isActive: boolean;
  notes?: string | null;
  createdOnUtc: string;
};

export type PayrollSalaryStructuresResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollSalaryStructureDto[];
};

export type CreatePayrollSalaryStructureRequest = {
  employeeId: string;
  payGroupId: string;
  basicSalary: number;
  currencyCode: string;
  effectiveFromUtc: string;
  isActive: boolean;
  notes?: string | null;
};


export type UpdatePayrollSalaryStructureRequest = {
  employeeId: string;
  payGroupId: string;
  basicSalary: number;
  currencyCode: string;
  effectiveFromUtc: string;
  isActive: boolean;
  notes?: string | null;
};

// ==========================================
// PAYROLL / PHASE 1 — PAY GROUP COMPOSITION
// ==========================================

export type PayrollPayGroupElementDto = {
  id: string;
  tenantId: string;
  payGroupId: string;
  payGroupCode: string;
  payGroupName: string;
  payElementId: string;
  payElementCode: string;
  payElementName: string;
  elementKind: number;
  calculationMode: number;
  defaultAmount: number;
  defaultRate: number;
  sequence: number;
  amountOverride?: number | null;
  rateOverride?: number | null;
  isMandatory: boolean;
  isActive: boolean;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  notes?: string | null;
  createdOnUtc: string;
};

export type PayrollPayGroupElementsResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  count: number;
  items: PayrollPayGroupElementDto[];
};

export type CreatePayrollPayGroupElementRequest = {
  payGroupId: string;
  payElementId: string;
  sequence: number;
  amountOverride?: number | null;
  rateOverride?: number | null;
  isMandatory: boolean;
  isActive: boolean;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  notes?: string | null;
};

export type UpdatePayrollPayGroupElementRequest = {
  sequence: number;
  amountOverride?: number | null;
  rateOverride?: number | null;
  isMandatory: boolean;
  isActive: boolean;
  effectiveFromUtc?: string | null;
  effectiveToUtc?: string | null;
  notes?: string | null;
};

export type PayrollRunLineItemDto = {
  id: string;
  payrollRunLineId: string;
  payElementId?: string | null;
  code: string;
  description: string;
  elementKind: number;
  calculationMode: number;
  amount: number;
  sequence: number;
  isTaxable: boolean;
};

export type PayrollRunLineDetailDto = {
  payrollRunLineId: string;
  payrollRunId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department?: string | null;
  jobTitle?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  items: PayrollRunLineItemDto[];
};

export type PayrollRunDetailDto = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  payrollRun: {
    id: string;
    tenantId: string;
    payrollPeriod: string;
    runDateUtc: string;
    status: number;
    journalEntryId?: string | null;
    postedOnUtc?: string | null;
    employeeCount: number;
    totalGrossPay: number;
    totalDeductions: number;
    totalNetPay: number;
  };
  count: number;
  items: PayrollRunLineDetailDto[];
};

export type PayrollPayslipItemDto = {
  code: string;
  description: string;
  amount: number;
  sequence: number;
};

export type PayrollPayslipDto = {
  payslipNumber: string;
  payrollRunId: string;
  payrollRunLineId: string;
  payrollPeriod: string;
  runDateUtc: string;
  status: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  currencyCode: string;
  earnings: PayrollPayslipItemDto[];
  deductions: PayrollPayslipItemDto[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

export type PayrollStatutoryReportRowDto = {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department?: string | null;
  pensionNumber?: string | null;
  taxIdentificationNumber?: string | null;
  grossPay: number;
  statutoryDeductionAmount: number;
  netPay: number;
};


export type PayrollPolicySettingDto = {
  id: string;
  tenantId: string;
  enforceMinimumTakeHome: boolean;
  minimumTakeHomeRuleType: 'fixed_amount' | 'gross_percentage';
  minimumTakeHomeAmount: number;
  minimumTakeHomePercent: number;
  currencyCode: string;
  createdOnUtc: string;
  updatedOnUtc: string;
};

export type UpdatePayrollPolicySettingRequest = {
  enforceMinimumTakeHome: boolean;
  minimumTakeHomeRuleType: 'fixed_amount' | 'gross_percentage';
  minimumTakeHomeAmount: number;
  minimumTakeHomePercent: number;
  currencyCode: string;
};


export type PurchaseRequisitionLineDto = {
  id: string;
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  estimatedUnitPrice: number;
  notes?: string | null;
};

export type PurchaseRequisitionDto = {
  id: string;
  tenantId: string;
  requisitionNumber: string;
  requestDateUtc: string;
  requestedByName: string;
  department?: string | null;
  neededByUtc?: string | null;
  purpose: string;
  status: number;
  notes?: string | null;
  createdOnUtc?: string | null;
  lineCount?: number;
  estimatedTotalAmount?: number;
  lines?: PurchaseRequisitionLineDto[];
};

export type PurchaseRequisitionListResponse = ListEnvelope<PurchaseRequisitionDto>;

export type PurchaseOrderLineDto = {
  id: string;
  purchaseRequisitionLineId?: string | null;
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
};

export type PurchaseOrderDto = {
  id: string;
  tenantId: string;
  purchaseOrderNumber: string;
  purchaseRequisitionId?: string | null;
  purchaseRequisitionNumber?: string | null;
  vendorId: string;
  vendorName?: string | null;
  orderDateUtc: string;
  expectedDeliveryUtc?: string | null;
  currencyCode: string;
  status: number;
  notes?: string | null;
  createdOnUtc?: string | null;
  lineCount?: number;
  totalAmount?: number;
  lines?: PurchaseOrderLineDto[];
};

export type PurchaseOrderListResponse = ListEnvelope<PurchaseOrderDto>;

export type CreatePurchaseRequisitionLineRequest = {
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  estimatedUnitPrice: number;
  notes?: string | null;
};

export type CreatePurchaseRequisitionRequest = {
  requestDateUtc: string;
  requestedByName: string;
  department?: string | null;
  neededByUtc?: string | null;
  purpose: string;
  notes?: string | null;
  lines: CreatePurchaseRequisitionLineRequest[];
};

export type UpdatePurchaseRequisitionRequest = CreatePurchaseRequisitionRequest;

export type CreatePurchaseOrderFromRequisitionRequest = {
  vendorId: string;
  orderDateUtc: string;
  expectedDeliveryUtc?: string | null;
  currencyCode: string;
  notes?: string | null;
};

export type PurchaseOrderLineRequest = {
  purchaseRequisitionLineId?: string | null;
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
};

export type UpdatePurchaseOrderRequest = {
  vendorId: string;
  orderDateUtc: string;
  expectedDeliveryUtc?: string | null;
  currencyCode: string;
  notes?: string | null;
  lines: PurchaseOrderLineRequest[];
};

export async function getPurchaseRequisitions() {
  const { data } = await api.get<PurchaseRequisitionListResponse>('/api/finance/procurement/requisitions');
  return data;
}

export async function getRejectedPurchaseRequisitions() {
  const { data } = await api.get<PurchaseRequisitionListResponse>('/api/finance/procurement/requisitions/rejected');
  return data;
}

export async function createPurchaseRequisition(request: CreatePurchaseRequisitionRequest) {
  const { data } = await api.post('/api/finance/procurement/requisitions', request);
  return data;
}

export async function updatePurchaseRequisition(requisitionId: string, request: UpdatePurchaseRequisitionRequest) {
  const { data } = await api.put(`/api/finance/procurement/requisitions/${requisitionId}`, request);
  return data;
}

export async function submitPurchaseRequisition(requisitionId: string) {
  const { data } = await api.post(`/api/finance/procurement/requisitions/${requisitionId}/submit`);
  return data;
}

export async function approvePurchaseRequisition(requisitionId: string) {
  const { data } = await api.post(`/api/finance/procurement/requisitions/${requisitionId}/approve`);
  return data;
}

export async function rejectPurchaseRequisition(requisitionId: string, reason: string) {
  const { data } = await api.post(`/api/finance/procurement/requisitions/${requisitionId}/reject`, { reason });
  return data;
}

export async function deletePurchaseRequisition(requisitionId: string) {
  const { data } = await api.delete(`/api/finance/procurement/requisitions/${requisitionId}`);
  return data;
}

export async function getPurchaseOrders() {
  const { data } = await api.get<PurchaseOrderListResponse>('/api/finance/procurement/purchase-orders');
  return data;
}

export async function getRejectedPurchaseOrders() {
  const { data } = await api.get<PurchaseOrderListResponse>('/api/finance/procurement/purchase-orders/rejected');
  return data;
}

export async function createPurchaseOrderFromRequisition(requisitionId: string, request: CreatePurchaseOrderFromRequisitionRequest) {
  const { data } = await api.post(`/api/finance/procurement/purchase-orders/from-requisition/${requisitionId}`, request);
  return data;
}

export async function updatePurchaseOrder(purchaseOrderId: string, request: UpdatePurchaseOrderRequest) {
  const { data } = await api.put(`/api/finance/procurement/purchase-orders/${purchaseOrderId}`, request);
  return data;
}

export async function submitPurchaseOrder(purchaseOrderId: string) {
  const { data } = await api.post(`/api/finance/procurement/purchase-orders/${purchaseOrderId}/submit`);
  return data;
}

export async function approvePurchaseOrder(purchaseOrderId: string) {
  const { data } = await api.post(`/api/finance/procurement/purchase-orders/${purchaseOrderId}/approve`);
  return data;
}

export async function rejectPurchaseOrder(purchaseOrderId: string, reason: string) {
  const { data } = await api.post(`/api/finance/procurement/purchase-orders/${purchaseOrderId}/reject`, { reason });
  return data;
}

export async function deletePurchaseOrder(purchaseOrderId: string) {
  const { data } = await api.delete(`/api/finance/procurement/purchase-orders/${purchaseOrderId}`);
  return data;
}


export async function reopenRejectedPayrollRun(runId: string) {
  const response = await api.post(`/api/payroll/run/${runId}/reopen`);
  return response.data;
}

export async function resubmitRejectedPayrollRun(runId: string) {
  const response = await api.post(`/api/payroll/run/${runId}/resubmit`);
  return response.data;
}


export async function getPayrollPolicySetting() {
  const response = await api.get<PayrollPolicySettingDto>('/api/payroll/policy');
  return response.data;
}

export async function upsertPayrollPolicySetting(payload: UpdatePayrollPolicySettingRequest) {
  const response = await api.put('/api/payroll/policy', payload);
  return response.data;
}



export async function getPayrollRunDetail(runId: string) {
  const response = await api.get<PayrollRunDetailDto>(`/api/payroll/runs/${runId}`);
  return response.data;
}

export async function getPayrollPayslips(runId: string) {
  const response = await api.get<{ tenantContextAvailable: boolean; tenantId: string | null; tenantKey: string | null; payrollRun: any; count: number; items: PayrollPayslipDto[] }>(`/api/payroll/runs/${runId}/payslips`);
  return response.data;
}

export async function getPayrollStatutoryReport(runId: string) {
  const response = await api.get<{ tenantContextAvailable: boolean; tenantId: string | null; tenantKey: string | null; payrollRun: any; count: number; totalGrossPay: number; totalStatutoryDeductions: number; totalNetPay: number; items: PayrollStatutoryReportRowDto[] }>(`/api/payroll/runs/${runId}/statutory-report`);
  return response.data;
}

export async function getEmployeePayrollHistory(employeeId: string) {
  const response = await api.get(`/api/payroll/employees/${employeeId}/history`);
  return response.data;
}


export async function getPayrollPayGroupElements(payGroupId: string) {
  const response = await api.get<PayrollPayGroupElementsResponse>(`/api/payroll/pay-group-elements/${payGroupId}`);
  return response.data;
}

export async function createPayrollPayGroupElement(payload: CreatePayrollPayGroupElementRequest) {
  const response = await api.post('/api/payroll/pay-group-elements', payload);
  return response.data;
}

export async function updatePayrollPayGroupElement(payGroupElementId: string, payload: UpdatePayrollPayGroupElementRequest) {
  const response = await api.put(`/api/payroll/pay-group-elements/${payGroupElementId}`, payload);
  return response.data;
}

export async function deletePayrollPayGroupElement(payGroupElementId: string) {
  const response = await api.delete(`/api/payroll/pay-group-elements/${payGroupElementId}`);
  return response.data;
}


export async function getPayrollEmployees() {
  const response = await api.get<PayrollEmployeesResponse>('/api/payroll/employees');
  return response.data;
}


export async function createPayrollEmployee(payload: CreatePayrollEmployeeRequest) {
  const response = await api.post('/api/payroll/employees', payload);
  return response.data;
}

export async function updatePayrollEmployee(employeeId: string, payload: UpdatePayrollEmployeeRequest) {
  const response = await api.put(`/api/payroll/employees/${employeeId}`, payload);
  return response.data;
}

export async function deletePayrollEmployee(employeeId: string) {
  const response = await api.delete(`/api/payroll/employees/${employeeId}`);
  return response.data;
}



export async function importPayrollEmployees(payload: ImportPayrollEmployeesRequest) {
  const response = await api.post('/api/payroll/employees/import', payload);
  return response.data;
}


export async function getPayrollPayGroups() {
  const response = await api.get<PayrollPayGroupsResponse>('/api/payroll/pay-groups');
  return response.data;
}

export async function createPayrollPayGroup(payload: CreatePayrollPayGroupRequest) {
  const response = await api.post('/api/payroll/pay-groups', payload);
  return response.data;
}


export async function updatePayrollPayGroup(payGroupId: string, payload: UpdatePayrollPayGroupRequest) {
  const response = await api.put(`/api/payroll/pay-groups/${payGroupId}`, payload);
  return response.data;
}

export async function deletePayrollPayGroup(payGroupId: string) {
  const response = await api.delete(`/api/payroll/pay-groups/${payGroupId}`);
  return response.data;
}

export async function getPayrollPayElements() {
  const response = await api.get<PayrollPayElementsResponse>('/api/payroll/pay-elements');
  return response.data;
}

export async function createPayrollPayElement(payload: CreatePayrollPayElementRequest) {
  const response = await api.post('/api/payroll/pay-elements', payload);
  return response.data;
}

export async function updatePayrollPayElement(payElementId: string, payload: UpdatePayrollPayElementRequest) {
  const response = await api.put(`/api/payroll/pay-elements/${payElementId}`, payload);
  return response.data;
}

export async function deletePayrollPayElement(payElementId: string) {
  const response = await api.delete(`/api/payroll/pay-elements/${payElementId}`);
  return response.data;
}

export async function getPayrollSalaryStructures() {
  const response = await api.get<PayrollSalaryStructuresResponse>('/api/payroll/salary-structures');
  return response.data;
}

export async function createPayrollSalaryStructure(payload: CreatePayrollSalaryStructureRequest) {
  const response = await api.post('/api/payroll/salary-structures', payload);
  return response.data;
}

export async function updatePayrollSalaryStructure(salaryStructureId: string, payload: UpdatePayrollSalaryStructureRequest) {
  const response = await api.put(`/api/payroll/salary-structures/${salaryStructureId}`, payload);
  return response.data;
}

export async function deletePayrollSalaryStructure(salaryStructureId: string) {
  const response = await api.delete(`/api/payroll/salary-structures/${salaryStructureId}`);
  return response.data;
}

export async function generatePayrollRun(period: string) {
  const response = await api.post('/api/payroll/run', null, {
    params: { period },
  });
  return response.data;
}


export type PostPayrollRunRequest = {
  salaryExpenseAccountId: string;
  deductionsPayableAccountId: string;
  netSalaryPayableAccountId: string;
  postingDateUtc?: string | null;
  reference?: string | null;
  description?: string | null;
};


export async function postPayrollRun(runId: string, payload: PostPayrollRunRequest) {
  const response = await api.post(`/api/payroll/run/${runId}/post`, payload);
  return response.data;
}


// ==========================================
// PAYROLL / SALARY MANAGEMENT — MAKER/CHECKER UI
// ==========================================

export type SubmitPayrollRunRequest = {
  notes?: string | null;
};

export type RejectPayrollRunRequest = {
  reason: string;
};

export async function submitPayrollRun(runId: string, payload?: SubmitPayrollRunRequest) {
  const response = await api.post(`/api/payroll/run/${runId}/submit`, payload ?? {});
  return response.data;
}

export async function approvePayrollRun(runId: string) {
  const response = await api.post(`/api/payroll/run/${runId}/approve`);
  return response.data;
}

export async function rejectPayrollRun(runId: string, payload: RejectPayrollRunRequest) {
  const response = await api.post(`/api/payroll/run/${runId}/reject`, payload);
  return response.data;
}

// ==========================================
// PAYROLL — QUERIES (MISSING)
// ==========================================

export type PayrollRunSummaryDto = {
  id: string;
  payrollPeriod: string;
  employeeCount: number;
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  status: number;
  journalEntryId?: string | null;
};


// GET RUNS
export async function getPayrollRuns() {
  const res = await api.get<{ items: PayrollRunSummaryDto[] }>('/api/payroll/runs');
  return res.data;
}

export function canPostJournals() {
  return true; // temporary until role system enforced
}

export async function deletePayrollRun(runId: string) {
  const response = await api.delete(`/api/payroll/runs/${runId}`);
  return response.data;
}


export type PurchaseOrderReceiptLineDto = {
  id: string;
  purchaseOrderLineId: string;
  inventoryItemId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  receiptKind: number;
  notes?: string | null;
};

export type PurchaseOrderReceiptDto = {
  id: string;
  tenantId: string;
  receiptNumber: string;
  purchaseOrderId: string;
  warehouseId?: string | null;
  warehouseName?: string | null;
  purchaseOrderNumber?: string | null;
  receiptDateUtc: string;
  status: number;
  notes?: string | null;
  inventoryTransactionId?: string | null;
  journalEntryId?: string | null;
  createdOnUtc: string;
  lineCount: number;
  totalAmount: number;
  lines: PurchaseOrderReceiptLineDto[];
};

export type PurchaseOrderReceiptsResponse = ListEnvelope<PurchaseOrderReceiptDto>;

export type CreatePurchaseOrderReceiptLineRequest = {
  purchaseOrderLineId: string;
  inventoryItemId?: string | null;
  description?: string | null;
  quantity: number;
  unitCost: number;
  notes?: string | null;
};

export type CreatePurchaseOrderReceiptRequest = {
  purchaseOrderId: string;
  warehouseId?: string | null;
  inventoryLedgerAccountId?: string | null;
  receiptClearingLedgerAccountId?: string | null;
  receiptDateUtc: string;
  notes?: string | null;
  lines: CreatePurchaseOrderReceiptLineRequest[];
};

export async function getPurchaseOrderReceipts() {
  const { data } = await api.get<PurchaseOrderReceiptsResponse>('/api/finance/procurement/purchase-order-receipts');
  return data;
}

export async function createPurchaseOrderReceipt(request: CreatePurchaseOrderReceiptRequest) {
  const { data } = await api.post('/api/finance/procurement/purchase-order-receipts', request);
  return data;
}

export type SecurityRoleDto = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isSystemDefined: boolean;
  isActive: boolean;
  permissionCount?: number;
};

export type SecurityPermissionDto = {
  id: string;
  code: string;
  module: string;
  action: string;
  name: string;
  description?: string | null;
  isSystemDefined: boolean;
  isActive: boolean;
};

export type ScopeMasterDto = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
};

export type UserAccessAssignmentDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  isActive: boolean;
  roles: { id: string; code: string; name: string; isPrimary: boolean }[];
  scopes: { id: string; scopeType: string; scopeEntityId: string; scopeCode?: string | null; scopeName?: string | null }[];
};

export type DepartmentWorkflowPolicyDto = {
  id: string;
  moduleCode: string;
  organizationDepartmentId: string;
  departmentCode: string;
  departmentName: string;
  makerCheckerRequired: boolean;
  enforceSegregationOfDuties: boolean;
  minimumApproverCount: number;
  notes?: string | null;
  isActive: boolean;
};

export async function seedDefaultAccessControl() {
  const { data } = await api.post('/api/admin/access-control/seed-defaults');
  return data;
}

export async function getSecurityRoles() {
  const { data } = await api.get<ListEnvelope<SecurityRoleDto>>('/api/admin/access-control/roles');
  return data;
}

export async function createSecurityRole(payload: { code: string; name: string; description?: string | null; isActive: boolean }) {
  const { data } = await api.post('/api/admin/access-control/roles', payload);
  return data;
}

export async function getSecurityPermissions() {
  const { data } = await api.get<ListEnvelope<SecurityPermissionDto>>('/api/admin/access-control/permissions');
  return data;
}

export async function createSecurityPermission(payload: { code: string; module: string; action: string; name: string; description?: string | null; isActive: boolean }) {
  const { data } = await api.post('/api/admin/access-control/permissions', payload);
  return data;
}

export async function setSecurityRolePermissions(roleId: string, permissionIds: string[]) {
  const { data } = await api.put(`/api/admin/access-control/roles/${roleId}/permissions`, { permissionIds });
  return data;
}

export async function getAccessDepartments() {
  const { data } = await api.get<ListEnvelope<ScopeMasterDto>>('/api/admin/access-control/departments');
  return data;
}

export async function createAccessDepartment(payload: { code: string; name: string; description?: string | null; isActive: boolean }) {
  const { data } = await api.post('/api/admin/access-control/departments', payload);
  return data;
}

export async function getAccessBranches() {
  const { data } = await api.get<ListEnvelope<ScopeMasterDto>>('/api/admin/access-control/branches');
  return data;
}

export async function createAccessBranch(payload: { code: string; name: string; description?: string | null; isActive: boolean }) {
  const { data } = await api.post('/api/admin/access-control/branches', payload);
  return data;
}

export async function getAccessCostCenters() {
  const { data } = await api.get<ListEnvelope<ScopeMasterDto>>('/api/admin/access-control/cost-centers');
  return data;
}

export async function createAccessCostCenter(payload: { code: string; name: string; description?: string | null; isActive: boolean }) {
  const { data } = await api.post('/api/admin/access-control/cost-centers', payload);
  return data;
}

export async function getUserAccessAssignments() {
  const { data } = await api.get<ListEnvelope<UserAccessAssignmentDto>>('/api/admin/access-control/users/access-assignments');
  return data;
}

export async function setUserAccessAssignments(userId: string, payload: { roleIds?: string[]; scopes?: { scopeType: string; scopeEntityId: string; scopeCode?: string | null; scopeName?: string | null }[] }) {
  const { data } = await api.put(`/api/admin/access-control/users/${userId}/access-assignments`, payload);
  return data;
}

export async function getDepartmentWorkflowPolicies() {
  const { data } = await api.get<ListEnvelope<DepartmentWorkflowPolicyDto>>('/api/admin/access-control/workflow-policies');
  return data;
}

export async function createDepartmentWorkflowPolicy(payload: { moduleCode: string; organizationDepartmentId: string; makerCheckerRequired: boolean; enforceSegregationOfDuties: boolean; minimumApproverCount: number; notes?: string | null; isActive: boolean }) {
  const { data } = await api.post('/api/admin/access-control/workflow-policies', payload);
  return data;
}

