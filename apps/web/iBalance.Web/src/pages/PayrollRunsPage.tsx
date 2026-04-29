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
    useMemo,
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
  
    const runsQ = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns, enabled: canView });
    const accountsQ = useQuery({ queryKey: ['ledger-accounts'], queryFn: getAccounts, enabled: canView });
    const selectedRunDetailQ = useQuery({ queryKey: ['payroll-run-detail', selectedRunId], queryFn: () => getPayrollRunDetail(selectedRunId), enabled: canView && selectedRunId.length > 0 });
  
    const postingAccounts = useMemo(
      () => ((accountsQ.data as any)?.items ?? []).filter((x: any) => x.isActive && x.isPostingAllowed && !x.isHeader),
      [accountsQ.data]
    );
  
    const refreshRuns = () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      if (selectedRunId) queryClient.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] });
    };
  
    const generateRunMut = useMutation<any, Error, string>({
      mutationFn: generatePayrollRun,
      onSuccess: (response: any) => {
        setMessage(response?.message || response?.Message || 'Payroll run generated.');
        refreshRuns();
      },
      onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to generate payroll run.')),
    });
  
    const submitRunMut = useMutation({
      mutationFn: (runId: string) => submitPayrollRun(runId, { notes: 'Submitted from Payroll Runs page.' }),
      onSuccess: (response: any) => { setMessage(response?.message || response?.Message || 'Payroll run submitted.'); refreshRuns(); },
      onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to submit payroll run.')),
    });
  
    const approveRunMut = useMutation({
      mutationFn: approvePayrollRun,
      onSuccess: (response: any) => { setMessage(response?.message || response?.Message || 'Payroll run approved.'); refreshRuns(); },
      onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to approve payroll run.')),
    });
  
    const rejectRunMut = useMutation({
      mutationFn: ({ runId, reason }: { runId: string; reason: string }) => rejectPayrollRun(runId, { reason }),
      onSuccess: (response: any) => { setMessage(response?.message || response?.Message || 'Payroll run rejected.'); setRejectionReason(''); refreshRuns(); },
      onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reject payroll run.')),
    });
  
    const postRunMut = useMutation({
      mutationFn: ({ runId, payload }: any) => postPayrollRun(runId, payload),
      onSuccess: (res: any) => { setMessage(res?.Message || res?.message || 'Payroll posted successfully.'); refreshRuns(); },
      onError: (e) => setErrorText(getTenantReadableError(e, 'Posting failed')),
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to Payroll Runs.</div>;
    if (runsQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading Payroll runs...</div>;
    if (runsQ.isError || accountsQ.isError) return <div className="panel error-panel">Unable to load Payroll runs.</div>;
  
    const selectedRun = ((runsQ.data as any)?.items ?? []).find((run: PayrollRunSummaryDto) => run.id === selectedRunId);
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Payroll Runs</h2>
          <div className="muted">Maker/Checker workflow: maker generates and submits, checker approves/posts or rejects.</div>
          {message ? <div className="success-panel">{message}</div> : null}
          {errorText ? <div className="error-panel">{errorText}</div> : null}
  
          <div className="form-grid three">
            <div className="form-row"><label>Payroll Period</label><input className="input" type="month" value={payrollRunPeriod} onChange={(e) => setPayrollRunPeriod(e.target.value)} /></div>
            <div className="form-row"><label>Generate</label><button className="button primary" type="button" disabled={!canManage || generateRunMut.isPending || !payrollRunPeriod} onClick={() => generateRunMut.mutate(payrollRunPeriod)}>Generate Payroll Run</button></div>
            <div className="form-row"><label>Select Run</label><select className="input" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}><option value="">Select run</option>{((runsQ.data as any)?.items ?? []).map((run: PayrollRunSummaryDto) => <option key={run.id} value={run.id}>{run.payrollPeriod} - {payrollStatusLabel(run.status)} - {formatAmount(run.totalNetPay)}</option>)}</select></div>
          </div>
        </section>
  
        <section className="panel">
          <h3>Payroll Runs</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Period</th><th>Status</th><th style={{ textAlign: 'right' }}>Employees</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Deductions</th><th style={{ textAlign: 'right' }}>Net Pay</th><th>Journal</th></tr></thead>
              <tbody>{((runsQ.data as any)?.items ?? []).map((run: PayrollRunSummaryDto) => <tr key={run.id}><td>{run.payrollPeriod}</td><td>{payrollStatusLabel(run.status)}</td><td style={{ textAlign: 'right' }}>{run.employeeCount}</td><td style={{ textAlign: 'right' }}>{formatAmount(run.totalGrossPay)}</td><td style={{ textAlign: 'right' }}>{formatAmount(run.totalDeductions)}</td><td style={{ textAlign: 'right' }}>{formatAmount(run.totalNetPay)}</td><td>{run.journalEntryId || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
  
        {selectedRun ? (
          <section className="panel">
            <h3>Maker / Checker Actions</h3>
            <div className="form-grid three">
              <button className="button secondary" type="button" disabled={!canManage || selectedRun.status !== 0 || submitRunMut.isPending} onClick={() => submitRunMut.mutate(selectedRun.id)}>Submit for Approval</button>
              <button className="button secondary" type="button" disabled={!canPost || selectedRun.status !== 0 || approveRunMut.isPending} onClick={() => approveRunMut.mutate(selectedRun.id)}>Approve Payroll</button>
              <button className="button success" type="button" disabled={!canPost || selectedRun.status === 2 || postingAccounts.length < 3 || postRunMut.isPending} onClick={() => postRunMut.mutate({ runId: selectedRun.id, payload: { salaryExpenseAccountId: postingAccounts[0]?.id, deductionsPayableAccountId: postingAccounts[1]?.id, netSalaryPayableAccountId: postingAccounts[2]?.id, postingDateUtc: new Date().toISOString(), reference: `PAY-${selectedRun.payrollPeriod}`, description: `Payroll posting - ${selectedRun.payrollPeriod}` } })}>Post to GL</button>
            </div>
            <div className="form-grid two" style={{ marginTop: 12 }}>
              <div className="form-row"><label>Reject Reason</label><input className="input" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /></div>
              <div className="form-row"><label>Reject</label><button className="button danger" type="button" disabled={!canPost || selectedRun.status === 2 || !rejectionReason.trim()} onClick={() => rejectRunMut.mutate({ runId: selectedRun.id, reason: rejectionReason })}>Reject Payroll</button></div>
            </div>
          </section>
        ) : null}
  
        {selectedRunId ? (
          <section className="panel">
            <h3>Payroll Register</h3>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee No.</th><th>Employee</th><th>Department</th><th>Job Title</th><th style={{ textAlign: 'right' }}>Gross</th><th style={{ textAlign: 'right' }}>Deductions</th><th style={{ textAlign: 'right' }}>Net Pay</th><th>Bank</th></tr></thead><tbody>{(selectedRunDetailQ.data?.items ?? []).map((line: PayrollRunLineDetailDto) => <tr key={line.id}><td>{line.employeeNumber}</td><td>{line.employeeName}</td><td>{line.department}</td><td>{line.jobTitle}</td><td style={{ textAlign: 'right' }}>{formatAmount(line.grossPay)}</td><td style={{ textAlign: 'right' }}>{formatAmount(line.totalDeductions)}</td><td style={{ textAlign: 'right' }}>{formatAmount(line.netPay)}</td><td>{[line.bankName, line.bankAccountNumber].filter(Boolean).join(' - ')}</td></tr>)}</tbody></table></div>
          </section>
        ) : null}
      </div>
    );
  }
  