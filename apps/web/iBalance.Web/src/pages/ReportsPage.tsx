import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBalanceSheet,
  getCompanyLogoDataUrl,
  getIncomeStatement,
  getTenantKey,
  getTenantLogoDataUrl,
  getTrialBalance,
} from '../lib/api';
import { canViewReports } from '../lib/auth';

function toUtcStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toUtcEnd(date: string) {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

function printSection(sectionId: string) {
  document.body.setAttribute('data-print-target', sectionId);
  window.print();
  window.setTimeout(() => {
    document.body.removeAttribute('data-print-target');
  }, 300);
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
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

export function ReportsPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const canView = canViewReports();

  const fromUtc = fromDate ? toUtcStart(fromDate) : undefined;
  const toUtc = toDate ? toUtcEnd(toDate) : undefined;

  const trialBalance = useQuery({
    queryKey: ['trial-balance', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getTrialBalance(fromUtc, toUtc),
    enabled: canView,
  });

  const balanceSheet = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: getBalanceSheet,
    enabled: canView,
  });

  const incomeStatement = useQuery({
    queryKey: ['income-statement', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getIncomeStatement(fromUtc, toUtc),
    enabled: canView,
  });

  const printablePeriodText = useMemo(() => {
    if (fromDate && toDate) return `Reporting period: ${fromDate} to ${toDate}`;
    if (fromDate) return `Reporting period: from ${fromDate}`;
    if (toDate) return `Reporting period: up to ${toDate}`;
    return 'Reporting period: current available range';
  }, [fromDate, toDate]);

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view financial reports.</div>;
  }

  if (trialBalance.isLoading || balanceSheet.isLoading || incomeStatement.isLoading) {
    return <div className="panel">Loading financial reports...</div>;
  }

  if (
    trialBalance.error ||
    balanceSheet.error ||
    incomeStatement.error ||
    !trialBalance.data ||
    !balanceSheet.data ||
    !incomeStatement.data
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
              Set a date range for the Trial Balance and Income Statement. The Balance Sheet is shown as at the current report date and time.
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
        </div>
      </section>

      <section id="print-trial-balance" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Trial Balance</h2>
            <span className="muted">{printablePeriodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-trial-balance')}>
            Print Trial Balance
          </button>
        </div>

        <ReportPrintHeader
          title="Trial Balance"
          subtitle={printablePeriodText}
        />

        <div className="kv" style={{ marginBottom: 16 }}>
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

      <section id="print-balance-sheet" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Balance Sheet</h2>
            <span className="muted">
              As at {formatDateTime(balanceSheet.data.asOfUtc)}
            </span>
          </div>
          <button className="button" onClick={() => printSection('print-balance-sheet')}>
            Print Balance Sheet
          </button>
        </div>

        <ReportPrintHeader
          title="Balance Sheet"
          subtitle={`As at ${formatDateTime(balanceSheet.data.asOfUtc)}`}
        />

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
          <div>Total Assets: {formatAmount(balanceSheet.data.totalAssets)}</div>
          <div>Total Liabilities: {formatAmount(balanceSheet.data.totalLiabilities)}</div>
          <div>Total Equity: {formatAmount(balanceSheet.data.totalEquity)}</div>
          <div>Total Liabilities and Equity: {formatAmount(balanceSheet.data.totalLiabilitiesAndEquity)}</div>
        </div>
      </section>

      <section id="print-income-statement" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Income Statement</h2>
            <span className="muted">{printablePeriodText}</span>
          </div>
          <button className="button" onClick={() => printSection('print-income-statement')}>
            Print Income Statement
          </button>
        </div>

        <ReportPrintHeader
          title="Income Statement"
          subtitle={printablePeriodText}
        />

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
          <div>Total Income: {formatAmount(incomeStatement.data.totalIncome)}</div>
          <div>Total Expenses: {formatAmount(incomeStatement.data.totalExpenses)}</div>
          <div>Net Income: {formatAmount(incomeStatement.data.netIncome)}</div>
        </div>
      </section>
    </div>
  );
}