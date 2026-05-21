import {
    canManageHrTraining,
    canViewHumanResources,
    createHrTrainingRecord,
    dateInputToUtc,
    formatHrAmount,
    getHrEmployees,
    getHrReadableError,
    getHrTrainingRecords,
    toDateInputValue,
    useMutation,
    useQuery,
    useQueryClient,
    useState,
  } from './HrShared';
  
  const today = new Date().toISOString().slice(0, 10);
  
  export function HrTrainingPage() {
    const queryClient = useQueryClient();
    const canView = canViewHumanResources();
    const canManage = canManageHrTraining();
  
    const [form, setForm] = useState({ employeeId: '', trainingTitle: '', provider: '', trainingDateUtc: today, costAmount: 0, notes: '' });
    const [message, setMessage] = useState('');
    const [errorText, setErrorText] = useState('');
  
    const employeesQ = useQuery({ queryKey: ['hr-employees'], queryFn: getHrEmployees, enabled: canView });
    const recordsQ = useQuery({ queryKey: ['hr-training-records'], queryFn: getHrTrainingRecords, enabled: canView });
  
    const createMut = useMutation({
      mutationFn: () => createHrTrainingRecord({ ...form, trainingDateUtc: dateInputToUtc(form.trainingDateUtc), notes: form.notes || null }),
      onSuccess: () => {
        setMessage('Training record created.');
        setErrorText('');
        setForm({ employeeId: '', trainingTitle: '', provider: '', trainingDateUtc: today, costAmount: 0, notes: '' });
        queryClient.invalidateQueries({ queryKey: ['hr-training-records'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to create training record.')),
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to HR training.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel"><h2>Training Records</h2><div className="muted">Track employee learning, training provider, date, and cost.</div>{message ? <div className="success-panel">{message}</div> : null}{errorText ? <div className="error-panel">{errorText}</div> : null}</section>
        {canManage ? <section className="panel"><h3>Create Training Record</h3><div className="form-grid four">
          <div className="form-row"><label>Employee</label><select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="">Select employee</option>{(employeesQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.employeeNumber} - {x.fullName}</option>)}</select></div>
          <div className="form-row"><label>Title</label><input className="input" value={form.trainingTitle} onChange={(e) => setForm({ ...form, trainingTitle: e.target.value })} /></div>
          <div className="form-row"><label>Provider</label><input className="input" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
          <div className="form-row"><label>Date</label><input className="input" type="date" value={form.trainingDateUtc} onChange={(e) => setForm({ ...form, trainingDateUtc: e.target.value })} /></div>
          <div className="form-row"><label>Cost</label><input className="input" type="number" value={form.costAmount} onChange={(e) => setForm({ ...form, costAmount: Number(e.target.value) })} /></div>
        </div><div className="form-row"><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div><button className="button primary" disabled={!form.employeeId || !form.trainingTitle.trim()} onClick={() => createMut.mutate()}>Create Training Record</button></section> : null}
        <section className="panel"><h3>Training List</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Title</th><th>Provider</th><th>Date</th><th style={{ textAlign: 'right' }}>Cost</th></tr></thead><tbody>{(recordsQ.data?.items ?? []).length === 0 ? <tr><td colSpan={5} className="muted">No training records found.</td></tr> : (recordsQ.data?.items ?? []).map((item) => <tr key={item.id}><td>{item.employeeNumber} - {item.employeeName}</td><td>{item.trainingTitle}</td><td>{item.provider || '—'}</td><td>{toDateInputValue(item.trainingDateUtc)}</td><td style={{ textAlign: 'right' }}>{formatHrAmount(item.costAmount)}</td></tr>)}</tbody></table></div></section>
      </div>
    );
  }
  