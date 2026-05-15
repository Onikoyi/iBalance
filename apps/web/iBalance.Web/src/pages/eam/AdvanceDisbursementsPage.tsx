import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  canApproveExpenseAdvances,
  canViewExpenseAdvances,
  disburseExpenseAdvanceRequest,
  eamStatusLabel,
  formatAmount,
  formatDateTime,
  getExpenseAdvanceRequests,
  getTenantReadableError,
  type DisburseExpenseAdvanceRequest,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  useQuery,
} from './eamShared';
import { getAccounts } from '../../lib/api';

export function AdvanceDisbursementsPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canDisburse = canApproveExpenseAdvances();
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState<DisburseExpenseAdvanceRequest>({ cashOrBankLedgerAccountId: '', notes: '' });
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
    () => (requestsQ.data?.items ?? []).filter((x: ExpenseAdvanceRequestDto) => [3, 5, 6, 7, 8, 10].includes(x.status)),
    [requestsQ.data?.items]
  );

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
    await qc.invalidateQueries({ queryKey: ['eam-dashboard'] });
  }

  const disburseMut = useMutation({
    mutationFn: () => disburseExpenseAdvanceRequest(selectedId, form),
    onSuccess: async () => {
      await refresh();
      setInfoText('Advance disbursed successfully.');
      setErrorText('');
      setSelectedId('');
      setForm({ cashOrBankLedgerAccountId: '', notes: '' });
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to disburse advance.'));
      setInfoText('');
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to advance disbursements.</div>;
  if (requestsQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading advance disbursements...</div>;
  if (requestsQ.isError || accountsQ.isError || !requestsQ.data || !accountsQ.data) return <div className="panel error-panel">Unable to load advance disbursements.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading"><h2>Advance Disbursements</h2><span className="muted">{items.length} item(s)</span></div>
        <div className="muted">Disburse only approved requests through a valid cash or bank account.</div>
        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead><tr><th>Reference</th><th>Purpose</th><th>Status</th><th>Request Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Action</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={6} className="muted">No approved or disbursed advances available.</td></tr> :
                items.map((item: ExpenseAdvanceRequestDto) => (
                  <tr key={item.id}>
                    <td>{item.requestNumber}</td>
                    <td>{item.purpose}</td>
                    <td>{eamStatusLabel(item.status)}</td>
                    <td>{formatDateTime(item.requestDateUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.requestedAmount)}</td>
                    <td>{item.status === 3 && canDisburse ? <button className="button small" onClick={() => setSelectedId(item.id)}>Prepare Disbursement</button> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedId ? (
        <section className="panel">
          <div className="section-heading"><h3>Disburse Advance</h3><button className="button" onClick={() => setSelectedId('')}>Close</button></div>
          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            <div>
              <label>Cash / Bank Ledger Account</label>
              <select className="input" value={form.cashOrBankLedgerAccountId} onChange={(e) => setForm({ ...form, cashOrBankLedgerAccountId: e.target.value })}>
                <option value="">Select account</option>
                {(accountsQ.data.items ?? []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="input" rows={4} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button className="button primary" onClick={() => disburseMut.mutate()} disabled={disburseMut.isPending}>Disburse Advance</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
