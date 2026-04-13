import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createLedgerAccount,
  getAccounts,
  getCompanyLogoDataUrl,
  getLedgerAccountStatement,
  getTenantKey,
  getTenantLogoDataUrl,
  getTenantReadableError,
  type LedgerAccountDto,
  type LedgerAccountStatementResponse,
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

export function AccountsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isUploading, setIsUploading] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');

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

  const headerAccounts = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((x) => x.isHeader).sort((a, b) => a.code.localeCompare(b.code));
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
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

  if (isLoading) {
    return <div className="panel">Loading chart of accounts...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">We could not load the chart of accounts at this time.</div>;
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
          <h2>Account listing</h2>
          <span className="muted">{data.count} account(s)</span>
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
                <th>Treasury</th>
                <th>Parent Account</th>
                <th style={{ width: 140 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: LedgerAccountDto) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.purpose || '—'}</td>
                  <td>{categoryLabel(item.category)}</td>
                  <td>{normalBalanceLabel(item.normalBalance)}</td>
                  <td>{formatStatus(item.isHeader, 'Header', 'Posting Account')}</td>
                  <td>{formatStatus(item.isPostingAllowed, 'Enabled', 'Not Enabled')}</td>
                  <td>{formatStatus(item.isCashOrBankAccount, 'Cash/Bank', 'Standard')}</td>
                  <td>{item.parentCode ? `${item.parentCode} - ${item.parentName}` : '—'}</td>
                  <td>
                    <button
                      className="button"
                      onClick={() => setSelectedAccountId(item.id)}
                    >
                      Drill Down
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
    </div>
  );
}