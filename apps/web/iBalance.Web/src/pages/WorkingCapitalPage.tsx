import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getPayablesStrategy,
  getReceivablesHealth,
  getTenantReadableError,
  getWorkingCapitalActions,
  getWorkingCapitalCashflowForecast,
  getWorkingCapitalDashboard,
  getWorkingCapitalOptimization,
  type WorkingCapitalActionDto,
  type WorkingCapitalCashflowAlertDto,
  type WorkingCapitalCashflowForecastBucketDto,
  type WorkingCapitalCashflowForecastItemDto,
  type WorkingCapitalExceptionRowDto,
  type WorkingCapitalInventoryRowDto,
  type WorkingCapitalPayableStrategyRowDto,
  type WorkingCapitalReceivableHealthRowDto,
} from '../lib/api';
import { canViewFinance } from '../lib/auth';

function dateInputToUtc(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function utcToDateInput(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function ninetyDaysAgoInputValue() {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().slice(0, 10);
}

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function riskClassName(value?: string | null) {
  const risk = (value || '').toLowerCase();

  if (risk === 'critical') return 'badge danger';
  if (risk === 'high') return 'badge warning';
  if (risk === 'moderate') return 'badge';
  return 'badge success';
}

function printWorkingCapitalReport(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const iframe = document.createElement('iframe');
  iframe.title = 'Working Capital Print Frame';
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
  frameDocument.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Working Capital Report</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; color:#111827; }
    h2 { margin-bottom: 4px; }
    .muted { color:#6b7280; font-size:12px; }
    .kv { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin:12px 0; }
    .kv-row { border:1px solid #d1d5db; border-radius:8px; padding:8px; display:grid; gap:4px; }
    .kv-row span:first-child { color:#6b7280; font-size:11px; text-transform:uppercase; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th, td { border:1px solid #d1d5db; padding:6px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; }
    .right { text-align:right; }
    .no-print, button, a { display:none !important; }
  </style>
</head>
<body>${section.innerHTML}</body>
</html>`);
  frameDocument.close();

  iframe.onload = () => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.parentNode?.removeChild(iframe), 500);
  };
}

export function WorkingCapitalPage() {
  const canView = canViewFinance();
  const [asOfDate, setAsOfDate] = useState(todayInputValue());
  const [fromDate, setFromDate] = useState(ninetyDaysAgoInputValue());
  const [toDate, setToDate] = useState(todayInputValue());

  const query = useMemo(() => ({
    asOfUtc: dateInputToUtc(asOfDate),
    fromUtc: dateInputToUtc(fromDate),
    toUtc: toDate ? new Date(`${toDate}T23:59:59.999Z`).toISOString() : undefined,
  }), [asOfDate, fromDate, toDate]);

  const dashboardQ = useQuery({
    queryKey: ['working-capital-dashboard', query.asOfUtc, query.fromUtc, query.toUtc],
    queryFn: () => getWorkingCapitalDashboard(query),
    enabled: canView,
  });

  const receivablesQ = useQuery({
    queryKey: ['working-capital-receivables-health', query.asOfUtc],
    queryFn: () => getReceivablesHealth(query.asOfUtc),
    enabled: canView,
  });

  const payablesQ = useQuery({
    queryKey: ['working-capital-payables-strategy', query.asOfUtc],
    queryFn: () => getPayablesStrategy(query.asOfUtc),
    enabled: canView,
  });

  const actionsQ = useQuery({
    queryKey: ['working-capital-actions', query.asOfUtc],
    queryFn: () => getWorkingCapitalActions(query.asOfUtc),
    enabled: canView,
  });

  const cashflowQ = useQuery({
    queryKey: ['working-capital-cashflow-forecast', query.asOfUtc],
    queryFn: () => getWorkingCapitalCashflowForecast(query.asOfUtc),
    enabled: canView,
  });

  const optimizationQ = useQuery({
    queryKey: ['working-capital-optimization', query.asOfUtc],
    queryFn: () => getWorkingCapitalOptimization(query.asOfUtc),
    enabled: canView,
  });

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view working capital analytics.</div>;
  }

  if (dashboardQ.isLoading || receivablesQ.isLoading || payablesQ.isLoading || actionsQ.isLoading || cashflowQ.isLoading) {
    return <div className="panel">Loading working capital dashboard...</div>;
  }

  if (dashboardQ.isError || receivablesQ.isError || payablesQ.isError || actionsQ.isError || cashflowQ.isError || !dashboardQ.data) {
    return <div className="panel error-panel">{getTenantReadableError(dashboardQ.error, 'Unable to load working capital dashboard.')}</div>;
  }

  const data = dashboardQ.data;

  return (
    <div className="page-grid">
      <section className="panel no-print">
        <div className="section-heading">
          <div>
            <h2>Working Capital Management</h2>
            <div className="muted">
              Phase 1 visibility dashboard across cash, receivables, inventory, and payables.
            </div>
          </div>
          <button className="button" onClick={() => printWorkingCapitalReport('working-capital-print')}>Print Report</button>
        </div>

        <div className="form-grid three">
          <div className="form-row">
            <label>As Of Date</label>
            <input className="input" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Analysis From</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Analysis To</label>
            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      </section>

      <section id="working-capital-print" className="panel">
        <div className="section-heading">
          <div>
            <h2>Working Capital Dashboard</h2>
            <div className="muted">
              Tenant: {data.tenantKey} · As of {utcToDateInput(data.asOfUtc)} · Period {utcToDateInput(data.fromUtc)} to {utcToDateInput(data.toUtc)}
            </div>
          </div>
          <span className={riskClassName(data.riskLevel)}>{data.riskLevel}</span>
        </div>

        <div className="kv">
          <div className="kv-row"><span>Cash / Bank Balance</span><span>{formatAmount(data.cashBalance)}</span></div>
          <div className="kv-row"><span>Accounts Receivable</span><span>{formatAmount(data.accountsReceivableBalance)}</span></div>
          <div className="kv-row"><span>Inventory Value</span><span>{formatAmount(data.inventoryValue)}</span></div>
          <div className="kv-row"><span>Accounts Payable</span><span>{formatAmount(data.accountsPayableBalance)}</span></div>
          <div className="kv-row"><span>Operating Working Capital</span><span>{formatAmount(data.operatingWorkingCapital)}</span></div>
          <div className="kv-row"><span>Net Working Capital</span><span>{formatAmount(data.netWorkingCapital)}</span></div>
          <div className="kv-row"><span>Period Sales</span><span>{formatAmount(data.periodSalesAmount)}</span></div>
          <div className="kv-row"><span>Period Purchases</span><span>{formatAmount(data.periodPurchaseAmount)}</span></div>
        </div>

        <div className="kv">
          <div className="kv-row"><span>DSO</span><span>{formatNumber(data.dsoDays)} days</span></div>
          <div className="kv-row"><span>DPO</span><span>{formatNumber(data.dpoDays)} days</span></div>
          <div className="kv-row"><span>Inventory Days</span><span>{formatNumber(data.inventoryDays)} days</span></div>
          <div className="kv-row"><span>Cash Conversion Cycle</span><span>{formatNumber(data.cashConversionCycleDays)} days</span></div>
        </div>

        <section style={{ marginTop: 18 }}>
          <h2>Top Overdue Receivables</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Invoice Date</th>
                  <th className="right" style={{ textAlign: 'right' }}>Outstanding</th>
                  <th className="right" style={{ textAlign: 'right' }}>Days</th>
                </tr>
              </thead>
              <tbody>
                {data.overdueReceivables.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No overdue receivables found.</td></tr>
                ) : (
                  data.overdueReceivables.map((row: WorkingCapitalExceptionRowDto) => (
                    <tr key={row.id}>
                      <td>{row.reference}</td>
                      <td>{[row.partyCode, row.partyName].filter(Boolean).join(' - ')}</td>
                      <td>{utcToDateInput(row.invoiceDateUtc)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.outstandingAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{row.daysOutstanding}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Top Payables to Manage</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Invoice Date</th>
                  <th className="right" style={{ textAlign: 'right' }}>Outstanding</th>
                  <th className="right" style={{ textAlign: 'right' }}>Days</th>
                </tr>
              </thead>
              <tbody>
                {data.duePayables.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No open payables found.</td></tr>
                ) : (
                  data.duePayables.map((row: WorkingCapitalExceptionRowDto) => (
                    <tr key={row.id}>
                      <td>{row.reference}</td>
                      <td>{[row.partyCode, row.partyName].filter(Boolean).join(' - ')}</td>
                      <td>{utcToDateInput(row.invoiceDateUtc)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.outstandingAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{row.daysOutstanding}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Top Inventory Exposure</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Item Name</th>
                  <th className="right" style={{ textAlign: 'right' }}>Qty on Hand</th>
                  <th className="right" style={{ textAlign: 'right' }}>Inventory Value</th>
                </tr>
              </thead>
              <tbody>
                {data.topInventory.length === 0 ? (
                  <tr><td colSpan={4} className="muted">No inventory exposure found.</td></tr>
                ) : (
                  data.topInventory.map((row: WorkingCapitalInventoryRowDto) => (
                    <tr key={row.inventoryItemId}>
                      <td>{row.itemCode}</td>
                      <td>{row.itemName}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(row.quantityOnHand)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.inventoryValue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>


        <section style={{ marginTop: 18 }}>
          <div className="section-heading">
            <div>
              <h2>Cash Flow Forecast</h2>
              <div className="muted">90-day liquidity projection using open receivables, open payables, and current cash position.</div>
            </div>
            <span className={riskClassName(cashflowQ.data?.riskLevel)}>{cashflowQ.data?.riskLevel ?? '—'}</span>
          </div>

          <div className="kv">
            <div className="kv-row"><span>Opening Cash</span><span>{formatAmount(cashflowQ.data?.openingCash)}</span></div>
            <div className="kv-row"><span>Expected Inflows</span><span>{formatAmount(cashflowQ.data?.totalExpectedInflows)}</span></div>
            <div className="kv-row"><span>Expected Outflows</span><span>{formatAmount(cashflowQ.data?.totalExpectedOutflows)}</span></div>
            <div className="kv-row"><span>Projected Closing Cash</span><span>{formatAmount(cashflowQ.data?.projectedClosingCash)}</span></div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th style={{ textAlign: 'right' }}>Expected Inflows</th>
                  <th style={{ textAlign: 'right' }}>Expected Outflows</th>
                  <th style={{ textAlign: 'right' }}>Net Cash Flow</th>
                  <th style={{ textAlign: 'right' }}>Projected Closing Cash</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {(cashflowQ.data?.buckets ?? []).map((bucket: WorkingCapitalCashflowForecastBucketDto) => (
                  <tr key={bucket.bucket}>
                    <td>{bucket.bucket} days</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(bucket.expectedInflows)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(bucket.expectedOutflows)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(bucket.netCashFlow)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(bucket.projectedClosingCash)}</td>
                    <td><span className={riskClassName(bucket.riskLevel)}>{bucket.riskLevel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>


        <section style={{ marginTop: 18 }}>
  <h2>Working Capital Optimization</h2>

  <h3>Collection Plan</h3>
  <div className="table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Days</th>
          <th>Priority</th>
          <th>Outstanding</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {(optimizationQ.data?.collectionPlan ?? []).map((row: any) => (
          <tr key={row.id}>
            <td>{row.invoiceNumber}</td>
            <td>{row.daysOutstanding}</td>
            <td>{row.priority}</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(row.balanceAmount)}</td>
            <td>{row.recommendedAction}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  <h3 style={{ marginTop: 16 }}>Payment Plan</h3>
  <div className="table-wrap">
    <table className="data-table">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Days</th>
          <th>Priority</th>
          <th>Outstanding</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {(optimizationQ.data?.paymentPlan ?? []).map((row: any) => (
          <tr key={row.id}>
            <td>{row.invoiceNumber}</td>
            <td>{row.daysOutstanding}</td>
            <td>{row.priority}</td>
            <td style={{ textAlign: 'right' }}>{formatAmount(row.balanceAmount)}</td>
            <td>{row.recommendedAction}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

        <section style={{ marginTop: 18 }}>
          <h2>Treasury Alerts</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Alert</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {(cashflowQ.data?.alerts ?? []).map((alert: WorkingCapitalCashflowAlertDto, index: number) => (
                  <tr key={`${alert.title}-${index}`}>
                    <td><span className={riskClassName(alert.severity)}>{alert.severity}</span></td>
                    <td>
                      <strong>{alert.title}</strong>
                      <div className="muted">{alert.description}</div>
                    </td>
                    <td>{alert.recommendedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Collection Forecast</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Bucket</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'right' }}>Probability</th>
                  <th style={{ textAlign: 'right' }}>Expected Cash</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {(cashflowQ.data?.receiptForecastItems ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="muted">No receivable cash forecast inside the next 90 days.</td></tr>
                ) : (
                  (cashflowQ.data?.receiptForecastItems ?? []).map((row: WorkingCapitalCashflowForecastItemDto) => (
                    <tr key={`receipt-${row.id}`}>
                      <td>{row.reference}</td>
                      <td>{[row.partyCode, row.partyName].filter(Boolean).join(' - ')}</td>
                      <td>{row.forecastBucket}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.outstandingAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(row.probabilityPercent)}%</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.expectedAmount)}</td>
                      <td>{row.recommendation}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Payment Forecast</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Bucket</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'right' }}>Probability</th>
                  <th style={{ textAlign: 'right' }}>Expected Cash Out</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {(cashflowQ.data?.paymentForecastItems ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="muted">No payable cash forecast inside the next 90 days.</td></tr>
                ) : (
                  (cashflowQ.data?.paymentForecastItems ?? []).map((row: WorkingCapitalCashflowForecastItemDto) => (
                    <tr key={`payment-${row.id}`}>
                      <td>{row.reference}</td>
                      <td>{[row.partyCode, row.partyName].filter(Boolean).join(' - ')}</td>
                      <td>{row.forecastBucket}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.outstandingAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(row.probabilityPercent)}%</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.expectedAmount)}</td>
                      <td>{row.recommendation}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Working Capital Action Panel</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Area</th>
                  <th>Action</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {(actionsQ.data?.items ?? []).map((action: WorkingCapitalActionDto, index: number) => (
                  <tr key={`${action.area}-${action.title}-${index}`}>
                    <td><span className={riskClassName(action.severity)}>{action.severity}</span></td>
                    <td>{action.area}</td>
                    <td>
                      <strong>{action.title}</strong>
                      <div className="muted">{action.description}</div>
                    </td>
                    <td>{action.recommendedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Receivables Health</h2>
          <div className="kv">
            <div className="kv-row"><span>Open Receivables</span><span>{receivablesQ.data?.count ?? 0}</span></div>
            <div className="kv-row"><span>Total Outstanding</span><span>{formatAmount(receivablesQ.data?.totalOutstandingAmount)}</span></div>
            <div className="kv-row"><span>Critical Count</span><span>{receivablesQ.data?.criticalCount ?? 0}</span></div>
            <div className="kv-row"><span>High Risk Count</span><span>{receivablesQ.data?.highRiskCount ?? 0}</span></div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Bucket</th>
                  <th>Risk</th>
                  <th>Recommended Action</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'right' }}>Days</th>
                </tr>
              </thead>
              <tbody>
                {(receivablesQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="muted">No receivables exposure found.</td></tr>
                ) : (
                  (receivablesQ.data?.items ?? []).map((row: WorkingCapitalReceivableHealthRowDto) => (
                    <tr key={row.id}>
                      <td>{row.invoiceNumber}</td>
                      <td>{[row.customerCode, row.customerName].filter(Boolean).join(' - ')}</td>
                      <td>{row.ageBucket}</td>
                      <td><span className={riskClassName(row.riskLevel)}>{row.riskLevel}</span></td>
                      <td>{row.recommendedAction}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.balanceAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{row.daysOutstanding}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2>Payables Strategy</h2>
          <div className="kv">
            <div className="kv-row"><span>Open Payables</span><span>{payablesQ.data?.count ?? 0}</span></div>
            <div className="kv-row"><span>Total Outstanding</span><span>{formatAmount(payablesQ.data?.totalOutstandingAmount)}</span></div>
            <div className="kv-row"><span>Immediate Count</span><span>{payablesQ.data?.immediateCount ?? 0}</span></div>
            <div className="kv-row"><span>High Priority Count</span><span>{payablesQ.data?.highPriorityCount ?? 0}</span></div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Vendor</th>
                  <th>Priority</th>
                  <th>Recommended Action</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th style={{ textAlign: 'right' }}>Days</th>
                </tr>
              </thead>
              <tbody>
                {(payablesQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="muted">No payable exposure found.</td></tr>
                ) : (
                  (payablesQ.data?.items ?? []).map((row: WorkingCapitalPayableStrategyRowDto) => (
                    <tr key={row.id}>
                      <td>{row.invoiceNumber}</td>
                      <td>{[row.vendorCode, row.vendorName].filter(Boolean).join(' - ')}</td>
                      <td><span className={riskClassName(row.priority)}>{row.priority}</span></td>
                      <td>{row.recommendedAction}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.balanceAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{row.daysOutstanding}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </section>
    </div>
  );
}
