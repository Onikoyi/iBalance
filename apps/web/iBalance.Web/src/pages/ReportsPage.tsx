import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getBalanceSheet,
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
} from '../lib/api';
import { canViewReports } from '../lib/auth';

function toUtcStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toUtcEnd(date: string) {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayInputValue() {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function formatDate(value?: string | null) {
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
  if (!fromDate || !toDate) return 'Reporting Period: Select From Date and To Date';
  return `Reporting Period: ${formatDate(`${fromDate}T00:00:00`)} to ${formatDate(`${toDate}T00:00:00`)}`;
}

function buildAsAtText(asAtDate: string) {
  return asAtDate ? `As At: ${formatDate(`${asAtDate}T00:00:00`)}` : 'As At: Select date';
}

function statusLabel(value?: number | null) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted';
    case 3: return 'Approved';
    case 4: return 'Posted';
    case 5: return 'Part Paid';
    case 6: return 'Paid';
    case 7: return 'Rejected';
    case 8: return 'Cancelled';
    default: return 'Unknown';
  }
}

function receiptStatusLabel(value?: number | null) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Posted';
    case 6: return 'Cancelled';
    default: return 'Unknown';
  }
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function LogoSlot({ src, fallbackText }: { src: string; fallbackText: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallbackText}
        style={{ height: 42, maxWidth: 180, objectFit: 'contain' }}
      />
    );
  }

  return <div className="print-logo-fallback">{fallbackText}</div>;
}

function ReportPrintHeader({
  title,
  subtitle,
  tenantKey,
  tenantLogo,
  companyLogo,
}: {
  title: string;
  subtitle: string;
  tenantKey: string;
  tenantLogo: string;
  companyLogo: string;
}) {
  return (
    <div className="print-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <LogoSlot src={companyLogo} fallbackText="Company" />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Company Report</div>
          <div className="muted">Tenant: {tenantKey}</div>
          <div className="muted">Generated: {formatDateTime(new Date().toISOString())}</div>
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <LogoSlot src={tenantLogo} fallbackText="Tenant" />
        <h2 style={{ margin: '8px 0 4px' }}>{title}</h2>
        <div className="muted">{subtitle}</div>
      </div>
    </div>
  );
}

function ReportSectionDivider({ title, subtitle }: { title: string; subtitle: string }) {
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

function buildPrintHtml(sectionHtml: string, title: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: Arial, Helvetica, sans-serif; line-height: 1.35; }
    .no-print, button, a { display: none !important; }
    .print-header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 2px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    .print-logo-fallback { min-width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: rgba(75, 29, 115, 0.12); font-weight: 700; }
    .muted { color: #4b5563; font-size: 12px; }
    h2 { margin: 0 0 6px; }
    h3 { margin: 18px 0 8px; }
    .kv { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 14px 0 18px; }
    .kv-row { border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 10px; display: grid; gap: 4px; }
    .kv-row span:first-child { color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; font-size: 10.5px; }
    .right { text-align: right; }
    tr { break-inside: avoid; }
    .report-footer { margin-top: 12px; display: flex; justify-content: space-between; color: #6b7280; font-size: 11px; }
  </style>
</head>
<body>${sectionHtml}</body>
</html>`;
}

function printSection(sectionId: string, title: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const iframe = document.createElement('iframe');
  iframe.title = 'Report Print Frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument || frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    document.body.removeChild(iframe);
    return;
  }

  frameDocument.open();
  frameDocument.write(buildPrintHtml(section.innerHTML, title));
  frameDocument.close();

  iframe.onload = () => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.parentNode?.removeChild(iframe), 500);
  };
}

function filterByDateRange<T extends { invoiceDateUtc?: string | null; receiptDateUtc?: string | null; paymentDateUtc?: string | null }>(
  rows: T[],
  fromDate: string,
  toDate: string,
  key: keyof T
) {
  const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;

  return rows.filter((row) => {
    const raw = row[key];
    if (!raw) return true;
    const time = new Date(String(raw)).getTime();
    if (Number.isNaN(time)) return true;
    return time >= from && time <= to;
  });
}

export function ReportsPage() {
  const canView = canViewReports();

  const [fromDate, setFromDate] = useState(firstDayInputValue());
  const [toDate, setToDate] = useState(todayInputValue());
  const [balanceSheetAsAtDate, setBalanceSheetAsAtDate] = useState(todayInputValue());
  const [taxReportComponentKind, setTaxReportComponentKind] = useState('all');
  const [taxReportTransactionScope, setTaxReportTransactionScope] = useState('all');
  const [arStatusFilter, setArStatusFilter] = useState('all');
  const [apStatusFilter, setApStatusFilter] = useState('all');

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const fromUtc = useMemo(() => toUtcStart(fromDate), [fromDate]);
  const toUtc = useMemo(() => toUtcEnd(toDate), [toDate]);
  const periodText = buildReportingPeriodText(fromDate, toDate);
  const asAtText = buildAsAtText(balanceSheetAsAtDate);

  const trialBalanceQ = useQuery({
    queryKey: ['trial-balance', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getTrialBalance(fromUtc, toUtc),
    enabled: canView && !!fromDate && !!toDate,
  });

  const balanceSheetQ = useQuery({
    queryKey: ['balance-sheet', balanceSheetAsAtDate],
    queryFn: () => getBalanceSheet(),
    enabled: canView,
  });

  const incomeStatementQ = useQuery({
    queryKey: ['income-statement', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getIncomeStatement(fromUtc, toUtc),
    enabled: canView && !!fromDate && !!toDate,
  });

  const taxReportQ = useQuery({
    queryKey: ['tax-report', fromUtc ?? null, toUtc ?? null, taxReportComponentKind, taxReportTransactionScope],
    queryFn: () =>
      getTaxReport(
        fromUtc,
        toUtc,
        taxReportComponentKind === 'all' ? null : Number(taxReportComponentKind),
        taxReportTransactionScope === 'all' ? null : Number(taxReportTransactionScope)
      ),
    enabled: canView && !!fromDate && !!toDate,
  });

  const salesInvoicesQ = useQuery({
    queryKey: ['reports-sales-invoices'],
    queryFn: getSalesInvoices,
    enabled: canView,
  });

  const customerReceiptsQ = useQuery({
    queryKey: ['reports-customer-receipts'],
    queryFn: getCustomerReceipts,
    enabled: canView,
  });

  const purchaseInvoicesQ = useQuery({
    queryKey: ['reports-purchase-invoices'],
    queryFn: getPurchaseInvoices,
    enabled: canView,
  });

  const vendorPaymentsQ = useQuery({
    queryKey: ['reports-vendor-payments'],
    queryFn: getVendorPayments,
    enabled: canView,
  });

  const trialBalance = trialBalanceQ.data as any;
  const balanceSheet = balanceSheetQ.data as any;
  const incomeStatement = incomeStatementQ.data as any;
  const taxReport = taxReportQ.data as any;

  const salesInvoices = useMemo(() => {
    const rows = filterByDateRange((salesInvoicesQ.data?.items ?? []) as any[], fromDate, toDate, 'invoiceDateUtc');
    return rows.filter((x) => arStatusFilter === 'all' || String(x.status) === arStatusFilter);
  }, [salesInvoicesQ.data?.items, fromDate, toDate, arStatusFilter]);

  const customerReceipts = useMemo(() => {
    return filterByDateRange((customerReceiptsQ.data?.items ?? []) as any[], fromDate, toDate, 'receiptDateUtc');
  }, [customerReceiptsQ.data?.items, fromDate, toDate]);

  const purchaseInvoices = useMemo(() => {
    const rows = filterByDateRange((purchaseInvoicesQ.data?.items ?? []) as any[], fromDate, toDate, 'invoiceDateUtc');
    return rows.filter((x) => apStatusFilter === 'all' || String(x.status) === apStatusFilter);
  }, [purchaseInvoicesQ.data?.items, fromDate, toDate, apStatusFilter]);

  const vendorPayments = useMemo(() => {
    return filterByDateRange((vendorPaymentsQ.data?.items ?? []) as any[], fromDate, toDate, 'paymentDateUtc');
  }, [vendorPaymentsQ.data?.items, fromDate, toDate]);

  const arSummary = useMemo(() => ({
    invoiceCount: salesInvoices.length,
    invoiceAmount: salesInvoices.reduce((sum, x) => sum + Number(x.netReceivableAmount || x.totalAmount || 0), 0),
    paidAmount: salesInvoices.reduce((sum, x) => sum + Number(x.amountPaid || 0), 0),
    outstandingAmount: salesInvoices.reduce((sum, x) => sum + Number(x.balanceAmount || 0), 0),
    receiptCount: customerReceipts.length,
    receiptAmount: customerReceipts.reduce((sum, x) => sum + Number(x.amount || 0), 0),
  }), [salesInvoices, customerReceipts]);

  const apSummary = useMemo(() => ({
    invoiceCount: purchaseInvoices.length,
    invoiceAmount: purchaseInvoices.reduce((sum, x) => sum + Number(x.netPayableAmount || x.totalAmount || 0), 0),
    paidAmount: purchaseInvoices.reduce((sum, x) => sum + Number(x.amountPaid || 0), 0),
    outstandingAmount: purchaseInvoices.reduce((sum, x) => sum + Number(x.balanceAmount || 0), 0),
    paymentCount: vendorPayments.length,
    paymentAmount: vendorPayments.reduce((sum, x) => sum + Number(x.amount || 0), 0),
  }), [purchaseInvoices, vendorPayments]);

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view reports.</div>;
  }

  const hasAnyReportError =
    trialBalanceQ.isError ||
    balanceSheetQ.isError ||
    incomeStatementQ.isError ||
    taxReportQ.isError ||
    salesInvoicesQ.isError ||
    customerReceiptsQ.isError ||
    purchaseInvoicesQ.isError ||
    vendorPaymentsQ.isError;

  const isInitialLoading =
    trialBalanceQ.isLoading &&
    balanceSheetQ.isLoading &&
    incomeStatementQ.isLoading &&
    taxReportQ.isLoading &&
    salesInvoicesQ.isLoading &&
    customerReceiptsQ.isLoading &&
    purchaseInvoicesQ.isLoading &&
    vendorPaymentsQ.isLoading;

  if (isInitialLoading) {
    return <div className="panel">Loading financial reports...</div>;
  }

  return (
    <div className="reports-grid">
      {hasAnyReportError ? (
        <section className="panel">
          <div className="muted">
            Some report datasets could not be loaded for the current role or selected filters. Available report sections remain usable below.
          </div>
        </section>
      ) : null}
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Financial Reports</h2>
            <div className="muted">
              Reports now contains only financial and operational reporting. Bank reconciliation has been moved into the standalone Reconciliation module.
            </div>
          </div>
          <Link to="/reconciliation" className="button">Open Reconciliation Module</Link>
        </div>

        <div className="form-grid three">
          <div className="form-row">
            <label>From Date</label>
            <input type="date" className="input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>To Date</label>
            <input type="date" className="input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Balance Sheet As At Date</label>
            <input type="date" className="input" value={balanceSheetAsAtDate} onChange={(e) => setBalanceSheetAsAtDate(e.target.value)} />
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
        title="Core Financial Statements"
        subtitle="Trial Balance, Balance Sheet, and Income Statement with company and tenant report headers."
      />

      <section id="print-trial-balance" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Trial Balance</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-trial-balance', 'Trial Balance')}>Print Trial Balance</button>
        </div>

        <ReportPrintHeader title="Trial Balance" subtitle={periodText} tenantKey={tenantKey} tenantLogo={tenantLogo} companyLogo={companyLogo} />

        <div className="kv">
          <div className="kv-row"><span>Total Debit</span><span>{formatAmount(trialBalance?.totalDebit)}</span></div>
          <div className="kv-row"><span>Total Credit</span><span>{formatAmount(trialBalance?.totalCredit)}</span></div>
          <div className="kv-row"><span>Rows</span><span>{trialBalance?.count ?? 0}</span></div>
          <div className="kv-row"><span>Status</span><span>{Math.abs(Number(trialBalance?.totalDebit || 0) - Number(trialBalance?.totalCredit || 0)) < 0.01 ? 'Balanced' : 'Out of Balance'}</span></div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Total Debit</th>
                <th style={{ textAlign: 'right' }}>Total Credit</th>
                <th style={{ textAlign: 'right' }}>Balance Debit</th>
                <th style={{ textAlign: 'right' }}>Balance Credit</th>
              </tr>
            </thead>
            <tbody>
              {(trialBalance?.items ?? []).map((row: any) => (
                <tr key={row.ledgerAccountId}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(row.totalDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(row.totalCredit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(row.balanceDebit)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(row.balanceCredit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="print-balance-sheet" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Balance Sheet</h2>
            <span className="muted">{asAtText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-balance-sheet', 'Balance Sheet')}>Print Balance Sheet</button>
        </div>

        <ReportPrintHeader title="Balance Sheet" subtitle={asAtText} tenantKey={tenantKey} tenantLogo={tenantLogo} companyLogo={companyLogo} />

        <div className="kv">
          <div className="kv-row"><span>Total Assets</span><span>{formatAmount(balanceSheet?.totalAssets)}</span></div>
          <div className="kv-row"><span>Total Liabilities</span><span>{formatAmount(balanceSheet?.totalLiabilities)}</span></div>
          <div className="kv-row"><span>Total Equity</span><span>{formatAmount(balanceSheet?.totalEquity)}</span></div>
          <div className="kv-row"><span>Liabilities + Equity</span><span>{formatAmount(balanceSheet?.totalLiabilitiesAndEquity)}</span></div>
        </div>

        {[
          ['Assets', balanceSheet?.assets ?? []],
          ['Liabilities', balanceSheet?.liabilities ?? []],
          ['Equity', balanceSheet?.equity ?? []],
        ].map(([title, rows]) => (
          <div key={title as string} style={{ marginTop: 16 }}>
            <h3>{title as string}</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as any[]).map((row: any) => (
                    <tr key={row.ledgerAccountId}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.totalDebit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.totalCredit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.amount ?? row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section id="print-income-statement" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Income Statement</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-income-statement', 'Income Statement')}>Print Income Statement</button>
        </div>

        <ReportPrintHeader title="Income Statement" subtitle={periodText} tenantKey={tenantKey} tenantLogo={tenantLogo} companyLogo={companyLogo} />

        <div className="kv">
          <div className="kv-row"><span>Total Income</span><span>{formatAmount(incomeStatement?.totalIncome)}</span></div>
          <div className="kv-row"><span>Total Expenses</span><span>{formatAmount(incomeStatement?.totalExpenses)}</span></div>
          <div className="kv-row"><span>Net Income</span><span>{formatAmount(incomeStatement?.netIncome)}</span></div>
          <div className="kv-row"><span>Period</span><span>{formatDate(`${fromDate}T00:00:00`)} - {formatDate(`${toDate}T00:00:00`)}</span></div>
        </div>

        {[
          ['Income', incomeStatement?.income ?? []],
          ['Expenses', incomeStatement?.expenses ?? []],
        ].map(([title, rows]) => (
          <div key={title as string} style={{ marginTop: 16 }}>
            <h3>{title as string}</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as any[]).map((row: any) => (
                    <tr key={row.ledgerAccountId}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.totalDebit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.totalCredit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.amount ?? row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <ReportSectionDivider
        title="Tax Reports"
        subtitle="Review VAT, WHT, and other tax movements generated from sales and purchase invoices."
      />

      <section className="panel no-print">
        <div className="form-grid two">
          <div className="form-row">
            <label>Tax Component</label>
            <select className="select" value={taxReportComponentKind} onChange={(e) => setTaxReportComponentKind(e.target.value)}>
              <option value="all">All Components</option>
              <option value="1">VAT</option>
              <option value="2">WHT</option>
              <option value="3">Other</option>
            </select>
          </div>

          <div className="form-row">
            <label>Transaction Scope</label>
            <select className="select" value={taxReportTransactionScope} onChange={(e) => setTaxReportTransactionScope(e.target.value)}>
              <option value="all">All Scopes</option>
              <option value="1">Sales</option>
              <option value="2">Purchases</option>
              <option value="3">Both</option>
            </select>
          </div>
        </div>
      </section>

      <section id="print-tax-report" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>VAT / WHT / Other Tax Report</h2>
            <span className="muted">{periodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-tax-report', 'Tax Report')}>Print Tax Report</button>
        </div>

        <ReportPrintHeader title="Tax Report" subtitle={periodText} tenantKey={tenantKey} tenantLogo={tenantLogo} companyLogo={companyLogo} />

        <div className="kv">
          <div className="kv-row"><span>Tax Lines</span><span>{taxReport?.count ?? 0}</span></div>
          <div className="kv-row"><span>Taxable Amount</span><span>{formatAmount(taxReport?.totalTaxableAmount)}</span></div>
          <div className="kv-row"><span>Tax Amount</span><span>{formatAmount(taxReport?.totalTaxAmount)}</span></div>
          <div className="kv-row"><span>Period</span><span>{formatDate(`${fromDate}T00:00:00`)} - {formatDate(`${toDate}T00:00:00`)}</span></div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Tax Code</th>
                <th>Component</th>
                <th>Scope</th>
                <th style={{ textAlign: 'right' }}>Taxable</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
              </tr>
            </thead>
            <tbody>
              {(taxReport?.items ?? []).length === 0 ? (
                <tr><td colSpan={7} className="muted">No tax lines found for the selected filter.</td></tr>
              ) : (
                (taxReport?.items ?? []).map((row: any) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.transactionDateUtc)}</td>
                    <td>{row.sourceReference || row.reference || '—'}</td>
                    <td>{row.taxCode || row.taxCodeName || row.code || '—'}</td>
                    <td>{row.componentKindLabel || row.componentKind || '—'}</td>
                    <td>{row.transactionScopeLabel || row.transactionScope || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(row.taxableAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(row.taxAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ReportSectionDivider
        title="Accounts Receivable Reports"
        subtitle="Detailed customer invoice and receipt reporting. Ageing remains available in the Ageing Analysis module."
      />

      <section className="panel no-print">
        <div className="form-row">
          <label>AR Invoice Status</label>
          <select className="select" value={arStatusFilter} onChange={(e) => setArStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="1">Draft</option>
            <option value="2">Submitted</option>
            <option value="3">Approved</option>
            <option value="4">Posted</option>
            <option value="5">Part Paid</option>
            <option value="6">Paid</option>
            <option value="8">Cancelled</option>
          </select>
        </div>
      </section>

      <section id="print-ar-report" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Accounts Receivable Report</h2>
            <span className="muted">Sales invoices and customer receipts · {periodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-ar-report', 'Accounts Receivable Report')}>Print AR Report</button>
        </div>

        <ReportPrintHeader title="Accounts Receivable Report" subtitle={periodText} tenantKey={tenantKey} tenantLogo={tenantLogo} companyLogo={companyLogo} />

        <div className="kv">
          <div className="kv-row"><span>Invoices</span><span>{arSummary.invoiceCount}</span></div>
          <div className="kv-row"><span>Invoice Amount</span><span>{formatAmount(arSummary.invoiceAmount)}</span></div>
          <div className="kv-row"><span>Paid Amount</span><span>{formatAmount(arSummary.paidAmount)}</span></div>
          <div className="kv-row"><span>Outstanding</span><span>{formatAmount(arSummary.outstandingAmount)}</span></div>
          <div className="kv-row"><span>Receipts</span><span>{arSummary.receiptCount}</span></div>
          <div className="kv-row"><span>Receipt Amount</span><span>{formatAmount(arSummary.receiptAmount)}</span></div>
        </div>

        <h3>Sales Invoices</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Base</th>
                <th style={{ textAlign: 'right' }}>Tax Add</th>
                <th style={{ textAlign: 'right' }}>Tax Deduct</th>
                <th style={{ textAlign: 'right' }}>Net Receivable</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {salesInvoices.length === 0 ? (
                <tr><td colSpan={10} className="muted">No sales invoices found for the selected filter.</td></tr>
              ) : (
                salesInvoices.map((invoice: any) => (
                  <tr key={invoice.id}>
                    <td>{formatDate(invoice.invoiceDateUtc)}</td>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{[invoice.customerCode, invoice.customerName].filter(Boolean).join(' - ')}</td>
                    <td>{statusLabel(invoice.status)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.taxAdditionAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.taxDeductionAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.netReceivableAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.amountPaid)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.balanceAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3>Customer Receipts</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Receipt No.</th>
                <th>Customer</th>
                <th>Invoice No.</th>
                <th>Status</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {customerReceipts.length === 0 ? (
                <tr><td colSpan={7} className="muted">No customer receipts found for the selected period.</td></tr>
              ) : (
                customerReceipts.map((receipt: any) => (
                  <tr key={receipt.id}>
                    <td>{formatDate(receipt.receiptDateUtc)}</td>
                    <td>{receipt.receiptNumber}</td>
                    <td>{[receipt.customerCode, receipt.customerName].filter(Boolean).join(' - ')}</td>
                    <td>{receipt.invoiceNumber || '—'}</td>
                    <td>{receiptStatusLabel(receipt.status)}</td>
                    <td>{receipt.description || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(receipt.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ReportSectionDivider
        title="Accounts Payable Reports"
        subtitle="Detailed vendor invoice and payment reporting. Ageing remains available in the Ageing Analysis module."
      />

      <section className="panel no-print">
        <div className="form-row">
          <label>AP Invoice Status</label>
          <select className="select" value={apStatusFilter} onChange={(e) => setApStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="1">Draft</option>
            <option value="2">Submitted</option>
            <option value="3">Approved</option>
            <option value="4">Posted</option>
            <option value="5">Part Paid</option>
            <option value="6">Paid</option>
            <option value="8">Cancelled</option>
          </select>
        </div>
      </section>

      <section id="print-ap-report" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Accounts Payable Report</h2>
            <span className="muted">Purchase invoices and vendor payments · {periodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-ap-report', 'Accounts Payable Report')}>Print AP Report</button>
        </div>

        <ReportPrintHeader title="Accounts Payable Report" subtitle={periodText} tenantKey={tenantKey} tenantLogo={tenantLogo} companyLogo={companyLogo} />

        <div className="kv">
          <div className="kv-row"><span>Invoices</span><span>{apSummary.invoiceCount}</span></div>
          <div className="kv-row"><span>Invoice Amount</span><span>{formatAmount(apSummary.invoiceAmount)}</span></div>
          <div className="kv-row"><span>Paid Amount</span><span>{formatAmount(apSummary.paidAmount)}</span></div>
          <div className="kv-row"><span>Outstanding</span><span>{formatAmount(apSummary.outstandingAmount)}</span></div>
          <div className="kv-row"><span>Payments</span><span>{apSummary.paymentCount}</span></div>
          <div className="kv-row"><span>Payment Amount</span><span>{formatAmount(apSummary.paymentAmount)}</span></div>
        </div>

        <h3>Purchase Invoices</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th>Vendor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Base</th>
                <th style={{ textAlign: 'right' }}>Tax Add</th>
                <th style={{ textAlign: 'right' }}>Tax Deduct</th>
                <th style={{ textAlign: 'right' }}>Net Payable</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {purchaseInvoices.length === 0 ? (
                <tr><td colSpan={10} className="muted">No purchase invoices found for the selected filter.</td></tr>
              ) : (
                purchaseInvoices.map((invoice: any) => (
                  <tr key={invoice.id}>
                    <td>{formatDate(invoice.invoiceDateUtc)}</td>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{[invoice.vendorCode, invoice.vendorName].filter(Boolean).join(' - ')}</td>
                    <td>{statusLabel(invoice.status)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.totalAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.taxAdditionAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.taxDeductionAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.netPayableAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.amountPaid)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(invoice.balanceAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3>Vendor Payments</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payment No.</th>
                <th>Vendor</th>
                <th>Invoice No.</th>
                <th>Status</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {vendorPayments.length === 0 ? (
                <tr><td colSpan={7} className="muted">No vendor payments found for the selected period.</td></tr>
              ) : (
                vendorPayments.map((payment: any) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.paymentDateUtc)}</td>
                    <td>{payment.paymentNumber}</td>
                    <td>{[payment.vendorCode, payment.vendorName].filter(Boolean).join(' - ')}</td>
                    <td>{payment.invoiceNumber || '—'}</td>
                    <td>{receiptStatusLabel(payment.status)}</td>
                    <td>{payment.description || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(payment.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ReportSectionDivider
        title="Fixed Asset Reports"
        subtitle="Open the fixed asset register and depreciation workspace in clean standalone pages."
      />

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Fixed Asset Reporting</h2>
            <div className="muted">Fixed asset register, depreciation operations, and lifecycle reporting entry points.</div>
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: 12 }}>
          <Link to="/fixed-assets" className="button primary">Open Fixed Assets</Link>
          <Link to="/fixed-assets/depreciation-runs" className="button">Depreciation Runs</Link>
          <Link to="/fixed-assets/register/print" className="button">Asset Register Print</Link>
        </div>
      </section>
    </div>
  );
}
