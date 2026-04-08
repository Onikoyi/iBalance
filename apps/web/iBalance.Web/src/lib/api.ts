import axios from 'axios';

export const tenantStorageKey = 'ibalance.tenantKey';

export function getTenantKey(): string {
  const stored = localStorage.getItem(tenantStorageKey);
  if (stored && stored.trim().length > 0) {
    return stored;
  }

  return import.meta.env.VITE_DEFAULT_TENANT_KEY || 'demo-tenant';
}

export function setTenantKey(value: string): void {
  localStorage.setItem(tenantStorageKey, value.trim());
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const tenantKey = getTenantKey();

  if (tenantKey) {
    config.headers['X-Tenant-Key'] = tenantKey;
  }

  return config;
});

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

export type ReportLineDto = {
  ledgerAccountId: string;
  code: string;
  name: string;
  totalDebit: number;
  totalCredit: number;
  balance?: number;
  amount?: number;
};

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