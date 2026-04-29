import {
    formatAmount,
    getEmployeePayrollHistory,
    getPayrollEmployees,
    getPayrollRuns,
    getPayrollStatutoryReport,
    payrollStatusLabel,
    printCurrentPage,
    useQuery,
    useState,
    type PayrollEmployeeDto,
    type PayrollRunSummaryDto,
    type PayrollStatutoryReportRowDto,
    canViewFinance,
  } from './PayrollShared';
  
  export function PayrollReportsPage() {
    const canView = canViewFinance();
    const [selectedRunId, setSelectedRunId] = useState('');
    const [selectedEmployeeHistoryId, setSelectedEmployeeHistoryId] = useState('');
  
    const runsQ = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns, enabled: canView });
    const employeesQ = useQuery({ queryKey: ['payroll-employees'], queryFn: getPayrollEmployees, enabled: canView });
    const statutoryQ = useQuery({ queryKey: ['payroll-statutory-report', selectedRunId], queryFn: () => getPayrollStatutoryReport(selectedRunId), enabled: canView && selectedRunId.length > 0 });
    const employeeHistoryQ = useQuery({ queryKey: ['employee-payroll-history', selectedEmployeeHistoryId], queryFn: () => getEmployeePayrollHistory(selectedEmployeeHistoryId), enabled: canView && selectedEmployeeHistoryId.length > 0 });
  
    if (!canView) return <div className="panel error-panel">You do not have access to Payroll Reports.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <div><h2>Payroll Reports & Statutory Compliance</h2><div className="muted">PAYE/deduction schedule, pension references, bank payroll history, and employee payroll history.</div></div>
            <button className="button secondary" type="button" onClick={printCurrentPage}>Print / Save PDF</button>
          </div>
  
          <div className="form-grid two">
            <div className="form-row"><label>Payroll Run</label><select className="input" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}><option value="">Select run</option>{(((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[]).map((run: PayrollRunSummaryDto) => <option key={run.id} value={run.id}>{run.payrollPeriod} - {payrollStatusLabel(run.status)}</option>)}</select></div>
            <div className="form-row"><label>Employee History</label><select className="input" value={selectedEmployeeHistoryId} onChange={(e) => setSelectedEmployeeHistoryId(e.target.value)}><option value="">Select employee</option>{(((employeesQ.data as any)?.items ?? []) as PayrollEmployeeDto[]).map((employee: PayrollEmployeeDto) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} - {employee.displayName}</option>)}</select></div>
          </div>
        </section>
  
        {selectedRunId ? (
          <section className="panel">
            <h3>Statutory Compliance Schedule</h3>
            <div className="kv"><div className="kv-row"><span>Total Gross Pay</span><span>{formatAmount(statutoryQ.data?.totalGrossPay)}</span></div><div className="kv-row"><span>Total Statutory / Employee Deductions</span><span>{formatAmount(statutoryQ.data?.totalStatutoryDeductions)}</span></div><div className="kv-row"><span>Total Net Pay</span><span>{formatAmount(statutoryQ.data?.totalNetPay)}</span></div></div>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee No.</th><th>Employee</th><th>Tax ID</th><th>Pension No.</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Deduction</th><th style={{ textAlign: 'right' }}>Net Pay</th></tr></thead><tbody>{(statutoryQ.data?.items ?? []).map((row: PayrollStatutoryReportRowDto) => <tr key={row.employeeId}><td>{row.employeeNumber}</td><td>{row.employeeName}</td><td>{row.taxIdentificationNumber}</td><td>{row.pensionNumber}</td><td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td><td style={{ textAlign: 'right' }}>{formatAmount(row.statutoryDeductionAmount)}</td><td style={{ textAlign: 'right' }}>{formatAmount(row.netPay)}</td></tr>)}</tbody></table></div>
          </section>
        ) : null}
  
        {selectedEmployeeHistoryId && employeeHistoryQ.data ? (
          <section className="panel">
            <h3>Employee Payroll History</h3>
            <div className="muted">{employeeHistoryQ.data.employee.employeeNumber} - {employeeHistoryQ.data.employee.employeeName}</div>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Period</th><th>Status</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Deductions</th><th style={{ textAlign: 'right' }}>Net Pay</th><th>Posted</th></tr></thead><tbody>{(employeeHistoryQ.data as any).items.map((row: any) => <tr key={row.payrollRunLineId}><td>{row.payrollPeriod}</td><td>{payrollStatusLabel(row.status)}</td><td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td><td style={{ textAlign: 'right' }}>{formatAmount(row.totalDeductions)}</td><td style={{ textAlign: 'right' }}>{formatAmount(row.netPay)}</td><td>{row.postedOnUtc ? new Date(row.postedOnUtc).toISOString().slice(0, 10) : '—'}</td></tr>)}</tbody></table></div>
          </section>
        ) : null}
      </div>
    );
  }
  