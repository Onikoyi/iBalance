import { useQuery } from '@tanstack/react-query';
import { getBalanceSheet, getIncomeStatement } from '../lib/api';

export function ReportsPage() {
  const balanceSheet = useQuery({
    queryKey: ['balance-sheet'],
    queryFn: getBalanceSheet,
  });

  const incomeStatement = useQuery({
    queryKey: ['income-statement'],
    queryFn: getIncomeStatement,
  });

  if (balanceSheet.isLoading || incomeStatement.isLoading) {
    return <div className="panel">Loading financial reports...</div>;
  }

  if (balanceSheet.error || incomeStatement.error || !balanceSheet.data || !incomeStatement.data) {
    return <div className="panel error-panel">Unable to load financial reports.</div>;
  }

  return (
    <div className="reports-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Balance Sheet</h2>
          <span>As at {new Date(balanceSheet.data.asOfUtc).toLocaleString()}</span>
        </div>

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

      <section className="panel">
        <div className="section-heading">
          <h2>Income Statement</h2>
          <span>Current queried period</span>
        </div>

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