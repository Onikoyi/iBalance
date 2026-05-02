import { deletePayrollRun, reopenRejectedPayrollRun, resubmitRejectedPayrollRun } from '../lib/api';
import {
  formatAmount,
  getPayrollRunDetail,
  getPayrollRuns,
  getTenantReadableError,
  payrollStatusLabel,
  useMutation,
  useQuery,
  useQueryClient,
  useState,
  type PayrollRunLineDetailDto,
  type PayrollRunSummaryDto,
  canManageFinanceSetup,
  canViewFinance,
} from './PayrollShared';

export function RejectPayrollRunsPage() {
  const queryClient = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');

  const runsQ = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: getPayrollRuns,
    enabled: canView,
  });

  const selectedRunDetailQ = useQuery({
    queryKey: ['payroll-run-detail', selectedRunId],
    queryFn: () => getPayrollRunDetail(selectedRunId),
    enabled: canView && selectedRunId.length > 0,
  });

  function refreshRuns() {
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    if (selectedRunId) {
      queryClient.invalidateQueries({ queryKey: ['payroll-run-detail', selectedRunId] });
    }
  }

  const reopenMut = useMutation({
    mutationFn: reopenRejectedPayrollRun,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Rejected payroll run returned to draft.');
      setErrorText('');
      setSelectedRunId('');
      refreshRuns();
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to reopen rejected payroll run.')),
  });

  const resubmitMut = useMutation({
    mutationFn: resubmitRejectedPayrollRun,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Rejected payroll run resubmitted.');
      setErrorText('');
      setSelectedRunId('');
      refreshRuns();
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to resubmit rejected payroll run.')),
  });

  const deleteMut = useMutation({
    mutationFn: deletePayrollRun,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Rejected payroll run deleted successfully.');
      setErrorText('');
      setSelectedRunId('');
      refreshRuns();
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to delete rejected payroll run.')),
  });

  async function removeRejectedRun(run: PayrollRunSummaryDto) {
    setMessage('');
    setErrorText('');

    const confirmed = window.confirm(`Delete rejected payroll run for "${run.payrollPeriod}"?`);
    if (!confirmed) return;

    await deleteMut.mutateAsync(run.id);
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Rejected Payroll Runs.</div>;
  if (runsQ.isLoading) return <div className="panel">Loading rejected payroll runs...</div>;
  if (runsQ.isError) return <div className="panel error-panel">Unable to load rejected payroll runs.</div>;

  const runs = ((((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[]).filter((run) => run.status === 4));
  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const runDetail = selectedRunDetailQ.data?.payrollRun ? selectedRunDetailQ.data : null;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Rejected Payroll Runs</h2>
        <div className="muted">
          Runs rejected by checker move here for correction workflow. From here, the Payroll Master can return a run to Draft,
          resubmit it, or delete it.
        </div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}

        <div className="form-grid two">
          <div className="form-row">
            <label>Select Rejected Run</label>
            <select className="input" value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)}>
              <option value="">Select rejected run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.payrollPeriod} - {payrollStatusLabel(run.status)} - {formatAmount(run.totalNetPay)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Rejected Runs Queue</h3>
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
                {canManage ? <th style={{ width: 260 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr><td colSpan={canManage ? 7 : 6} className="muted">No rejected payroll runs found.</td></tr>
              ) : (
                runs.map((run) => (
                  <tr key={run.id}>
                    <td>{run.payrollPeriod}</td>
                    <td>{payrollStatusLabel(run.status)}</td>
                    <td style={{ textAlign: 'right' }}>{run.employeeCount}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(run.totalGrossPay)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(run.totalDeductions)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(run.totalNetPay)}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => setSelectedRunId(run.id)}>View</button>
                          <button className="button secondary" type="button" onClick={() => reopenMut.mutate(run.id)} disabled={reopenMut.isPending}>
                            Return to Draft
                          </button>
                          <button className="button secondary" type="button" onClick={() => resubmitMut.mutate(run.id)} disabled={resubmitMut.isPending}>
                            Resubmit
                          </button>
                          <button className="button danger" type="button" onClick={() => removeRejectedRun(run)} disabled={deleteMut.isPending}>
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRun && runDetail ? (
        <section className="panel">
          <h3>Rejected Run Detail</h3>
          <div className="kv">
            <div className="kv-row"><span>Period</span><span>{selectedRun.payrollPeriod}</span></div>
            <div className="kv-row"><span>Status</span><span>{payrollStatusLabel(selectedRun.status)}</span></div>
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
                  <div className="muted">
                    {line.employeeNumber} · {line.department || '—'} · {line.jobTitle || '—'}
                  </div>
                </div>
                <strong>{formatAmount(line.netPay)}</strong>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Seq</th>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Kind</th>
                      <th>Mode</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
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
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
