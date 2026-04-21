import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getCurrentTenantLicense,
  getCustomerReceipts,
  getDashboardSummary,
  getSalesInvoices,
  getTaxReport,
  getBudgets,
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
  }).format(value || 0);
}

function salesInvoiceStatusLabel(value?: number) {
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

  const taxReportQ = useQuery({
    queryKey: ['dashboard-tax-report'],
    queryFn: () => getTaxReport(undefined, undefined, null, null),
    staleTime: 60_000,
  });

  const budgetsQ = useQuery({
    queryKey: ['dashboard-budgets'],
    queryFn: getBudgets,
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
  const taxReport = taxReportQ.data;

  const activeInvoices = invoices.filter((x) => x.status !== 7 && x.status !== 8);
  const activeReceipts = receipts.filter((x) => x.status !== 4 && x.status !== 6);

  const arSummary = {
    totalInvoices: activeInvoices.length,
    draftInvoices: activeInvoices.filter((x) => x.status === 1).length,
    submittedInvoices: activeInvoices.filter((x) => x.status === 2).length,
    approvedInvoices: activeInvoices.filter((x) => x.status === 3).length,
    postedInvoices: activeInvoices.filter((x) => x.status === 4).length,
    partPaidInvoices: activeInvoices.filter((x) => x.status === 5).length,
    paidInvoices: activeInvoices.filter((x) => x.status === 6).length,
    receivableBalance: activeInvoices.reduce((sum, x) => sum + Number(x.balanceAmount || 0), 0),
    invoicedAmount: activeInvoices.reduce((sum, x) => sum + Number(x.netReceivableAmount || x.totalAmount || 0), 0),
    cashCollected: activeInvoices.reduce((sum, x) => sum + Number(x.amountPaid || 0), 0),
    totalReceipts: activeReceipts.length,
    draftReceipts: activeReceipts.filter((x) => x.status === 1).length,
    submittedReceipts: activeReceipts.filter((x) => x.status === 2).length,
    approvedReceipts: activeReceipts.filter((x) => x.status === 3).length,
    postedReceipts: activeReceipts.filter((x) => x.status === 5).length,
  };

  const taxSummary = {
    totalTaxLines: taxReport?.count ?? 0,
    totalTaxableAmount: taxReport?.totalTaxableAmount ?? 0,
    totalTaxAmount: taxReport?.totalTaxAmount ?? 0,
    totalTaxAdditions: taxReport?.totalAdditions ?? 0,
    totalTaxDeductions: taxReport?.totalDeductions ?? 0,
    vatAmount:
      taxReport?.byComponentKind?.find((x) => x.componentKind === 1)?.totalTaxAmount ?? 0,
    whtAmount:
      taxReport?.byComponentKind?.find((x) => x.componentKind === 2)?.totalTaxAmount ?? 0,
    otherTaxAmount:
      taxReport?.byComponentKind?.find((x) => x.componentKind === 3)?.totalTaxAmount ?? 0,
  };

  const budgets = budgetsQ.data?.items || [];

const activeBudgets = budgets.filter((x) => x.status !== 4 && x.status !== 6);

const budgetSummary = {
  totalBudgets: activeBudgets.length,
  draftBudgets: activeBudgets.filter((x) => x.status === 1).length,
  submittedBudgets: activeBudgets.filter((x) => x.status === 2).length,
  approvedBudgets: activeBudgets.filter((x) => x.status === 3).length,
  lockedBudgets: activeBudgets.filter((x) => x.status === 5).length,
  closedBudgets: activeBudgets.filter((x) => x.status === 7).length,
  approvedBudgetAmount: activeBudgets
    .filter((x) => x.status === 3)
    .reduce((sum, x) => sum + Number(x.totalAmount || 0), 0),
  lockedBudgetAmount: activeBudgets
    .filter((x) => x.status === 5)
    .reduce((sum, x) => sum + Number(x.totalAmount || 0), 0),
  controlledBudgets: activeBudgets.filter((x) => x.overrunPolicy === 1 || x.overrunPolicy === 4).length,
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
          <StatCard label="Total Debit" value={formatAmount(data.totalDebit)} />
          <StatCard label="Total Credit" value={formatAmount(data.totalCredit)} />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Tax overview</h2>
          <span className="muted">VAT, WHT, and other tax activity</span>
        </div>

        {taxReportQ.isLoading ? (
          <div className="muted">Loading tax metrics...</div>
        ) : taxReportQ.isError ? (
          <div className="muted">Tax metrics are not available right now.</div>
        ) : (
          <>
            <div className="stats-grid">
              <StatCard label="Tax Lines" value={taxSummary.totalTaxLines} />
              <StatCard label="Taxable Amount" value={formatAmount(taxSummary.totalTaxableAmount)} />
              <StatCard label="Total Tax Amount" value={formatAmount(taxSummary.totalTaxAmount)} />
              <StatCard label="Tax Additions" value={formatAmount(taxSummary.totalTaxAdditions)} />
              <StatCard label="Tax Deductions" value={formatAmount(taxSummary.totalTaxDeductions)} />
              <StatCard label="VAT" value={formatAmount(taxSummary.vatAmount)} />
              <StatCard label="WHT" value={formatAmount(taxSummary.whtAmount)} />
              <StatCard label="Other Taxes" value={formatAmount(taxSummary.otherTaxAmount)} />
            </div>

            <div className="hero-actions" style={{ marginTop: 16 }}>
              <Link to="/reports" className="button primary">Open Tax Reports</Link>
            </div>
          </>
        )}
      </section>

      <section className="panel">
  <div className="section-heading">
    <h2>Budget overview</h2>
    <span className="muted">Budget control, approval, and utilization readiness</span>
  </div>

  {budgetsQ.isLoading ? (
    <div className="muted">Loading budget metrics...</div>
  ) : budgetsQ.isError ? (
    <div className="muted">Budget metrics are not available right now.</div>
  ) : (
    <>
      <div className="stats-grid">
        <StatCard label="Budgets" value={budgetSummary.totalBudgets} />
        <StatCard label="Draft Budgets" value={budgetSummary.draftBudgets} />
        <StatCard label="Submitted Budgets" value={budgetSummary.submittedBudgets} />
        <StatCard label="Approved Budgets" value={budgetSummary.approvedBudgets} />
        <StatCard label="Locked Budgets" value={budgetSummary.lockedBudgets} />
        <StatCard label="Closed Budgets" value={budgetSummary.closedBudgets} />
        <StatCard label="Approved Budget Amount" value={formatAmount(budgetSummary.approvedBudgetAmount)} />
        <StatCard label="Locked Budget Amount" value={formatAmount(budgetSummary.lockedBudgetAmount)} />
        <StatCard label="Strict Control Budgets" value={budgetSummary.controlledBudgets} />
      </div>

      <div className="hero-actions" style={{ marginTop: 16 }}>
        <Link to="/budgets" className="button primary">Open Budgets</Link>
        <Link to="/budget-vs-actual" className="button">Budget vs Actual</Link>
        <Link to="/budgets/rejected" className="button">Rejected Budgets</Link>
      </div>
    </>
  )}
</section>

      <section className="panel">
        <div className="section-heading">
          <h2>Accounts receivable overview</h2>
          <span className="muted">Current invoice and collection activity</span>
        </div>

        <div className="stats-grid">
          <StatCard label="Invoices" value={arSummary.totalInvoices} />
          <StatCard label="Draft Invoices" value={arSummary.draftInvoices} />
          <StatCard label="Submitted Invoices" value={arSummary.submittedInvoices} />
          <StatCard label="Approved Invoices" value={arSummary.approvedInvoices} />
          <StatCard label="Posted Invoices" value={arSummary.postedInvoices} />
          <StatCard label="Part Paid" value={arSummary.partPaidInvoices} />
          <StatCard label="Paid Invoices" value={arSummary.paidInvoices} />
          <StatCard label="Receipts" value={arSummary.totalReceipts} />
          <StatCard label="Submitted Receipts" value={arSummary.submittedReceipts} />
          <StatCard label="Approved Receipts" value={arSummary.approvedReceipts} />
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
          <span className="muted">Latest active sales invoice records</span>
        </div>

        {invoicesQ.isLoading ? (
          <div className="muted">Loading invoice activity...</div>
        ) : activeInvoices.length === 0 ? (
          <div className="muted">No active invoice activity is available yet.</div>
        ) : (
          <div className="detail-stack">
            {activeInvoices.slice(0, 5).map((invoice) => (
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
                  <span>{salesInvoiceStatusLabel(invoice.status)}</span>
                </div>
                <div className="kv-row">
                  <span>Net Receivable</span>
                  <span>{formatAmount(invoice.netReceivableAmount || invoice.totalAmount)}</span>
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