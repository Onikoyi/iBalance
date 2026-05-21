import {
    canManageHrDisciplinary,
    canViewHumanResources,
    createHrDisciplinaryRecord,
    dateInputToUtc,
    getHrDisciplinaryRecords,
    getHrEmployees,
    getHrReadableError,
    toDateInputValue,
    useMutation,
    useQuery,
    useQueryClient,
    useState,
  } from './HrShared';
  
  const today = new Date().toISOString().slice(0, 10);
  
  export function HrDisciplinaryPage() {
    const queryClient = useQueryClient();
    const canView = canViewHumanResources();
    const canManage = canManageHrDisciplinary();
  
    const [form, setForm] = useState({ employeeId: '', incidentDateUtc: today, category: '', description: '', actionTaken: '', notes: '' });
    const [message, setMessage] = useState('');
    const [errorText, setErrorText] = useState('');
  
    const employeesQ = useQuery({ queryKey: ['hr-employees'], queryFn: getHrEmployees, enabled: canView });
    const recordsQ = useQuery({ queryKey: ['hr-disciplinary-records'], queryFn: getHrDisciplinaryRecords, enabled: canView });
  
    const createMut = useMutation({
      mutationFn: () => createHrDisciplinaryRecord({ ...form, incidentDateUtc: dateInputToUtc(form.incidentDateUtc), notes: form.notes || null }),
      onSuccess: () => {
        setMessage('Disciplinary record created.');
        setErrorText('');
        setForm({ employeeId: '', incidentDateUtc: today, category: '', description: '', actionTaken: '', notes: '' });
        queryClient.invalidateQueries({ queryKey: ['hr-disciplinary-records'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to create disciplinary record.')),
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to HR disciplinary records.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel"><h2>Disciplinary Records</h2><div className="muted">Track employee disciplinary events and actions taken.</div>{message ? <div className="success-panel">{message}</div> : null}{errorText ? <div className="error-panel">{errorText}</div> : null}</section>
        {canManage ? <section className="panel"><h3>Create Disciplinary Record</h3><div className="form-grid four">
          <div className="form-row"><label>Employee</label><select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="">Select employee</option>{(employeesQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.employeeNumber} - {x.fullName}</option>)}</select></div>
          <div className="form-row"><label>Incident Date</label><input className="input" type="date" value={form.incidentDateUtc} onChange={(e) => setForm({ ...form, incidentDateUtc: e.target.value })} /></div>
          <div className="form-row"><label>Category</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
          <div className="form-row"><label>Action Taken</label><input className="input" value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} /></div>
        </div><div className="form-row"><label>Description</label><textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div><button className="button primary" disabled={!form.employeeId || !form.category.trim() || !form.description.trim()} onClick={() => createMut.mutate()}>Create Disciplinary Record</button></section> : null}
        <section className="panel"><h3>Disciplinary List</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Date</th><th>Category</th><th>Description</th><th>Action Taken</th></tr></thead><tbody>{(recordsQ.data?.items ?? []).length === 0 ? <tr><td colSpan={5} className="muted">No disciplinary records found.</td></tr> : (recordsQ.data?.items ?? []).map((item) => <tr key={item.id}><td>{item.employeeNumber} - {item.employeeName}</td><td>{toDateInputValue(item.incidentDateUtc)}</td><td>{item.category}</td><td>{item.description}</td><td>{item.actionTaken || '—'}</td></tr>)}</tbody></table></div></section>
      </div>
    );
  }
  