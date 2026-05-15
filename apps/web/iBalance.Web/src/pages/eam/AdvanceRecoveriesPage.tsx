import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  canCreateExpenseAdvances,
  canViewExpenseAdvances,
  formatAmount,
  getExpenseAdvanceRequests,
  getTenantReadableError,
  recordEamRecovery,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  type RecordRecoveryRequest,
  useQuery,
} from './eamShared';

export function AdvanceRecoveriesPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canManage = canCreateExpenseAdvances();
  const [form, setForm] = useState<RecordRecoveryRequest>({ requestId: '', method: 'Salary Recovery', amount: 0, notes: '' });
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestsQ = useQuery<ExpenseAdvanceRequestListResponse>({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
    enabled: canView,
  });

  const items = useMemo<ExpenseAdvanceRequestDto[]>(
    () => (requestsQ.data?.items ?? []).filter((x: ExpenseAdvanceRequestDto) => Number(x.outstandingAmount || 0) > 0),
    [requestsQ.data?.items]
  );

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
    await qc.invalidateQueries({ queryKey: ['eam-dashboard'] });
  }

  const recoveryMut = useMutation({
    mutationFn: recordEamRecovery,
    onSuccess: async () => {
      await refresh();
      setInfoText('Recovery recorded successfully.');
      setErrorText('');
      setForm({ requestId: '', method: 'Salary Recovery', amount: 0, notes: '' });
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to record recovery.'));
      setInfoText('');
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to advance recoveries.</div>;
  if (requestsQ.isLoading) return <div className="panel">Loading advance recoveries...</div>;
  if (requestsQ.isError || !requestsQ.data) return <div className="panel error-panel">Unable to load advance recoveries.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Advance Recoveries</h2>
        <div className="muted">Record recoveries for unsettled balances through salary, journal, or cash methods.</div>
        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
        <div className="form-grid two-columns" style={{ marginTop: 16 }}>
          <div><label>Advance Request</label><select className="input" value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })}><option value="">Select request</option>{items.map((item: ExpenseAdvanceRequestDto) => <option key={item.id} value={item.id}>{item.requestNumber} - {item.purpose} - {formatAmount(item.outstandingAmount)}</option>)}</select></div>
          <div><label>Recovery Method</label><select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}><option>Cash Refund</option><option>Salary Recovery</option><option>Journal Recovery</option></select></div>
          <div><label>Recovery Amount</label><input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value || 0) })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        {canManage ? <div className="inline-actions" style={{ marginTop: 16 }}><button className="button primary" onClick={() => recoveryMut.mutate(form)} disabled={recoveryMut.isPending}>Record Recovery</button></div> : null}
      </section>
    </div>
  );
}
