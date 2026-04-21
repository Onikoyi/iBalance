import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBankReconciliation,
  completeBankReconciliation,
  createApiPlaceholderBankStatementImport,
  createBankReconciliation,
  createBankReconciliationMatch,
  getBalanceSheet,
  getBankReconciliationDetail,
  getBankReconciliations,
  getBankStatementImportDetail,
  getBankStatementImports,
  getCashbook,
  getCashbookSummary,
  getCompanyLogoDataUrl,
  getCustomerReceipts,
  getIncomeStatement,
  getPurchaseInvoices,
  getSalesInvoices,
  getTaxReport,
  getTenantKey,
  getTenantLogoDataUrl,
  getTrialBalance,
  getVendorPayments,
  removeBankReconciliationMatch,
  setBankReconciliationLineReconciledState,
  uploadBankStatementImport,
} from '../lib/api';
import { canViewReports } from '../lib/auth';

function toUtcStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toUtcEnd(date: string) {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatDisplayDate(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
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

function buildAsAtText(asAtDate: string) {
  return `As At: ${formatDisplayDate(`${asAtDate}T00:00:00`)}`;
}

function buildBankStatementTemplateCsv() {
  const headers = [
    'TransactionDate',
    'ValueDate',
    'Reference',
    'Description',
    'DebitAmount',
    'CreditAmount',
    'Balance',
    'ExternalReference',
  ];

  const rows = [
    ['2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'BNK-0001', 'Opening balance carried forward', '0', '0', '150000.00', 'EXT-001'],
    ['2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z', 'BNK-0002', 'Customer transfer received', '0', '25000.00', '175000.00', 'EXT-002'],
    ['2026-01-04T00:00:00.000Z', '2026-01-04T00:00:00.000Z', 'BNK-0003', 'Supplier payment issued', '10000.00', '0', '165000.00', 'EXT-003'],
  ];

  return [headers, ...rows]
    .map((row) => row.map((cell) => {
      const value = String(cell);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replaceAll('"', '""')}"`;
      }
      return value;
    }).join(','))
    .join('\n');
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

function invoiceStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Posted';
    case 5: return 'Part Paid';
    case 6: return 'Paid';
    case 7: return 'Rejected';
    case 8: return 'Cancelled';
    default: return 'Unknown';
  }
}

function receiptStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Posted';
    case 6: return 'Cancelled';
    default: return 'Unknown';
  }
}

function purchaseInvoiceStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Posted';
    case 5: return 'Part Paid';
    case 6: return 'Paid';
    case 7: return 'Rejected';
    case 8: return 'Cancelled';
    default: return 'Unknown';
  }
}

function vendorPaymentStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Posted';
    case 6: return 'Cancelled';
    default: return 'Unknown';
  }
}


function reconciliationStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Completed';
    case 3: return 'Cancelled';
    default: return 'Unknown';
  }
}

function statementSourceTypeLabel(value: number) {
  switch (value) {
    case 1: return 'Upload';
    case 2: return 'API Feed';
    default: return 'Unknown';
  }
}

function callOverReadinessLabel(score: number) {
  if (score >= 100) return 'Fully Aligned';
  if (score >= 75) return 'Mostly Ready';
  if (score >= 50) return 'Partially Ready';
  if (score >= 25) return 'Started';
  return 'Not Ready';
}

function LogoSlot({
  dataUrl,
  fallbackText,
}: {
  dataUrl: string;
  fallbackText: string;
}) {
  if (dataUrl) {
    return (
      <img
        src={dataUrl}
        alt={fallbackText}
        style={{ height: 42, maxWidth: 180, objectFit: 'contain' }}
      />
    );
  }

  return (
    <div className="print-logo-fallback">
      {fallbackText}
    </div>
  );
}

type ReportHeaderProps = {
  title: string;
  subtitle: string;
};

function ReportPrintHeader({ title, subtitle }: ReportHeaderProps) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  return (
    <div className="print-report-header">
      <div className="print-report-brand-row">
        <div className="print-brand-block">
          <LogoSlot dataUrl={companyLogo} fallbackText="iBalance" />
          <div className="print-brand-meta">
            <strong>Nikosoft Technologies</strong>
            <span>iBalance Accounting Cloud</span>
          </div>
        </div>

        <div className="print-brand-block">
          <LogoSlot dataUrl={tenantLogo} fallbackText="Organization" />
          <div className="print-brand-meta">
            <strong>{tenantKey || 'Organization'}</strong>
            <span>Client Workspace</span>
          </div>
        </div>
      </div>

      <div className="print-report-title-block">
        <h2>{title}</h2>
        <div className="muted">{subtitle}</div>
      </div>
    </div>
  );
}


function ReportSectionDivider({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <section className="panel no-print" style={{ borderLeft: '4px solid rgba(75, 29, 115, 0.35)' }}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <div className="muted">{subtitle}</div>
        </div>
      </div>
    </section>
  );
}

function buildStandaloneHtml(args: {
  title: string;
  subtitle: string;
  bodyHtml: string;
}) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:42px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${fallback}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${args.title}</title>
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

    .print-report-brand-row {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .print-brand-block {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .print-brand-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .print-brand-meta strong {
      font-size: 15px;
    }

    .print-brand-meta span {
      font-size: 12px;
      color: #6b7280;
    }

    .print-report-title-block {
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 12px;
    }

    .print-report-title-block h2 {
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
      margin-bottom: 16px;
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

    .report-block {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .report-block h3 {
      margin: 0 0 12px 0;
    }

    .report-line {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }

    .report-line:last-child {
      border-bottom: none;
    }

    .report-totals {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-weight: 600;
    }

    .table-wrap {
      overflow: visible;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    .data-table th,
    .data-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
      vertical-align: top;
    }

    .data-table tfoot th,
    .data-table tfoot td {
      border-top: 1px solid #d1d5db;
      border-bottom: none;
      font-weight: 700;
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
    <div class="print-report-brand-row">
      <div class="print-brand-block">
        ${logoOrFallback(companyLogo, 'iBalance')}
        <div class="print-brand-meta">
          <strong>Nikosoft Technologies</strong>
          <span>iBalance Accounting Cloud</span>
        </div>
      </div>

      <div class="print-brand-block">
        ${logoOrFallback(tenantLogo, 'Org')}
        <div class="print-brand-meta">
          <strong>${tenantKey || 'Organization'}</strong>
          <span>Client Workspace</span>
        </div>
      </div>
    </div>

    <div class="print-report-title-block">
      <h2>${args.title}</h2>
      <div class="muted">${args.subtitle}</div>
    </div>

    ${args.bodyHtml}
  </div>
</body>
</html>`;
}


function buildReconciliationReportHtml(args: {
  tenantKey: string;
  tenantLogo: string;
  companyLogo: string;
  reconciliation: {
    id: string;
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
  metrics: {
    totalLines: number;
    reconciledLines: number;
    unreconciledLines: number;
    reconciledAmount: number;
    unreconciledAmount: number;
    reconciledLinePercentage: number;
    reconciledAmountPercentage: number;
  };
  items: Array<{
    id: string;
    movementDateUtc: string;
    reference: string;
    description: string;
    debitAmount: number;
    creditAmount: number;
    isReconciled: boolean;
    notes?: string | null;
  }>;
}) {
  const {
    tenantKey,
    tenantLogo,
    companyLogo,
    reconciliation,
    metrics,
    items,
  } = args;

  const logoOrFallback = (src: string, fallback: string) =>
    src
      ? `<img src="${src}" alt="${fallback}" style="height:42px;max-width:180px;object-fit:contain;" />`
      : `<div style="min-width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${fallback}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bank Reconciliation Report</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      margin: 0;
      padding: 24px;
      background: #ffffff;
    }
    .page {
      max-width: 1200px;
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
      margin-bottom: 16px;
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
    th, td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
      vertical-align: top;
    }
    th {
      text-align: left;
      border-bottom: 1px solid #d1d5db;
    }
    .right {
      text-align: right;
    }
    .yes {
      color: #065f46;
      font-weight: 600;
    }
    .no {
      color: #92400e;
      font-weight: 600;
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
      <h1>Bank Reconciliation Report</h1>
      <div class="muted">${reconciliation.ledgerAccountCode || ''} - ${reconciliation.ledgerAccountName || ''}</div>
      <div class="muted">
        Statement Period: ${new Date(reconciliation.statementFromUtc).toLocaleString()} to ${new Date(reconciliation.statementToUtc).toLocaleString()}
      </div>
    </div>

    <div class="kv">
      <div class="kv-row"><span>Status</span><span>${reconciliationStatusLabel(reconciliation.status)}</span></div>
      <div class="kv-row"><span>Statement Closing Balance</span><span>${formatAmount(reconciliation.statementClosingBalance)}</span></div>
      <div class="kv-row"><span>Book Closing Balance</span><span>${formatAmount(reconciliation.bookClosingBalance)}</span></div>
      <div class="kv-row"><span>Difference</span><span>${formatAmount(reconciliation.differenceAmount)}</span></div>
      <div class="kv-row"><span>Notes</span><span>${reconciliation.notes || '—'}</span></div>
      <div class="kv-row"><span>Completed On</span><span>${formatDateTime(reconciliation.completedOnUtc || null)}</span></div>
      <div class="kv-row"><span>Cancelled On</span><span>${formatDateTime(reconciliation.cancelledOnUtc || null)}</span></div>
    </div>

    <div class="kv">
      <div class="kv-row"><span>Total Lines</span><span>${metrics.totalLines}</span></div>
      <div class="kv-row"><span>Reconciled Lines</span><span>${metrics.reconciledLines}</span></div>
      <div class="kv-row"><span>Unreconciled Lines</span><span>${metrics.unreconciledLines}</span></div>
      <div class="kv-row"><span>Reconciled Amount</span><span>${formatAmount(metrics.reconciledAmount)}</span></div>
      <div class="kv-row"><span>Unreconciled Amount</span><span>${formatAmount(metrics.unreconciledAmount)}</span></div>
      <div class="kv-row"><span>Reconciled Lines %</span><span>${formatPercentage(metrics.reconciledLinePercentage)}</span></div>
      <div class="kv-row"><span>Reconciled Amount %</span><span>${formatPercentage(metrics.reconciledAmountPercentage)}</span></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Reference</th>
          <th>Description</th>
          <th class="right">Debit</th>
          <th class="right">Credit</th>
          <th>Reconciled</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${items.length === 0
          ? `<tr><td colspan="7" class="muted">No reconciliation lines available.</td></tr>`
          : items.map((item) => `
            <tr>
              <td>${formatDateTime(item.movementDateUtc)}</td>
              <td>${item.reference}</td>
              <td>${item.description}</td>
              <td class="right">${formatAmount(item.debitAmount)}</td>
              <td class="right">${formatAmount(item.creditAmount)}</td>
              <td class="${item.isReconciled ? 'yes' : 'no'}">${item.isReconciled ? 'Yes' : 'No'}</td>
              <td>${item.notes || '—'}</td>
            </tr>
          `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function ReportsPage() {
  const today = new Date();
  const defaultToDate = today.toISOString().slice(0, 10);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultFromDate = new Date(
    Date.UTC(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate())
  ).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [balanceSheetAsAtDate, setBalanceSheetAsAtDate] = useState(defaultToDate);
  const [cashbookLedgerAccountId, setCashbookLedgerAccountId] = useState('');
  const [reconciliationLedgerAccountId, setReconciliationLedgerAccountId] = useState('');
  const [taxReportComponentKind, setTaxReportComponentKind] = useState('all');
  const [taxReportTransactionScope, setTaxReportTransactionScope] = useState('all');
  const [statementClosingBalance, setStatementClosingBalance] = useState('');
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [selectedReconciliationId, setSelectedReconciliationId] = useState('');
  const [reconciliationLineFilter, setReconciliationLineFilter] = useState('all');
  const [statementImportLedgerAccountId, setStatementImportLedgerAccountId] = useState('');
  const [statementSourceReference, setStatementSourceReference] = useState('');
  const [statementImportNotes, setStatementImportNotes] = useState('');
  const [selectedStatementImportId, setSelectedStatementImportId] = useState('');
  const [callOverStatementSearch, setCallOverStatementSearch] = useState('');
  const [callOverBookSearch, setCallOverBookSearch] = useState('');
  const [apiPlaceholderReference, setApiPlaceholderReference] = useState('');
  const [selectedStatementLineId, setSelectedStatementLineId] = useState('');
  const [selectedBookLineId, setSelectedBookLineId] = useState('');
  const [matchNotes, setMatchNotes] = useState('');
  const qc = useQueryClient();

  const canView = canViewReports();

  const isPeriodRangeValid = !!fromDate && !!toDate;
  const periodText = buildReportingPeriodText(fromDate, toDate);
  const asAtText = buildAsAtText(balanceSheetAsAtDate);

  const fromUtc = isPeriodRangeValid ? toUtcStart(fromDate) : undefined;
  const toUtc = isPeriodRangeValid ? toUtcEnd(toDate) : undefined;

  const trialBalance = useQuery({
    queryKey: ['trial-balance', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getTrialBalance(fromUtc, toUtc),
    enabled: canView && isPeriodRangeValid,
  });

  const balanceSheet = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: () => getBalanceSheet(),
    enabled: canView,
  });

  const incomeStatement = useQuery({
    queryKey: ['income-statement', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getIncomeStatement(fromUtc, toUtc),
    enabled: canView && isPeriodRangeValid,
  });

  const cashbook = useQuery({
    queryKey: ['cashbook', cashbookLedgerAccountId || null, fromUtc ?? null, toUtc ?? null],
    queryFn: () => getCashbook(cashbookLedgerAccountId || null, fromUtc, toUtc),
    enabled: canView && isPeriodRangeValid,
  });

  const cashbookSummary = useQuery({
    queryKey: ['cashbook-summary', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getCashbookSummary(fromUtc, toUtc),
    enabled: canView && isPeriodRangeValid,
  });


  const taxReportQ = useQuery({
    queryKey: [
      'tax-report',
      fromUtc ?? null,
      toUtc ?? null,
      taxReportComponentKind,
      taxReportTransactionScope,
    ],
    queryFn: () =>
      getTaxReport(
        fromUtc,
        toUtc,
        taxReportComponentKind === 'all' ? null : Number(taxReportComponentKind),
        taxReportTransactionScope === 'all' ? null : Number(taxReportTransactionScope)
      ),
    enabled: canView && isPeriodRangeValid,
  });

  const bankReconciliationsQ = useQuery({
    queryKey: ['bank-reconciliations', reconciliationLedgerAccountId || null],
    queryFn: () => getBankReconciliations(reconciliationLedgerAccountId || null),
    enabled: canView,
  });

  const bankReconciliationDetailQ = useQuery({
    queryKey: ['bank-reconciliation-detail', selectedReconciliationId || null],
    queryFn: () => getBankReconciliationDetail(selectedReconciliationId),
    enabled: canView && !!selectedReconciliationId,
  });


  const bankStatementImportsQ = useQuery({
    queryKey: ['bank-statement-imports', statementImportLedgerAccountId || null],
    queryFn: () => getBankStatementImports(statementImportLedgerAccountId || null),
    enabled: canView,
  });

  const bankStatementImportDetailQ = useQuery({
    queryKey: ['bank-statement-import-detail', selectedStatementImportId || null],
    queryFn: () => getBankStatementImportDetail(selectedStatementImportId),
    enabled: canView && !!selectedStatementImportId,
  });


  const createReconciliationMut = useMutation({
    mutationFn: createBankReconciliation,
    onSuccess: async (result: any) => {
      await qc.invalidateQueries({ queryKey: ['bank-reconciliations'] });
      const createdId = result?.id || result?.Id;
      if (createdId) {
        setSelectedReconciliationId(createdId);
      }
      setReconciliationNotes('');
    },
  });


  const updateReconciliationLineMut = useMutation({
    mutationFn: ({
      bankReconciliationId,
      bankReconciliationLineId,
      payload,
    }: {
      bankReconciliationId: string;
      bankReconciliationLineId: string;
      payload: { isReconciled: boolean; notes?: string | null };
    }) =>
      setBankReconciliationLineReconciledState(
        bankReconciliationId,
        bankReconciliationLineId,
        payload
      ),
    onSuccess: async () => {
      if (selectedReconciliationId) {
        await qc.invalidateQueries({
          queryKey: ['bank-reconciliation-detail', selectedReconciliationId],
        });
        await qc.invalidateQueries({
          queryKey: ['bank-reconciliations'],
        });
      }
    },
  });


  const completeReconciliationMut = useMutation({
    mutationFn: completeBankReconciliation,
    onSuccess: async () => {
      if (selectedReconciliationId) {
        await qc.invalidateQueries({
          queryKey: ['bank-reconciliation-detail', selectedReconciliationId],
        });
      }
      await qc.invalidateQueries({
        queryKey: ['bank-reconciliations'],
      });
    },
  });

  const cancelReconciliationMut = useMutation({
    mutationFn: cancelBankReconciliation,
    onSuccess: async () => {
      if (selectedReconciliationId) {
        await qc.invalidateQueries({
          queryKey: ['bank-reconciliation-detail', selectedReconciliationId],
        });
      }
      await qc.invalidateQueries({
        queryKey: ['bank-reconciliations'],
      });
    },
  });


  const uploadStatementImportMut = useMutation({
    mutationFn: uploadBankStatementImport,
    onSuccess: async (result: any) => {
      await qc.invalidateQueries({ queryKey: ['bank-statement-imports'] });
      const createdId = result?.id || result?.Id;
      if (createdId) {
        setSelectedStatementImportId(createdId);
      }
      setStatementImportNotes('');
    },
  });

  const createApiPlaceholderImportMut = useMutation({
    mutationFn: createApiPlaceholderBankStatementImport,
    onSuccess: async (result: any) => {
      await qc.invalidateQueries({ queryKey: ['bank-statement-imports'] });
      const createdId = result?.id || result?.Id;
      if (createdId) {
        setSelectedStatementImportId(createdId);
      }
    },
  });


  const createMatchMut = useMutation({
    mutationFn: ({
      bankReconciliationId,
      payload,
    }: {
      bankReconciliationId: string;
      payload: {
        bankReconciliationLineId: string;
        bankStatementImportLineId: string;
        notes?: string | null;
      };
    }) => createBankReconciliationMatch(bankReconciliationId, payload),
    onSuccess: async () => {
      if (selectedReconciliationId) {
        await qc.invalidateQueries({
          queryKey: ['bank-reconciliation-detail', selectedReconciliationId],
        });
      }
      if (selectedStatementImportId) {
        await qc.invalidateQueries({
          queryKey: ['bank-statement-import-detail', selectedStatementImportId],
        });
      }
      await qc.invalidateQueries({ queryKey: ['bank-reconciliations'] });
      setSelectedStatementLineId('');
      setSelectedBookLineId('');
      setMatchNotes('');
    },
  });

  const removeMatchMut = useMutation({
    mutationFn: ({
      bankReconciliationId,
      bankReconciliationMatchId,
    }: {
      bankReconciliationId: string;
      bankReconciliationMatchId: string;
    }) => removeBankReconciliationMatch(bankReconciliationId, bankReconciliationMatchId),
    onSuccess: async () => {
      if (selectedReconciliationId) {
        await qc.invalidateQueries({
          queryKey: ['bank-reconciliation-detail', selectedReconciliationId],
        });
      }
      if (selectedStatementImportId) {
        await qc.invalidateQueries({
          queryKey: ['bank-statement-import-detail', selectedStatementImportId],
        });
      }
      await qc.invalidateQueries({ queryKey: ['bank-reconciliations'] });
    },
  });

  const salesInvoicesQ = useQuery({
    queryKey: ['ar-sales-invoices'],
    queryFn: getSalesInvoices,
    enabled: canView,
  });

  const customerReceiptsQ = useQuery({
    queryKey: ['ar-customer-receipts'],
    queryFn: getCustomerReceipts,
    enabled: canView,
  });

  const purchaseInvoicesQ = useQuery({
    queryKey: ['ap-purchase-invoices'],
    queryFn: getPurchaseInvoices,
    enabled: canView,
  });

  const vendorPaymentsQ = useQuery({
    queryKey: ['ap-vendor-payments'],
    queryFn: getVendorPayments,
    enabled: canView,
  });

  const filteredSalesInvoices = useMemo(() => {
    const items = salesInvoicesQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const invoiceDate = new Date(item.invoiceDateUtc).getTime();
      return invoiceDate >= from && invoiceDate <= to;
    });
  }, [salesInvoicesQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const filteredCustomerReceipts = useMemo(() => {
    const items = customerReceiptsQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const receiptDate = new Date(item.receiptDateUtc).getTime();
      return receiptDate >= from && receiptDate <= to;
    });
  }, [customerReceiptsQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const filteredPurchaseInvoices = useMemo(() => {
    const items = purchaseInvoicesQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const invoiceDate = new Date(item.invoiceDateUtc).getTime();
      return invoiceDate >= from && invoiceDate <= to;
    });
  }, [purchaseInvoicesQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const filteredVendorPayments = useMemo(() => {
    const items = vendorPaymentsQ.data?.items || [];
    if (!isPeriodRangeValid) return [];

    const from = new Date(`${fromDate}T00:00:00`).getTime();
    const to = new Date(`${toDate}T23:59:59`).getTime();

    return items.filter((item) => {
      const paymentDate = new Date(item.paymentDateUtc).getTime();
      return paymentDate >= from && paymentDate <= to;
    });
  }, [vendorPaymentsQ.data?.items, fromDate, toDate, isPeriodRangeValid]);

  const arSummary = useMemo(() => {
    const invoices = filteredSalesInvoices;
    const receipts = filteredCustomerReceipts;

    return {
      totalInvoices: invoices.length,
      totalInvoiced: invoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
      totalCollected: invoices.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0),
      totalOutstanding: invoices.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0),
      draftInvoiceCount: invoices.filter((item) => item.status === 1).length,
      submittedInvoiceCount: invoices.filter((item) => item.status === 2).length,
      approvedInvoiceCount: invoices.filter((item) => item.status === 3).length,
      postedInvoiceCount: invoices.filter((item) => item.status === 4).length,
      partPaidInvoiceCount: invoices.filter((item) => item.status === 5).length,
      paidInvoiceCount: invoices.filter((item) => item.status === 6).length,
      rejectedInvoiceCount: invoices.filter((item) => item.status === 7).length,
      cancelledInvoiceCount: invoices.filter((item) => item.status === 8).length,
      totalReceipts: receipts.length,
      totalReceiptAmount: receipts.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      draftReceiptCount: receipts.filter((item) => item.status === 1).length,
      submittedReceiptCount: receipts.filter((item) => item.status === 2).length,
      approvedReceiptCount: receipts.filter((item) => item.status === 3).length,
      rejectedReceiptCount: receipts.filter((item) => item.status === 4).length,
      postedReceiptCount: receipts.filter((item) => item.status === 5).length,
      cancelledReceiptCount: receipts.filter((item) => item.status === 6).length,
    };
  }, [filteredSalesInvoices, filteredCustomerReceipts]);

  const apSummary = useMemo(() => {
    const invoices = filteredPurchaseInvoices;
    const payments = filteredVendorPayments;

    return {
      totalInvoices: invoices.length,
      totalInvoiced: invoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
      totalPaid: invoices.reduce((sum, item) => sum + Number(item.amountPaid || 0), 0),
      totalOutstanding: invoices.reduce((sum, item) => sum + Number(item.balanceAmount || 0), 0),
      draftInvoiceCount: invoices.filter((item) => item.status === 1).length,
      submittedInvoiceCount: invoices.filter((item) => item.status === 2).length,
      approvedInvoiceCount: invoices.filter((item) => item.status === 3).length,
      postedInvoiceCount: invoices.filter((item) => item.status === 4).length,
      partPaidInvoiceCount: invoices.filter((item) => item.status === 5).length,
      paidInvoiceCount: invoices.filter((item) => item.status === 6).length,
      rejectedInvoiceCount: invoices.filter((item) => item.status === 7).length,
      cancelledInvoiceCount: invoices.filter((item) => item.status === 8).length,
      totalPayments: payments.length,
      totalPaymentAmount: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      draftPaymentCount: payments.filter((item) => item.status === 1).length,
      submittedPaymentCount: payments.filter((item) => item.status === 2).length,
      approvedPaymentCount: payments.filter((item) => item.status === 3).length,
      rejectedPaymentCount: payments.filter((item) => item.status === 4).length,
      postedPaymentCount: payments.filter((item) => item.status === 5).length,
      cancelledPaymentCount: payments.filter((item) => item.status === 6).length,
    };
  }, [filteredPurchaseInvoices, filteredVendorPayments]);


  const reconciliationMetrics = useMemo(() => {
    const detail = bankReconciliationDetailQ.data;

    if (!detail) {
      return {
        totalLines: 0,
        reconciledLines: 0,
        unreconciledLines: 0,
        reconciledAmount: 0,
        unreconciledAmount: 0,
        reconciledDebit: 0,
        reconciledCredit: 0,
        unreconciledDebit: 0,
        unreconciledCredit: 0,
        reconciledLinePercentage: 0,
        reconciledAmountPercentage: 0,
      };
    }

    const absoluteAmount = (debitAmount: number, creditAmount: number) =>
      Math.abs(Number(debitAmount || 0) - Number(creditAmount || 0));

    const reconciledItems = detail.items.filter((x) => x.isReconciled);
    const unreconciledItems = detail.items.filter((x) => !x.isReconciled);

    const reconciledAmount = reconciledItems.reduce(
      (sum, item) => sum + absoluteAmount(item.debitAmount, item.creditAmount),
      0
    );

    const unreconciledAmount = unreconciledItems.reduce(
      (sum, item) => sum + absoluteAmount(item.debitAmount, item.creditAmount),
      0
    );

    const totalAmount = reconciledAmount + unreconciledAmount;
    const totalLines = detail.count;
    const reconciledLines = detail.reconciledCount;
    const unreconciledLines = detail.unreconciledCount;

    return {
      totalLines,
      reconciledLines,
      unreconciledLines,
      reconciledAmount,
      unreconciledAmount,
      reconciledDebit: reconciledItems.reduce((sum, item) => sum + Number(item.debitAmount || 0), 0),
      reconciledCredit: reconciledItems.reduce((sum, item) => sum + Number(item.creditAmount || 0), 0),
      unreconciledDebit: unreconciledItems.reduce((sum, item) => sum + Number(item.debitAmount || 0), 0),
      unreconciledCredit: unreconciledItems.reduce((sum, item) => sum + Number(item.creditAmount || 0), 0),
      reconciledLinePercentage: totalLines > 0 ? (reconciledLines / totalLines) * 100 : 0,
      reconciledAmountPercentage: totalAmount > 0 ? (reconciledAmount / totalAmount) * 100 : 0,
    };
  }, [bankReconciliationDetailQ.data]);


  const filteredReconciliationLines = useMemo(() => {
    const detail = bankReconciliationDetailQ.data;
    if (!detail) return [];

    switch (reconciliationLineFilter) {
      case 'reconciled':
        return detail.items.filter((x) => x.isReconciled);
      case 'unreconciled':
        return detail.items.filter((x) => !x.isReconciled);
      default:
        return detail.items;
    }
  }, [bankReconciliationDetailQ.data, reconciliationLineFilter]);



  const filteredStatementLines = useMemo(() => {
    const detail = bankStatementImportDetailQ.data;
    if (!detail) return [];

    const search = callOverStatementSearch.trim().toLowerCase();

    return detail.items.filter((item) => {
      if (!search) return true;

      return (
        item.reference.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search) ||
        (item.externalReference || '').toLowerCase().includes(search)
      );
    });
  }, [bankStatementImportDetailQ.data, callOverStatementSearch]);

  const filteredBookLines = useMemo(() => {
    const detail = bankReconciliationDetailQ.data;
    if (!detail) return [];

    const baseItems = (() => {
      switch (reconciliationLineFilter) {
        case 'reconciled':
          return detail.items.filter((x) => x.isReconciled);
        case 'unreconciled':
          return detail.items.filter((x) => !x.isReconciled);
        default:
          return detail.items;
      }
    })();

    const search = callOverBookSearch.trim().toLowerCase();

    return baseItems.filter((item) => {
      if (!search) return true;

      return (
        item.reference.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      );
    });
  }, [bankReconciliationDetailQ.data, reconciliationLineFilter, callOverBookSearch]);


  const callOverReadiness = useMemo(() => {
    const statementDetail = bankStatementImportDetailQ.data;
    const reconciliationDetail = bankReconciliationDetailQ.data;

    const statementAccountId = statementDetail?.bankStatementImport.ledgerAccountId || null;
    const reconciliationAccountId = reconciliationDetail?.reconciliation.ledgerAccountId || null;

    const statementFrom = statementDetail?.bankStatementImport.statementFromUtc || null;
    const statementTo = statementDetail?.bankStatementImport.statementToUtc || null;

    const reconciliationFrom = reconciliationDetail?.reconciliation.statementFromUtc || null;
    const reconciliationTo = reconciliationDetail?.reconciliation.statementToUtc || null;

    const accountAligned =
      !!statementAccountId &&
      !!reconciliationAccountId &&
      statementAccountId === reconciliationAccountId;

    const periodAligned =
      !!statementFrom &&
      !!statementTo &&
      !!reconciliationFrom &&
      !!reconciliationTo &&
      statementFrom === reconciliationFrom &&
      statementTo === reconciliationTo;

    const statementLineCount = statementDetail?.count ?? 0;
    const bookLineCount = reconciliationDetail?.count ?? 0;
    const reconciledCount = reconciliationDetail?.reconciledCount ?? 0;
    const unreconciledCount = reconciliationDetail?.unreconciledCount ?? 0;

    const statementNetAmount = statementDetail
      ? Math.abs((statementDetail.totalCredit || 0) - (statementDetail.totalDebit || 0))
      : 0;

    const bookDifferenceAmount = reconciliationDetail
      ? Math.abs(reconciliationDetail.reconciliation.differenceAmount || 0)
      : 0;

    const readinessScore =
      (statementDetail ? 25 : 0) +
      (reconciliationDetail ? 25 : 0) +
      (accountAligned ? 25 : 0) +
      (periodAligned ? 25 : 0);

    return {
      hasStatement: !!statementDetail,
      hasReconciliation: !!reconciliationDetail,
      accountAligned,
      periodAligned,
      statementLineCount,
      bookLineCount,
      reconciledCount,
      unreconciledCount,
      statementNetAmount,
      bookDifferenceAmount,
      readinessScore,
    };
  }, [bankStatementImportDetailQ.data, bankReconciliationDetailQ.data]);

 

  const matchedStatementLineIds = useMemo(() => {
    const statementDetail = bankStatementImportDetailQ.data;
    const reconciliationDetail = bankReconciliationDetailQ.data;

    if (!statementDetail || !reconciliationDetail) return new Set<string>();

    const matchedStatementIds = new Set<string>();

    reconciliationDetail.items.forEach((bookLine) => {
      const note = (bookLine.notes || '').trim();
      if (note.startsWith('MATCH:')) {
        const statementLineId = note.replace('MATCH:', '').trim();
        if (statementLineId) {
          matchedStatementIds.add(statementLineId);
        }
      }
    });

    return matchedStatementIds;
  }, [bankStatementImportDetailQ.data, bankReconciliationDetailQ.data]);

  const selectedStatementLine = useMemo(
    () => filteredStatementLines.find((x) => x.id === selectedStatementLineId) || null,
    [filteredStatementLines, selectedStatementLineId]
  );

  const selectedBookLine = useMemo(
    () => filteredBookLines.find((x) => x.id === selectedBookLineId) || null,
    [filteredBookLines, selectedBookLineId]
  );



  function openStandalonePrint(html: string) {
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

  async function handleCreateReconciliation() {
    if (!reconciliationLedgerAccountId || !fromUtc || !toUtc) {
      return;
    }

    const parsedStatementClosingBalance = Number(statementClosingBalance);

    if (Number.isNaN(parsedStatementClosingBalance)) {
      return;
    }

    await createReconciliationMut.mutateAsync({
      ledgerAccountId: reconciliationLedgerAccountId,
      statementFromUtc: fromUtc,
      statementToUtc: toUtc,
      statementClosingBalance: parsedStatementClosingBalance,
      notes: reconciliationNotes.trim() || null,
    });
  }

  async function handleToggleReconciliationLine(
    bankReconciliationId: string,
    bankReconciliationLineId: string,
    nextValue: boolean,
    existingNotes?: string | null
  ) {
    await updateReconciliationLineMut.mutateAsync({
      bankReconciliationId,
      bankReconciliationLineId,
      payload: {
        isReconciled: nextValue,
        notes: existingNotes || null,
      },
    });
  }


  async function handleCompleteReconciliation(bankReconciliationId: string) {
    await completeReconciliationMut.mutateAsync(bankReconciliationId);
  }

  async function handleCancelReconciliation(bankReconciliationId: string) {
    await cancelReconciliationMut.mutateAsync(bankReconciliationId);
  }


  function downloadBankStatementTemplate() {
    const content = buildBankStatementTemplateCsv();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ibalance-bank-statement-upload-template.csv';
    a.click();

    URL.revokeObjectURL(url);
  }

  async function handleBankStatementUploadFile(file: File | null) {
    if (!file || !statementImportLedgerAccountId || !fromUtc || !toUtc) {
      return;
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error('The selected bank statement file does not contain any line rows.');
    }

    const header = splitCsvLine(lines[0]).map((x) => x.toLowerCase());
    const expected = [
      'transactiondate',
      'valuedate',
      'reference',
      'description',
      'debitamount',
      'creditamount',
      'balance',
      'externalreference',
    ];

    if (expected.some((value, index) => header[index] !== value)) {
      throw new Error('The file format is not valid. Please use the Bank Statement Upload Template.');
    }

    const parsedLines = lines.slice(1).map((line, rowIndex) => {
      const cols = splitCsvLine(line);

      if (cols.length < 8) {
        throw new Error(`Row ${rowIndex + 2}: incomplete statement line data.`);
      }

      const transactionDateUtc = new Date(cols[0]).toISOString();
      const valueDateUtc = cols[1] ? new Date(cols[1]).toISOString() : null;
      const debitAmount = Number(cols[4] || 0);
      const creditAmount = Number(cols[5] || 0);
      const balance = cols[6] ? Number(cols[6]) : null;

      if (Number.isNaN(debitAmount) || Number.isNaN(creditAmount)) {
        throw new Error(`Row ${rowIndex + 2}: invalid debit or credit amount.`);
      }

      if (balance !== null && Number.isNaN(balance)) {
        throw new Error(`Row ${rowIndex + 2}: invalid balance value.`);
      }

      return {
        transactionDateUtc,
        valueDateUtc,
        reference: cols[2],
        description: cols[3],
        debitAmount,
        creditAmount,
        balance,
        externalReference: cols[7] || null,
      };
    });

    await uploadStatementImportMut.mutateAsync({
      ledgerAccountId: statementImportLedgerAccountId,
      statementFromUtc: fromUtc,
      statementToUtc: toUtc,
      sourceReference: statementSourceReference.trim() || null,
      fileName: file.name,
      notes: statementImportNotes.trim() || null,
      lines: parsedLines,
    });
  }

  async function handleCreateApiPlaceholderImport() {
    if (!statementImportLedgerAccountId || !fromUtc || !toUtc || !apiPlaceholderReference.trim()) {
      return;
    }

    await createApiPlaceholderImportMut.mutateAsync({
      ledgerAccountId: statementImportLedgerAccountId,
      statementFromUtc: fromUtc,
      statementToUtc: toUtc,
      sourceReference: apiPlaceholderReference.trim(),
      notes: statementImportNotes.trim() || null,
    });
  }


  function printReconciliationReport() {
    if (!bankReconciliationDetailQ.data) {
      return;
    }

    const html = buildReconciliationReportHtml({
      tenantKey: getTenantKey(),
      tenantLogo: getTenantLogoDataUrl(),
      companyLogo: getCompanyLogoDataUrl(),
      reconciliation: bankReconciliationDetailQ.data.reconciliation,
      metrics: reconciliationMetrics,
      items: bankReconciliationDetailQ.data.items,
    });

    openStandalonePrint(html);
  }


  async function handleCreateMatch() {
    if (!selectedReconciliationId || !selectedStatementLineId || !selectedBookLineId) {
      return;
    }

    await createMatchMut.mutateAsync({
      bankReconciliationId: selectedReconciliationId,
      payload: {
        bankReconciliationLineId: selectedBookLineId,
        bankStatementImportLineId: selectedStatementLineId,
        notes: `MATCH:${selectedStatementLineId}${matchNotes.trim() ? ` | ${matchNotes.trim()}` : ''}`,
      },
    });
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

  async function handleRemoveMatchForBookLine(bookLineId: string, notes?: string | null) {
    if (!selectedReconciliationId || !bankReconciliationDetailQ.data) {
      return;
    }

    const currentLine = bankReconciliationDetailQ.data.items.find((x) => x.id === bookLineId);
    if (!currentLine?.isReconciled) {
      return;
    }

    const noteText = notes || '';
    if (!noteText.startsWith('MATCH:')) {
      return;
    }

    // First version: remove by toggling the book line back to unreconciled if no dedicated match id is exposed yet.
    await updateReconciliationLineMut.mutateAsync({
      bankReconciliationId: selectedReconciliationId,
      bankReconciliationLineId: bookLineId,
      payload: {
        isReconciled: false,
        notes: null,
      },
    });
  }


  function printTrialBalanceStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Accounts Included</span><span>${trialBalance.data?.count ?? 0}</span></div>
        <div class="kv-row"><span>Total Debit</span><span>${formatAmount(trialBalance.data?.totalDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Credit</span><span>${formatAmount(trialBalance.data?.totalCredit ?? 0)}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th class="right">Total Debit</th>
              <th class="right">Total Credit</th>
              <th class="right">Balance Debit</th>
              <th class="right">Balance Credit</th>
            </tr>
          </thead>
          <tbody>
            ${(trialBalance.data?.items ?? []).map((item) => `
              <tr>
                <td>${item.code}</td>
                <td>${item.name}</td>
                <td class="right">${formatAmount(item.totalDebit)}</td>
                <td class="right">${formatAmount(item.totalCredit)}</td>
                <td class="right">${formatAmount(item.balanceDebit)}</td>
                <td class="right">${formatAmount(item.balanceCredit)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2">Total</th>
              <th class="right">${formatAmount(trialBalance.data?.totalDebit ?? 0)}</th>
              <th class="right">${formatAmount(trialBalance.data?.totalCredit ?? 0)}</th>
              <th></th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Trial Balance',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printBalanceSheetStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>As At</span><span>${asAtText.replace('As At: ', '')}</span></div>
        <div class="kv-row"><span>Total Assets</span><span>${formatAmount(balanceSheet.data?.totalAssets ?? 0)}</span></div>
        <div class="kv-row"><span>Total Liabilities</span><span>${formatAmount(balanceSheet.data?.totalLiabilities ?? 0)}</span></div>
        <div class="kv-row"><span>Total Equity</span><span>${formatAmount(balanceSheet.data?.totalEquity ?? 0)}</span></div>
        <div class="kv-row"><span>Total Liabilities and Equity</span><span>${formatAmount(balanceSheet.data?.totalLiabilitiesAndEquity ?? 0)}</span></div>
      </div>

      <div class="report-block">
        <h3>Assets</h3>
        ${(balanceSheet.data?.assets ?? []).length === 0
          ? '<div class="muted">No asset balances available.</div>'
          : (balanceSheet.data?.assets ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.balance ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-block">
        <h3>Liabilities</h3>
        ${(balanceSheet.data?.liabilities ?? []).length === 0
          ? '<div class="muted">No liability balances available.</div>'
          : (balanceSheet.data?.liabilities ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.balance ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-block">
        <h3>Equity</h3>
        ${(balanceSheet.data?.equity ?? []).length === 0
          ? '<div class="muted">No equity balances available.</div>'
          : (balanceSheet.data?.equity ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.balance ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-totals">
        <div>${asAtText}</div>
        <div>Total Assets: ${formatAmount(balanceSheet.data?.totalAssets ?? 0)}</div>
        <div>Total Liabilities: ${formatAmount(balanceSheet.data?.totalLiabilities ?? 0)}</div>
        <div>Total Equity: ${formatAmount(balanceSheet.data?.totalEquity ?? 0)}</div>
        <div>Total Liabilities and Equity: ${formatAmount(balanceSheet.data?.totalLiabilitiesAndEquity ?? 0)}</div>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Balance Sheet',
      subtitle: asAtText,
      bodyHtml,
    }));
  }

  function printIncomeStatementStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Income</span><span>${formatAmount(incomeStatement.data?.totalIncome ?? 0)}</span></div>
        <div class="kv-row"><span>Total Expenses</span><span>${formatAmount(incomeStatement.data?.totalExpenses ?? 0)}</span></div>
        <div class="kv-row"><span>Net Income</span><span>${formatAmount(incomeStatement.data?.netIncome ?? 0)}</span></div>
      </div>

      <div class="report-block">
        <h3>Income</h3>
        ${(incomeStatement.data?.income ?? []).length === 0
          ? '<div class="muted">No income balances available.</div>'
          : (incomeStatement.data?.income ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.amount ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-block">
        <h3>Expenses</h3>
        ${(incomeStatement.data?.expenses ?? []).length === 0
          ? '<div class="muted">No expense balances available.</div>'
          : (incomeStatement.data?.expenses ?? []).map((item) => `
              <div class="report-line">
                <span>${item.code} - ${item.name}</span>
                <strong>${formatAmount(item.amount ?? 0)}</strong>
              </div>
            `).join('')}
      </div>

      <div class="report-totals">
        <div>${periodText}</div>
        <div>Total Income: ${formatAmount(incomeStatement.data?.totalIncome ?? 0)}</div>
        <div>Total Expenses: ${formatAmount(incomeStatement.data?.totalExpenses ?? 0)}</div>
        <div>Net Income: ${formatAmount(incomeStatement.data?.netIncome ?? 0)}</div>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Income Statement',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printCashbookStandalone() {
    const selectedLedgerAccount = cashbook.data?.selectedLedgerAccount;
    const selectedAccountLabel = selectedLedgerAccount
      ? `${selectedLedgerAccount.code} - ${selectedLedgerAccount.name}`
      : 'No treasury account selected';

    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Treasury Account</span><span>${selectedAccountLabel}</span></div>
        <div class="kv-row"><span>Opening Balance (Debit)</span><span>${formatAmount(cashbook.data?.openingBalanceDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Opening Balance (Credit)</span><span>${formatAmount(cashbook.data?.openingBalanceCredit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Debit</span><span>${formatAmount(cashbook.data?.totalDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Credit</span><span>${formatAmount(cashbook.data?.totalCredit ?? 0)}</span></div>
        <div class="kv-row"><span>Closing Balance (Debit)</span><span>${formatAmount(cashbook.data?.closingBalanceDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Closing Balance (Credit)</span><span>${formatAmount(cashbook.data?.closingBalanceCredit ?? 0)}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
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
            ${(cashbook.data?.items ?? []).length === 0
              ? '<tr><td colspan="7" class="muted">No cashbook movements were found for the selected treasury account and reporting period.</td></tr>'
              : (cashbook.data?.items ?? []).map((item) => `
                  <tr>
                    <td>${formatDateTime(item.movementDateUtc)}</td>
                    <td>${item.reference}</td>
                    <td>${item.description}</td>
                    <td class="right">${formatAmount(item.debitAmount)}</td>
                    <td class="right">${formatAmount(item.creditAmount)}</td>
                    <td class="right">${formatAmount(item.runningBalanceDebit)}</td>
                    <td class="right">${formatAmount(item.runningBalanceCredit)}</td>
                  </tr>
                `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="3">Totals</th>
              <th class="right">${formatAmount(cashbook.data?.totalDebit ?? 0)}</th>
              <th class="right">${formatAmount(cashbook.data?.totalCredit ?? 0)}</th>
              <th class="right">${formatAmount(cashbook.data?.closingBalanceDebit ?? 0)}</th>
              <th class="right">${formatAmount(cashbook.data?.closingBalanceCredit ?? 0)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Cashbook',
      subtitle: `${periodText} | ${selectedAccountLabel}`,
      bodyHtml,
    }));
  }

  function printCashbookSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Treasury Accounts</span><span>${cashbookSummary.data?.count ?? 0}</span></div>
        <div class="kv-row"><span>Total Opening Balance (Debit)</span><span>${formatAmount(cashbookSummary.data?.totalOpeningBalanceDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Opening Balance (Credit)</span><span>${formatAmount(cashbookSummary.data?.totalOpeningBalanceCredit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Period Debit</span><span>${formatAmount(cashbookSummary.data?.totalPeriodDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Period Credit</span><span>${formatAmount(cashbookSummary.data?.totalPeriodCredit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Closing Balance (Debit)</span><span>${formatAmount(cashbookSummary.data?.totalClosingBalanceDebit ?? 0)}</span></div>
        <div class="kv-row"><span>Total Closing Balance (Credit)</span><span>${formatAmount(cashbookSummary.data?.totalClosingBalanceCredit ?? 0)}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th class="right">Opening Debit</th>
              <th class="right">Opening Credit</th>
              <th class="right">Period Debit</th>
              <th class="right">Period Credit</th>
              <th class="right">Closing Debit</th>
              <th class="right">Closing Credit</th>
            </tr>
          </thead>
          <tbody>
            ${(cashbookSummary.data?.items ?? []).length === 0
              ? '<tr><td colspan="8" class="muted">No treasury accounts were found for the selected reporting period.</td></tr>'
              : (cashbookSummary.data?.items ?? []).map((item) => `
                  <tr>
                    <td>${item.code}</td>
                    <td>${item.name}</td>
                    <td class="right">${formatAmount(item.openingBalanceDebit)}</td>
                    <td class="right">${formatAmount(item.openingBalanceCredit)}</td>
                    <td class="right">${formatAmount(item.periodDebit)}</td>
                    <td class="right">${formatAmount(item.periodCredit)}</td>
                    <td class="right">${formatAmount(item.closingBalanceDebit)}</td>
                    <td class="right">${formatAmount(item.closingBalanceCredit)}</td>
                  </tr>
                `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan="2">Totals</th>
              <th class="right">${formatAmount(cashbookSummary.data?.totalOpeningBalanceDebit ?? 0)}</th>
              <th class="right">${formatAmount(cashbookSummary.data?.totalOpeningBalanceCredit ?? 0)}</th>
              <th class="right">${formatAmount(cashbookSummary.data?.totalPeriodDebit ?? 0)}</th>
              <th class="right">${formatAmount(cashbookSummary.data?.totalPeriodCredit ?? 0)}</th>
              <th class="right">${formatAmount(cashbookSummary.data?.totalClosingBalanceDebit ?? 0)}</th>
              <th class="right">${formatAmount(cashbookSummary.data?.totalClosingBalanceCredit ?? 0)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Treasury / Cashbook Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printTaxReportStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Tax Type Filter</span><span>${
          taxReportComponentKind === 'all'
            ? 'All Tax Types'
            : taxComponentKindLabel(Number(taxReportComponentKind))
        }</span></div>
        <div class="kv-row"><span>Transaction Scope Filter</span><span>${
          taxReportTransactionScope === 'all'
            ? 'All Scopes'
            : taxTransactionScopeLabel(Number(taxReportTransactionScope))
        }</span></div>
        <div class="kv-row"><span>Tax Line Count</span><span>${taxReportQ.data?.count ?? 0}</span></div>
        <div class="kv-row"><span>Total Taxable Amount</span><span>${formatAmount(taxReportQ.data?.totalTaxableAmount ?? 0)}</span></div>
        <div class="kv-row"><span>Total Tax Amount</span><span>${formatAmount(taxReportQ.data?.totalTaxAmount ?? 0)}</span></div>
        <div class="kv-row"><span>Total Additions</span><span>${formatAmount(taxReportQ.data?.totalAdditions ?? 0)}</span></div>
        <div class="kv-row"><span>Total Deductions</span><span>${formatAmount(taxReportQ.data?.totalDeductions ?? 0)}</span></div>
      </div>

      <h2>Tax Summary by Type</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tax Type</th>
              <th class="right">Count</th>
              <th class="right">Taxable Amount</th>
              <th class="right">Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(taxReportQ.data?.byComponentKind ?? []).length === 0
              ? '<tr><td colspan="4" class="muted">No tax activity was found for the selected filters.</td></tr>'
              : (taxReportQ.data?.byComponentKind ?? []).map((item) => `
                  <tr>
                    <td>${taxComponentKindLabel(item.componentKind)}</td>
                    <td class="right">${item.count}</td>
                    <td class="right">${formatAmount(item.totalTaxableAmount)}</td>
                    <td class="right">${formatAmount(item.totalTaxAmount)}</td>
                  </tr>
                `).join('')}
          </tbody>
        </table>
      </div>

      <h2>Tax Summary by Tax Code</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tax Code</th>
              <th>Tax Name</th>
              <th>Kind</th>
              <th>Mode</th>
              <th>Scope</th>
              <th class="right">Rate %</th>
              <th class="right">Count</th>
              <th class="right">Taxable Amount</th>
              <th class="right">Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(taxReportQ.data?.byTaxCode ?? []).length === 0
              ? '<tr><td colspan="9" class="muted">No tax-code activity was found for the selected filters.</td></tr>'
              : (taxReportQ.data?.byTaxCode ?? []).map((item) => `
                  <tr>
                    <td>${item.taxCode || '—'}</td>
                    <td>${item.taxCodeName || '—'}</td>
                    <td>${taxComponentKindLabel(item.componentKind)}</td>
                    <td>${taxApplicationModeLabel(item.applicationMode)}</td>
                    <td>${taxTransactionScopeLabel(item.transactionScope)}</td>
                    <td class="right">${formatAmount(item.ratePercent)}</td>
                    <td class="right">${item.count}</td>
                    <td class="right">${formatAmount(item.totalTaxableAmount)}</td>
                    <td class="right">${formatAmount(item.totalTaxAmount)}</td>
                  </tr>
                `).join('')}
          </tbody>
        </table>
      </div>

      <h2>Tax Movement Details</h2>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Document</th>
              <th>Counterparty</th>
              <th>Tax Code</th>
              <th>Kind</th>
              <th>Mode</th>
              <th>Scope</th>
              <th class="right">Rate %</th>
              <th class="right">Taxable Amount</th>
              <th class="right">Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(taxReportQ.data?.items ?? []).length === 0
              ? '<tr><td colspan="10" class="muted">No tax movement lines were found for the selected filters.</td></tr>'
              : (taxReportQ.data?.items ?? []).map((item) => `
                  <tr>
                    <td>${formatDateTime(item.transactionDateUtc)}</td>
                    <td>
                      <div>${item.sourceDocumentNumber}</div>
                      <div class="muted">${item.sourceModule} / ${item.sourceDocumentType}</div>
                    </td>
                    <td>${
                      item.counterpartyName || item.counterpartyCode
                        ? `${item.counterpartyCode || ''} ${item.counterpartyName || ''}`.trim()
                        : '—'
                    }</td>
                    <td>${item.taxCode || '—'}</td>
                    <td>${taxComponentKindLabel(item.componentKind)}</td>
                    <td>${taxApplicationModeLabel(item.applicationMode)}</td>
                    <td>${taxTransactionScopeLabel(item.transactionScope)}</td>
                    <td class="right">${formatAmount(item.ratePercent)}</td>
                    <td class="right">${formatAmount(item.taxableAmount)}</td>
                    <td class="right">${formatAmount(item.taxAmount)}</td>
                  </tr>
                `).join('')}
          </tbody>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'VAT / WHT / Other Tax Report',
      subtitle: periodText,
      bodyHtml,
    }));
  }


  function printReceivablesSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Invoices</span><span>${arSummary.totalInvoices}</span></div>
        <div class="kv-row"><span>Total Invoiced</span><span>${formatAmount(arSummary.totalInvoiced)}</span></div>
        <div class="kv-row"><span>Total Collected</span><span>${formatAmount(arSummary.totalCollected)}</span></div>
        <div class="kv-row"><span>Total Outstanding</span><span>${formatAmount(arSummary.totalOutstanding)}</span></div>
        <div class="kv-row"><span>Draft Invoices</span><span>${arSummary.draftInvoiceCount}</span></div>
        <div class="kv-row"><span>Posted Invoices</span><span>${arSummary.postedInvoiceCount}</span></div>
        <div class="kv-row"><span>Part Paid Invoices</span><span>${arSummary.partPaidInvoiceCount}</span></div>
        <div class="kv-row"><span>Paid Invoices</span><span>${arSummary.paidInvoiceCount}</span></div>
        <div class="kv-row"><span>Cancelled Invoices</span><span>${arSummary.cancelledInvoiceCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Customer</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Total Amount</th>
              <th class="right">Amount Paid</th>
              <th class="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSalesInvoices.map((item) => `
              <tr>
                <td>${item.invoiceNumber}</td>
                <td>${item.customerCode} - ${item.customerName}</td>
                <td>${item.description}</td>
                <td>${invoiceStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.totalAmount)}</td>
                <td class="right">${formatAmount(item.amountPaid)}</td>
                <td class="right">${formatAmount(item.balanceAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4">Total</th>
              <th class="right">${formatAmount(arSummary.totalInvoiced)}</th>
              <th class="right">${formatAmount(arSummary.totalCollected)}</th>
              <th class="right">${formatAmount(arSummary.totalOutstanding)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Accounts Receivable Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printCustomerReceiptsSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Receipts</span><span>${arSummary.totalReceipts}</span></div>
        <div class="kv-row"><span>Total Receipt Amount</span><span>${formatAmount(arSummary.totalReceiptAmount)}</span></div>
        <div class="kv-row"><span>Draft Receipts</span><span>${arSummary.draftReceiptCount}</span></div>
        <div class="kv-row"><span>Posted Receipts</span><span>${arSummary.postedReceiptCount}</span></div>
        <div class="kv-row"><span>Cancelled Receipts</span><span>${arSummary.cancelledReceiptCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Receipt Number</th>
              <th>Customer</th>
              <th>Invoice</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Amount</th>
              <th>Receipt Date</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCustomerReceipts.map((item) => `
              <tr>
                <td>${item.receiptNumber}</td>
                <td>${item.customerCode} - ${item.customerName}</td>
                <td>${item.invoiceNumber}</td>
                <td>${item.description}</td>
                <td>${receiptStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.amount)}</td>
                <td>${formatDateTime(item.receiptDateUtc)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">Total</th>
              <th class="right">${formatAmount(arSummary.totalReceiptAmount)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Customer Receipts Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printPayablesSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Purchase Invoices</span><span>${apSummary.totalInvoices}</span></div>
        <div class="kv-row"><span>Total Invoiced</span><span>${formatAmount(apSummary.totalInvoiced)}</span></div>
        <div class="kv-row"><span>Total Paid</span><span>${formatAmount(apSummary.totalPaid)}</span></div>
        <div class="kv-row"><span>Total Outstanding</span><span>${formatAmount(apSummary.totalOutstanding)}</span></div>
        <div class="kv-row"><span>Draft Invoices</span><span>${apSummary.draftInvoiceCount}</span></div>
        <div class="kv-row"><span>Posted Invoices</span><span>${apSummary.postedInvoiceCount}</span></div>
        <div class="kv-row"><span>Part Paid Invoices</span><span>${apSummary.partPaidInvoiceCount}</span></div>
        <div class="kv-row"><span>Paid Invoices</span><span>${apSummary.paidInvoiceCount}</span></div>
        <div class="kv-row"><span>Cancelled Invoices</span><span>${apSummary.cancelledInvoiceCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Vendor</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Total Amount</th>
              <th class="right">Amount Paid</th>
              <th class="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPurchaseInvoices.map((item) => `
              <tr>
                <td>${item.invoiceNumber}</td>
                <td>${item.vendorCode} - ${item.vendorName}</td>
                <td>${item.description}</td>
                <td>${purchaseInvoiceStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.totalAmount)}</td>
                <td class="right">${formatAmount(item.amountPaid)}</td>
                <td class="right">${formatAmount(item.balanceAmount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="4">Total</th>
              <th class="right">${formatAmount(apSummary.totalInvoiced)}</th>
              <th class="right">${formatAmount(apSummary.totalPaid)}</th>
              <th class="right">${formatAmount(apSummary.totalOutstanding)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Accounts Payable Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  function printVendorPaymentsSummaryStandalone() {
    const bodyHtml = `
      <div class="kv">
        <div class="kv-row"><span>Reporting Period</span><span>${periodText.replace('Reporting Period: ', '')}</span></div>
        <div class="kv-row"><span>Total Payments</span><span>${apSummary.totalPayments}</span></div>
        <div class="kv-row"><span>Total Payment Amount</span><span>${formatAmount(apSummary.totalPaymentAmount)}</span></div>
        <div class="kv-row"><span>Draft Payments</span><span>${apSummary.draftPaymentCount}</span></div>
        <div class="kv-row"><span>Submitted for Approval</span><span>${apSummary.submittedPaymentCount}</span></div>
        <div class="kv-row"><span>Approved Payments</span><span>${apSummary.approvedPaymentCount}</span></div>
        <div class="kv-row"><span>Rejected Payments</span><span>${apSummary.rejectedPaymentCount}</span></div>
        <div class="kv-row"><span>Posted Payments</span><span>${apSummary.postedPaymentCount}</span></div>
        <div class="kv-row"><span>Cancelled Payments</span><span>${apSummary.cancelledPaymentCount}</span></div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Payment Number</th>
              <th>Vendor</th>
              <th>Invoice</th>
              <th>Description</th>
              <th>Status</th>
              <th class="right">Amount</th>
              <th>Payment Date</th>
            </tr>
          </thead>
          <tbody>
            ${filteredVendorPayments.map((item) => `
              <tr>
                <td>${item.paymentNumber}</td>
                <td>${item.vendorCode} - ${item.vendorName}</td>
                <td>${item.invoiceNumber}</td>
                <td>${item.description}</td>
                <td>${vendorPaymentStatusLabel(item.status)}</td>
                <td class="right">${formatAmount(item.amount)}</td>
                <td>${formatDateTime(item.paymentDateUtc)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="5">Total</th>
              <th class="right">${formatAmount(apSummary.totalPaymentAmount)}</th>
              <th></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;

    openStandalonePrint(buildStandaloneHtml({
      title: 'Vendor Payments Summary',
      subtitle: periodText,
      bodyHtml,
    }));
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view financial reports.</div>;
  }

  if (
    trialBalance.isLoading ||
    balanceSheet.isLoading ||
    incomeStatement.isLoading ||
    cashbook.isLoading ||
    cashbookSummary.isLoading ||
    bankReconciliationsQ.isLoading ||
    bankStatementImportsQ.isLoading ||
    salesInvoicesQ.isLoading ||
    taxReportQ.isLoading ||
    customerReceiptsQ.isLoading ||
    purchaseInvoicesQ.isLoading ||
    vendorPaymentsQ.isLoading
  ) {
    return <div className="panel">Loading financial reports...</div>;
  }

  if (
    trialBalance.error ||
    balanceSheet.error ||
    incomeStatement.error ||
    cashbook.error ||
    cashbookSummary.error ||
    bankReconciliationsQ.error ||
    bankStatementImportsQ.error ||
    salesInvoicesQ.error ||
    customerReceiptsQ.error ||
    purchaseInvoicesQ.error ||
    vendorPaymentsQ.error ||
    taxReportQ.error ||
    !trialBalance.data ||
    !balanceSheet.data ||
    !incomeStatement.data ||
    !cashbook.data ||
    !cashbookSummary.data ||
    !bankReconciliationsQ.data ||
    !bankStatementImportsQ.data ||
    !salesInvoicesQ.data ||
    !taxReportQ.data ||
    !customerReceiptsQ.data ||
    !purchaseInvoicesQ.data ||
    !vendorPaymentsQ.data
  ) {
    return <div className="panel error-panel">We could not load the financial reports at this time.</div>;
  }

  return (
    <div className="reports-grid">
<section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Report filters</h2>
            <div className="muted">
              All period-sensitive reports are driven by the selected From Date and To Date. Point-in-time reports carry an As At date.
            </div>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>From Date</label>
            <input
              type="date"
              className="input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>To Date</label>
            <input
              type="date"
              className="input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Balance Sheet As At Date</label>
            <input
              type="date"
              className="input"
              value={balanceSheetAsAtDate}
              onChange={(e) => setBalanceSheetAsAtDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Cashbook Treasury Account</label>
            <select
              className="select"
              value={cashbookLedgerAccountId}
              onChange={(e) => setCashbookLedgerAccountId(e.target.value)}
            >
              <option value="">— Select Treasury Account —</option>
              {cashbook.data.cashOrBankAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Current Period In Focus</label>
            <div className="panel" style={{ margin: 0, padding: 12 }}>
              <div className="muted">{periodText}</div>
              <div className="muted" style={{ marginTop: 8 }}>{asAtText}</div>
            </div>
          </div>
        </div>
      </section>

      <ReportSectionDivider
        title="Treasury, Cashbook & Bank Reconciliation"
        subtitle="Start here for cash/bank positions, detailed cashbook movements, bank reconciliation, statement import, and call-over matching."
      />

<section id="print-cashbook-summary" className="panel printable-report">
      <div className="section-heading no-print">
        <div>
          <h2>Treasury / Cashbook Summary</h2>
          <span className="muted">{periodText}</span>
        </div>
        <button className="button" onClick={printCashbookSummaryStandalone}>
          Print Treasury Summary
        </button>
      </div>

      <ReportPrintHeader title="Treasury / Cashbook Summary" subtitle={periodText} />

      <div className="kv" style={{ marginBottom: 16 }}>
        <div className="kv-row">
          <span>Reporting Period</span>
          <span>{periodText.replace('Reporting Period: ', '')}</span>
        </div>
        <div className="kv-row">
          <span>Treasury Accounts</span>
          <span>{cashbookSummary.data.count}</span>
        </div>
        <div className="kv-row">
          <span>Total Opening Balance (Debit)</span>
          <span>{formatAmount(cashbookSummary.data.totalOpeningBalanceDebit)}</span>
        </div>
        <div className="kv-row">
          <span>Total Opening Balance (Credit)</span>
          <span>{formatAmount(cashbookSummary.data.totalOpeningBalanceCredit)}</span>
        </div>
        <div className="kv-row">
          <span>Total Period Debit</span>
          <span>{formatAmount(cashbookSummary.data.totalPeriodDebit)}</span>
        </div>
        <div className="kv-row">
          <span>Total Period Credit</span>
          <span>{formatAmount(cashbookSummary.data.totalPeriodCredit)}</span>
        </div>
        <div className="kv-row">
          <span>Total Closing Balance (Debit)</span>
          <span>{formatAmount(cashbookSummary.data.totalClosingBalanceDebit)}</span>
        </div>
        <div className="kv-row">
          <span>Total Closing Balance (Credit)</span>
          <span>{formatAmount(cashbookSummary.data.totalClosingBalanceCredit)}</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table report-print-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Account Name</th>
              <th style={{ textAlign: 'right' }}>Opening Debit</th>
              <th style={{ textAlign: 'right' }}>Opening Credit</th>
              <th style={{ textAlign: 'right' }}>Period Debit</th>
              <th style={{ textAlign: 'right' }}>Period Credit</th>
              <th style={{ textAlign: 'right' }}>Closing Debit</th>
              <th style={{ textAlign: 'right' }}>Closing Credit</th>
            </tr>
          </thead>
          <tbody>
            {cashbookSummary.data.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  No treasury accounts were found for the selected reporting period.
                </td>
              </tr>
            ) : (
              cashbookSummary.data.items.map((item) => (
                <tr key={item.ledgerAccountId}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.openingBalanceDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.openingBalanceCredit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.periodDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.periodCredit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.closingBalanceDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.closingBalanceCredit)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>Totals</th>
              <th style={{ textAlign: 'right' }}>{formatAmount(cashbookSummary.data.totalOpeningBalanceDebit)}</th>
              <th style={{ textAlign: 'right' }}>{formatAmount(cashbookSummary.data.totalOpeningBalanceCredit)}</th>
              <th style={{ textAlign: 'right' }}>{formatAmount(cashbookSummary.data.totalPeriodDebit)}</th>
              <th style={{ textAlign: 'right' }}>{formatAmount(cashbookSummary.data.totalPeriodCredit)}</th>
              <th style={{ textAlign: 'right' }}>{formatAmount(cashbookSummary.data.totalClosingBalanceDebit)}</th>
              <th style={{ textAlign: 'right' }}>{formatAmount(cashbookSummary.data.totalClosingBalanceCredit)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

<section id="print-cashbook" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Cashbook</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button
            className="button"
            onClick={printCashbookStandalone}
            disabled={!cashbook.data.selectedLedgerAccount}
          >
            Print Cashbook
          </button>
        </div>

        <ReportPrintHeader
          title="Cashbook"
          subtitle={
            cashbook.data.selectedLedgerAccount
              ? `${periodText} | ${cashbook.data.selectedLedgerAccount.code} - ${cashbook.data.selectedLedgerAccount.name}`
              : periodText
          }
        />

        {!cashbook.data.selectedLedgerAccount ? (
          <div className="panel error-panel">
            Select a treasury account above to view the cashbook.
          </div>
        ) : (
          <>
            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row">
                <span>Reporting Period</span>
                <span>{periodText.replace('Reporting Period: ', '')}</span>
              </div>
              <div className="kv-row">
                <span>Treasury Account</span>
                <span>{cashbook.data.selectedLedgerAccount.code} - {cashbook.data.selectedLedgerAccount.name}</span>
              </div>
              <div className="kv-row">
                <span>Opening Balance (Debit)</span>
                <span>{formatAmount(cashbook.data.openingBalanceDebit)}</span>
              </div>
              <div className="kv-row">
                <span>Opening Balance (Credit)</span>
                <span>{formatAmount(cashbook.data.openingBalanceCredit)}</span>
              </div>
              <div className="kv-row">
                <span>Total Debit</span>
                <span>{formatAmount(cashbook.data.totalDebit)}</span>
              </div>
              <div className="kv-row">
                <span>Total Credit</span>
                <span>{formatAmount(cashbook.data.totalCredit)}</span>
              </div>
              <div className="kv-row">
                <span>Closing Balance (Debit)</span>
                <span>{formatAmount(cashbook.data.closingBalanceDebit)}</span>
              </div>
              <div className="kv-row">
                <span>Closing Balance (Credit)</span>
                <span>{formatAmount(cashbook.data.closingBalanceCredit)}</span>
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
                  {cashbook.data.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted">
                        No cashbook movements were found for the selected treasury account and reporting period.
                      </td>
                    </tr>
                  ) : (
                    cashbook.data.items.map((item) => (
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
                    <th style={{ textAlign: 'right' }}>{formatAmount(cashbook.data.totalDebit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(cashbook.data.totalCredit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(cashbook.data.closingBalanceDebit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(cashbook.data.closingBalanceCredit)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </section>

<section className="panel no-print">
    <div className="section-heading">
      <div>
        <h2>Bank Reconciliation</h2>
        <span className="muted">Create and review reconciliation drafts for treasury accounts</span>
      </div>
    </div>

    <div className="form-grid two" style={{ marginBottom: 16 }}>
      <div className="form-row">
        <label>Treasury Account</label>
        <select
          className="select"
          value={reconciliationLedgerAccountId}
          onChange={(e) => setReconciliationLedgerAccountId(e.target.value)}
        >
          <option value="">— Select Treasury Account —</option>
          {cashbook.data.cashOrBankAccounts.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} - {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Statement Closing Balance</label>
        <input
          className="input"
          type="number"
          step="0.01"
          value={statementClosingBalance}
          onChange={(e) => setStatementClosingBalance(e.target.value)}
          placeholder="Enter statement closing balance"
        />
      </div>

      <div className="form-row" style={{ gridColumn: '1 / -1' }}>
        <label>Notes</label>
        <input
          className="input"
          value={reconciliationNotes}
          onChange={(e) => setReconciliationNotes(e.target.value)}
          placeholder="Optional reconciliation notes"
        />
      </div>

      <div className="form-row">
        <label>Statement Period</label>
        <div className="panel" style={{ margin: 0, padding: 12 }}>
          <div className="muted">{periodText}</div>
        </div>
      </div>

      <div className="form-row">
        <label>Create Reconciliation</label>
        <div className="inline-actions">
          <button
            className="button primary"
            onClick={handleCreateReconciliation}
            disabled={
              !reconciliationLedgerAccountId ||
              !fromUtc ||
              !toUtc ||
              !statementClosingBalance ||
              createReconciliationMut.isPending
            }
          >
            {createReconciliationMut.isPending ? 'Creating…' : 'Create Draft Reconciliation'}
          </button>
        </div>
      </div>
    </div>

    {createReconciliationMut.isError ? (
      <div className="panel error-panel" style={{ marginBottom: 16 }}>
        We could not create the bank reconciliation draft at this time.
      </div>
    ) : null}

    {createReconciliationMut.isSuccess ? (
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="muted">Bank reconciliation draft created successfully.</div>
      </div>
    ) : null}

    <div className="section-heading" style={{ marginTop: 8 }}>
      <div>
        <h2>Reconciliation Listing</h2>
        <span className="muted">{bankReconciliationsQ.data.count} reconciliation record(s)</span>
      </div>
    </div>

    <div className="table-wrap" style={{ marginBottom: 16 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Treasury Account</th>
            <th>Statement From</th>
            <th>Statement To</th>
            <th style={{ textAlign: 'right' }}>Statement Balance</th>
            <th style={{ textAlign: 'right' }}>Book Balance</th>
            <th style={{ textAlign: 'right' }}>Difference</th>
            <th>Status</th>
            <th style={{ width: 140 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {bankReconciliationsQ.data.items.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                No bank reconciliations have been created yet.
              </td>
            </tr>
          ) : (
            bankReconciliationsQ.data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.ledgerAccountCode} - {item.ledgerAccountName}</td>
                <td>{formatDateTime(item.statementFromUtc)}</td>
                <td>{formatDateTime(item.statementToUtc)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.statementClosingBalance)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.bookClosingBalance)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.differenceAmount)}</td>
                <td>{reconciliationStatusLabel(item.status)}</td>
                <td>
                <button
                className="button"
                onClick={() => {
                  setSelectedReconciliationId(item.id);
                  setReconciliationLineFilter('all');
                  setCallOverBookSearch('');
                  setSelectedBookLineId('');
                  setMatchNotes('');
                }}
              >
                Open
              </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <div className="section-heading">
      <div>
        <h2>Reconciliation Detail</h2>
        <span className="muted">
          {selectedReconciliationId ? 'Opened reconciliation detail' : 'Select a reconciliation from the listing'}
        </span>
      </div>
    </div>

    {!selectedReconciliationId ? (
      <div className="panel">
        <div className="muted">Choose a reconciliation record above to view its lines and summary.</div>
      </div>
    ) : bankReconciliationDetailQ.isLoading ? (
      <div className="panel">
        <div className="muted">Loading reconciliation detail...</div>
      </div>
    ) : bankReconciliationDetailQ.isError || !bankReconciliationDetailQ.data ? (
      <div className="panel error-panel">
        We could not load the reconciliation detail at this time.
      </div>
    ) : (
      <>


      <div className="inline-actions" style={{ marginBottom: 16 }}>
      <button
        className="button primary"
        disabled={
          bankReconciliationDetailQ.data.reconciliation.status !== 1 ||
          completeReconciliationMut.isPending ||
          cancelReconciliationMut.isPending
        }
        onClick={() =>
          handleCompleteReconciliation(bankReconciliationDetailQ.data.reconciliation.id)
        }
      >
        {completeReconciliationMut.isPending ? 'Completing…' : 'Complete Reconciliation'}
      </button>

      <button
        className="button"
        disabled={
          bankReconciliationDetailQ.data.reconciliation.status !== 1 ||
          completeReconciliationMut.isPending ||
          cancelReconciliationMut.isPending
        }
        onClick={() =>
          handleCancelReconciliation(bankReconciliationDetailQ.data.reconciliation.id)
        }
      >
        {cancelReconciliationMut.isPending ? 'Cancelling…' : 'Cancel Reconciliation'}
      </button>

      <button
        className="button"
        onClick={printReconciliationReport}
      >
        Print Reconciliation Report
      </button>
    </div>



        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Treasury Account</span>
            <span>
              {bankReconciliationDetailQ.data.reconciliation.ledgerAccountCode} - {bankReconciliationDetailQ.data.reconciliation.ledgerAccountName}
            </span>
          </div>
          <div className="kv-row">
            <span>Status</span>
            <span>{reconciliationStatusLabel(bankReconciliationDetailQ.data.reconciliation.status)}</span>
          </div>
          <div className="kv-row">
            <span>Statement Closing Balance</span>
            <span>{formatAmount(bankReconciliationDetailQ.data.reconciliation.statementClosingBalance)}</span>
          </div>
          <div className="kv-row">
            <span>Book Closing Balance</span>
            <span>{formatAmount(bankReconciliationDetailQ.data.reconciliation.bookClosingBalance)}</span>
          </div>
          <div className="kv-row">
            <span>Difference</span>
            <span>{formatAmount(bankReconciliationDetailQ.data.reconciliation.differenceAmount)}</span>
          </div>
          <div className="kv-row">
            <span>Reconciled Lines</span>
            <span>{bankReconciliationDetailQ.data.reconciledCount}</span>
          </div>
          <div className="kv-row">
            <span>Unreconciled Lines</span>
            <span>{bankReconciliationDetailQ.data.unreconciledCount}</span>
          </div>
        </div>


        <div className="kv" style={{ marginBottom: 16 }}>
        <div className="kv-row">
          <span>Reconciled Amount</span>
          <span>{formatAmount(reconciliationMetrics.reconciledAmount)}</span>
        </div>
        <div className="kv-row">
          <span>Unreconciled Amount</span>
          <span>{formatAmount(reconciliationMetrics.unreconciledAmount)}</span>
        </div>
        <div className="kv-row">
          <span>Reconciled Debit</span>
          <span>{formatAmount(reconciliationMetrics.reconciledDebit)}</span>
        </div>
        <div className="kv-row">
          <span>Reconciled Credit</span>
          <span>{formatAmount(reconciliationMetrics.reconciledCredit)}</span>
        </div>
        <div className="kv-row">
          <span>Unreconciled Debit</span>
          <span>{formatAmount(reconciliationMetrics.unreconciledDebit)}</span>
        </div>
        <div className="kv-row">
          <span>Unreconciled Credit</span>
          <span>{formatAmount(reconciliationMetrics.unreconciledCredit)}</span>
        </div>
        <div className="kv-row">
          <span>Reconciled Lines %</span>
          <span>{formatPercentage(reconciliationMetrics.reconciledLinePercentage)}</span>
        </div>
        <div className="kv-row">
          <span>Reconciled Amount %</span>
          <span>{formatPercentage(reconciliationMetrics.reconciledAmountPercentage)}</span>
        </div>
      </div>


      <div className="panel" style={{ marginBottom: 16 }}>
      <div className="muted">
        Draft reconciliations can be updated, completed, or cancelled. Completed and cancelled reconciliations are locked and become read-only.
      </div>
      <div className="muted" style={{ marginTop: 8 }}>
        Progress: {reconciliationMetrics.reconciledLines} of {reconciliationMetrics.totalLines} lines reconciled
        {' '}({formatPercentage(reconciliationMetrics.reconciledLinePercentage)}).
      </div>
      <div className="muted" style={{ marginTop: 4 }}>
        Amount progress: {formatAmount(reconciliationMetrics.reconciledAmount)} reconciled out of{' '}
        {formatAmount(reconciliationMetrics.reconciledAmount + reconciliationMetrics.unreconciledAmount)}
        {' '}({formatPercentage(reconciliationMetrics.reconciledAmountPercentage)}).
      </div>
    </div>

    <div className="panel" style={{ marginBottom: 16 }}>
    <div className="muted">
      Use “Print Reconciliation Report” to generate a formal report of the current reconciliation, including balances, status, metrics, and line-by-line review results.
    </div>
  </div>

    <div className="form-grid two" style={{ marginBottom: 16 }}>
    <div className="form-row">
      <label>Reconciliation Line Filter</label>
      <select
        className="select"
        value={reconciliationLineFilter}
        onChange={(e) => setReconciliationLineFilter(e.target.value)}
      >
        <option value="all">All Lines</option>
        <option value="reconciled">Reconciled Only</option>
        <option value="unreconciled">Unreconciled Only</option>
      </select>
    </div>

    <div className="form-row">
      <label>Filtered Result</label>
      <div className="panel" style={{ margin: 0, padding: 12 }}>
        <div className="muted">
          Showing {filteredReconciliationLines.length} of {bankReconciliationDetailQ.data.count} line(s)
        </div>
      </div>
    </div>
  </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th>Reconciled</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
            {filteredReconciliationLines.length === 0 ? (
                <tr>
                <td colSpan={7} className="muted">
                No reconciliation lines matched the current filter.
              </td>
                </tr>
              ) : (
                filteredReconciliationLines.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.movementDateUtc)}</td>
                    <td>{item.reference}</td>
                    <td>{item.description}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.debitAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.creditAmount)}</td>
                    <td>
                    <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={item.isReconciled}
                        disabled={
                          bankReconciliationDetailQ.data.reconciliation.status !== 1 ||
                          updateReconciliationLineMut.isPending
                        }
                        onChange={(e) =>
                          handleToggleReconciliationLine(
                            item.bankReconciliationId,
                            item.id,
                            e.target.checked,
                            item.notes
                          )
                        }
                      />
                      {item.isReconciled ? 'Yes' : 'No'}
                    </label>
                  </td>
                    <td>{item.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </>
    )}
  </section>

<section className="panel no-print">
  <div className="section-heading">
    <div>
      <h2>Call-over Workspace</h2>
      <span className="muted">
        Split-window statement-to-book review for treasury reconciliation activities
      </span>
    </div>
  </div>

  <div className="form-grid two" style={{ marginBottom: 16 }}>
    <div className="form-row">
      <label>Treasury Account for Statement Import</label>
      <select
        className="select"
        value={statementImportLedgerAccountId}
        onChange={(e) => setStatementImportLedgerAccountId(e.target.value)}
      >
        <option value="">— Select Treasury Account —</option>
        {cashbook.data.cashOrBankAccounts.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} - {item.name}
          </option>
        ))}
      </select>
    </div>

    <div className="form-row">
      <label>Statement Period</label>
      <div className="panel" style={{ margin: 0, padding: 12 }}>
        <div className="muted">{periodText}</div>
      </div>
    </div>

    <div className="form-row">
      <label>Upload Source Reference</label>
      <input
        className="input"
        value={statementSourceReference}
        onChange={(e) => setStatementSourceReference(e.target.value)}
        placeholder="Optional source reference for upload batch"
      />
    </div>

    <div className="form-row">
      <label>API Placeholder Reference</label>
      <input
        className="input"
        value={apiPlaceholderReference}
        onChange={(e) => setApiPlaceholderReference(e.target.value)}
        placeholder="Required for API placeholder creation"
      />
    </div>

    <div className="form-row" style={{ gridColumn: '1 / -1' }}>
      <label>Statement Import Notes</label>
      <input
        className="input"
        value={statementImportNotes}
        onChange={(e) => setStatementImportNotes(e.target.value)}
        placeholder="Optional notes for upload or API import"
      />
    </div>

    <div className="form-row">
      <label>Statement Upload Template</label>
      <div className="inline-actions">
        <button className="button" onClick={downloadBankStatementTemplate}>
          Download Template
        </button>

        <label
          className="button"
          style={{
            cursor: !statementImportLedgerAccountId || !fromUtc || !toUtc || uploadStatementImportMut.isPending
              ? 'not-allowed'
              : 'pointer',
            opacity: !statementImportLedgerAccountId || !fromUtc || !toUtc || uploadStatementImportMut.isPending
              ? 0.7
              : 1,
          }}
        >
          {uploadStatementImportMut.isPending ? 'Uploading…' : 'Upload Statement'}
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            disabled={!statementImportLedgerAccountId || !fromUtc || !toUtc || uploadStatementImportMut.isPending}
            onChange={async (e) => {
              try {
                await handleBankStatementUploadFile(e.target.files?.[0] || null);
              } catch {
                // page-level message omitted for now; kept intentionally quiet
              } finally {
                e.currentTarget.value = '';
              }
            }}
          />
        </label>
      </div>
    </div>

    <div className="form-row">
      <label>API Source Placeholder</label>
      <div className="inline-actions">
        <button
          className="button"
          onClick={handleCreateApiPlaceholderImport}
          disabled={
            !statementImportLedgerAccountId ||
            !fromUtc ||
            !toUtc ||
            !apiPlaceholderReference.trim() ||
            createApiPlaceholderImportMut.isPending
          }
        >
          {createApiPlaceholderImportMut.isPending ? 'Creating…' : 'Create API Placeholder'}
        </button>
      </div>
    </div>
  </div>

  <div className="section-heading" style={{ marginTop: 8 }}>
    <div>
      <h2>Statement Import Listing</h2>
      <span className="muted">{bankStatementImportsQ.data.count} import batch(es)</span>
    </div>
  </div>

  <div className="table-wrap" style={{ marginBottom: 16 }}>
    <table className="data-table">
      <thead>
        <tr>
          <th>Treasury Account</th>
          <th>Statement From</th>
          <th>Statement To</th>
          <th>Source Type</th>
          <th>Source Reference</th>
          <th>File Name</th>
          <th>Lines</th>
          <th>Imported On</th>
          <th style={{ width: 140 }}>Action</th>
        </tr>
      </thead>
      <tbody>
        {bankStatementImportsQ.data.items.length === 0 ? (
          <tr>
            <td colSpan={9} className="muted">
              No bank statement imports have been created yet.
            </td>
          </tr>
        ) : (
          bankStatementImportsQ.data.items.map((item) => (
            <tr key={item.id}>
              <td>{item.ledgerAccountCode} - {item.ledgerAccountName}</td>
              <td>{formatDateTime(item.statementFromUtc)}</td>
              <td>{formatDateTime(item.statementToUtc)}</td>
              <td>{statementSourceTypeLabel(item.sourceType)}</td>
              <td>{item.sourceReference}</td>
              <td>{item.fileName || '—'}</td>
              <td>{item.lineCount}</td>
              <td>{formatDateTime(item.importedOnUtc)}</td>
              <td>
              <button
              className="button"
              onClick={() => {
                setSelectedStatementImportId(item.id);
                setCallOverStatementSearch('');
                setSelectedStatementLineId('');
                setMatchNotes('');
              }}
            >
              Open
            </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>


  <div className="kv" style={{ marginBottom: 16 }}>
  <div className="kv-row">
    <span>Call-over Readiness</span>
    <span>{callOverReadinessLabel(callOverReadiness.readinessScore)}</span>
  </div>
  <div className="kv-row">
    <span>Readiness Score</span>
    <span>{callOverReadiness.readinessScore}%</span>
  </div>
  <div className="kv-row">
    <span>Statement Loaded</span>
    <span>{callOverReadiness.hasStatement ? 'Yes' : 'No'}</span>
  </div>
  <div className="kv-row">
    <span>Reconciliation Loaded</span>
    <span>{callOverReadiness.hasReconciliation ? 'Yes' : 'No'}</span>
  </div>
  <div className="kv-row">
    <span>Account Alignment</span>
    <span>{callOverReadiness.accountAligned ? 'Aligned' : 'Not Aligned'}</span>
  </div>
  <div className="kv-row">
    <span>Period Alignment</span>
    <span>{callOverReadiness.periodAligned ? 'Aligned' : 'Not Aligned'}</span>
  </div>
  <div className="kv-row">
    <span>Statement Line Count</span>
    <span>{callOverReadiness.statementLineCount}</span>
  </div>
  <div className="kv-row">
    <span>Book Line Count</span>
    <span>{callOverReadiness.bookLineCount}</span>
  </div>
  <div className="kv-row">
    <span>Reconciled / Unreconciled</span>
    <span>{callOverReadiness.reconciledCount} / {callOverReadiness.unreconciledCount}</span>
  </div>
  <div className="kv-row">
    <span>Statement Net Activity</span>
    <span>{formatAmount(callOverReadiness.statementNetAmount)}</span>
  </div>
  <div className="kv-row">
    <span>Outstanding Difference</span>
    <span>{formatAmount(callOverReadiness.bookDifferenceAmount)}</span>
  </div>
</div>

<div className="panel" style={{ marginBottom: 16 }}>
<div className="muted">
  Best Call-over flow: load a treasury account, import or open a bank statement batch, open the matching reconciliation for the same account and period, then review both sides together.
</div>
<div className="muted" style={{ marginTop: 8 }}>
  The workspace is strongest when the statement import and reconciliation are aligned on the same treasury account and statement period.
</div>
</div>


<div className="panel" style={{ marginBottom: 16 }}>
<div className="section-heading">
  <div>
    <h2>Match Control</h2>
    <span className="muted">Select one statement line and one book line to create a Call-over match</span>
  </div>
</div>

<div className="form-grid two">
  <div className="form-row">
    <label>Selected Statement Line</label>
    <div className="panel" style={{ margin: 0, padding: 12 }}>
      <div className="muted">
        {selectedStatementLine
          ? `${selectedStatementLine.reference} — ${selectedStatementLine.description}`
          : 'No statement line selected'}
      </div>
    </div>
  </div>

  <div className="form-row">
    <label>Selected Book Line</label>
    <div className="panel" style={{ margin: 0, padding: 12 }}>
      <div className="muted">
        {selectedBookLine
          ? `${selectedBookLine.reference} — ${selectedBookLine.description}`
          : 'No book line selected'}
      </div>
    </div>
  </div>

  <div className="form-row" style={{ gridColumn: '1 / -1' }}>
    <label>Match Notes</label>
    <input
      className="input"
      value={matchNotes}
      onChange={(e) => setMatchNotes(e.target.value)}
      placeholder="Optional notes for this match"
    />
  </div>

  <div className="form-row">
    <label>Create Match</label>
    <div className="inline-actions">
      <button
        className="button primary"
        onClick={handleCreateMatch}
        disabled={
          !selectedReconciliationId ||
          !selectedStatementLineId ||
          !selectedBookLineId ||
          createMatchMut.isPending
        }
      >
        {createMatchMut.isPending ? 'Matching…' : 'Create Match'}
      </button>
    </div>
  </div>

  <div className="form-row">
    <label>Reset Selection</label>
    <div className="inline-actions">
      <button
        className="button"
        onClick={() => {
          setSelectedStatementLineId('');
          setSelectedBookLineId('');
          setMatchNotes('');
        }}
      >
        Clear Selection
      </button>
    </div>
  </div>
</div>
</div>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      alignItems: 'start',
    }}
  >
    <div className="panel" style={{ margin: 0, background: 'rgba(59, 130, 246, 0.06)' }}>
      <div className="section-heading">
        <div>
          <h2>Bank Statement Window</h2>
          <span className="muted">
            Uploaded or API-sourced statement lines for Call-over review
          </span>
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <label>Statement Line Search</label>
        <input
          className="input"
          value={callOverStatementSearch}
          onChange={(e) => setCallOverStatementSearch(e.target.value)}
          placeholder="Search by reference, description, or external reference"
        />
      </div>

      {!selectedStatementImportId ? (
        <div className="muted">Select a statement import from the listing above.</div>
      ) : bankStatementImportDetailQ.isLoading ? (
        <div className="muted">Loading statement import detail...</div>
      ) : bankStatementImportDetailQ.isError || !bankStatementImportDetailQ.data ? (
        <div className="panel error-panel">
          We could not load the statement import detail at this time.
        </div>
      ) : (
        <>
          <div className="kv" style={{ marginBottom: 16 }}>
            <div className="kv-row">
              <span>Treasury Account</span>
              <span>
                {bankStatementImportDetailQ.data.bankStatementImport.ledgerAccountCode} - {bankStatementImportDetailQ.data.bankStatementImport.ledgerAccountName}
              </span>
            </div>
            <div className="kv-row">
              <span>Source Type</span>
              <span>{statementSourceTypeLabel(bankStatementImportDetailQ.data.bankStatementImport.sourceType)}</span>
            </div>
            <div className="kv-row">
              <span>Source Reference</span>
              <span>{bankStatementImportDetailQ.data.bankStatementImport.sourceReference}</span>
            </div>
            <div className="kv-row">
              <span>Total Debit</span>
              <span>{formatAmount(bankStatementImportDetailQ.data.totalDebit)}</span>
            </div>
            <div className="kv-row">
              <span>Total Credit</span>
              <span>{formatAmount(bankStatementImportDetailQ.data.totalCredit)}</span>
            </div>
            <div className="kv-row">
              <span>Visible Lines</span>
              <span>{filteredStatementLines.length} of {bankStatementImportDetailQ.data.count}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
              <tr>
              <th>Date</th>
              <th>Value Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Matched</th>
            </tr>
              </thead>
              <tbody>
                {filteredStatementLines.length === 0 ? (
                  <tr>
                  <td colSpan={8} className="muted">
                      No statement lines matched the current search.
                    </td>
                  </tr>
                ) : (
                  filteredStatementLines.map((item, index) => {
                    const isMatched = matchedStatementLineIds.has(item.id);
                    const isSelected = selectedStatementLineId === item.id;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (!isMatched) {
                            setSelectedStatementLineId(item.id);
                          }
                        }}
                        style={{
                          cursor: isMatched ? 'default' : 'pointer',
                          background: isSelected
                            ? 'rgba(37, 99, 235, 0.18)'
                            : isMatched
                              ? 'rgba(16, 185, 129, 0.10)'
                              : index % 2 === 0
                                ? 'rgba(59, 130, 246, 0.04)'
                                : 'transparent',
                        }}
                      >
                      <td>{formatDateTime(item.transactionDateUtc)}</td>
                      <td>{formatDateTime(item.valueDateUtc || null)}</td>
                      <td>{item.reference}</td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.debitAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.creditAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.balance || 0)}</td>
                      <td>{matchedStatementLineIds.has(item.id) ? 'Yes' : 'No'}</td>
                      </tr>
                    )})
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>

    <div className="panel" style={{ margin: 0, background: 'rgba(16, 185, 129, 0.06)' }}>
      <div className="section-heading">
        <div>
          <h2>Cashbook / Book Window</h2>
          <span className="muted">
            Reconciliation book-side review with filters and reconciliation status
          </span>
        </div>
      </div>

      <div className="form-grid two" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>Book Line Search</label>
          <input
            className="input"
            value={callOverBookSearch}
            onChange={(e) => setCallOverBookSearch(e.target.value)}
            placeholder="Search by reference or description"
          />
        </div>

        <div className="form-row">
          <label>Book Line Filter</label>
          <select
            className="select"
            value={reconciliationLineFilter}
            onChange={(e) => setReconciliationLineFilter(e.target.value)}
          >
            <option value="all">All Lines</option>
            <option value="reconciled">Reconciled Only</option>
            <option value="unreconciled">Unreconciled Only</option>
          </select>
        </div>
      </div>

      {!selectedReconciliationId ? (
        <div className="muted">Open a reconciliation above to review book-side lines here.</div>
      ) : bankReconciliationDetailQ.isLoading ? (
        <div className="muted">Loading reconciliation detail...</div>
      ) : bankReconciliationDetailQ.isError || !bankReconciliationDetailQ.data ? (
        <div className="panel error-panel">
          We could not load the reconciliation detail at this time.
        </div>
      ) : (
        <>
          <div className="kv" style={{ marginBottom: 16 }}>
            <div className="kv-row">
              <span>Treasury Account</span>
              <span>
                {bankReconciliationDetailQ.data.reconciliation.ledgerAccountCode} - {bankReconciliationDetailQ.data.reconciliation.ledgerAccountName}
              </span>
            </div>
            <div className="kv-row">
              <span>Status</span>
              <span>{reconciliationStatusLabel(bankReconciliationDetailQ.data.reconciliation.status)}</span>
            </div>
            <div className="kv-row">
              <span>Difference</span>
              <span>{formatAmount(bankReconciliationDetailQ.data.reconciliation.differenceAmount)}</span>
            </div>
            <div className="kv-row">
              <span>Visible Lines</span>
              <span>{filteredBookLines.length} of {bankReconciliationDetailQ.data.count}</span>
            </div>
            <div className="kv-row">
              <span>Reconciled Progress</span>
              <span>{formatPercentage(reconciliationMetrics.reconciledLinePercentage)}</span>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
              <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th>Reconciled</th>
              <th>Action</th>
            </tr>
              </thead>
              <tbody>
                {filteredBookLines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      No book lines matched the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredBookLines.map((item, index) => {
                    const isSelected = selectedBookLineId === item.id;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (!item.isReconciled) {
                            setSelectedBookLineId(item.id);
                          }
                        }}
                        style={{
                          cursor: item.isReconciled ? 'default' : 'pointer',
                          background: isSelected
                            ? 'rgba(245, 158, 11, 0.18)'
                            : item.isReconciled
                              ? 'rgba(16, 185, 129, 0.10)'
                              : index % 2 === 0
                                ? 'rgba(245, 158, 11, 0.06)'
                                : 'transparent',
                        }}
                      >
                      <td>{formatDateTime(item.movementDateUtc)}</td>
                      <td>{item.reference}</td>
                      <td>{item.description}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.debitAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.creditAmount)}</td>
                      <td>{item.isReconciled ? 'Yes' : 'No'}</td>
                      <td>
                        {item.isReconciled ? (
                          <button
                            className="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMatchForBookLine(item.id, item.notes);
                            }}
                            disabled={updateReconciliationLineMut.isPending || removeMatchMut.isPending}
                          >
                            Unmatch
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      </tr>
                    )})
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  </div>
</section>

      <ReportSectionDivider
        title="Core Financial Statements"
        subtitle="Use these statutory management reports for control totals and management review."
      />

<section id="print-trial-balance" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Trial Balance</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printTrialBalanceStandalone}>
            Print Trial Balance
          </button>
        </div>

        <ReportPrintHeader title="Trial Balance" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Accounts Included</span>
            <span>{trialBalance.data.count}</span>
          </div>
          <div className="kv-row">
            <span>Total Debit</span>
            <span>{formatAmount(trialBalance.data.totalDebit)}</span>
          </div>
          <div className="kv-row">
            <span>Total Credit</span>
            <span>{formatAmount(trialBalance.data.totalCredit)}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th style={{ textAlign: 'right' }}>Total Debit</th>
                <th style={{ textAlign: 'right' }}>Total Credit</th>
                <th style={{ textAlign: 'right' }}>Balance Debit</th>
                <th style={{ textAlign: 'right' }}>Balance Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.data.items.map((item) => (
                <tr key={item.ledgerAccountId}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalCredit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceCredit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(trialBalance.data.totalDebit)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(trialBalance.data.totalCredit)}</th>
                <th />
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

<section id="print-income-statement" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Income Statement</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printIncomeStatementStandalone}>
            Print Income Statement
          </button>
        </div>

        <ReportPrintHeader title="Income Statement" subtitle={periodText} />

        <div className="panel no-print" style={{ marginBottom: 16 }}>
          <div className="muted">{periodText}</div>
        </div>

        <div className="report-block">
          <h3>Income</h3>
          {incomeStatement.data.income.length === 0 ? (
            <div className="muted">No income balances available.</div>
          ) : (
            incomeStatement.data.income.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.amount ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-block">
          <h3>Expenses</h3>
          {incomeStatement.data.expenses.length === 0 ? (
            <div className="muted">No expense balances available.</div>
          ) : (
            incomeStatement.data.expenses.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.amount ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-totals">
          <div>{periodText}</div>
          <div>Total Income: {formatAmount(incomeStatement.data.totalIncome)}</div>
          <div>Total Expenses: {formatAmount(incomeStatement.data.totalExpenses)}</div>
          <div>Net Income: {formatAmount(incomeStatement.data.netIncome)}</div>
        </div>
      </section>

<section id="print-balance-sheet" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Balance Sheet</h2>
            <span className="muted">{asAtText}</span>
          </div>
          <button className="button" onClick={printBalanceSheetStandalone}>
            Print Balance Sheet
          </button>
        </div>

        <ReportPrintHeader title="Balance Sheet" subtitle={asAtText} />

        <div className="panel no-print" style={{ marginBottom: 16 }}>
          <div className="muted">{asAtText}</div>
        </div>

        <div className="report-block">
          <h3>Assets</h3>
          {balanceSheet.data.assets.length === 0 ? (
            <div className="muted">No asset balances available.</div>
          ) : (
            balanceSheet.data.assets.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.balance ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-block">
          <h3>Liabilities</h3>
          {balanceSheet.data.liabilities.length === 0 ? (
            <div className="muted">No liability balances available.</div>
          ) : (
            balanceSheet.data.liabilities.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.balance ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-block">
          <h3>Equity</h3>
          {balanceSheet.data.equity.length === 0 ? (
            <div className="muted">No equity balances available.</div>
          ) : (
            balanceSheet.data.equity.map((item) => (
              <div key={item.ledgerAccountId} className="report-line">
                <span>{item.code} - {item.name}</span>
                <strong>{formatAmount(item.balance ?? 0)}</strong>
              </div>
            ))
          )}
        </div>

        <div className="report-totals">
          <div>{asAtText}</div>
          <div>Total Assets: {formatAmount(balanceSheet.data.totalAssets)}</div>
          <div>Total Liabilities: {formatAmount(balanceSheet.data.totalLiabilities)}</div>
          <div>Total Equity: {formatAmount(balanceSheet.data.totalEquity)}</div>
          <div>Total Liabilities and Equity: {formatAmount(balanceSheet.data.totalLiabilitiesAndEquity)}</div>
        </div>
      </section>

     


  <section className="panel no-print">
  <div className="section-heading">
    <div>
      <h2>Budget Reports</h2>
      <div className="muted">
        Review budget register, rejected budgets, budget utilization, and Budget vs Actual performance.
      </div>
    </div>
  </div>

  <div className="stats-grid">
    <div className="stat-card">
      <div className="muted">Budget Register</div>
      <div style={{ marginTop: 12 }}>
        <Link to="/budgets" className="button primary">
          Open Budgets
        </Link>
      </div>
    </div>

    <div className="stat-card">
      <div className="muted">Rejected Budgets</div>
      <div style={{ marginTop: 12 }}>
        <Link to="/budgets/rejected" className="button">
          Open Rejected Budgets
        </Link>
      </div>
    </div>

    <div className="stat-card">
      <div className="muted">Budget vs Actual</div>
      <div style={{ marginTop: 12 }}>
        <Link to="/budget-vs-actual" className="button">
          Open Budget vs Actual
        </Link>
      </div>
    </div>
  </div>
</section>

<ReportSectionDivider
title="Tax Reports"
subtitle="Review VAT, WHT, and other tax movements generated from sales and purchase invoices."
/>

<section id="print-tax-report" className="panel printable-report">
<div className="section-heading no-print">
<div>
<h2>VAT / WHT / Other Tax Report</h2>
<span className="muted">
Date-range tax report for setup-driven VAT, withholding tax, and other levies.
</span>
</div>

<button className="button" onClick={printTaxReportStandalone}>
Print Tax Report
</button>
</div>

    <ReportPrintHeader title="VAT / WHT / Other Tax Report" subtitle={periodText} />

    <div className="form-grid two no-print" style={{ marginBottom: 16 }}>
      <div className="form-row">
        <label>Tax Type</label>
        <select
          className="select"
          value={taxReportComponentKind}
          onChange={(e) => setTaxReportComponentKind(e.target.value)}
        >
          <option value="all">All Tax Types</option>
          <option value="1">VAT</option>
          <option value="2">WHT</option>
          <option value="3">Other</option>
        </select>
      </div>

      <div className="form-row">
        <label>Transaction Scope</label>
        <select
          className="select"
          value={taxReportTransactionScope}
          onChange={(e) => setTaxReportTransactionScope(e.target.value)}
        >
          <option value="all">All Scopes</option>
          <option value="1">Sales</option>
          <option value="2">Purchases</option>
          <option value="3">Both</option>
        </select>
      </div>
    </div>

    <div className="kv" style={{ marginBottom: 16 }}>
      <div className="kv-row">
        <span>Reporting Period</span>
        <span>{periodText.replace('Reporting Period: ', '')}</span>
      </div>
      <div className="kv-row">
        <span>Tax Type Filter</span>
        <span>
          {taxReportComponentKind === 'all'
            ? 'All Tax Types'
            : taxComponentKindLabel(Number(taxReportComponentKind))}
        </span>
      </div>
      <div className="kv-row">
        <span>Transaction Scope Filter</span>
        <span>
          {taxReportTransactionScope === 'all'
            ? 'All Scopes'
            : taxTransactionScopeLabel(Number(taxReportTransactionScope))}
        </span>
      </div>
      <div className="kv-row">
        <span>Tax Line Count</span>
        <span>{taxReportQ.data.count}</span>
      </div>
      <div className="kv-row">
        <span>Total Taxable Amount</span>
        <span>{formatAmount(taxReportQ.data.totalTaxableAmount)}</span>
      </div>
      <div className="kv-row">
        <span>Total Tax Amount</span>
        <span>{formatAmount(taxReportQ.data.totalTaxAmount)}</span>
      </div>
      <div className="kv-row">
        <span>Total Additions</span>
        <span>{formatAmount(taxReportQ.data.totalAdditions)}</span>
      </div>
      <div className="kv-row">
        <span>Total Deductions</span>
        <span>{formatAmount(taxReportQ.data.totalDeductions)}</span>
      </div>
    </div>

    <div className="section-heading">
      <div>
        <h2>Tax Summary by Type</h2>
        <span className="muted">Grouped VAT/WHT/Other tax totals</span>
      </div>
    </div>

    <div className="table-wrap" style={{ marginBottom: 16 }}>
      <table className="data-table report-print-table">
        <thead>
          <tr>
            <th>Tax Type</th>
            <th style={{ textAlign: 'right' }}>Count</th>
            <th style={{ textAlign: 'right' }}>Taxable Amount</th>
            <th style={{ textAlign: 'right' }}>Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          {taxReportQ.data.byComponentKind.length === 0 ? (
            <tr>
              <td colSpan={4} className="muted">
                No tax activity was found for the selected filters.
              </td>
            </tr>
          ) : (
            taxReportQ.data.byComponentKind.map((item) => (
              <tr key={item.componentKind}>
                <td>{taxComponentKindLabel(item.componentKind)}</td>
                <td style={{ textAlign: 'right' }}>{item.count}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.totalTaxableAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.totalTaxAmount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <div className="section-heading">
      <div>
        <h2>Tax Summary by Tax Code</h2>
        <span className="muted">Grouped totals by configured tax code</span>
      </div>
    </div>

    <div className="table-wrap" style={{ marginBottom: 16 }}>
      <table className="data-table report-print-table">
        <thead>
          <tr>
            <th>Tax Code</th>
            <th>Tax Name</th>
            <th>Kind</th>
            <th>Mode</th>
            <th>Scope</th>
            <th style={{ textAlign: 'right' }}>Rate %</th>
            <th style={{ textAlign: 'right' }}>Count</th>
            <th style={{ textAlign: 'right' }}>Taxable Amount</th>
            <th style={{ textAlign: 'right' }}>Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          {taxReportQ.data.byTaxCode.length === 0 ? (
            <tr>
              <td colSpan={9} className="muted">
                No tax-code activity was found for the selected filters.
              </td>
            </tr>
          ) : (
            taxReportQ.data.byTaxCode.map((item) => (
              <tr key={item.taxCodeId}>
                <td>{item.taxCode || '—'}</td>
                <td>{item.taxCodeName || '—'}</td>
                <td>{taxComponentKindLabel(item.componentKind)}</td>
                <td>{taxApplicationModeLabel(item.applicationMode)}</td>
                <td>{taxTransactionScopeLabel(item.transactionScope)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.ratePercent)}</td>
                <td style={{ textAlign: 'right' }}>{item.count}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.totalTaxableAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.totalTaxAmount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    <div className="section-heading">
      <div>
        <h2>Tax Movement Details</h2>
        <span className="muted">Line-level VAT/WHT/Other tax activity</span>
      </div>
    </div>

    <div className="table-wrap">
      <table className="data-table report-print-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Document</th>
            <th>Counterparty</th>
            <th>Tax Code</th>
            <th>Kind</th>
            <th>Mode</th>
            <th>Scope</th>
            <th style={{ textAlign: 'right' }}>Rate %</th>
            <th style={{ textAlign: 'right' }}>Taxable Amount</th>
            <th style={{ textAlign: 'right' }}>Tax Amount</th>
          </tr>
        </thead>
        <tbody>
          {taxReportQ.data.items.length === 0 ? (
            <tr>
              <td colSpan={10} className="muted">
                No tax movement lines were found for the selected filters.
              </td>
            </tr>
          ) : (
            taxReportQ.data.items.map((item) => (
              <tr key={item.id}>
                <td>{formatDateTime(item.transactionDateUtc)}</td>
                <td>
                  <div>{item.sourceDocumentNumber}</div>
                  <div className="muted">{item.sourceModule} / {item.sourceDocumentType}</div>
                </td>
                <td>
                  {item.counterpartyName || item.counterpartyCode
                    ? `${item.counterpartyCode || ''} ${item.counterpartyName || ''}`.trim()
                    : '—'}
                </td>
                <td>{item.taxCode || '—'}</td>
                <td>{taxComponentKindLabel(item.componentKind)}</td>
                <td>{taxApplicationModeLabel(item.applicationMode)}</td>
                <td>{taxTransactionScopeLabel(item.transactionScope)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.ratePercent)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.taxableAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.taxAmount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </section>

      <ReportSectionDivider
        title="Subledger Operational Reports"
        subtitle="Review Accounts Receivable and Accounts Payable transaction summaries after workflow processing."
      />

<section id="print-accounts-receivable-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Accounts Receivable Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printReceivablesSummaryStandalone}>
            Print Receivables Summary
          </button>
        </div>

        <ReportPrintHeader title="Accounts Receivable Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Invoices</span>
            <span>{arSummary.totalInvoices}</span>
          </div>
          <div className="kv-row">
            <span>Total Invoiced</span>
            <span>{formatAmount(arSummary.totalInvoiced)}</span>
          </div>
          <div className="kv-row">
            <span>Total Collected</span>
            <span>{formatAmount(arSummary.totalCollected)}</span>
          </div>
          <div className="kv-row">
            <span>Total Outstanding</span>
            <span>{formatAmount(arSummary.totalOutstanding)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Invoices</span>
            <span>{arSummary.draftInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Submitted Invoices</span>
            <span>{arSummary.submittedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Approved Invoices</span>
            <span>{arSummary.approvedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Invoices</span>
            <span>{arSummary.postedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Part Paid Invoices</span>
            <span>{arSummary.partPaidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Paid Invoices</span>
            <span>{arSummary.paidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Rejected Invoices</span>
            <span>{arSummary.rejectedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Invoices</span>
            <span>{arSummary.cancelledInvoiceCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredSalesInvoices.map((item) => (
                <tr key={item.id}>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.customerCode} - {item.customerName}</td>
                  <td>{item.description}</td>
                  <td>{invoiceStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amountPaid)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalInvoiced)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalCollected)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalOutstanding)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

<section id="print-customer-receipts-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Customer Receipts Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printCustomerReceiptsSummaryStandalone}>
            Print Receipts Summary
          </button>
        </div>

        <ReportPrintHeader title="Customer Receipts Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Receipts</span>
            <span>{arSummary.totalReceipts}</span>
          </div>
          <div className="kv-row">
            <span>Total Receipt Amount</span>
            <span>{formatAmount(arSummary.totalReceiptAmount)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Receipts</span>
            <span>{arSummary.draftReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Submitted Receipts</span>
            <span>{arSummary.submittedReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Approved Receipts</span>
            <span>{arSummary.approvedReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Rejected Receipts</span>
            <span>{arSummary.rejectedReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Receipts</span>
            <span>{arSummary.postedReceiptCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Receipts</span>
            <span>{arSummary.cancelledReceiptCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Receipt Number</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Receipt Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomerReceipts.map((item) => (
                <tr key={item.id}>
                  <td>{item.receiptNumber}</td>
                  <td>{item.customerCode} - {item.customerName}</td>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.description}</td>
                  <td>{receiptStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                  <td>{formatDateTime(item.receiptDateUtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(arSummary.totalReceiptAmount)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

<section id="print-accounts-payable-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Accounts Payable Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printPayablesSummaryStandalone}>
            Print Payables Summary
          </button>
        </div>

        <ReportPrintHeader title="Accounts Payable Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Purchase Invoices</span>
            <span>{apSummary.totalInvoices}</span>
          </div>
          <div className="kv-row">
            <span>Total Invoiced</span>
            <span>{formatAmount(apSummary.totalInvoiced)}</span>
          </div>
          <div className="kv-row">
            <span>Total Paid</span>
            <span>{formatAmount(apSummary.totalPaid)}</span>
          </div>
          <div className="kv-row">
            <span>Total Outstanding</span>
            <span>{formatAmount(apSummary.totalOutstanding)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Invoices</span>
            <span>{apSummary.draftInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Submitted Invoices</span>
            <span>{apSummary.submittedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Approved Invoices</span>
            <span>{apSummary.approvedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Invoices</span>
            <span>{apSummary.postedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Part Paid Invoices</span>
            <span>{apSummary.partPaidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Paid Invoices</span>
            <span>{apSummary.paidInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Rejected Invoices</span>
            <span>{apSummary.rejectedInvoiceCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Invoices</span>
            <span>{apSummary.cancelledInvoiceCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Invoice Number</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Amount Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchaseInvoices.map((item) => (
                <tr key={item.id}>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.vendorCode} - {item.vendorName}</td>
                  <td>{item.description}</td>
                  <td>{purchaseInvoiceStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amountPaid)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.balanceAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={4}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalInvoiced)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalPaid)}</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalOutstanding)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

<section id="print-vendor-payments-summary" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Vendor Payments Summary</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={printVendorPaymentsSummaryStandalone}>
            Print Vendor Payments Summary
          </button>
        </div>

        <ReportPrintHeader title="Vendor Payments Summary" subtitle={periodText} />

        <div className="kv" style={{ marginBottom: 16 }}>
          <div className="kv-row">
            <span>Reporting Period</span>
            <span>{periodText.replace('Reporting Period: ', '')}</span>
          </div>
          <div className="kv-row">
            <span>Total Payments</span>
            <span>{apSummary.totalPayments}</span>
          </div>
          <div className="kv-row">
            <span>Total Payment Amount</span>
            <span>{formatAmount(apSummary.totalPaymentAmount)}</span>
          </div>
          <div className="kv-row">
            <span>Draft Payments</span>
            <span>{apSummary.draftPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Submitted for Approval</span>
            <span>{apSummary.submittedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Approved Payments</span>
            <span>{apSummary.approvedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Rejected Payments</span>
            <span>{apSummary.rejectedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Posted Payments</span>
            <span>{apSummary.postedPaymentCount}</span>
          </div>
          <div className="kv-row">
            <span>Cancelled Payments</span>
            <span>{apSummary.cancelledPaymentCount}</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Payment Number</th>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Description</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Payment Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendorPayments.map((item) => (
                <tr key={item.id}>
                  <td>{item.paymentNumber}</td>
                  <td>{item.vendorCode} - {item.vendorName}</td>
                  <td>{item.invoiceNumber}</td>
                  <td>{item.description}</td>
                  <td>{vendorPaymentStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                  <td>{formatDateTime(item.paymentDateUtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>Total</th>
                <th style={{ textAlign: 'right' }}>{formatAmount(apSummary.totalPaymentAmount)}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}