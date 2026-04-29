import {
    formatAmount,
    getPayrollPayslips,
    getPayrollRuns,
    payrollStatusLabel,
    printCurrentPage,
    useQuery,
    useState,
    type PayrollPayslipDto,
    type PayrollRunSummaryDto,
    canViewFinance,
  } from './PayrollShared';
  
  export function PayrollPayslipsPage() {
    const canView = canViewFinance();
    const [selectedRunId, setSelectedRunId] = useState('');
    const runsQ = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns, enabled: canView });
    const payslipsQ = useQuery({ queryKey: ['payroll-payslips', selectedRunId], queryFn: () => getPayrollPayslips(selectedRunId), enabled: canView && selectedRunId.length > 0 });
  
    if (!canView) return <div className="panel error-panel">You do not have access to Payroll Payslips.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <div><h2>Payslips</h2><div className="muted">Print or save employee payslips by payroll run.</div></div>
            <button className="button secondary" type="button" onClick={printCurrentPage}>Print / Save PDF</button>
          </div>
          <div className="form-row"><label>Payroll Run</label><select className="input" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}><option value="">Select run</option>{(((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[]).map((run: PayrollRunSummaryDto) => <option key={run.id} value={run.id}>{run.payrollPeriod} - {payrollStatusLabel(run.status)}</option>)}</select></div>
        </section>
  
        {selectedRunId ? (
          <section className="panel">
            <h3>Payslips</h3>
            {(payslipsQ.data?.items ?? []).map((payslip: PayrollPayslipDto) => (
              <div key={payslip.payrollRunLineId} className="panel" style={{ marginTop: 12 }}>
                <div className="section-heading"><div><h3>{payslip.employeeName}</h3><div className="muted">{payslip.payslipNumber} | {payslip.payrollPeriod}</div></div><strong>{payslip.currencyCode} {formatAmount(payslip.netPay)}</strong></div>
                <div className="form-grid three">
                  <div className="kv-row"><span>Employee No.</span><span>{payslip.employeeNumber}</span></div>
                  <div className="kv-row"><span>Department</span><span>{payslip.department || '—'}</span></div>
                  <div className="kv-row"><span>Job Title</span><span>{payslip.jobTitle || '—'}</span></div>
                  <div className="kv-row"><span>Bank</span><span>{[payslip.bankName, payslip.bankAccountNumber].filter(Boolean).join(' - ') || '—'}</span></div>
                  <div className="kv-row"><span>Tax ID</span><span>{payslip.taxIdentificationNumber || '—'}</span></div>
                  <div className="kv-row"><span>Pension No.</span><span>{payslip.pensionNumber || '—'}</span></div>
                </div>
                <div className="form-grid two">
                  <div><h4>Earnings</h4><div className="table-wrap"><table className="data-table"><tbody>{payslip.earnings.map((item: any) => <tr key={item.code}><td>{item.description}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td></tr>)}</tbody></table></div></div>
                  <div><h4>Deductions</h4><div className="table-wrap"><table className="data-table"><tbody>{payslip.deductions.length === 0 ? <tr><td className="muted">No deductions</td><td style={{ textAlign: 'right' }}>{formatAmount(0)}</td></tr> : payslip.deductions.map((item: any) => <tr key={item.code}><td>{item.description}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td></tr>)}</tbody></table></div></div>
                </div>
                <div className="kv"><div className="kv-row"><span>Gross Pay</span><span>{formatAmount(payslip.grossPay)}</span></div><div className="kv-row"><span>Total Deductions</span><span>{formatAmount(payslip.totalDeductions)}</span></div><div className="kv-row"><span>Net Pay</span><strong>{formatAmount(payslip.netPay)}</strong></div></div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    );
  }
  