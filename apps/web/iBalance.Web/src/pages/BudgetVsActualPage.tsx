import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getConsolidatedBudgetVsActual,
  getFiscalPeriods,
  type BudgetType,
  type BudgetVsActualItemDto,
} from '../lib/api';
import { canViewFinance } from '../lib/auth';

type ReportMode = 'type' | 'consolidated';

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

function toUtcFromDateInput(value: string) {
  if (!value) return '';

  if (value.includes('T')) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toISOString();
  }

  return `${value}T00:00:00.000Z`;
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

export function BudgetVsActualPage() {
  const canView = canViewFinance();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode: ReportMode = searchParams.get('mode') === 'type' ? 'type' : 'consolidated';

  const [reportMode, setReportMode] = useState<ReportMode>(initialMode);
  const [selectedFiscalPeriodId, setSelectedFiscalPeriodId] = useState('');
  const [periodStartUtc, setPeriodStartUtc] = useState(searchParams.get('periodStartUtc') || '');
  const [periodEndUtc, setPeriodEndUtc] = useState(searchParams.get('periodEndUtc') || '');
  const [selectedBudgetType, setSelectedBudgetType] = useState<BudgetType | ''>(
    searchParams.get('budgetType') ? (Number(searchParams.get('budgetType')) as BudgetType) : ''
  );
  const [search, setSearch] = useState('');
  const [overrunFilter, setOverrunFilter] = useState<'all' | 'over' | 'within'>('all');

  const fiscalPeriodsQ = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: getFiscalPeriods,
    enabled: canView,
  });

  const reportQ = useQuery({
    queryKey: [
      'budget-vs-actual-consolidated',
      reportMode,
      periodStartUtc,
      periodEndUtc,
      selectedBudgetType,
    ],
    queryFn: () =>
      getConsolidatedBudgetVsActual(
        periodStartUtc,
        periodEndUtc,
        reportMode === 'type' ? selectedBudgetType || null : null
      ),
    enabled:
      canView &&
      !!periodStartUtc &&
      !!periodEndUtc &&
      (reportMode === 'consolidated' || (reportMode === 'type' && !!selectedBudgetType)),
  });

  const reportTitle = reportMode === 'type'
    ? `${selectedBudgetType ? budgetTypeLabel(selectedBudgetType) : 'Budget Type'} Budget vs Actual Report`
    : 'Budget vs Actual Consolidated Report';

  const filteredSections = useMemo(() => {
    const sections = reportQ.data?.sections || [];
    const text = search.trim().toLowerCase();

    return sections.map((section) => ({
      ...section,
      budgets: section.budgets.map((budget) => ({
        ...budget,
        items: budget.items.filter((item) => {
          const matchesSearch =
            !text ||
            item.ledgerAccountCode.toLowerCase().includes(text) ||
            item.ledgerAccountName.toLowerCase().includes(text) ||
            (item.notes || '').toLowerCase().includes(text) ||
            item.overrunStatus.toLowerCase().includes(text);

          const matchesOverrun =
            overrunFilter === 'all' ||
            (overrunFilter === 'over' && item.isOverBudget) ||
            (overrunFilter === 'within' && !item.isOverBudget);

          return matchesSearch && matchesOverrun;
        }),
      })),
    }));
  }, [reportQ.data?.sections, search, overrunFilter]);

  function changeMode(value: ReportMode) {
    setReportMode(value);
    setSearch('');
    setOverrunFilter('all');

    if (value === 'consolidated') {
      setSelectedBudgetType('');
      setSearchParams({
        mode: 'consolidated',
        ...(periodStartUtc ? { periodStartUtc } : {}),
        ...(periodEndUtc ? { periodEndUtc } : {}),
      });
      return;
    }

    setSearchParams({
      mode: 'type',
      ...(periodStartUtc ? { periodStartUtc } : {}),
      ...(periodEndUtc ? { periodEndUtc } : {}),
    });
  }

  function changeFiscalPeriod(value: string) {
    setSelectedFiscalPeriodId(value);

    const period = (fiscalPeriodsQ.data?.items || []).find((x) => x.id === value);

    if (!period) {
      setPeriodStartUtc('');
      setPeriodEndUtc('');
      return;
    }

    const start = toUtcFromDateInput(period.startDate);
    const end = toUtcFromDateInput(period.endDate);

    setPeriodStartUtc(start);
    setPeriodEndUtc(end);

    const params: Record<string, string> = {
      mode: reportMode,
      periodStartUtc: start,
      periodEndUtc: end,
    };

    if (reportMode === 'type' && selectedBudgetType) {
      params.budgetType = String(selectedBudgetType);
    }

    setSearchParams(params);
  }

  function changeBudgetType(value: string) {
    const nextValue = value ? (Number(value) as BudgetType) : '';

    setSelectedBudgetType(nextValue);

    const params: Record<string, string> = {
      mode: 'type',
      ...(periodStartUtc ? { periodStartUtc } : {}),
      ...(periodEndUtc ? { periodEndUtc } : {}),
    };

    if (nextValue) {
      params.budgetType = String(nextValue);
    }

    setSearchParams(params);
  }

  function openPrintWindow() {
    if (!periodStartUtc || !periodEndUtc || !reportQ.data) return;

    const baseUrl =
      `/budget-vs-actual/print?mode=${reportMode}` +
      `&periodStartUtc=${encodeURIComponent(periodStartUtc)}` +
      `&periodEndUtc=${encodeURIComponent(periodEndUtc)}`;

    const printUrl =
      reportMode === 'type' && selectedBudgetType
        ? `${baseUrl}&budgetType=${selectedBudgetType}`
        : baseUrl;

    window.open(
      printUrl,
      'ibalance-budget-vs-actual-print',
      'width=1200,height=800,noopener,noreferrer'
    );
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view Budget vs Actual reports.</div>;
  }

  if (fiscalPeriodsQ.isLoading) {
    return <div className="panel">Loading fiscal periods...</div>;
  }

  if (fiscalPeriodsQ.isError || !fiscalPeriodsQ.data) {
    return <div className="panel error-panel">We could not load fiscal periods at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Budget vs Actual</h2>
            <div className="muted">
              Print either a selected budget type or a consolidated report for all budget types.
            </div>
          </div>

          <div className="inline-actions">
            <Link to="/budgets" className="button">Budgets</Link>
            <button
              className="button primary"
              onClick={openPrintWindow}
              disabled={
                !periodStartUtc ||
                !periodEndUtc ||
                !reportQ.data ||
                (reportMode === 'type' && !selectedBudgetType)
              }
            >
              Print Report
            </button>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Report Option</label>
            <div className="inline-actions">
              <label className="button" style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="budget-report-mode"
                  checked={reportMode === 'type'}
                  onChange={() => changeMode('type')}
                  style={{ marginRight: 8 }}
                />
                By Budget Type
              </label>

              <label className="button" style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="budget-report-mode"
                  checked={reportMode === 'consolidated'}
                  onChange={() => changeMode('consolidated')}
                  style={{ marginRight: 8 }}
                />
                Consolidated All Types
              </label>
            </div>
          </div>

          <div className="form-row">
            <label>Fiscal Period</label>
            <select
              className="select"
              value={selectedFiscalPeriodId}
              onChange={(e) => changeFiscalPeriod(e.target.value)}
            >
              <option value="">— Select Fiscal Period —</option>
              {(fiscalPeriodsQ.data?.items || []).map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name} ({period.startDate} - {period.endDate})
                </option>
              ))}
            </select>
          </div>

          {reportMode === 'type' ? (
            <div className="form-row">
              <label>Budget Type</label>
              <select
                className="select"
                value={selectedBudgetType}
                onChange={(e) => changeBudgetType(e.target.value)}
              >
                <option value="">— Select Budget Type —</option>
                <option value={1}>Operating</option>
                <option value={2}>Capital</option>
                <option value={3}>Cash Flow</option>
                <option value={4}>Project</option>
              </select>
            </div>
          ) : null}

          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Account code, account name, notes, overrun status"
            />
          </div>

          <div className="form-row">
            <label>Overrun Filter</label>
            <select
              className="select"
              value={overrunFilter}
              onChange={(e) => setOverrunFilter(e.target.value as 'all' | 'over' | 'within')}
            >
              <option value="all">All Lines</option>
              <option value="over">Over Budget Only</option>
              <option value="within">Within Budget Only</option>
            </select>
          </div>
        </div>
      </section>

      {!periodStartUtc || !periodEndUtc ? (
        <section className="panel">
          <div className="muted">Select a fiscal period to load the report.</div>
        </section>
      ) : reportMode === 'type' && !selectedBudgetType ? (
        <section className="panel">
          <div className="muted">Select a budget type to load the report.</div>
        </section>
      ) : reportQ.isLoading ? (
        <section className="panel">Loading Budget vs Actual report...</section>
      ) : reportQ.isError || !reportQ.data ? (
        <section className="panel error-panel">We could not load Budget vs Actual report at this time.</section>
      ) : (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>{reportTitle}</h2>
              <div className="muted">
                {formatDate(reportQ.data.periodStartUtc)} - {formatDate(reportQ.data.periodEndUtc)}
              </div>
            </div>
          </div>

          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <StatLike label="Budget Types" value={reportQ.data.sectionCount} />
            <StatLike label="Budgets" value={reportQ.data.budgetCount} />
            <StatLike label="Budget Amount" value={formatAmount(reportQ.data.totalBudgetAmount)} />
            <StatLike label="Actual Amount" value={formatAmount(reportQ.data.totalActualAmount)} />
            <StatLike label="Variance" value={formatAmount(reportQ.data.totalVarianceAmount)} />
            <StatLike label="Over-Budget Lines" value={reportQ.data.overBudgetLineCount} />
          </div>

          {filteredSections.length === 0 || reportQ.data.budgetCount === 0 ? (
            <div className="muted">
              No approved, locked, or closed budgets were found for the selected option.
            </div>
          ) : (
            filteredSections.map((section) => (
              <section key={section.budgetType} className="panel" style={{ marginTop: 16 }}>
                <div className="section-heading">
                  <div>
                    <h2>{budgetTypeLabel(section.budgetType)} Budgets</h2>
                    <div className="muted">
                      {section.budgetCount} budget(s), {section.overBudgetLineCount} over-budget line(s)
                    </div>
                  </div>
                </div>

                <div className="stats-grid" style={{ marginBottom: 16 }}>
                  <StatLike label="Section Budget" value={formatAmount(section.totalBudgetAmount)} />
                  <StatLike label="Section Actual" value={formatAmount(section.totalActualAmount)} />
                  <StatLike label="Section Variance" value={formatAmount(section.totalVarianceAmount)} />
                </div>

                {section.budgets.map((budget) => (
                  <div key={budget.id} style={{ marginTop: 18 }}>
                    <div className="section-heading">
                      <div>
                        <h2>{budget.budgetNumber} - {budget.name}</h2>
                        <div className="muted">{budget.description}</div>
                      </div>
                    </div>

                    <div className="kv" style={{ marginBottom: 12 }}>
                      <div className="kv-row"><span>Status</span><span>{budgetStatusLabel(budget.status)}</span></div>
                      <div className="kv-row"><span>Budget Amount</span><span>{formatAmount(budget.totalBudgetAmount)}</span></div>
                      <div className="kv-row"><span>Actual Amount</span><span>{formatAmount(budget.totalActualAmount)}</span></div>
                      <div className="kv-row"><span>Variance</span><span>{formatAmount(budget.totalVarianceAmount)}</span></div>
                      <div className="kv-row"><span>Overrun Policy</span><span>{overrunPolicyLabel(budget.overrunPolicy)}</span></div>
                    </div>

                    <BudgetActualTable items={budget.items} />
                  </div>
                ))}
              </section>
            ))
          )}
        </section>
      )}
    </div>
  );
}

function BudgetActualTable({ items }: { items: BudgetVsActualItemDto[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table report-print-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Category</th>
            <th>Normal Balance</th>
            <th>Period</th>
            <th style={{ textAlign: 'right' }}>Budget</th>
            <th style={{ textAlign: 'right' }}>Actual</th>
            <th style={{ textAlign: 'right' }}>Variance</th>
            <th style={{ textAlign: 'right' }}>Utilization %</th>
            <th>Class</th>
            <th>Overrun Status</th>
            <th>Notes</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={11} className="muted">No budget lines matched the selected filter.</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.budgetLineId}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>{item.ledgerAccountCode}</span>
                    <span className="muted">{item.ledgerAccountName}</span>
                  </div>
                </td>
                <td>{accountCategoryLabel(item.category)}</td>
                <td>{normalBalanceLabel(item.normalBalance)}</td>
                <td>{formatDate(item.periodStartUtc)} - {formatDate(item.periodEndUtc)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.budgetAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.actualAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(item.varianceAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatPercent(item.utilizationPercent)}%</td>
                <td>{varianceClass(item)}</td>
                <td>{item.overrunStatus}</td>
                <td>{item.notes || '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatLike({ label, value }: { label: string | number; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="muted">{label}</div>
      <div style={{ fontWeight: 800, fontSize: 24, marginTop: 8 }}>{value}</div>
    </div>
  );
}