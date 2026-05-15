import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  canCreateExpenseAdvances,
  canViewExpenseAdvances,
  formatAmount,
  getExpenseAdvanceRequests,
  getTenantReadableError,
  recordEamRefund,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  type RecordRefundRequest,
  useQuery,
} from './eamShared';
import { getAccounts } from '../../lib/api';

export function AdvanceRefundsPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canRecord = canCreateExpenseAdvances();
  const [form, setForm] = useState<RecordRefundRequest>({ requestId: '', cashOrBankLedgerAccountId: '', amount: 0, notes: '' });
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestsQ = useQuery<ExpenseAdvanceRequestListResponse>({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
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

  const refundMut = useMutation({
    mutationFn: recordEamRefund,
    onSuccess: async () => {
      await refresh();
      setInfoText('Refund recorded successfully.');
      setErrorText('');
      setForm({ requestId: '', cashOrBankLedgerAccountId: '', amount: 0, notes: '' });
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to record refund.'));
      setInfoText('');
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to advance refunds.</div>;
  if (requestsQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading advance refunds...</div>;
  if (requestsQ.isError || accountsQ.isError || !requestsQ.data || !accountsQ.data) return <div className="panel error-panel">Unable to load advance refunds.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Advance Refunds</h2>
        <div className="muted">Record returned cash for retired advances with outstanding balances.</div>
        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
        <div className="form-grid two-columns" style={{ marginTop: 16 }}>
          <div><label>Advance Request</label><select className="input" value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })}><option value="">Select request</option>{items.map((item: ExpenseAdvanceRequestDto) => <option key={item.id} value={item.id}>{item.requestNumber} - {item.purpose} - {formatAmount(item.outstandingAmount)}</option>)}</select></div>
          <div><label>Cash / Bank Account</label><select className="input" value={form.cashOrBankLedgerAccountId} onChange={(e) => setForm({ ...form, cashOrBankLedgerAccountId: e.target.value })}><option value="">Select account</option>{(accountsQ.data.items ?? []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
          <div><label>Refund Amount</label><input className="input" type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value || 0) })} /></div>
          <div style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        {canRecord ? <div className="inline-actions" style={{ marginTop: 16 }}><button className="button primary" onClick={() => refundMut.mutate(form)} disabled={refundMut.isPending}>Record Refund</button></div> : null}
      </section>
    </div>
  );
}
