import {
    formatAmount,
    payrollStatusLabel,
    getPayrollRuns,
    useQuery,
    type PayrollRunSummaryDto,
    canViewFinance,
  } from './PayrollShared';
  
  export function PayrollDashboardPage() {
    const canView = canViewFinance();
    const runsQ = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns, enabled: canView });
  
    if (!canView) return <div className="panel error-panel">You do not have access to Payroll.</div>;
    if (runsQ.isLoading) return <div className="panel">Loading Payroll dashboard...</div>;
    if (runsQ.isError) return <div className="panel error-panel">Unable to load Payroll dashboard.</div>;
  
    const runs = ((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[];
    const totalGross = runs.reduce((sum: number, run: PayrollRunSummaryDto) => sum + run.totalGrossPay, 0);
    const totalDeductions = runs.reduce((sum: number, run: PayrollRunSummaryDto) => sum + run.totalDeductions, 0);
    const totalNet = runs.reduce((sum: number, run: PayrollRunSummaryDto) => sum + run.totalNetPay, 0);
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Payroll Dashboard</h2>
          <div className="muted">Overview of payroll runs, statutory deductions, net pay, and posting status.</div>
  
          <div className="kpi-grid">
            <div className="kpi-card"><span>Payroll Runs</span><strong>{runs.length}</strong></div>
            <div className="kpi-card"><span>Gross Pay</span><strong>{formatAmount(totalGross)}</strong></div>
            <div className="kpi-card"><span>Deductions</span><strong>{formatAmount(totalDeductions)}</strong></div>
            <div className="kpi-card"><span>Net Pay</span><strong>{formatAmount(totalNet)}</strong></div>
          </div>
        </section>
  
        <section className="panel">
          <h3>Recent Payroll Runs</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Employees</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No payroll runs yet.</td></tr>
                ) : (
                  runs.map((run: PayrollRunSummaryDto) => (
                    <tr key={run.id}>
                      <td>{run.payrollPeriod}</td>
                      <td>{payrollStatusLabel(run.status)}</td>
                      <td style={{ textAlign: 'right' }}>{run.employeeCount}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(run.totalGrossPay)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(run.totalDeductions)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(run.totalNetPay)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  