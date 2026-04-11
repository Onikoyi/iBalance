import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  getCompanyLogoDataUrl,
  getTenantKey,
  getTenantLogoDataUrl,
  getVendorStatement,
} from '../lib/api';

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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

function vendorMovementStatusLabel(type: string, status: number) {
  if (type === 'Invoice') {
    switch (status) {
      case 1: return 'Draft';
      case 2: return 'Posted';
      case 3: return 'Part Paid';
      case 4: return 'Paid';
      case 5: return 'Cancelled';
      default: return 'Unknown';
    }
  }

  switch (status) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Cancelled';
    default: return 'Unknown';
  }
}

function LogoBlock({
  src,
  fallback,
}: {
  src: string;
  fallback: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallback}
        style={{ height: 48, maxWidth: 180, objectFit: 'contain' }}
      />
    );
  }

  return (
    <div
      style={{
        minWidth: 48,
        height: 48,
        borderRadius: 12,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(75, 29, 115, 0.12)',
        fontWeight: 700,
      }}
    >
      {fallback}
    </div>
  );
}

export function VendorStatementPage() {
  const { vendorId } = useParams<{ vendorId: string }>();

  const today = new Date();
  const defaultToDate = today.toISOString().slice(0, 10);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultFromDate = new Date(
    Date.UTC(startOfMonth.getFullYear(), startOfMonth.getMonth(), startOfMonth.getDate())
  ).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);

  const reportingPeriodText = buildReportingPeriodText(fromDate, toDate);
  const isRangeValid = !!fromDate && !!toDate;

  const fromUtc = isRangeValid ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
  const toUtc = isRangeValid ? new Date(`${toDate}T23:59:59`).toISOString() : undefined;

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const statementQ = useQuery({
    queryKey: ['ap-vendor-statement', vendorId, fromUtc ?? null, toUtc ?? null],
    queryFn: () => getVendorStatement(vendorId || '', fromUtc, toUtc),
    enabled: !!vendorId && isRangeValid,
  });

  const totals = useMemo(() => {
    const items = statementQ.data?.items ?? [];
    return {
      debit: items.reduce((sum, x) => sum + Number(x.debitAmount || 0), 0),
      credit: items.reduce((sum, x) => sum + Number(x.creditAmount || 0), 0),
    };
  }, [statementQ.data?.items]);

  if (!vendorId) {
    return <div className="panel error-panel">Vendor identifier is required.</div>;
  }

  if (!isRangeValid) {
    return <div className="panel error-panel">Please select both From Date and To Date.</div>;
  }

  if (statementQ.isLoading) {
    return <div className="panel">Loading vendor statement...</div>;
  }

  if (statementQ.isError || !statementQ.data) {
    return <div className="panel error-panel">We could not load the vendor statement at this time.</div>;
  }

  const statement = statementQ.data;

  return (
    <div className="page-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Vendor Statement Filters</h2>
            <div className="muted">This statement is strictly date-range driven and carries the selected reporting period.</div>
          </div>

          <div className="inline-actions">
            <button className="button" onClick={() => window.print()}>
              Print Statement
            </button>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>From Date</label>
            <input
              className="input"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>To Date</label>
            <input
              className="input"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="muted">{reportingPeriodText}</div>
        </div>
      </section>

      <section className="panel printable-report">
        <div className="print-report-header">
          <div className="print-report-brand-row">
            <div className="print-brand-block">
              <LogoBlock src={companyLogo} fallback="iBalance" />
              <div className="print-brand-meta">
                <strong>Nikosoft Technologies</strong>
                <span>iBalance Accounting Cloud</span>
              </div>
            </div>

            <div className="print-brand-block">
              <LogoBlock src={tenantLogo} fallback="Org" />
              <div className="print-brand-meta">
                <strong>{tenantKey || 'Organization'}</strong>
                <span>Client Workspace</span>
              </div>
            </div>
          </div>

          <div className="print-report-title-block">
            <h2>Vendor Statement</h2>
            <div className="muted">{statement.vendor.vendorCode} - {statement.vendor.vendorName}</div>
            <div className="muted">{reportingPeriodText}</div>
          </div>
        </div>

        <div className="form-grid two" style={{ marginBottom: 16 }}>
          <section className="panel" style={{ margin: 0 }}>
            <div className="section-heading">
              <h2>Vendor Details</h2>
            </div>

            <div className="kv">
              <div className="kv-row">
                <span>Vendor</span>
                <span>{statement.vendor.vendorCode} - {statement.vendor.vendorName}</span>
              </div>
              <div className="kv-row">
                <span>Email</span>
                <span>{statement.vendor.email || 'Not available'}</span>
              </div>
              <div className="kv-row">
                <span>Phone Number</span>
                <span>{statement.vendor.phoneNumber || 'Not available'}</span>
              </div>
              <div className="kv-row">
                <span>Billing Address</span>
                <span>{statement.vendor.billingAddress || 'Not available'}</span>
              </div>
              <div className="kv-row">
                <span>Status</span>
                <span>{statement.vendor.isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </section>

          <section className="panel" style={{ margin: 0 }}>
            <div className="section-heading">
              <h2>Statement Summary</h2>
            </div>

            <div className="kv">
              <div className="kv-row">
                <span>Reporting Period</span>
                <span>{reportingPeriodText.replace('Reporting Period: ', '')}</span>
              </div>
              <div className="kv-row">
                <span>Total Invoices</span>
                <span>{statement.totalInvoices}</span>
              </div>
              <div className="kv-row">
                <span>Total Payments</span>
                <span>{statement.totalPayments}</span>
              </div>
              <div className="kv-row">
                <span>Total Invoiced</span>
                <span>{formatAmount(statement.totalInvoiced)}</span>
              </div>
              <div className="kv-row">
                <span>Total Paid</span>
                <span>{formatAmount(statement.totalPaid)}</span>
              </div>
              <div className="kv-row">
                <span>Closing Balance</span>
                <span>{formatAmount(statement.closingBalance)}</span>
              </div>
            </div>
          </section>
        </div>

        <section className="panel" style={{ margin: 0 }}>
          <div className="section-heading">
            <div>
              <h2>Statement Movements</h2>
              <div className="muted">{reportingPeriodText}</div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table report-print-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Invoice Amount</th>
                  <th style={{ textAlign: 'right' }}>Payment Amount</th>
                  <th style={{ textAlign: 'right' }}>Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {statement.items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="muted">
                      No vendor statement movements were found for the selected reporting period.
                    </td>
                  </tr>
                ) : (
                  statement.items.map((item, index) => (
                    <tr key={`${item.reference}-${index}`}>
                      <td>{item.type}</td>
                      <td>{formatDateTime(item.dateUtc)}</td>
                      <td>{item.reference}</td>
                      <td>{item.description}</td>
                      <td>{vendorMovementStatusLabel(item.type, item.status)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.debitAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.creditAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.invoiceAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.paymentAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.runningBalance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={5}>Totals</th>
                  <th style={{ textAlign: 'right' }}>{formatAmount(totals.debit)}</th>
                  <th style={{ textAlign: 'right' }}>{formatAmount(totals.credit)}</th>
                  <th style={{ textAlign: 'right' }}>{formatAmount(statement.totalInvoiced)}</th>
                  <th style={{ textAlign: 'right' }}>{formatAmount(statement.totalPaid)}</th>
                  <th style={{ textAlign: 'right' }}>{formatAmount(statement.closingBalance)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}