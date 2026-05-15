import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  canCreateExpenseAdvances,
  canSubmitExpenseAdvances,
  canViewExpenseAdvances,
  dateInputToUtc,
  formatAmount,
  formatDateTime,
  getEamExpenseCategories,
  getEamRetirements,
  getExpenseAdvanceRequests,
  getTenantReadableError,
  saveEamRetirement,
  submitEamRetirement,
  toDateInputValue,
  type EamExpenseCategoryDto,
  type EamRetirementDto,
  type EamRetirementLineDto,
  type EamRetirementListResponse,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  type SaveEamRetirementRequest,
  useQuery,
} from './eamShared';

const emptyRetirement: SaveEamRetirementRequest = {
  requestId: '',
  retirementDateUtc: new Date().toISOString(),
  notes: '',
  lines: [{ expenseCategoryId: '', description: '', amount: 0 }],
};

export function AdvanceRetirementsPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canCreate = canCreateExpenseAdvances();
  const canSubmit = canSubmitExpenseAdvances();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<SaveEamRetirementRequest>(emptyRetirement);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestsQ = useQuery<ExpenseAdvanceRequestListResponse>({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
    enabled: canView,
  });

  const retirementsQ = useQuery<EamRetirementListResponse>({
    queryKey: ['eam-retirements'],
    queryFn: getEamRetirements,
    enabled: canView,
  });

  const categoriesQ = useQuery({
    queryKey: ['eam-expense-categories'],
    queryFn: getEamExpenseCategories,
    enabled: canView,
  });

  const availableRequests = useMemo<ExpenseAdvanceRequestDto[]>(
    () => (requestsQ.data?.items ?? []).filter((x: ExpenseAdvanceRequestDto) => [5, 6, 8].includes(x.status)),
    [requestsQ.data?.items]
  );

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-retirements'] });
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
    await qc.invalidateQueries({ queryKey: ['eam-dashboard'] });
  }

  const saveMut = useMutation({
    mutationFn: saveEamRetirement,
    onSuccess: async () => {
      await refresh();
      setShowCreate(false);
      setForm(emptyRetirement);
      setInfoText('Retirement saved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to save retirement.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (retirementId: string) => submitEamRetirement(retirementId),
    onSuccess: async () => {
      await refresh();
      setInfoText('Retirement submitted successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to submit retirement.'));
      setInfoText('');
    },
  });

  function updateLine(index: number, patch: Partial<EamRetirementLineDto>) {
    const lines = [...form.lines];
    lines[index] = { ...lines[index], ...patch };
    setForm({ ...form, lines });
  }

  function addLine() {
    setForm({ ...form, lines: [...form.lines, { expenseCategoryId: '', description: '', amount: 0 }] });
  }

  async function saveRetirement() {
    setErrorText('');
    setInfoText('');
    if (!form.requestId) return setErrorText('Advance request is required.');
    if (form.lines.length === 0) return setErrorText('At least one retirement expense line is required.');
    if (form.lines.some((x) => !x.expenseCategoryId || !x.description.trim() || Number(x.amount || 0) <= 0)) {
      return setErrorText('Each retirement line requires category, description, and amount.');
    }
    await saveMut.mutateAsync(form);
  }

  if (!canView) return <div className="panel error-panel">You do not have access to advance retirements.</div>;
  if (requestsQ.isLoading || retirementsQ.isLoading || categoriesQ.isLoading) return <div className="panel">Loading advance retirements...</div>;
  if (requestsQ.isError || retirementsQ.isError || categoriesQ.isError || !requestsQ.data || !retirementsQ.data || !categoriesQ.data) return <div className="panel error-panel">Unable to load advance retirements.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Advance Retirements</h2>
            <div className="muted">Retire disbursed advances with expense lines, then submit into approval workflow.</div>
          </div>
          {canCreate ? <button className="button primary" onClick={() => setShowCreate(true)}>New Retirement</button> : null}
        </div>
        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead><tr><th>Retirement No</th><th>Request Id</th><th>Status</th><th>Retirement Date</th><th style={{ textAlign: 'right' }}>Amount</th><th>Action</th></tr></thead>
            <tbody>
              {(retirementsQ.data.items ?? []).length === 0 ? <tr><td colSpan={6} className="muted">No retirements found.</td></tr> :
                (retirementsQ.data.items ?? []).map((item: EamRetirementDto) => (
                  <tr key={item.id}>
                    <td>{item.retirementNumber}</td>
                    <td>{item.requestId}</td>
                    <td>{item.status}</td>
                    <td>{formatDateTime(item.retirementDateUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.totalRetiredAmount)}</td>
                    <td>{item.status === 1 && canSubmit ? <button className="button small" onClick={() => submitMut.mutate(item.id)}>Submit</button> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <section className="panel">
          <div className="section-heading"><h3>New Retirement</h3><button className="button" onClick={() => setShowCreate(false)}>Close</button></div>
          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            <div>
              <label>Advance Request</label>
              <select className="input" value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })}>
                <option value="">Select disbursed advance</option>
                {availableRequests.map((item: ExpenseAdvanceRequestDto) => (
                  <option key={item.id} value={item.id}>{item.requestNumber} - {item.purpose} - {formatAmount(item.outstandingAmount)}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Retirement Date</label>
              <input className="input" type="date" value={toDateInputValue(form.retirementDateUtc)} onChange={(e) => setForm({ ...form, retirementDateUtc: dateInputToUtc(e.target.value) })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <h4>Expense Lines</h4>
            {form.lines.map((line, index) => (
              <div key={index} className="form-grid three-columns" style={{ marginTop: 8 }}>
                <div>
                  <label>Category</label>
                  <select className="input" value={line.expenseCategoryId} onChange={(e) => updateLine(index, { expenseCategoryId: e.target.value })}>
                    <option value="">Select category</option>
                    {(categoriesQ.data.items ?? []).map((item: EamExpenseCategoryDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Description</label>
                  <input className="input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </div>
                <div>
                  <label>Amount</label>
                  <input className="input" type="number" min="0" value={line.amount} onChange={(e) => updateLine(index, { amount: Number(e.target.value || 0) })} />
                </div>
              </div>
            ))}
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <button className="button" onClick={addLine}>Add Line</button>
            </div>
          </div>

          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button className="button primary" onClick={saveRetirement} disabled={saveMut.isPending}>Save Retirement</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
