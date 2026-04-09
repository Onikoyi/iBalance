import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBalanceSheet,
  getIncomeStatement,
  getTenantKey,
  getTenantLogoDataUrl,
  getCompanyLogoDataUrl,
  getTrialBalance,
} from '../lib/api';

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
          <LogoSlot dataUrl={tenantLogo} fallbackText="Tenant" />
          <div className="print-brand-meta">
            <strong>{tenantKey || 'Tenant'}</strong>
            <span>Client / Tenant</span>
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

  const fromUtc = fromDate ? toUtcStart(fromDate) : undefined;
  const toUtc = toDate ? toUtcEnd(toDate) : undefined;

  const trialBalance = useQuery({
    queryKey: ['trial-balance', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getTrialBalance(fromUtc, toUtc),
  });

  const balanceSheet = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: getBalanceSheet,
  });

  const incomeStatement = useQuery({
    queryKey: ['income-statement', fromUtc ?? null, toUtc ?? null],
    queryFn: () => getIncomeStatement(fromUtc, toUtc),
  });

  const printablePeriodText = useMemo(() => {
    if (fromDate && toDate) return `From ${fromDate} to ${toDate}`;
    if (fromDate) return `From ${fromDate}`;
    if (toDate) return `To ${toDate}`;
    return 'Current queried period / inception-to-date';
  }, [fromDate, toDate]);

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
    return <div className="panel error-panel">Unable to load financial reports.</div>;
  }

  return (
    <div className="reports-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Report Filters</h2>
            <div className="muted">
              Trial Balance and Income Statement use the selected date range. Balance Sheet prints as at current report timestamp.
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

        <div className="table-wrap">
          <table className="data-table report-print-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Total Debit</th>
                <th>Total Credit</th>
                <th>Balance Debit</th>
                <th>Balance Credit</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.data.items.map((item) => (
                <tr key={item.ledgerAccountId}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{item.totalDebit.toFixed(2)}</td>
                  <td>{item.totalCredit.toFixed(2)}</td>
                  <td>{item.balanceDebit.toFixed(2)}</td>
                  <td>{item.balanceCredit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="report-totals">
          <div>Total Debit: {trialBalance.data.totalDebit.toFixed(2)}</div>
          <div>Total Credit: {trialBalance.data.totalCredit.toFixed(2)}</div>
        </div>
      </section>

      <section id="print-balance-sheet" className="panel printable-report">
        <div className="section-heading no-print">
          <div>
            <h2>Balance Sheet</h2>
            <span className="muted">
              As at {new Date(balanceSheet.data.asOfUtc).toLocaleString()}
            </span>
          </div>
          <button className="button" onClick={() => printSection('print-balance-sheet')}>
            Print Balance Sheet
          </button>
        </div>

        <ReportPrintHeader
          title="Balance Sheet"
          subtitle={`As at ${new Date(balanceSheet.data.asOfUtc).toLocaleString()}`}
        />

        <div className="report-block">
          <h3>Assets</h3>
          {balanceSheet.data.assets.map((item) => (
            <div key={item.ledgerAccountId} className="report-line">
              <span>{item.code} - {item.name}</span>
              <strong>{(item.balance ?? 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>

        <div className="report-block">
          <h3>Liabilities</h3>
          {balanceSheet.data.liabilities.map((item) => (
            <div key={item.ledgerAccountId} className="report-line">
              <span>{item.code} - {item.name}</span>
              <strong>{(item.balance ?? 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>

        <div className="report-block">
          <h3>Equity</h3>
          {balanceSheet.data.equity.map((item) => (
            <div key={item.ledgerAccountId} className="report-line">
              <span>{item.code} - {item.name}</span>
              <strong>{(item.balance ?? 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>

        <div className="report-totals">
          <div>Total Assets: {balanceSheet.data.totalAssets.toFixed(2)}</div>
          <div>Total Liabilities + Equity: {balanceSheet.data.totalLiabilitiesAndEquity.toFixed(2)}</div>
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
          {incomeStatement.data.income.map((item) => (
            <div key={item.ledgerAccountId} className="report-line">
              <span>{item.code} - {item.name}</span>
              <strong>{(item.amount ?? 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>

        <div className="report-block">
          <h3>Expenses</h3>
          {incomeStatement.data.expenses.map((item) => (
            <div key={item.ledgerAccountId} className="report-line">
              <span>{item.code} - {item.name}</span>
              <strong>{(item.amount ?? 0).toFixed(2)}</strong>
            </div>
          ))}
        </div>

        <div className="report-totals">
          <div>Total Income: {incomeStatement.data.totalIncome.toFixed(2)}</div>
          <div>Total Expenses: {incomeStatement.data.totalExpenses.toFixed(2)}</div>
          <div>Net Income: {incomeStatement.data.netIncome.toFixed(2)}</div>
        </div>
      </section>
    </div>
  );
}