import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getConsolidatedBudgetVsActual,
  type BudgetType,
  type BudgetVsActualItemDto,
  type ConsolidatedBudgetVsActualResponse,
} from '../lib/api';
import { canViewFinance } from '../lib/auth';

type PrintMode = 'type' | 'consolidated';

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString();
}

function budgetStatusLabel(value: number) {
  switch (value) {
    case 1:
      return 'Draft';
    case 2:
      return 'Submitted for Approval';
    case 3:
      return 'Approved';
    case 4:
      return 'Rejected';
    case 5:
      return 'Locked';
    case 6:
      return 'Cancelled';
    case 7:
      return 'Closed';
    default:
      return 'Unknown';
  }
}

function budgetTypeLabel(value: number) {
  switch (value) {
    case 1:
      return 'Operating';
    case 2:
      return 'Capital';
    case 3:
      return 'Cash Flow';
    case 4:
      return 'Project';
    default:
      return 'Unknown';
  }
}

function accountCategoryLabel(value: number) {
  switch (value) {
    case 1:
      return 'Asset';
    case 2:
      return 'Liability';
    case 3:
      return 'Equity';
    case 4:
      return 'Income';
    case 5:
      return 'Expense';
    default:
      return 'Unknown';
  }
}

function normalBalanceLabel(value: number) {
  switch (value) {
    case 1:
      return 'Debit';
    case 2:
      return 'Credit';
    default:
      return 'Unknown';
  }
}

function overrunPolicyLabel(value: number) {
  switch (value) {
    case 1:
      return 'Disallow';
    case 2:
      return 'Warn Only';
    case 3:
      return 'Allow';
    case 4:
      return 'Require Approval';
    default:
      return 'Unknown';
  }
}

function varianceClass(item: BudgetVsActualItemDto) {
  if (item.isOverBudget) return 'Over Budget';
  if (item.actualAmount === 0) return 'No Actual';
  return 'Within Budget';
}

export function BudgetVsActualPrintPage() {
  const canView = canViewFinance();
  const [searchParams] = useSearchParams();
  const hasPrintedRef = useRef(false);

  const mode: PrintMode = searchParams.get('mode') === 'type' ? 'type' : 'consolidated';
  const periodStartUtc = searchParams.get('periodStartUtc') || '';
  const periodEndUtc = searchParams.get('periodEndUtc') || '';
  const budgetTypeParam = searchParams.get('budgetType');
  const budgetType = budgetTypeParam ? (Number(budgetTypeParam) as BudgetType) : null;

  const reportQ = useQuery({
    queryKey: ['budget-vs-actual-print', mode, periodStartUtc, periodEndUtc, budgetType],
    queryFn: () =>
      getConsolidatedBudgetVsActual(
        periodStartUtc,
        periodEndUtc,
        mode === 'type' ? budgetType : null
      ),
    enabled:
      canView &&
      !!periodStartUtc &&
      !!periodEndUtc &&
      (mode === 'consolidated' || (mode === 'type' && !!budgetType)),
  });

  useEffect(() => {
    if (!reportQ.data || hasPrintedRef.current) {
      return undefined;
    }

    hasPrintedRef.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 500);

    return () => window.clearTimeout(timer);
  }, [reportQ.data]);

  if (!canView) {
    return <div className="print-page-error">You do not have access to print Budget vs Actual reports.</div>;
  }

  if (!periodStartUtc || !periodEndUtc) {
    return (
      <div className="print-page-error">
        Report period is required.
        <div style={{ marginTop: 12 }}>
          <Link to="/budget-vs-actual">Back to Budget vs Actual</Link>
        </div>
      </div>
    );
  }

  if (mode === 'type' && !budgetType) {
    return (
      <div className="print-page-error">
        Budget type is required.
        <div style={{ marginTop: 12 }}>
          <Link to="/budget-vs-actual?mode=type">Back to Budget vs Actual</Link>
        </div>
      </div>
    );
  }

  if (reportQ.isLoading) {
    return <div className="print-page-error">Loading Budget vs Actual report...</div>;
  }

  if (reportQ.isError || !reportQ.data) {
    return <div className="print-page-error">Unable to load Budget vs Actual report.</div>;
  }

  return (
    <BudgetTypesPrintReport
      report={reportQ.data}
      mode={mode}
      budgetType={budgetType}
      periodStartUtc={periodStartUtc}
      periodEndUtc={periodEndUtc}
    />
  );
}

function BudgetTypesPrintReport({
  report,
  mode,
  budgetType,
  periodStartUtc,
  periodEndUtc,
}: {
  report: ConsolidatedBudgetVsActualResponse;
  mode: PrintMode;
  budgetType: BudgetType | null;
  periodStartUtc: string;
  periodEndUtc: string;
}) {
  const title =
    mode === 'type'
      ? `${budgetTypeLabel(budgetType || 0)} Budget vs Actual Report`
      : 'Budget vs Actual Consolidated Report';

  const subtitle =
    mode === 'type'
      ? 'Selected budget type report'
      : 'All reportable budget types sectioned separately';

  const backUrl =
    mode === 'type' && budgetType
      ? `/budget-vs-actual?mode=type&periodStartUtc=${encodeURIComponent(periodStartUtc)}&periodEndUtc=${encodeURIComponent(periodEndUtc)}&budgetType=${budgetType}`
      : `/budget-vs-actual?mode=consolidated&periodStartUtc=${encodeURIComponent(periodStartUtc)}&periodEndUtc=${encodeURIComponent(periodEndUtc)}`;

  return (
    <div className="standalone-print-page">
      <div className="print-actions no-print">
        <Link to={backUrl} className="button">
          Back
        </Link>

        <button className="button primary" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <section className="standalone-report-card">
        <StandaloneReportHeader
          tenantKey={report.tenantKey}
          title={title}
          subtitle={subtitle}
        />

        <div className="standalone-report-title">
          <h2>{title}</h2>
          <div className="muted">
            {formatDate(report.periodStartUtc)} - {formatDate(report.periodEndUtc)}
          </div>
        </div>

        <div className="print-kv-grid">
          <div><span>Report Period</span><strong>{formatDate(report.periodStartUtc)} - {formatDate(report.periodEndUtc)}</strong></div>
          <div><span>Budget Type Sections</span><strong>{report.sectionCount}</strong></div>
          <div><span>Budget Count</span><strong>{report.budgetCount}</strong></div>
          <div><span>Over-Budget Lines</span><strong>{report.overBudgetLineCount}</strong></div>
          <div><span>Total Budget</span><strong>{formatAmount(report.totalBudgetAmount)}</strong></div>
          <div><span>Total Actual</span><strong>{formatAmount(report.totalActualAmount)}</strong></div>
          <div><span>Total Variance</span><strong>{formatAmount(report.totalVarianceAmount)}</strong></div>
        </div>

        {report.sections.length === 0 ? (
          <div className="standalone-empty-report">
            No approved, locked, or closed budgets were found for the selected report option.
          </div>
        ) : (
          report.sections.map((section) => (
            <section key={section.budgetType} className="standalone-report-section">
              <div className="standalone-section-header">
                <div>
                  <h2>{budgetTypeLabel(section.budgetType)} Budgets</h2>
                  <div>
                    {section.budgetCount} budget(s), {section.overBudgetLineCount} over-budget line(s)
                  </div>
                </div>
              </div>

              <div className="print-kv-grid compact">
                <div><span>Section Budget</span><strong>{formatAmount(section.totalBudgetAmount)}</strong></div>
                <div><span>Section Actual</span><strong>{formatAmount(section.totalActualAmount)}</strong></div>
                <div><span>Section Variance</span><strong>{formatAmount(section.totalVarianceAmount)}</strong></div>
              </div>

              {section.budgets.map((budget) => (
                <section key={budget.id} className="standalone-budget-subsection">
                  <div className="standalone-budget-title">
                    <h3>{budget.budgetNumber} - {budget.name}</h3>
                    <div>{budget.description}</div>
                  </div>

                  <div className="print-kv-grid compact">
                    <div><span>Budget Period</span><strong>{formatDate(budget.periodStartUtc)} - {formatDate(budget.periodEndUtc)}</strong></div>
                    <div><span>Status</span><strong>{budgetStatusLabel(budget.status)}</strong></div>
                    <div><span>Overrun Policy</span><strong>{overrunPolicyLabel(budget.overrunPolicy)}</strong></div>
                    <div><span>Total Budget</span><strong>{formatAmount(budget.totalBudgetAmount)}</strong></div>
                    <div><span>Total Actual</span><strong>{formatAmount(budget.totalActualAmount)}</strong></div>
                    <div><span>Total Variance</span><strong>{formatAmount(budget.totalVarianceAmount)}</strong></div>
                  </div>

                  <BudgetActualPrintTable items={budget.items} />
                </section>
              ))}
            </section>
          ))
        )}

        <StandaloneReportFooter tenantKey={report.tenantKey} />
      </section>
    </div>
  );
}

function StandaloneReportHeader({
  tenantKey,
  title,
  subtitle,
}: {
  tenantKey: string;
  title: string;
  subtitle: string;
}) {
  return (
    <header className="standalone-report-header">
      <div>
        <div className="standalone-report-brand">iBalance Accounting Cloud</div>
        <h1>{title}</h1>
        <div className="muted">{subtitle}</div>
      </div>

      <div className="standalone-report-meta">
        <strong>{tenantKey}</strong>
        <span>{new Date().toLocaleString()}</span>
      </div>
    </header>
  );
}

function StandaloneReportFooter({ tenantKey }: { tenantKey: string }) {
  return (
    <footer className="standalone-report-footer">
      <span>Printed from iBalance Accounting Cloud</span>
      <span>{tenantKey}</span>
    </footer>
  );
}

function BudgetActualPrintTable({ items }: { items: BudgetVsActualItemDto[] }) {
  return (
    <table className="standalone-report-table">
      <thead>
        <tr>
          <th>Account</th>
          <th>Category</th>
          <th>Normal Balance</th>
          <th>Period</th>
          <th className="amount-cell">Budget</th>
          <th className="amount-cell">Actual</th>
          <th className="amount-cell">Variance</th>
          <th className="amount-cell">Utilization %</th>
          <th>Class</th>
          <th>Overrun Status</th>
          <th>Notes</th>
        </tr>
      </thead>

      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={11}>No budget lines found.</td>
          </tr>
        ) : (
          items.map((item) => (
            <tr key={item.budgetLineId}>
              <td>
                <strong>{item.ledgerAccountCode}</strong>
                <div>{item.ledgerAccountName}</div>
              </td>
              <td>{accountCategoryLabel(item.category)}</td>
              <td>{normalBalanceLabel(item.normalBalance)}</td>
              <td>{formatDate(item.periodStartUtc)} - {formatDate(item.periodEndUtc)}</td>
              <td className="amount-cell">{formatAmount(item.budgetAmount)}</td>
              <td className="amount-cell">{formatAmount(item.actualAmount)}</td>
              <td className="amount-cell">{formatAmount(item.varianceAmount)}</td>
              <td className="amount-cell">{formatPercent(item.utilizationPercent)}%</td>
              <td>{varianceClass(item)}</td>
              <td>{item.overrunStatus}</td>
              <td>{item.notes || '—'}</td>
            </tr>
          ))
        )}
      </tbody>

      <tfoot>
        <tr>
          <th colSpan={4}>Total</th>
          <th className="amount-cell">
            {formatAmount(items.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0))}
          </th>
          <th className="amount-cell">
            {formatAmount(items.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0))}
          </th>
          <th className="amount-cell">
            {formatAmount(items.reduce((sum, item) => sum + Number(item.varianceAmount || 0), 0))}
          </th>
          <th colSpan={4}></th>
        </tr>
      </tfoot>
    </table>
  );
}