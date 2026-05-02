import { deletePayrollRun } from '../lib/api';
import {
  approvePayrollRun,
  formatAmount,
  generatePayrollRun,
  getAccounts,
  getPayrollRunDetail,
  getPayrollRuns,
  getTenantReadableError,
  payrollStatusLabel,
  postPayrollRun,
  rejectPayrollRun,
  submitPayrollRun,
  useMutation,
  useQuery,
  useQueryClient,
  useState,
  type PayrollRunLineDetailDto,
  type PayrollRunSummaryDto,
  canManageFinanceSetup,
  canPostJournals,
  canViewFinance,
} from './PayrollShared';

export function PayrollRunsPage() {
  const queryClient = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();
  const canPost = canPostJournals();
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [payrollRunPeriod, setPayrollRunPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [selectedRunId, setSelectedRunId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [postingDate, setPostingDate] = useState('');
  const [salaryExpenseAccountId, setSalaryExpenseAccountId] = useState('');
  const [deductionsPayableAccountId, setDeductionsPayableAccountId] = useState('');
  const [netSalaryPayableAccountId, setNetSalaryPayableAccountId] = useState('');

  const runsQ = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns, enabled: canView });
  const accountsQ = useQuery({ queryKey: ['ledger-accounts'], queryFn: getAccounts, enabled: canView });
  const selectedRunDetailQ = useQuery({
    queryKey: ['payroll-run-detail', selectedRunId],
    queryFn: () => getPayrollRunDetail(selectedRunId),
    enabled: canView && selectedRunId.length > 0,
  });

  const postingAccounts = (((accountsQ.data as any)?.items ?? []) as any[]).filter((x) => x.isActive && x.isPostingAllowed && !x.isHeader);

  const refreshRuns = () => {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    if (selectedRunId) queryClient.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] });
  };

  function toMonthEndDate(period: string) {
    if (!period) return '';
    const [yearText, monthText] = period.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    if (!year || !month) return '';
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${yearText}-${monthText}-${String(day).padStart(2, '0')}`;
  }

  function clearPostingControlsForRun() {
    setPostingDate('');
    setSalaryExpenseAccountId('');
    setDeductionsPayableAccountId('');
    setNetSalaryPayableAccountId('');
  }

  const generateRunMut = useMutation<any, Error, string>({
    mutationFn: generatePayrollRun,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Payroll run generated.');
      setErrorText('');
      refreshRuns();
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to generate payroll run.')),
  });

  const submitRunMut = useMutation({
    mutationFn: (runId: string) => submitPayrollRun(runId, { notes: 'Submitted from Payroll Runs page.' }),
    onSuccess: (response: any) => { setMessage(response?.message || response?.Message || 'Payroll run submitted.'); setErrorText(''); refreshRuns(); },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to submit payroll run.')),
  });

  const approveRunMut = useMutation({
    mutationFn: approvePayrollRun,
    onSuccess: (response: any) => { setMessage(response?.message || response?.Message || 'Payroll run approved.'); setErrorText(''); refreshRuns(); },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to approve payroll run.')),
  });

  const rejectRunMut = useMutation({
    mutationFn: ({ runId, reason }: { runId: string; reason: string }) => rejectPayrollRun(runId, { reason }),
    onSuccess: (response: any) => { setMessage(response?.message || response?.Message || 'Payroll run rejected.'); setErrorText(''); setRejectionReason(''); refreshRuns(); },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reject payroll run.')),
  });

  const postRunMut = useMutation({
    mutationFn: ({ runId, payload }: any) => postPayrollRun(runId, payload),
    onSuccess: (res: any) => { setMessage((res?.Message || res?.message || 'Payroll posted successfully.') + (res?.FiscalPeriod ? ` Fiscal Period: ${res.FiscalPeriod}.` : '')); setErrorText(''); refreshRuns(); },
    onError: (e) => setErrorText(getTenantReadableError(e, 'Posting failed')),
  });

  const deleteRunMut = useMutation({
    mutationFn: deletePayrollRun,
    onSuccess: (response: any, runId: string) => {
      setMessage(response?.message || response?.Message || 'Payroll run deleted successfully.');
      setErrorText('');
      if (selectedRunId === runId) {
        setSelectedRunId('');
      }
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-run-detail'] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to delete payroll run.')),
  });

  async function removePayrollRun(run: PayrollRunSummaryDto) {
    setMessage('');
    setErrorText('');

    const confirmed = window.confirm(
      `Delete payroll run for "${run.payrollPeriod}"? This is only allowed while the run is still in Draft.`
    );

    if (!confirmed) return;

    await deleteRunMut.mutateAsync(run.id);
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Payroll Runs.</div>;
  if (runsQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading Payroll runs...</div>;
  if (runsQ.isError || accountsQ.isError) return <div className="panel error-panel">Unable to load Payroll runs.</div>;

  const runs = ((((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[]).filter((run) => run.status !== 4));
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const runDetail = selectedRunDetailQ.data?.payrollRun ? selectedRunDetailQ.data : null;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Payroll Runs</h2>
        <div className="muted">Maker/Checker workflow with persisted payroll line-item breakdown.</div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}

        <div className="form-grid three">
          <div className="form-row"><label>Payroll Period</label><input className="input" type="month" value={payrollRunPeriod} onChange={(e) => setPayrollRunPeriod(e.target.value)} /></div>
          <div className="form-row"><label>Generate</label><button className="button primary" type="button" disabled={!canManage || generateRunMut.isPending || !payrollRunPeriod} onClick={() => generateRunMut.mutate(payrollRunPeriod)}>Generate Payroll Run</button></div>
          <div className="form-row">
            <label>Select Run</label>
            <select
              className="input"
              value={selectedRunId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedRunId(value);
                const pickedRun = runs.find((run) => run.id === value);
                setPostingDate(pickedRun ? toMonthEndDate(pickedRun.payrollPeriod) : '');
                clearPostingControlsForRun();
              }}
            >
              <option value="">Select run</option>
              {runs.map((run) => <option key={run.id} value={run.id}>{run.payrollPeriod} - {payrollStatusLabel(run.status)} - {formatAmount(run.totalNetPay)}</option>)}
            </select>
          </div>
        </div>
        <div className="muted" style={{ marginTop: 10 }}>Rejected runs now move to the separate Rejected Payroll Runs queue for reopening, resubmitting, or deletion.</div>
      </section>

      <section className="panel">
        <h3>Payroll Runs</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Period</th><th>Status</th><th style={{ textAlign: 'right' }}>Employees</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Deductions</th><th style={{ textAlign: 'right' }}>Net Pay</th><th>Journal</th>{canManage ? <th style={{ width: 140 }}>Actions</th> : null}</tr></thead>
            <tbody>{runs.map((run) => <tr key={run.id}><td>{run.payrollPeriod}</td><td>{payrollStatusLabel(run.status)}</td><td style={{ textAlign: 'right' }}>{run.employeeCount}</td><td style={{ textAlign: 'right' }}>{formatAmount(run.totalGrossPay)}</td><td style={{ textAlign: 'right' }}>{formatAmount(run.totalDeductions)}</td><td style={{ textAlign: 'right' }}>{formatAmount(run.totalNetPay)}</td><td>{run.journalEntryId || '—'}</td>{canManage ? <td><button className="button danger" type="button" disabled={run.status !== 0 || !!run.journalEntryId || deleteRunMut.isPending} onClick={() => removePayrollRun(run)}>Delete</button></td> : null}</tr>)}</tbody>
          </table>
        </div>
      </section>

      {selectedRun ? (
        <section className="panel">
          <h3>Maker / Checker Actions</h3>
          <div className="form-grid three">
            <button className="button secondary" type="button" disabled={!canManage || selectedRun.status !== 0 || submitRunMut.isPending} onClick={() => submitRunMut.mutate(selectedRun.id)}>Submit for Approval</button>
            <button className="button secondary" type="button" disabled={!canPost || selectedRun.status !== 1 || approveRunMut.isPending} onClick={() => approveRunMut.mutate(selectedRun.id)}>Approve Payroll</button>
          </div>

          <div className="form-grid two" style={{ marginTop: 12 }}>
            <div className="form-row"><label>Reject Reason</label><input className="input" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /></div>
            <div className="form-row"><label>Reject</label><button className="button danger" type="button" disabled={!canPost || selectedRun.status !== 1 || !rejectionReason.trim()} onClick={() => rejectRunMut.mutate({ runId: selectedRun.id, reason: rejectionReason })}>Reject Payroll</button></div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Posting Controls</h3>
            <div className="muted" style={{ marginBottom: 12 }}>
              Payroll posting will use each Pay Element ledger where available. The accounts below are controlled fallbacks for unmapped earnings, unmapped deductions / employer obligations, and net salary payable. The posting date drives fiscal-period validation.
            </div>
            <div className="form-grid two">
              <div className="form-row">
                <label>Posting Date</label>
                <input className="input" type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Reference</label>
                <input className="input" value={`PAY-${selectedRun.payrollPeriod}`} readOnly />
              </div>
              <div className="form-row">
                <label>Fallback Salary Expense Account</label>
                <select className="input" value={salaryExpenseAccountId} onChange={(e) => setSalaryExpenseAccountId(e.target.value)}>
                  <option value="">Select fallback salary expense account</option>
                  {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Fallback Deductions Payable Account</label>
                <select className="input" value={deductionsPayableAccountId} onChange={(e) => setDeductionsPayableAccountId(e.target.value)}>
                  <option value="">Select fallback deductions payable account</option>
                  {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Net Salary Payable Account</label>
                <select className="input" value={netSalaryPayableAccountId} onChange={(e) => setNetSalaryPayableAccountId(e.target.value)}>
                  <option value="">Select net salary payable account</option>
                  {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
            </div>
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button
                className="button success"
                type="button"
                disabled={!canPost || selectedRun.status !== 1 || !postingDate || !salaryExpenseAccountId || !deductionsPayableAccountId || !netSalaryPayableAccountId || postRunMut.isPending}
                onClick={() =>
                  postRunMut.mutate({
                    runId: selectedRun.id,
                    payload: {
                      salaryExpenseAccountId,
                      deductionsPayableAccountId,
                      netSalaryPayableAccountId,
                      postingDateUtc: `${postingDate}T00:00:00.000Z`,
                      reference: `PAY-${selectedRun.payrollPeriod}`,
                      description: `Payroll posting - ${selectedRun.payrollPeriod}`,
                    },
                  })
                }
              >
                Post to GL
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {runDetail ? (
        <section className="panel">
          <h3>Payroll Register</h3>
          <div className="kv">
            <div className="kv-row"><span>Employees</span><span>{runDetail.payrollRun.employeeCount}</span></div>
            <div className="kv-row"><span>Total Gross Pay</span><span>{formatAmount(runDetail.payrollRun.totalGrossPay)}</span></div>
            <div className="kv-row"><span>Total Deductions</span><span>{formatAmount(runDetail.payrollRun.totalDeductions)}</span></div>
            <div className="kv-row"><span>Total Net Pay</span><span>{formatAmount(runDetail.payrollRun.totalNetPay)}</span></div>
          </div>
          {(runDetail.items ?? []).map((line: PayrollRunLineDetailDto) => (
            <div key={line.payrollRunLineId} className="panel" style={{ marginTop: 12 }}>
              <div className="section-heading">
                <div>
                  <h3>{line.employeeName}</h3>
                  <div className="muted">{line.employeeNumber} · {line.department || '—'} · {line.jobTitle || '—'}</div>
                </div>
                <strong>{formatAmount(line.netPay)}</strong>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Seq</th><th>Code</th><th>Description</th><th>Kind</th><th>Mode</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {line.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.sequence}</td>
                        <td>{item.code}</td>
                        <td>{item.description}</td>
                        <td>{item.elementKind}</td>
                        <td>{item.calculationMode}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="kv">
                <div className="kv-row"><span>Gross Pay</span><span>{formatAmount(line.grossPay)}</span></div>
                <div className="kv-row"><span>Total Deductions</span><span>{formatAmount(line.totalDeductions)}</span></div>
                <div className="kv-row"><span>Net Pay</span><strong>{formatAmount(line.netPay)}</strong></div>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
