import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLedgerAccount,
  createTaxCode,
  getAccounts,
  getCompanyLogoDataUrl,
  getLedgerAccountStatement,
  getTaxCodes,
  getTenantKey,
  getTenantLogoDataUrl,
  getTenantReadableError,
  updateLedgerAccount,
  type LedgerAccountDto,
  type LedgerAccountStatementResponse,
  type TaxCodeDto,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

function categoryLabel(value: number) {
  switch (value) {
    case 1: return 'Asset';
    case 2: return 'Liability';
    case 3: return 'Equity';
    case 4: return 'Income';
    case 5: return 'Expense';
    default: return 'Unclassified';
  }
}

function normalBalanceLabel(value: number) {
  return value === 1 ? 'Debit' : 'Credit';
}

function taxComponentKindLabel(value: number) {
  switch (value) {
    case 1: return 'VAT';
    case 2: return 'WHT';
    case 3: return 'Other';
    default: return 'Unknown';
  }
}

function taxApplicationModeLabel(value: number) {
  switch (value) {
    case 1: return 'Add to Amount';
    case 2: return 'Deduct from Amount';
    default: return 'Unknown';
  }
}

function taxTransactionScopeLabel(value: number) {
  switch (value) {
    case 1: return 'Sales';
    case 2: return 'Purchases';
    case 3: return 'Both';
    default: return 'Unknown';
  }
}


function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function formatDisplayDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildReportingPeriodText(fromDate: string, toDate: string) {
  if (!fromDate || !toDate) {
    return 'Reporting Period: Select From Date and To Date';
  }

  return `Reporting Period: ${formatDisplayDate(`${fromDate}T00:00:00`)} to ${formatDisplayDate(`${toDate}T00:00:00`)}`;
}

type FormState = {
  code: string;
  name: string;
  purpose: string;
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  isCashOrBankAccount: boolean;
  parentLedgerAccountId: string;
};

type EditFormState = {
  id: string;
  code: string;
  name: string;
  purpose: string;
  isActive: boolean;
  isCashOrBankAccount: boolean;
  isHeader: boolean;
};

type TaxCodeFormState = {
  code: string;
  name: string;
  description: string;
  componentKind: number;
  applicationMode: number;
  transactionScope: number;
  ratePercent: string;
  taxLedgerAccountId: string;
  isActive: boolean;
  effectiveFromDate: string;
  effectiveToDate: string;
};


type UploadRow = {
  code: string;
  name: string;
  purpose: string;
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  isCashOrBankAccount: boolean;
  parentCode: string;
};

const emptyForm: FormState = {
  code: '',
  name: '',
  purpose: '',
  category: 1,
  normalBalance: 1,
  isHeader: false,
  isPostingAllowed: true,
  isCashOrBankAccount: false,
  parentLedgerAccountId: '',
};

const emptyEditForm: EditFormState = {
  id: '',
  code: '',
  name: '',
  purpose: '',
  isActive: true,
  isCashOrBankAccount: false,
  isHeader: false,
};


const emptyTaxCodeForm: TaxCodeFormState = {
  code: '',
  name: '',
  description: '',
  componentKind: 1,
  applicationMode: 1,
  transactionScope: 3,
  ratePercent: '',
  taxLedgerAccountId: '',
  isActive: true,
  effectiveFromDate: new Date().toISOString().slice(0, 10),
  effectiveToDate: '',
};


function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function parseCategory(value: string) {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'asset': return 1;
    case 'liability': return 2;
    case 'equity': return 3;
    case 'income': return 4;
    case 'expense': return 5;
    default: return 0;
  }
}

function parseNormalBalance(value: string) {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'debit': return 1;
    case 'credit': return 2;
    default: return 0;
  }
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result.map((x) => x.trim());
}

function buildTemplateCsv() {
  const headers = [
    'Code',
    'Name',
    'Purpose',
    'Category',
    'NormalBalance',
    'IsHeader',
    'IsPostingAllowed',
    'IsCashOrBankAccount',
    'ParentCode',
  ];

  const rows = [
    ['1000', 'Assets', 'Main asset control header for asset accounts', 'Asset', 'Debit', 'true', 'false', 'false', ''],
    ['1010', 'Main Bank Account', 'Primary operating bank account used for treasury receipts and payments', 'Asset', 'Debit', 'false', 'true', 'true', '1000'],
    ['1020', 'Cash on Hand', 'Petty cash and till balances used for treasury cash operations', 'Asset', 'Debit', 'false', 'true', 'true', '1000'],
    ['1100', 'Trade Receivables', 'Receivables control account for posted sales invoices', 'Asset', 'Debit', 'false', 'true', 'false', '1000'],
    ['1200', 'Prepayments and Deposits', 'Short-term prepayments and recoverable deposits', 'Asset', 'Debit', 'false', 'true', 'false', '1000'],
    ['1300', 'Inventory Clearing', 'Placeholder inventory-related asset account for future stock integration', 'Asset', 'Debit', 'false', 'true', 'false', '1000'],
    ['2000', 'Liabilities', 'Main liability control header for liability accounts', 'Liability', 'Credit', 'true', 'false', 'false', ''],
    ['2010', 'Trade Payables', 'Payables control account for posted purchase invoices', 'Liability', 'Credit', 'false', 'true', 'false', '2000'],
    ['2100', 'Accrued Expenses', 'Accrued obligations recognized before payment', 'Liability', 'Credit', 'false', 'true', 'false', '2000'],
    ['2200', 'Taxes Payable', 'Tax obligations due to authorities', 'Liability', 'Credit', 'false', 'true', 'false', '2000'],
    ['3000', 'Equity', 'Main equity header for capital and retained earnings', 'Equity', 'Credit', 'true', 'false', 'false', ''],
    ['3010', 'Owner Capital', 'Owner investment or share capital', 'Equity', 'Credit', 'false', 'true', 'false', '3000'],
    ['3020', 'Retained Earnings', 'Accumulated profits retained in the business', 'Equity', 'Credit', 'false', 'true', 'false', '3000'],
    ['4000', 'Revenue', 'Main revenue header for operating income', 'Income', 'Credit', 'true', 'false', 'false', ''],
    ['4010', 'Sales Revenue', 'Revenue from sale of goods', 'Income', 'Credit', 'false', 'true', 'false', '4000'],
    ['4020', 'Service Revenue', 'Revenue from rendering services', 'Income', 'Credit', 'false', 'true', 'false', '4000'],
    ['4030', 'Other Operating Income', 'Miscellaneous operating income earned', 'Income', 'Credit', 'false', 'true', 'false', '4000'],
    ['5000', 'Operating Expenses', 'Main expense header for operating costs', 'Expense', 'Debit', 'true', 'false', 'false', ''],
    ['5010', 'Cost of Sales / Direct Costs', 'Direct cost account for goods sold or direct service cost', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5020', 'Salaries and Wages', 'Employee compensation expense', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5030', 'Rent Expense', 'Office or facility rent cost', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5040', 'Utilities Expense', 'Electricity, water, internet and similar utilities', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5050', 'Office and Admin Expense', 'General administration and office running cost', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5060', 'Transport and Logistics', 'Delivery, transport and logistics expense', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5070', 'Repairs and Maintenance', 'Routine maintenance and repair expense', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
    ['5080', 'Bank Charges', 'Bank fees and transaction charges', 'Expense', 'Debit', 'false', 'true', 'false', '5000'],
  ];

  return [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
    .join('\n');
}

function formatStatus(value: boolean, positiveLabel: string, negativeLabel: string) {
  return value ? positiveLabel : negativeLabel;
}

type PrintLedgerArgs = {
  tenantKey: string;
  tenantLogo: string;
  companyLogo: string;
  statement: LedgerAccountStatementResponse;
  reportingPeriodText: string;
};

function buildLedgerPrintHtml(args: PrintLedgerArgs) {
  const { tenantKey, tenantLogo, companyLogo, statement, reportingPeriodText } = args;

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:44px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${fallback}</div>`;

  const rowsHtml = statement.items.length === 0
    ? `<tr><td colspan="7" style="padding:12px;color:#6b7280;">No ledger movements were found for the selected account and reporting period.</td></tr>`
    : statement.items.map((item) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${formatDateTime(item.movementDateUtc)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.reference}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(item.debitAmount)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(item.creditAmount)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(item.runningBalanceDebit)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(item.runningBalanceCredit)}</td>
        </tr>
      `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Ledger Statement - ${statement.ledgerAccount.code}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .page {
      max-width: 1100px;
      margin: 0 auto;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: center;
      margin-bottom: 18px;
    }
    .brand-block {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .brand-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .brand-meta strong {
      font-size: 15px;
    }
    .brand-meta span {
      font-size: 12px;
      color: #6b7280;
    }
    .title-block {
      margin-bottom: 18px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
    }
    .title-block h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
    }
    .muted {
      color: #6b7280;
      font-size: 14px;
    }
    .kv {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 18px;
    }
    .kv-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 10px 14px;
      border-bottom: 1px solid #f3f4f6;
    }
    .kv-row:last-child {
      border-bottom: none;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    th {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #d1d5db;
      font-size: 14px;
    }
    tfoot th {
      border-top: 1px solid #d1d5db;
      border-bottom: none;
    }
    .right {
      text-align: right;
    }
    @media print {
      body {
        padding: 0;
      }
      .page {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand-row">
      <div class="brand-block">
        ${logoOrFallback(companyLogo, 'iBalance')}
        <div class="brand-meta">
          <strong>Nikosoft Technologies</strong>
          <span>iBalance Accounting Cloud</span>
        </div>
      </div>
      <div class="brand-block">
        ${logoOrFallback(tenantLogo, 'Org')}
        <div class="brand-meta">
          <strong>${tenantKey || 'Organization'}</strong>
          <span>Client Workspace</span>
        </div>
      </div>
    </div>

    <div class="title-block">
      <h1>Ledger Statement</h1>
      <div class="muted">${statement.ledgerAccount.code} - ${statement.ledgerAccount.name}</div>
      <div class="muted">${reportingPeriodText}</div>
    </div>

    <div class="kv">
      <div class="kv-row"><span>Account Code</span><span>${statement.ledgerAccount.code}</span></div>
      <div class="kv-row"><span>Account Name</span><span>${statement.ledgerAccount.name}</span></div>
      <div class="kv-row"><span>Category</span><span>${categoryLabel(statement.ledgerAccount.category)}</span></div>
      <div class="kv-row"><span>Normal Balance</span><span>${normalBalanceLabel(statement.ledgerAccount.normalBalance)}</span></div>
      <div class="kv-row"><span>Total Debit</span><span>${formatAmount(statement.totalDebit)}</span></div>
      <div class="kv-row"><span>Total Credit</span><span>${formatAmount(statement.totalCredit)}</span></div>
      <div class="kv-row"><span>Closing Balance (Debit)</span><span>${formatAmount(statement.closingBalanceDebit)}</span></div>
      <div class="kv-row"><span>Closing Balance (Credit)</span><span>${formatAmount(statement.closingBalanceCredit)}</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference</th>
          <th>Description</th>
          <th class="right">Debit</th>
          <th class="right">Credit</th>
          <th class="right">Running Debit</th>
          <th class="right">Running Credit</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <th colspan="3">Totals</th>
          <th class="right">${formatAmount(statement.totalDebit)}</th>
          <th class="right">${formatAmount(statement.totalCredit)}</th>
          <th class="right">${formatAmount(statement.closingBalanceDebit)}</th>
          <th class="right">${formatAmount(statement.closingBalanceCredit)}</th>
        </tr>
      </tfoot>
    </table>
  </div>
</body>
</html>`;
}

function buildAccountsPrintHtml(args: {
  tenantKey: string;
  tenantLogo: string;
  companyLogo: string;
  items: LedgerAccountDto[];
}) {
  const { tenantKey, tenantLogo, companyLogo, items } = args;

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:44px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${fallback}</div>`;

  const rowsHtml = items.length === 0
    ? `<tr><td colspan="10" style="padding:12px;color:#6b7280;">No accounts matched the current filter selection.</td></tr>`
    : items.map((item) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.code}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.purpose || '—'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${categoryLabel(item.category)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${normalBalanceLabel(item.normalBalance)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.isHeader ? 'Header' : 'Posting Account'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.isPostingAllowed ? 'Enabled' : 'Not Enabled'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.isCashOrBankAccount ? 'Yes' : 'No'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.isActive ? 'Active' : 'Inactive'}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${item.parentCode ? `${item.parentCode} - ${item.parentName}` : '—'}</td>
        </tr>
      `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Chart of Accounts</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .page {
      max-width: 1300px;
      margin: 0 auto;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: center;
      margin-bottom: 18px;
    }
    .brand-block {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .brand-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .brand-meta strong {
      font-size: 15px;
    }
    .brand-meta span {
      font-size: 12px;
      color: #6b7280;
    }
    .title-block {
      margin-bottom: 18px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
    }
    .title-block h1 {
      margin: 0 0 8px 0;
      font-size: 26px;
    }
    .muted {
      color: #6b7280;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }
    th {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #d1d5db;
      font-size: 14px;
    }
    td {
      font-size: 13px;
      vertical-align: top;
    }
    @media print {
      body {
        padding: 0;
      }
      .page {
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand-row">
      <div class="brand-block">
        ${logoOrFallback(companyLogo, 'iBalance')}
        <div class="brand-meta">
          <strong>Nikosoft Technologies</strong>
          <span>iBalance Accounting Cloud</span>
        </div>
      </div>
      <div class="brand-block">
        ${logoOrFallback(tenantLogo, 'Org')}
        <div class="brand-meta">
          <strong>${tenantKey || 'Organization'}</strong>
          <span>Client Workspace</span>
        </div>
      </div>
    </div>

    <div class="title-block">
      <h1>Chart of Accounts</h1>
      <div class="muted">Filtered printable account listing</div>
      <div class="muted">Total Accounts in Print View: ${items.length}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Account Name</th>
          <th>Purpose</th>
          <th>Category</th>
          <th>Normal Balance</th>
          <th>Type</th>
          <th>Posting</th>
          <th>Is Cash / Bank</th>
          <th>Status</th>
          <th>Parent Account</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function AccountsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm);
  const [isUploading, setIsUploading] = useState(false);
  const [showCreateTaxCode, setShowCreateTaxCode] = useState(false);
  const [taxCodeForm, setTaxCodeForm] = useState<TaxCodeFormState>(emptyTaxCodeForm);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');

  const [accountSearch, setAccountSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [cashBankFilter, setCashBankFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');


  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const taxCodesQ = useQuery({
    queryKey: ['tax-codes'],
    queryFn: () => getTaxCodes(null, null, null),
    enabled: canView,
  });

  const headerAccounts = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((x) => x.isHeader).sort((a, b) => a.code.localeCompare(b.code));
  }, [data?.items]);


  const postingAccounts = useMemo(() => {
    const items = data?.items ?? [];
    return items
      .filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [data?.items]);


  const accountSummary = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: items.length,
      active: items.filter((x) => x.isActive).length,
      posting: items.filter((x) => x.isPostingAllowed && !x.isHeader).length,
      headers: items.filter((x) => x.isHeader).length,
      cashOrBank: items.filter((x) => x.isCashOrBankAccount).length,
    };
  }, [data?.items]);

  const filteredAccounts = useMemo(() => {
    const items = data?.items ?? [];
    const search = accountSearch.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !search ||
        item.code.toLowerCase().includes(search) ||
        item.name.toLowerCase().includes(search) ||
        (item.purpose || '').toLowerCase().includes(search) ||
        (item.parentCode || '').toLowerCase().includes(search) ||
        (item.parentName || '').toLowerCase().includes(search);

      const matchesCategory =
        categoryFilter === 'all' || String(item.category) === categoryFilter;

      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'header' && item.isHeader) ||
        (typeFilter === 'posting' && !item.isHeader);

      const matchesCashBank =
        cashBankFilter === 'all' ||
        (cashBankFilter === 'cashbank' && item.isCashOrBankAccount) ||
        (cashBankFilter === 'standard' && !item.isCashOrBankAccount);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesType &&
        matchesCashBank &&
        matchesStatus
      );
    });
  }, [data?.items, accountSearch, categoryFilter, typeFilter, cashBankFilter, statusFilter]);


  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));

  const pagedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [accountSearch, categoryFilter, typeFilter, cashBankFilter, statusFilter, pageSize]);

  const isStatementRangeValid = !!statementFromDate && !!statementToDate;
  const reportingPeriodText = buildReportingPeriodText(statementFromDate, statementToDate);

  const statementFromUtc = isStatementRangeValid
    ? new Date(`${statementFromDate}T00:00:00`).toISOString()
    : null;

  const statementToUtc = isStatementRangeValid
    ? new Date(`${statementToDate}T23:59:59`).toISOString()
    : null;

  const ledgerStatementQ = useQuery({
    queryKey: ['ledger-account-statement', selectedAccountId, statementFromUtc, statementToUtc],
    queryFn: () => getLedgerAccountStatement(selectedAccountId, statementFromUtc, statementToUtc),
    enabled: canView && !!selectedAccountId && isStatementRangeValid,
  });

  const createMut = useMutation({
    mutationFn: createLedgerAccount,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowCreate(false);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('The account has been created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the account at this time.'));
      setInfoText('');
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; purpose?: string | null; isActive: boolean; isCashOrBankAccount: boolean } }) =>
      updateLedgerAccount(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      if (selectedAccountId) {
        await qc.invalidateQueries({ queryKey: ['ledger-account-statement', selectedAccountId, statementFromUtc, statementToUtc] });
      }
      setShowEdit(false);
      setEditForm(emptyEditForm);
      setErrorText('');
      setInfoText('The account has been updated successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not update the account at this time.'));
      setInfoText('');
    },
  });

  const createTaxCodeMut = useMutation({
    mutationFn: createTaxCode,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tax-codes'] });
      setShowCreateTaxCode(false);
      setTaxCodeForm(emptyTaxCodeForm);
      setErrorText('');
      setInfoText('The tax code has been created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the tax code at this time.'));
      setInfoText('');
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function updateEdit<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setEditForm((s) => ({ ...s, [key]: value }));
  }

  function updateTaxCodeForm<K extends keyof TaxCodeFormState>(key: K, value: TaxCodeFormState[K]) {
    setTaxCodeForm((s) => ({ ...s, [key]: value }));
  }

  function openModal() {
    if (!canManage) {
      setErrorText('You have view access only on this page.');
      setInfoText('');
      return;
    }

    setErrorText('');
    setInfoText('');
    setForm(emptyForm);
    setShowCreate(true);
  }

  function closeModal() {
    if (!createMut.isPending) {
      setShowCreate(false);
      setErrorText('');
    }
  }

  function openEditModal(account: LedgerAccountDto) {
    if (!canManage) {
      setErrorText('You have view access only on this page.');
      setInfoText('');
      return;
    }

    setErrorText('');
    setInfoText('');
    setEditForm({
      id: account.id,
      code: account.code,
      name: account.name,
      purpose: account.purpose || '',
      isActive: account.isActive,
      isCashOrBankAccount: account.isCashOrBankAccount,
      isHeader: account.isHeader,
    });
    setShowEdit(true);
  }

  function closeEditModal() {
    if (!editMut.isPending) {
      setShowEdit(false);
      setErrorText('');
      setEditForm(emptyEditForm);
    }
  }

  function openTaxCodeModal() {
    if (!canManage) {
      setErrorText('You have view access only on this page.');
      setInfoText('');
      return;
    }

    setErrorText('');
    setInfoText('');
    setTaxCodeForm(emptyTaxCodeForm);
    setShowCreateTaxCode(true);
  }

  function closeTaxCodeModal() {
    if (!createTaxCodeMut.isPending) {
      setShowCreateTaxCode(false);
      setErrorText('');
      setTaxCodeForm(emptyTaxCodeForm);
    }
  }

  async function submit() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You have view access only on this page.');
      return;
    }

    if (!form.code.trim() || !form.name.trim()) {
      setErrorText('Please enter both the account code and account name.');
      return;
    }

    if (form.isHeader && form.isPostingAllowed) {
      setErrorText('A header account cannot be set as posting-enabled.');
      return;
    }

    if (form.isHeader && form.isCashOrBankAccount) {
      setErrorText('A header account cannot be marked as a cash or bank account.');
      return;
    }

    await createMut.mutateAsync({
      code: form.code.trim(),
      name: form.name.trim(),
      purpose: form.purpose.trim() || null,
      category: form.category,
      normalBalance: form.normalBalance,
      isHeader: form.isHeader,
      isPostingAllowed: form.isPostingAllowed,
      isCashOrBankAccount: form.isCashOrBankAccount,
      parentLedgerAccountId: form.parentLedgerAccountId ? form.parentLedgerAccountId : null,
    });
  }

  async function submitEdit() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You have view access only on this page.');
      return;
    }

    if (!editForm.id) {
      setErrorText('No account is selected for editing.');
      return;
    }

    if (!editForm.name.trim()) {
      setErrorText('Please enter the account name.');
      return;
    }

    if (editForm.isHeader && editForm.isCashOrBankAccount) {
      setErrorText('A header account cannot be marked as a cash or bank account.');
      return;
    }

    await editMut.mutateAsync({
      id: editForm.id,
      payload: {
        name: editForm.name.trim(),
        purpose: editForm.purpose.trim() || null,
        isActive: editForm.isActive,
        isCashOrBankAccount: editForm.isCashOrBankAccount,
      },
    });
  }


  async function submitTaxCode() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You have view access only on this page.');
      return;
    }

    if (!taxCodeForm.code.trim() || !taxCodeForm.name.trim()) {
      setErrorText('Please enter both the tax code and tax name.');
      return;
    }

    if (!taxCodeForm.taxLedgerAccountId) {
      setErrorText('Please select the ledger account that will hold this tax.');
      return;
    }

    const ratePercent = Number(taxCodeForm.ratePercent);

    if (Number.isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      setErrorText('Tax rate must be a number between 0 and 100.');
      return;
    }

    if (!taxCodeForm.effectiveFromDate) {
      setErrorText('Effective From date is required.');
      return;
    }

    await createTaxCodeMut.mutateAsync({
      code: taxCodeForm.code.trim(),
      name: taxCodeForm.name.trim(),
      description: taxCodeForm.description.trim() || null,
      componentKind: taxCodeForm.componentKind,
      applicationMode: taxCodeForm.applicationMode,
      transactionScope: taxCodeForm.transactionScope,
      ratePercent,
      taxLedgerAccountId: taxCodeForm.taxLedgerAccountId,
      isActive: taxCodeForm.isActive,
      effectiveFromUtc: new Date(`${taxCodeForm.effectiveFromDate}T00:00:00`).toISOString(),
      effectiveToUtc: taxCodeForm.effectiveToDate
        ? new Date(`${taxCodeForm.effectiveToDate}T23:59:59`).toISOString()
        : null,
    });
  }


  function downloadTemplate() {
    const content = buildTemplateCsv();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ibalance-chart-of-accounts-template.csv';
    a.click();

    URL.revokeObjectURL(url);
  }

  function printSelectedLedger() {
    if (!ledgerStatementQ.data || !isStatementRangeValid) {
      return;
    }

    const html = buildLedgerPrintHtml({
      tenantKey,
      tenantLogo,
      companyLogo,
      statement: ledgerStatementQ.data,
      reportingPeriodText,
    });

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }

  function printAccountsListing() {
    const html = buildAccountsPrintHtml({
      tenantKey,
      tenantLogo,
      companyLogo,
      items: filteredAccounts,
    });

    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }


  async function onUploadFile(file: File | null) {
    if (!file) return;

    if (!canManage) {
      setInfoText('');
      setErrorText('You have view access only on this page.');
      return;
    }

    setErrorText('');
    setInfoText('');
    setIsUploading(true);

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error('The selected file does not contain any account rows.');
      }

      const header = splitCsvLine(lines[0]).map((x) => x.toLowerCase());
      const expected = ['code', 'name', 'purpose', 'category', 'normalbalance', 'isheader', 'ispostingallowed', 'iscashorbankaccount', 'parentcode'];

      if (expected.some((value, index) => header[index] !== value)) {
        throw new Error('The file format is not valid. Please use the provided template.');
      }

      const parsedRows: UploadRow[] = lines.slice(1).map((line, rowIndex) => {
        const cols = splitCsvLine(line);

        if (cols.length < 9) {
          throw new Error(`Row ${rowIndex + 2}: incomplete data.`);
        }

        const category = parseCategory(cols[3]);
        const normalBalance = parseNormalBalance(cols[4]);

        if (!category) {
          throw new Error(`Row ${rowIndex + 2}: invalid account category.`);
        }

        if (!normalBalance) {
          throw new Error(`Row ${rowIndex + 2}: invalid normal balance value.`);
        }

        return {
          code: cols[0],
          name: cols[1],
          purpose: cols[2],
          category,
          normalBalance,
          isHeader: parseBoolean(cols[5]),
          isPostingAllowed: parseBoolean(cols[6]),
          isCashOrBankAccount: parseBoolean(cols[7]),
          parentCode: cols[8],
        };
      });

      const currentAccounts = (await qc.fetchQuery({
        queryKey: ['accounts'],
        queryFn: getAccounts,
      })).items;

      const codeToId = new Map(currentAccounts.map((x) => [x.code.toUpperCase(), x.id]));
      const pendingCreated = new Map<string, string>();

      let created = 0;
      const failures: string[] = [];

      for (const row of parsedRows) {
        try {
          if (!row.code.trim() || !row.name.trim()) {
            failures.push(`${row.code || 'Unnamed row'}: account code and name are required.`);
            continue;
          }

          if (row.isHeader && row.isPostingAllowed) {
            failures.push(`${row.code}: a header account cannot be posting-enabled.`);
            continue;
          }

          if (row.isHeader && row.isCashOrBankAccount) {
            failures.push(`${row.code}: a header account cannot be marked as a cash or bank account.`);
            continue;
          }

          const parentCode = row.parentCode.trim().toUpperCase();
          const parentLedgerAccountId =
            (parentCode ? pendingCreated.get(parentCode) : null) ||
            (parentCode ? codeToId.get(parentCode) : null) ||
            null;

          if (parentCode && !parentLedgerAccountId) {
            failures.push(`${row.code}: parent account '${parentCode}' was not found.`);
            continue;
          }

          const result = await createLedgerAccount({
            code: row.code.trim(),
            name: row.name.trim(),
            purpose: row.purpose.trim() || null,
            category: row.category,
            normalBalance: row.normalBalance,
            isHeader: row.isHeader,
            isPostingAllowed: row.isPostingAllowed,
            isCashOrBankAccount: row.isCashOrBankAccount,
            parentLedgerAccountId,
          });

          const createdId = result?.id || result?.Id;
          if (createdId) {
            pendingCreated.set(row.code.trim().toUpperCase(), createdId);
          }

          created += 1;
        } catch (uploadError) {
          failures.push(`${row.code}: ${getTenantReadableError(uploadError, 'This row could not be imported.')}`);
        }
      }

      await qc.invalidateQueries({ queryKey: ['accounts'] });

      if (failures.length > 0) {
        setInfoText(`Import completed with ${created} account(s) created.`);
        setErrorText(failures.join(' | '));
      } else {
        setInfoText(`Import completed successfully. ${created} account(s) were created.`);
        setErrorText('');
      }
    } catch (uploadError) {
      setErrorText(getTenantReadableError(uploadError, 'We could not process the selected file.'));
      setInfoText('');
    } finally {
      setIsUploading(false);
    }
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view the chart of accounts.</div>;
  }

  if (isLoading || taxCodesQ.isLoading) {
    return <div className="panel">Loading finance setup...</div>;
  }

  if (error || taxCodesQ.error || !data || !taxCodesQ.data) {
    return <div className="panel error-panel">We could not load finance setup at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Chart of accounts</h2>
            <div className="muted">Manage your organization’s account structure and posting hierarchy.</div>
          </div>

          <div className="inline-actions">
            <button className="button" onClick={downloadTemplate}>Download Template</button>
            {canManage ? (
              <>
                <label
                  className="button"
                  style={{ cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1 }}
                >
                  {isUploading ? 'Uploading…' : 'Import Accounts'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    disabled={isUploading}
                    onChange={(e) => onUploadFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button className="button primary" onClick={openModal}>New Account</button>
              </>
            ) : null}
          </div>
        </div>

        <div className="kv">
          <div className="kv-row">
            <span>Total Accounts</span>
            <span>{accountSummary.total}</span>
          </div>
          <div className="kv-row">
            <span>Active Accounts</span>
            <span>{accountSummary.active}</span>
          </div>
          <div className="kv-row">
            <span>Posting Accounts</span>
            <span>{accountSummary.posting}</span>
          </div>
          <div className="kv-row">
            <span>Header Accounts</span>
            <span>{accountSummary.headers}</span>
          </div>
          <div className="kv-row">
            <span>Cash / Bank Accounts</span>
            <span>{accountSummary.cashOrBank}</span>
          </div>
        </div>

        {!canManage ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">You currently have read-only access to the chart of accounts.</div>
          </div>
        ) : null}

        {infoText ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">{infoText}</div>
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginTop: 16 }}>
            {errorText}
          </div>
        ) : null}
      </section>


      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>VAT / WHT / Other Tax Setup</h2>
            <span className="muted">
              Configure setup-driven tax codes for VAT, withholding tax, and other levies.
            </span>
          </div>

          {canManage ? (
            <button className="button primary" onClick={openTaxCodeModal}>
              New Tax Code
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Mode</th>
                <th>Scope</th>
                <th style={{ textAlign: 'right' }}>Rate %</th>
                <th>Tax Ledger</th>
                <th>Effective From</th>
                <th>Effective To</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {taxCodesQ.data.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted">
                    No tax codes have been configured yet.
                  </td>
                </tr>
              ) : (
                taxCodesQ.data.items.map((item: TaxCodeDto) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>
                      <div>{item.name}</div>
                      <div className="muted">{item.description || '—'}</div>
                    </td>
                    <td>{taxComponentKindLabel(item.componentKind)}</td>
                    <td>{taxApplicationModeLabel(item.applicationMode)}</td>
                    <td>{taxTransactionScopeLabel(item.transactionScope)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.ratePercent)}</td>
                    <td>
                      {item.taxLedgerAccountCode
                        ? `${item.taxLedgerAccountCode} - ${item.taxLedgerAccountName}`
                        : '—'}
                    </td>
                    <td>{formatDisplayDate(item.effectiveFromUtc)}</td>
                    <td>{formatDisplayDate(item.effectiveToUtc)}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>



      <section className="panel no-print">
      <div className="section-heading">
          <div>
            <h2>Account listing</h2>
            <span className="muted">{filteredAccounts.length} of {data.count} account(s)</span>
          </div>

          <div className="inline-actions">
            <button className="button" onClick={printAccountsListing}>
              Print Accounts
            </button>
          </div>
        </div>

        <div className="form-grid two" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Search Accounts</label>
            <input
              className="input"
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Search by code, name, purpose, or parent account"
            />
          </div>

          <div className="form-row">
            <label>Category</label>
            <select
              className="select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="1">Asset</option>
              <option value="2">Liability</option>
              <option value="3">Equity</option>
              <option value="4">Income</option>
              <option value="5">Expense</option>
            </select>
          </div>

          <div className="form-row">
            <label>Account Type</label>
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="header">Header</option>
              <option value="posting">Posting Account</option>
            </select>
          </div>

          <div className="form-row">
            <label>Cash / Bank Filter</label>
            <select
              className="select"
              value={cashBankFilter}
              onChange={(e) => setCashBankFilter(e.target.value)}
            >
              <option value="all">All Accounts</option>
              <option value="cashbank">Cash / Bank Only</option>
              <option value="standard">Non Cash / Bank Only</option>
            </select>
          </div>

          <div className="form-row">
            <label>Status</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div className="form-row">
            <label>Clear Filters</label>
            <div className="inline-actions">
            <button
                className="button"
                onClick={() => {
                  setAccountSearch('');
                  setCategoryFilter('all');
                  setTypeFilter('all');
                  setCashBankFilter('all');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Purpose</th>
                <th>Category</th>
                <th>Normal Balance</th>
                <th>Type</th>
                <th>Posting</th>
                <th>Is Cash / Bank</th>
                <th>Status</th>
                <th>Parent Account</th>
                <th style={{ width: 220 }}>Action</th>
              </tr>
            </thead>
            <tbody>
            {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">
                    No accounts matched the current search/filter selection.
                  </td>
                </tr>
              ) : (
                pagedAccounts.map((item: LedgerAccountDto) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.purpose || '—'}</td>
                    <td>{categoryLabel(item.category)}</td>
                    <td>{normalBalanceLabel(item.normalBalance)}</td>
                    <td>{formatStatus(item.isHeader, 'Header', 'Posting Account')}</td>
                    <td>{formatStatus(item.isPostingAllowed, 'Enabled', 'Not Enabled')}</td>
                    <td>{formatStatus(item.isCashOrBankAccount, 'Yes', 'No')}</td>
                    <td>{formatStatus(item.isActive, 'Active', 'Inactive')}</td>
                    <td>{item.parentCode ? `${item.parentCode} - ${item.parentName}` : '—'}</td>
                    <td>
                      <div className="inline-actions">
                        <button
                          className="button"
                          onClick={() => setSelectedAccountId(item.id)}
                        >
                          Drill Down
                        </button>
                        {canManage ? (
                          <button
                            className="button"
                            onClick={() => openEditModal(item)}
                          >
                            Edit
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>


              <div className="panel" style={{ marginTop: 16 }}>
          <div className="inline-actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="muted">
                Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
              </span>
              <span className="muted">
                Showing {filteredAccounts.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}
                {' '}to{' '}
                {Math.min(currentPage * pageSize, filteredAccounts.length)}
                {' '}of {filteredAccounts.length} filtered account(s)
              </span>
            </div>

            <div className="inline-actions" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div className="form-row" style={{ margin: 0 }}>
                <label style={{ marginBottom: 4 }}>Rows per page</label>
                <select
                  className="select"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <button
                className="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                First
              </button>

              <button
                className="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              <button
                className="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>

              <button
                className="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </button>
            </div>
          </div>
        </div>

      <section className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Ledger drill-down</h2>
            <span className="muted">Review postings, movements, and running balance for a selected account</span>
          </div>

          <div className="inline-actions">
            <button
              className="button"
              onClick={printSelectedLedger}
              disabled={!selectedAccountId || !ledgerStatementQ.data || !isStatementRangeValid}
            >
              Print Ledger Report
            </button>
          </div>
        </div>

        <div className="form-grid two no-print">
          <div className="form-row">
            <label>Ledger Account</label>
            <select
              className="select"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
            >
              <option value="">— Select Ledger Account —</option>
              {data.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>From Date</label>
            <input
              className="input"
              type="date"
              value={statementFromDate}
              onChange={(e) => setStatementFromDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>To Date</label>
            <input
              className="input"
              type="date"
              value={statementToDate}
              onChange={(e) => setStatementToDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Clear Filters</label>
            <div className="inline-actions">
              <button
                className="button"
                onClick={() => {
                  setStatementFromDate('');
                  setStatementToDate('');
                }}
              >
                Reset Dates
              </button>
            </div>
          </div>
        </div>

        <div className="panel no-print" style={{ marginBottom: 16 }}>
          <div className="muted">{reportingPeriodText}</div>
        </div>

        {!selectedAccountId ? (
          <div className="muted">Select an account and choose both From Date and To Date to view its ledger statement.</div>
        ) : !isStatementRangeValid ? (
          <div className="panel error-panel">
            Please select both From Date and To Date before viewing or printing the ledger statement.
          </div>
        ) : ledgerStatementQ.isLoading ? (
          <div className="muted">Loading ledger statement...</div>
        ) : ledgerStatementQ.isError || !ledgerStatementQ.data ? (
          <div className="panel error-panel">
            We could not load the ledger statement at this time.
          </div>
        ) : (
          <>
            <div className="print-report-header">
              <div className="print-report-title-block">
                <h2>
                  Ledger Statement — {ledgerStatementQ.data.ledgerAccount.code} - {ledgerStatementQ.data.ledgerAccount.name}
                </h2>
                <div className="muted">{reportingPeriodText}</div>
              </div>
            </div>

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row">
                <span>Account Code</span>
                <span>{ledgerStatementQ.data.ledgerAccount.code}</span>
              </div>
              <div className="kv-row">
                <span>Account Name</span>
                <span>{ledgerStatementQ.data.ledgerAccount.name}</span>
              </div>
              <div className="kv-row">
                <span>Category</span>
                <span>{categoryLabel(ledgerStatementQ.data.ledgerAccount.category)}</span>
              </div>
              <div className="kv-row">
                <span>Normal Balance</span>
                <span>{normalBalanceLabel(ledgerStatementQ.data.ledgerAccount.normalBalance)}</span>
              </div>
              <div className="kv-row">
                <span>Reporting Period</span>
                <span>{reportingPeriodText.replace('Reporting Period: ', '')}</span>
              </div>
              <div className="kv-row">
                <span>Total Debit</span>
                <span>{formatAmount(ledgerStatementQ.data.totalDebit)}</span>
              </div>
              <div className="kv-row">
                <span>Total Credit</span>
                <span>{formatAmount(ledgerStatementQ.data.totalCredit)}</span>
              </div>
              <div className="kv-row">
                <span>Closing Balance (Debit)</span>
                <span>{formatAmount(ledgerStatementQ.data.closingBalanceDebit)}</span>
              </div>
              <div className="kv-row">
                <span>Closing Balance (Credit)</span>
                <span>{formatAmount(ledgerStatementQ.data.closingBalanceCredit)}</span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table report-print-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                    <th style={{ textAlign: 'right' }}>Running Debit</th>
                    <th style={{ textAlign: 'right' }}>Running Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerStatementQ.data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted">
                        No ledger movements were found for the selected account and reporting period.
                      </td>
                    </tr>
                  ) : (
                    ledgerStatementQ.data.items.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDateTime(item.movementDateUtc)}</td>
                        <td>{item.reference}</td>
                        <td>{item.description}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(item.debitAmount)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(item.creditAmount)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(item.runningBalanceDebit)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(item.runningBalanceCredit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Totals</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(ledgerStatementQ.data.totalDebit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(ledgerStatementQ.data.totalCredit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(ledgerStatementQ.data.closingBalanceDebit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(ledgerStatementQ.data.closingBalanceCredit)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

      {showCreate ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create account</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Account Code</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update('code', e.target.value)}
                  placeholder="Enter account code"
                />
              </div>

              <div className="form-row">
                <label>Account Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Enter account name"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Purpose</label>
                <input
                  className="input"
                  value={form.purpose}
                  onChange={(e) => update('purpose', e.target.value)}
                  placeholder="Enter the business purpose of this account"
                />
              </div>

              <div className="form-row">
                <label>Category</label>
                <select
                  className="select"
                  value={form.category}
                  onChange={(e) => update('category', Number(e.target.value))}
                >
                  <option value={1}>Asset</option>
                  <option value={2}>Liability</option>
                  <option value={3}>Equity</option>
                  <option value={4}>Income</option>
                  <option value={5}>Expense</option>
                </select>
              </div>

              <div className="form-row">
                <label>Normal Balance</label>
                <select
                  className="select"
                  value={form.normalBalance}
                  onChange={(e) => update('normalBalance', Number(e.target.value))}
                >
                  <option value={1}>Debit</option>
                  <option value={2}>Credit</option>
                </select>
              </div>

              <div className="form-row">
                <label>Parent Account</label>
                <select
                  className="select"
                  value={form.parentLedgerAccountId}
                  onChange={(e) => update('parentLedgerAccountId', e.target.value)}
                >
                  <option value="">— No Parent Account —</option>
                  {headerAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Account Options</label>
                <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.isHeader}
                      onChange={(e) => {
                        const isHeader = e.target.checked;
                        update('isHeader', isHeader);
                        if (isHeader) {
                          update('isPostingAllowed', false);
                          update('isCashOrBankAccount', false);
                        }
                      }}
                    />
                    Header account
                  </label>

                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.isPostingAllowed}
                      disabled={form.isHeader}
                      onChange={(e) => update('isPostingAllowed', e.target.checked)}
                    />
                    Allow posting
                  </label>

                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.isCashOrBankAccount}
                      disabled={form.isHeader}
                      onChange={(e) => update('isCashOrBankAccount', e.target.checked)}
                    />
                    Cash / Bank account
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={createMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEdit ? (
        <div className="modal-backdrop" onMouseDown={closeEditModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit account</h2>
              <button className="button ghost" onClick={closeEditModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Account Code</label>
                <input
                  className="input"
                  value={editForm.code}
                  disabled
                />
              </div>

              <div className="form-row">
                <label>Account Name</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={(e) => updateEdit('name', e.target.value)}
                  placeholder="Enter account name"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Purpose</label>
                <input
                  className="input"
                  value={editForm.purpose}
                  onChange={(e) => updateEdit('purpose', e.target.value)}
                  placeholder="Enter the business purpose of this account"
                />
              </div>

              <div className="form-row">
                <label>Status</label>
                <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => updateEdit('isActive', e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="form-row">
                <label>Treasury Classification</label>
                <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={editForm.isCashOrBankAccount}
                      disabled={editForm.isHeader}
                      onChange={(e) => updateEdit('isCashOrBankAccount', e.target.checked)}
                    />
                    Cash / Bank account
                  </label>
                </div>
                {editForm.isHeader ? (
                  <div className="muted" style={{ marginTop: 8 }}>
                    Header accounts cannot be marked as Cash / Bank accounts.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeEditModal} disabled={editMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitEdit} disabled={editMut.isPending}>
                {editMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateTaxCode ? (
        <div className="modal-backdrop" onMouseDown={closeTaxCodeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create tax code</h2>
              <button className="button ghost" onClick={closeTaxCodeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Tax Code</label>
                <input
                  className="input"
                  value={taxCodeForm.code}
                  onChange={(e) => updateTaxCodeForm('code', e.target.value)}
                  placeholder="Example: VAT7.5"
                />
              </div>

              <div className="form-row">
                <label>Tax Name</label>
                <input
                  className="input"
                  value={taxCodeForm.name}
                  onChange={(e) => updateTaxCodeForm('name', e.target.value)}
                  placeholder="Example: VAT 7.5%"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="input"
                  value={taxCodeForm.description}
                  onChange={(e) => updateTaxCodeForm('description', e.target.value)}
                  placeholder="Optional description"
                />
              </div>

              <div className="form-row">
                <label>Tax Kind</label>
                <select
                  className="select"
                  value={taxCodeForm.componentKind}
                  onChange={(e) => updateTaxCodeForm('componentKind', Number(e.target.value))}
                >
                  <option value={1}>VAT</option>
                  <option value={2}>WHT</option>
                  <option value={3}>Other</option>
                </select>
              </div>

              <div className="form-row">
                <label>Application Mode</label>
                <select
                  className="select"
                  value={taxCodeForm.applicationMode}
                  onChange={(e) => updateTaxCodeForm('applicationMode', Number(e.target.value))}
                >
                  <option value={1}>Add to Amount</option>
                  <option value={2}>Deduct from Amount</option>
                </select>
              </div>

              <div className="form-row">
                <label>Transaction Scope</label>
                <select
                  className="select"
                  value={taxCodeForm.transactionScope}
                  onChange={(e) => updateTaxCodeForm('transactionScope', Number(e.target.value))}
                >
                  <option value={1}>Sales</option>
                  <option value={2}>Purchases</option>
                  <option value={3}>Both</option>
                </select>
              </div>

              <div className="form-row">
                <label>Rate Percent</label>
                <input
                  className="input"
                  type="number"
                  step="0.0001"
                  value={taxCodeForm.ratePercent}
                  onChange={(e) => updateTaxCodeForm('ratePercent', e.target.value)}
                  placeholder="Example: 7.5"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Tax Ledger Account</label>
                <select
                  className="select"
                  value={taxCodeForm.taxLedgerAccountId}
                  onChange={(e) => updateTaxCodeForm('taxLedgerAccountId', e.target.value)}
                >
                  <option value="">— Select Tax Ledger Account —</option>
                  {postingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Effective From</label>
                <input
                  className="input"
                  type="date"
                  value={taxCodeForm.effectiveFromDate}
                  onChange={(e) => updateTaxCodeForm('effectiveFromDate', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Effective To</label>
                <input
                  className="input"
                  type="date"
                  value={taxCodeForm.effectiveToDate}
                  onChange={(e) => updateTaxCodeForm('effectiveToDate', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Status</label>
                <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={taxCodeForm.isActive}
                    onChange={(e) => updateTaxCodeForm('isActive', e.target.checked)}
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeTaxCodeModal} disabled={createTaxCodeMut.isPending}>
                Cancel
              </button>
              <button className="button primary" onClick={submitTaxCode} disabled={createTaxCodeMut.isPending}>
                {createTaxCodeMut.isPending ? 'Creating…' : 'Create Tax Code'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}