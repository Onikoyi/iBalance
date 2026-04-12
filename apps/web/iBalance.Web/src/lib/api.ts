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
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  isActive: boolean;
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

export type JournalEntryDto = {
  id: string;
  tenantId: string;
  entryDateUtc: string;
  reference: string;
  description: string;
  status: number;
  type: number;
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
  amountPaid: number;
  balanceAmount: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  lineCount: number;
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
};

export type PostSalesInvoiceRequest = {
  receivableLedgerAccountId: string;
  revenueLedgerAccountId: string;
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
    invoiceAmountPaid: number;
    invoiceBalanceAmount: number;
    receiptDateUtc: string;
    receiptNumber: string;
    description: string;
    amount: number;
    status: number;
    journalEntryId?: string | null;
    postedOnUtc?: string | null;
    createdOnUtc: string;
    createdBy?: string | null;
    createdByDisplayName?: string | null;
    preparedByDisplayName?: string | null;
    lastModifiedOnUtc?: string | null;
    lastModifiedBy?: string | null;
    lastModifiedByDisplayName?: string | null;
    approvedByDisplayName?: string | null;
    approvedOnUtc?: string | null;
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
  count: number;
  items: {
    type: string;
    dateUtc: string;
    reference: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    invoiceAmount: number;
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
  amountPaid: number;
  balanceAmount: number;
  journalEntryId?: string | null;
  postedOnUtc?: string | null;
  lineCount: number;
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
};

export type PostPurchaseInvoiceRequest = {
  payableLedgerAccountId: string;
  expenseLedgerAccountId: string;
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
    invoiceAmountPaid: number;
    invoiceBalanceAmount: number;
    paymentDateUtc: string;
    paymentNumber: string;
    description: string;
    amount: number;
    status: number;
    journalEntryId?: string | null;
    postedOnUtc?: string | null;
    createdOnUtc: string;
    createdBy?: string | null;
    createdByDisplayName?: string | null;
    preparedByDisplayName?: string | null;
    lastModifiedOnUtc?: string | null;
    lastModifiedBy?: string | null;
    lastModifiedByDisplayName?: string | null;
    approvedByDisplayName?: string | null;
    approvedOnUtc?: string | null;
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

export async function postPurchaseInvoice(purchaseInvoiceId: string, payload: PostPurchaseInvoiceRequest) {
  const response = await api.post(
    `/api/finance/ap/purchase-invoices/${encodeURIComponent(purchaseInvoiceId)}/post`,
    payload
  );
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
};

export async function createLedgerAccount(payload: CreateLedgerAccountRequest) {
  const response = await api.post('/api/finance/accounts', payload);
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