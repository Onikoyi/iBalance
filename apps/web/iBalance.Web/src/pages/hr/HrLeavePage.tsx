import {
    approveHrLeaveRequest,
    canApproveHrLeave,
    canCreateHrLeave,
    canRejectHrLeave,
    canViewHrLeave,
    createHrLeaveRequest,
    dateInputToUtc,
    getHrEmployees,
    getHrLeaveRequests,
    getHrReadableError,
    leaveStatusLabel,
    rejectHrLeaveRequest,
    submitHrLeaveRequest,
    toDateInputValue,
    useMutation,
    useQuery,
    useQueryClient,
    useState,
  } from './HrShared';
  
  const today = new Date().toISOString().slice(0, 10);
  
  export function HrLeavePage() {
    const queryClient = useQueryClient();
    const canView = canViewHrLeave();
    const canCreate = canCreateHrLeave();
    const canApprove = canApproveHrLeave();
    const canReject = canRejectHrLeave();
  
    const [form, setForm] = useState({
      employeeId: '',
      startDateUtc: today,
      endDateUtc: today,
      leaveType: 'Annual Leave',
      reason: '',
    });
    const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
    const [message, setMessage] = useState('');
    const [errorText, setErrorText] = useState('');
  
    const employeesQ = useQuery({ queryKey: ['hr-employees'], queryFn: getHrEmployees, enabled: canView });
    const leaveQ = useQuery({ queryKey: ['hr-leave-requests'], queryFn: getHrLeaveRequests, enabled: canView });
  
    const createMut = useMutation({
      mutationFn: () =>
        createHrLeaveRequest({
          employeeId: form.employeeId,
          startDateUtc: dateInputToUtc(form.startDateUtc),
          endDateUtc: dateInputToUtc(form.endDateUtc),
          leaveType: form.leaveType,
          reason: form.reason,
        }),
      onSuccess: () => {
        setMessage('Leave request created.');
        setErrorText('');
        setForm({ employeeId: '', startDateUtc: today, endDateUtc: today, leaveType: 'Annual Leave', reason: '' });
        queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to create leave request.')),
    });
  
    const submitMut = useMutation({
      mutationFn: submitHrLeaveRequest,
      onSuccess: () => {
        setMessage('Leave request submitted.');
        setErrorText('');
        queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to submit leave request.')),
    });
  
    const approveMut = useMutation({
      mutationFn: approveHrLeaveRequest,
      onSuccess: () => {
        setMessage('Leave request approved.');
        setErrorText('');
        queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
        queryClient.invalidateQueries({ queryKey: ['hr-dashboard-summary'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to approve leave request.')),
    });
  
    const rejectMut = useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => {
        if (!reason.trim()) throw new Error('Reason for rejection is required.');
        return rejectHrLeaveRequest(id, reason.trim());
      },
      onSuccess: () => {
        setMessage('Leave request rejected.');
        setErrorText('');
        queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to reject leave request.')),
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to HR leave management.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Leave Management</h2>
          <div className="muted">Create, submit, approve, and reject employee leave requests.</div>
          {message ? <div className="success-panel">{message}</div> : null}
          {errorText ? <div className="error-panel">{errorText}</div> : null}
        </section>
  
        {canCreate ? (
          <section className="panel">
            <h3>Create Leave Request</h3>
            <div className="form-grid four">
              <div className="form-row"><label>Employee</label><select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}><option value="">Select employee</option>{(employeesQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.employeeNumber} - {x.fullName}</option>)}</select></div>
              <div className="form-row"><label>Start Date</label><input className="input" type="date" value={form.startDateUtc} onChange={(e) => setForm({ ...form, startDateUtc: e.target.value })} /></div>
              <div className="form-row"><label>End Date</label><input className="input" type="date" value={form.endDateUtc} onChange={(e) => setForm({ ...form, endDateUtc: e.target.value })} /></div>
              <div className="form-row"><label>Leave Type</label><input className="input" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })} /></div>
            </div>
            <div className="form-row"><label>Reason</label><textarea className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <button className="button primary" disabled={!form.employeeId || !form.reason.trim()} onClick={() => createMut.mutate()}>Create Leave Request</button>
          </section>
        ) : null}
  
        <section className="panel">
          <h3>Leave Requests</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Status</th><th>Reason</th><th>Action</th></tr></thead>
              <tbody>
                {(leaveQ.data?.items ?? []).length === 0 ? <tr><td colSpan={7} className="muted">No leave requests found.</td></tr> : (leaveQ.data?.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td>{item.employeeNumber} - {item.employeeName}</td>
                    <td>{item.leaveType}</td>
                    <td>{toDateInputValue(item.startDateUtc)}</td>
                    <td>{toDateInputValue(item.endDateUtc)}</td>
                    <td>{leaveStatusLabel(item.status)}</td>
                    <td>{item.reason}</td>
                    <td>
                      <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                        {canCreate && (item.status === 1 || item.status === 4) ? <button className="button" onClick={() => submitMut.mutate(item.id)}>Submit</button> : null}
                        {canApprove && item.status === 2 ? <button className="button primary" onClick={() => approveMut.mutate(item.id)}>Approve</button> : null}
                        {canReject && item.status === 2 ? (
                          <>
                            <input className="input" style={{ width: 160 }} placeholder="Reject reason" value={rejectReasons[item.id] || ''} onChange={(e) => setRejectReasons({ ...rejectReasons, [item.id]: e.target.value })} />
                            <button className="button danger" disabled={!rejectReasons[item.id]?.trim()} onClick={() => rejectMut.mutate({ id: item.id, reason: rejectReasons[item.id] || '' })}>Reject</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }
  