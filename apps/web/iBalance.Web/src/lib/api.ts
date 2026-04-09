import axios from 'axios';

export const tenantStorageKey = 'ibalance.tenantKey';
export const tenantLogoStorageKey = 'ibalance.tenantLogo';
export const companyLogoStorageKey = 'ibalance.companyLogo';

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

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const tenantKey = getTenantKey();
  if (tenantKey) config.headers['X-Tenant-Key'] = tenantKey;
  return config;
});

/** Backend uses `{ Message = "..." }` for many errors. :contentReference[oaicite:3]{index=3} */
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

export async function getTrialBalance(fromUtc?: string | null, toUtc?: string | null) {
  const response = await api.get<TrialBalanceResponse>('/api/finance/trial-balance', {
    params: {
      ...(fromUtc ? { fromUtc } : {}),
      ...(toUtc ? { toUtc } : {}),
    },
  });

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

export async function getIncomeStatement() {
  const response = await api.get<IncomeStatementResponse>('/api/finance/reports/income-statement');
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