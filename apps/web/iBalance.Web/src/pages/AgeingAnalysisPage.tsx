import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getAccountsPayableAgeingAnalysis,
  getAccountsReceivableAgeingAnalysis,
  getCompanyLogoDataUrl,
  getCustomers,
  getTenantKey,
  getTenantLogoDataUrl,
  getVendors,
  type AgeingAnalysisDetailRowDto,
  type AgeingAnalysisResponse,
  type AgeingAnalysisSummaryRowDto,
} from '../lib/api';
import { canViewReports } from '../lib/auth';

type AgeingScope = 'AR' | 'AP';
type ViewMode = 'summary' | 'detail';

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateInputToUtcEnd(value: string) {
  return value ? new Date(value + 'T23:59:59.999Z').toISOString() : undefined;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function logoOrFallback(src: string, fallback: string) {
  return src
    ? `<img src="${src}" alt="${escapeHtml(fallback)}" style="height:42px;max-width:180px;object-fit:contain;" />`
    : `<div style="min-width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(75,29,115,0.12);font-weight:700;">${escapeHtml(fallback)}</div>`;
}

function buildPrintHtml(data: AgeingAnalysisResponse, viewMode: ViewMode) {
  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();
  const rows = viewMode === 'summary'
    ? data.summaryItems.map((item) => `
      <tr>
        <td>${escapeHtml(item.partyCode || '')}</td>
        <td>${escapeHtml(item.partyName || '')}</td>
        <td class="right">${item.invoiceCount}</td>
        <td class="right">${formatAmount(item.invoiceAmount)}</td>
        <td class="right">${formatAmount(item.paidAmount)}</td>
        <td class="right">${formatAmount(item.outstandingAmount)}</td>
        <td class="right">${formatAmount(item.currentAmount)}</td>
        <td class="right">${formatAmount(item.days1To30Amount)}</td>
        <td class="right">${formatAmount(item.days31To60Amount)}</td>
        <td class="right">${formatAmount(item.days61To90Amount)}</td>
        <td class="right">${formatAmount(item.days91To120Amount)}</td>
        <td class="right">${formatAmount(item.over120Amount)}</td>
      </tr>`).join('')
    : data.detailItems.map((item) => `
      <tr>
        <td>${escapeHtml(item.partyCode || '')}</td>
        <td>${escapeHtml(item.partyName || '')}</td>
        <td>${escapeHtml(item.invoiceNumber || '')}</td>
        <td>${formatDate(item.invoiceDateUtc)}</td>
        <td class="right">${item.daysOutstanding}</td>
        <td>${escapeHtml(item.ageBucket || '')}</td>
        <td class="right">${formatAmount(item.invoiceAmount)}</td>
        <td class="right">${formatAmount(item.paidAmount)}</td>
        <td class="right">${formatAmount(item.outstandingAmount)}</td>
        <td class="right">${formatAmount(item.currentAmount)}</td>
        <td class="right">${formatAmount(item.days1To30Amount)}</td>
        <td class="right">${formatAmount(item.days31To60Amount)}</td>
        <td class="right">${formatAmount(item.days61To90Amount)}</td>
        <td class="right">${formatAmount(item.days91To120Amount)}</td>
        <td class="right">${formatAmount(item.over120Amount)}</td>
      </tr>`).join('');

  const header = viewMode === 'summary'
    ? '<tr><th>Code</th><th>Name</th><th class="right">Invoices</th><th class="right">Invoice Amount</th><th class="right">Paid</th><th class="right">Outstanding</th><th class="right">Current</th><th class="right">1-30</th><th class="right">31-60</th><th class="right">61-90</th><th class="right">91-120</th><th class="right">120+</th></tr>'
    : '<tr><th>Code</th><th>Name</th><th>Invoice</th><th>Date</th><th class="right">Days</th><th>Bucket</th><th class="right">Invoice Amount</th><th class="right">Paid</th><th class="right">Outstanding</th><th class="right">Current</th><th class="right">1-30</th><th class="right">31-60</th><th class="right">61-90</th><th class="right">91-120</th><th class="right">120+</th></tr>';

  const footerColSpan = viewMode === 'summary' ? 3 : 6;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; padding: 24px; background: #fff; }
    .page { max-width: 1320px; margin: 0 auto; }
    .brand-row { display:flex; justify-content:space-between; gap:24px; align-items:center; margin-bottom:18px; }
    .brand-block { display:flex; gap:12px; align-items:center; }
    .brand-meta { display:flex; flex-direction:column; gap:4px; }
    .brand-meta span, .muted { color:#6b7280; font-size:12px; }
    .title-block { margin-bottom:18px; border-bottom:2px solid #e5e7eb; padding-bottom:12px; }
    h1 { margin:0 0 8px 0; font-size:26px; }
    .kv { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:16px; }
    .metric { border:1px solid #e5e7eb; border-radius:12px; padding:10px; }
    .metric strong { display:block; font-size:16px; margin-top:4px; }
    table { width:100%; border-collapse:collapse; margin-top:12px; }
    th, td { padding:7px; border-bottom:1px solid #e5e7eb; font-size:12px; vertical-align:top; }
    th { text-align:left; border-bottom:1px solid #d1d5db; }
    tfoot td { font-weight:700; border-top:1px solid #d1d5db; }
    .right { text-align:right; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print { body { padding:0; } .page { max-width:none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="brand-row">
      <div class="brand-block">${logoOrFallback(companyLogo, 'iBalance')}<div class="brand-meta"><strong>Nikosoft Technologies</strong><span>iBalance Accounting Cloud</span></div></div>
      <div class="brand-block">${logoOrFallback(tenantLogo, 'Org')}<div class="brand-meta"><strong>${escapeHtml(tenantKey || 'Organization')}</strong><span>Client Workspace</span></div></div>
    </div>
    <div class="title-block"><h1>${escapeHtml(data.title)}</h1><div class="muted">As At: ${formatDate(data.asOfUtc)} • ${viewMode === 'summary' ? 'Summary' : 'Detail'} View</div></div>
    <div class="kv">
      <div class="metric"><span>Total Invoice Amount</span><strong>${formatAmount(data.totalInvoiceAmount)}</strong></div>
      <div class="metric"><span>Total Paid</span><strong>${formatAmount(data.totalPaidAmount)}</strong></div>
      <div class="metric"><span>Total Outstanding</span><strong>${formatAmount(data.totalOutstandingAmount)}</strong></div>
      <div class="metric"><span>Rows</span><strong>${viewMode === 'summary' ? data.summaryCount : data.detailCount}</strong></div>
    </div>
    <table><thead>${header}</thead><tbody>${rows || `<tr><td colspan="15">No ageing balances found.</td></tr>`}</tbody><tfoot><tr><td colspan="${footerColSpan}">Total</td><td class="right">${formatAmount(data.totalInvoiceAmount)}</td><td class="right">${formatAmount(data.totalPaidAmount)}</td><td class="right">${formatAmount(data.totalOutstandingAmount)}</td><td class="right">${formatAmount(data.totalCurrentAmount)}</td><td class="right">${formatAmount(data.totalDays1To30Amount)}</td><td class="right">${formatAmount(data.totalDays31To60Amount)}</td><td class="right">${formatAmount(data.totalDays61To90Amount)}</td><td class="right">${formatAmount(data.totalDays91To120Amount)}</td><td class="right">${formatAmount(data.totalOver120Amount)}</td></tr></tfoot></table>
  </div>
</body>
</html>`;
}

function openPrintWindow(data: AgeingAnalysisResponse, viewMode: ViewMode) {
  const popup = window.open('', '_blank', 'width=1200,height=800');

  if (!popup) {
    window.alert('The ageing analysis print window was blocked by the browser. Please allow pop-ups for this site and try again.');
    return;
  }

  popup.document.open();
  popup.document.write(buildPrintHtml(data, viewMode));
  popup.document.close();
  popup.focus();

  window.setTimeout(() => {
    try {
      popup.focus();
      popup.print();
    } catch {
      // Leave the standalone print window open if the browser blocks automatic print.
    }
  }, 350);
}

export function AgeingAnalysisPage() {
  const canView = canViewReports();
  const [scope, setScope] = useState<AgeingScope>('AR');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  const [asOfDate, setAsOfDate] = useState(todayInputValue());
  const [partyId, setPartyId] = useState('');
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);

  const customersQ = useQuery({ queryKey: ['customers'], queryFn: getCustomers, enabled: canView });
  const vendorsQ = useQuery({ queryKey: ['ap-vendors'], queryFn: getVendors, enabled: canView });

  const ageingQ = useQuery({
    queryKey: ['ageing-analysis', scope, asOfDate, partyId, includeZeroBalances],
    queryFn: () => scope === 'AR'
      ? getAccountsReceivableAgeingAnalysis({ asOfUtc: dateInputToUtcEnd(asOfDate), customerId: partyId || null, includeZeroBalances })
      : getAccountsPayableAgeingAnalysis({ asOfUtc: dateInputToUtcEnd(asOfDate), vendorId: partyId || null, includeZeroBalances }),
    enabled: canView && !!asOfDate,
  });

  const parties = useMemo(() => {
    return scope === 'AR'
      ? (customersQ.data?.items ?? []).map((x) => ({ id: x.id, code: x.customerCode, name: x.customerName }))
      : (vendorsQ.data?.items ?? []).map((x) => ({ id: x.id, code: x.vendorCode, name: x.vendorName }));
  }, [scope, customersQ.data?.items, vendorsQ.data?.items]);

  const data = ageingQ.data;

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view ageing analysis reports.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Ageing Analysis</h2>
            <div className="muted">Review outstanding receivables and payables by ageing buckets as at a selected date.</div>
          </div>
          {data ? <button className="button" onClick={() => openPrintWindow(data, viewMode)}>Print Report</button> : null}
        </div>

        <div className="form-grid four">
          <div className="form-row">
            <label>Ledger Scope</label>
            <select className="select" value={scope} onChange={(e) => { setScope(e.target.value as AgeingScope); setPartyId(''); }}>
              <option value="AR">Accounts Receivable</option>
              <option value="AP">Accounts Payable</option>
            </select>
          </div>
          <div className="form-row">
            <label>As Of Date</label>
            <input className="input" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label>{scope === 'AR' ? 'Customer' : 'Vendor'}</label>
            <select className="select" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
              <option value="">All {scope === 'AR' ? 'Customers' : 'Vendors'}</option>
              {parties.map((party) => <option key={party.id} value={party.id}>{party.code} - {party.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>View</label>
            <select className="select" value={viewMode} onChange={(e) => setViewMode(e.target.value as ViewMode)}>
              <option value="summary">Summary</option>
              <option value="detail">Detail</option>
            </select>
          </div>
        </div>

        <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
          <input type="checkbox" checked={includeZeroBalances} onChange={(e) => setIncludeZeroBalances(e.target.checked)} />
          Include settled / zero-balance invoices
        </label>
      </section>

      {ageingQ.isLoading ? <section className="panel">Loading ageing analysis...</section> : null}
      {ageingQ.isError ? <section className="panel error-panel">Unable to load ageing analysis.</section> : null}

      {data ? (
        <>
          <section className="panel">
            <div className="section-heading">
              <h2>{data.title}</h2>
              <span className="muted">As at {formatDate(data.asOfUtc)}</span>
            </div>
            <div className="kv">
              <div className="kv-row"><span>Total Invoice Amount</span><span>{formatAmount(data.totalInvoiceAmount)}</span></div>
              <div className="kv-row"><span>Total Paid</span><span>{formatAmount(data.totalPaidAmount)}</span></div>
              <div className="kv-row"><span>Total Outstanding</span><span>{formatAmount(data.totalOutstandingAmount)}</span></div>
              <div className="kv-row"><span>Current</span><span>{formatAmount(data.totalCurrentAmount)}</span></div>
              <div className="kv-row"><span>1-30 Days</span><span>{formatAmount(data.totalDays1To30Amount)}</span></div>
              <div className="kv-row"><span>31-60 Days</span><span>{formatAmount(data.totalDays31To60Amount)}</span></div>
              <div className="kv-row"><span>61-90 Days</span><span>{formatAmount(data.totalDays61To90Amount)}</span></div>
              <div className="kv-row"><span>91-120 Days</span><span>{formatAmount(data.totalDays91To120Amount)}</span></div>
              <div className="kv-row"><span>120+ Days</span><span>{formatAmount(data.totalOver120Amount)}</span></div>
            </div>
          </section>

          {viewMode === 'summary' ? <SummaryTable items={data.summaryItems} /> : <DetailTable items={data.detailItems} />}
        </>
      ) : null}
    </div>
  );
}

function SummaryTable({ items }: { items: AgeingAnalysisSummaryRowDto[] }) {
  return (
    <section className="panel">
      <div className="section-heading"><h2>Summary by Party</h2><span className="muted">{items.length} row(s)</span></div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Invoices</th><th style={{ textAlign: 'right' }}>Invoice Amount</th><th style={{ textAlign: 'right' }}>Paid</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'right' }}>Current</th><th style={{ textAlign: 'right' }}>1-30</th><th style={{ textAlign: 'right' }}>31-60</th><th style={{ textAlign: 'right' }}>61-90</th><th style={{ textAlign: 'right' }}>91-120</th><th style={{ textAlign: 'right' }}>120+</th></tr></thead>
          <tbody>{items.length === 0 ? <tr><td colSpan={12} className="muted">No ageing balances found.</td></tr> : items.map((item) => <tr key={item.partyId}><td>{item.partyCode}</td><td>{item.partyName}</td><td>{item.invoiceCount}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.invoiceAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.paidAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.outstandingAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.currentAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days1To30Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days31To60Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days61To90Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days91To120Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.over120Amount)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function DetailTable({ items }: { items: AgeingAnalysisDetailRowDto[] }) {
  return (
    <section className="panel">
      <div className="section-heading"><h2>Invoice Detail</h2><span className="muted">{items.length} row(s)</span></div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Invoice</th><th>Date</th><th>Description</th><th style={{ textAlign: 'right' }}>Days</th><th>Bucket</th><th style={{ textAlign: 'right' }}>Invoice Amount</th><th style={{ textAlign: 'right' }}>Paid</th><th style={{ textAlign: 'right' }}>Outstanding</th><th style={{ textAlign: 'right' }}>Current</th><th style={{ textAlign: 'right' }}>1-30</th><th style={{ textAlign: 'right' }}>31-60</th><th style={{ textAlign: 'right' }}>61-90</th><th style={{ textAlign: 'right' }}>91-120</th><th style={{ textAlign: 'right' }}>120+</th></tr></thead>
          <tbody>{items.length === 0 ? <tr><td colSpan={16} className="muted">No ageing balances found.</td></tr> : items.map((item) => <tr key={item.invoiceId}><td>{item.partyCode}</td><td>{item.partyName}</td><td>{item.invoiceNumber}</td><td>{formatDate(item.invoiceDateUtc)}</td><td>{item.description}</td><td style={{ textAlign: 'right' }}>{item.daysOutstanding}</td><td>{item.ageBucket}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.invoiceAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.paidAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.outstandingAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.currentAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days1To30Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days31To60Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days61To90Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.days91To120Amount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.over120Amount)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
