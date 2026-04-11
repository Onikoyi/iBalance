import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getCurrentTenantLicense,
  getCustomerReceipts,
  getDashboardSummary,
  getSalesInvoices,
} from '../lib/api';
import { StatCard } from '../components/common/StatCard';

function licenseLabel(value?: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Renewal Due Soon';
    case 3: return 'Expired';
    case 4: return 'Suspended';
    default: return 'Unavailable';
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleDateString();
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function invoiceStatusLabel(value?: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Part Paid';
    case 4: return 'Paid';
    case 5: return 'Cancelled';
    default: return 'Unknown';
  }
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  const licenseQ = useQuery({
    queryKey: ['current-tenant-license'],
    queryFn: getCurrentTenantLicense,
    staleTime: 60_000,
  });

  const invoicesQ = useQuery({
    queryKey: ['ar-sales-invoices'],
    queryFn: getSalesInvoices,
    staleTime: 60_000,
  });

  const receiptsQ = useQuery({
    queryKey: ['ar-customer-receipts'],
    queryFn: getCustomerReceipts,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <div className="panel">Loading dashboard...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">We could not load the dashboard at this time.</div>;
  }

  const invoices = invoicesQ.data?.items || [];
  const receipts = receiptsQ.data?.items || [];

  const arSummary = {
    totalInvoices: invoices.length,
    draftInvoices: invoices.filter((x) => x.status === 1).length,
    postedInvoices: invoices.filter((x) => x.status === 2).length,
    partPaidInvoices: invoices.filter((x) => x.status === 3).length,
    paidInvoices: invoices.filter((x) => x.status === 4).length,
    receivableBalance: invoices.reduce((sum, x) => sum + Number(x.balanceAmount || 0), 0),
    invoicedAmount: invoices.reduce((sum, x) => sum + Number(x.totalAmount || 0), 0),
    cashCollected: invoices.reduce((sum, x) => sum + Number(x.amountPaid || 0), 0),
    totalReceipts: receipts.length,
    draftReceipts: receipts.filter((x) => x.status === 1).length,
    postedReceipts: receipts.filter((x) => x.status === 2).length,
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Financial overview</h2>
            <div className="muted">A quick view of current activity across your finance workspace.</div>
          </div>
        </div>

        <div className="stats-grid">
          <StatCard label="Accounts" value={data.totalAccounts} />
          <StatCard label="Posted Journals" value={data.totalPostedJournals} />
          <StatCard label="Draft Journals" value={data.totalDraftJournals} />
          <StatCard label="Opening Journals" value={data.totalOpeningBalanceJournals} />
          <StatCard label="Ledger Movements" value={data.totalLedgerMovements} />
          <StatCard label="Total Debit" value={data.totalDebit.toFixed(2)} />
          <StatCard label="Total Credit" value={data.totalCredit.toFixed(2)} />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Accounts receivable overview</h2>
          <span className="muted">Current invoice and collection activity</span>
        </div>

        <div className="stats-grid">
          <StatCard label="Invoices" value={arSummary.totalInvoices} />
          <StatCard label="Draft Invoices" value={arSummary.draftInvoices} />
          <StatCard label="Posted Invoices" value={arSummary.postedInvoices} />
          <StatCard label="Part Paid" value={arSummary.partPaidInvoices} />
          <StatCard label="Paid Invoices" value={arSummary.paidInvoices} />
          <StatCard label="Receipts" value={arSummary.totalReceipts} />
          <StatCard label="Posted Receipts" value={arSummary.postedReceipts} />
          <StatCard label="Invoiced Amount" value={formatAmount(arSummary.invoicedAmount)} />
          <StatCard label="Cash Collected" value={formatAmount(arSummary.cashCollected)} />
          <StatCard label="Receivable Balance" value={formatAmount(arSummary.receivableBalance)} />
        </div>

        <div className="hero-actions" style={{ marginTop: 16 }}>
          <Link to="/customers" className="button">Customers</Link>
          <Link to="/sales-invoices" className="button primary">Sales Invoices</Link>
          <Link to="/customer-receipts" className="button">Customer Receipts</Link>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Subscription summary</h2>
          <span className="muted">Current organization access status</span>
        </div>

        {licenseQ.isLoading ? (
          <div className="panel">Loading subscription summary...</div>
        ) : licenseQ.isError || !licenseQ.data ? (
          <div className="muted">Subscription information is not available right now.</div>
        ) : (
          <div className="kv">
            <div className="kv-row">
              <span>Status</span>
              <span>{licenseLabel(licenseQ.data.licenseStatus)}</span>
            </div>
            <div className="kv-row">
              <span>Subscription Plan</span>
              <span>{licenseQ.data.packageName || 'Not assigned'}</span>
            </div>
            <div className="kv-row">
              <span>Start Date</span>
              <span>{formatDate(licenseQ.data.licenseStartDateUtc)}</span>
            </div>
            <div className="kv-row">
              <span>End Date</span>
              <span>{formatDate(licenseQ.data.licenseEndDateUtc)}</span>
            </div>
            <div className="kv-row">
              <span>Days Remaining</span>
              <span>{licenseQ.data.daysRemaining ?? 'Not available'}</span>
            </div>
          </div>
        )}

        <div className="hero-actions" style={{ marginTop: 16 }}>
          <Link to="/license-status" className="button">View Subscription</Link>
          <Link to="/reports" className="button">Open Reports</Link>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Current fiscal period</h2>
          <span className="muted">Today’s operational period</span>
        </div>

        {data.openFiscalPeriod ? (
          <div className="kv">
            <div className="kv-row">
              <span>Period Name</span>
              <span>{data.openFiscalPeriod.name}</span>
            </div>
            <div className="kv-row">
              <span>Start Date</span>
              <span>{data.openFiscalPeriod.startDate}</span>
            </div>
            <div className="kv-row">
              <span>End Date</span>
              <span>{data.openFiscalPeriod.endDate}</span>
            </div>
          </div>
        ) : (
          <div className="muted">
            There is no open fiscal period for today.
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Recent invoice activity</h2>
          <span className="muted">Latest sales invoice records</span>
        </div>

        {invoicesQ.isLoading ? (
          <div className="muted">Loading invoice activity...</div>
        ) : invoices.length === 0 ? (
          <div className="muted">No invoice activity is available yet.</div>
        ) : (
          <div className="detail-stack">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="kv" style={{ marginBottom: 12 }}>
                <div className="kv-row">
                  <span>Invoice</span>
                  <span>{invoice.invoiceNumber}</span>
                </div>
                <div className="kv-row">
                  <span>Customer</span>
                  <span>{invoice.customerName}</span>
                </div>
                <div className="kv-row">
                  <span>Status</span>
                  <span>{invoiceStatusLabel(invoice.status)}</span>
                </div>
                <div className="kv-row">
                  <span>Total</span>
                  <span>{formatAmount(invoice.totalAmount)}</span>
                </div>
                <div className="kv-row">
                  <span>Balance</span>
                  <span>{formatAmount(invoice.balanceAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}