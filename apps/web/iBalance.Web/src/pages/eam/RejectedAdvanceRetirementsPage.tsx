import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  canCreateExpenseAdvances,
  canSubmitExpenseAdvances,
  canViewExpenseAdvances,
  dateInputToUtc,
  formatAmount,
  formatDateTime,
  getEamExpenseCategories,
  getRejectedEamRetirements,
  getTenantReadableError,
  submitEamRetirement,
  toDateInputValue,
  updateEamRetirement,
  type EamExpenseCategoryDto,
  type EamRetirementDto,
  type EamRetirementLineDto,
  type EamRetirementListResponse,
  type SaveEamRetirementRequest,
} from './eamShared';

export function RejectedAdvanceRetirementsPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canManage = canCreateExpenseAdvances();
  const canSubmit = canSubmitExpenseAdvances();
  const [selected, setSelected] = useState<EamRetirementDto | null>(null);
  const [form, setForm] = useState<SaveEamRetirementRequest | null>(null);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const retirementsQ = useQuery<EamRetirementListResponse>({
    queryKey: ['eam-rejected-retirements'],
    queryFn: getRejectedEamRetirements,
    enabled: canView,
  });

  const categoriesQ = useQuery({
    queryKey: ['eam-expense-categories'],
    queryFn: getEamExpenseCategories,
    enabled: canView,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-rejected-retirements'] });
    await qc.invalidateQueries({ queryKey: ['eam-retirements'] });
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
  }

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected || !form) {
        throw new Error('No retirement selected.');
      }

      return updateEamRetirement(selected.id, form);
    },
    onSuccess: async () => {
      await refresh();
      setInfoText('Rejected retirement corrected successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to update rejected retirement.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (retirementId: string) => submitEamRetirement(retirementId),
    onSuccess: async () => {
      await refresh();
      setSelected(null);
      setForm(null);
      setInfoText('Rejected retirement resubmitted successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to resubmit rejected retirement.'));
      setInfoText('');
    },
  });

  function openEdit(item: EamRetirementDto) {
    setSelected(item);
    setForm({
      requestId: item.requestId,
      retirementDateUtc: item.retirementDateUtc,
      notes: item.notes || '',
      lines:
        item.lines?.length
          ? item.lines
          : [{ expenseCategoryId: '', description: '', amount: 0 }],
    });
    setErrorText('');
    setInfoText('');
  }

  function updateLine(index: number, patch: Partial<EamRetirementLineDto>) {
    if (!form) {
      return;
    }

    const lines = [...form.lines];
    lines[index] = { ...lines[index], ...patch };
    setForm({ ...form, lines });
  }

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to rejected retirements.
      </div>
    );
  }

  if (retirementsQ.isLoading || categoriesQ.isLoading) {
    return <div className="panel">Loading rejected retirements...</div>;
  }

  if (retirementsQ.isError || categoriesQ.isError || !retirementsQ.data || !categoriesQ.data) {
    return <div className="panel error-panel">Unable to load rejected retirements.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Rejected Advance Retirements</h2>
          <span className="muted">{retirementsQ.data.count} rejected item(s)</span>
        </div>

        <div className="muted">Correct and resubmit rejected retirement records.</div>

        {infoText ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">{infoText}</div>
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginTop: 16 }}>
            {errorText}
          </div>
        ) : null}

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Retirement No</th>
                <th>Rejected On</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(retirementsQ.data.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No rejected retirements found.
                  </td>
                </tr>
              ) : (
                (retirementsQ.data.items ?? []).map((item: EamRetirementDto) => (
                  <tr key={item.id}>
                    <td>{item.retirementNumber}</td>
                    <td>{formatDateTime(item.retirementDateUtc)}</td>
                    <td>{item.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(item.totalRetiredAmount)}
                    </td>
                    <td>
                      <button className="button small" onClick={() => openEdit(item)}>
                        Edit
                      </button>{' '}
                      {canSubmit ? (
                        <button
                          className="button small"
                          onClick={() => submitMut.mutate(item.id)}
                        >
                          Resubmit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && form ? (
        <section className="panel">
          <div className="section-heading">
            <h3>Edit Rejected Retirement</h3>
            <button
              className="button"
              onClick={() => {
                setSelected(null);
                setForm(null);
              }}
            >
              Close
            </button>
          </div>

          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            <div>
              <label>Retirement Date</label>
              <input
                className="input"
                type="date"
                value={toDateInputValue(form.retirementDateUtc)}
                onChange={(e) =>
                  setForm({ ...form, retirementDateUtc: dateInputToUtc(e.target.value) })
                }
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {form.lines.map((line, index) => (
            <div key={index} className="form-grid three-columns" style={{ marginTop: 8 }}>
              <div>
                <label>Category</label>
                <select
                  className="input"
                  value={line.expenseCategoryId}
                  onChange={(e) => updateLine(index, { expenseCategoryId: e.target.value })}
                >
                  <option value="">Select category</option>
                  {(categoriesQ.data.items ?? []).map((item: EamExpenseCategoryDto) => (
                    <option key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Description</label>
                <input
                  className="input"
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                />
              </div>

              <div>
                <label>Amount</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={line.amount}
                  onChange={(e) => updateLine(index, { amount: Number(e.target.value || 0) })}
                />
              </div>
            </div>
          ))}

          {canManage ? (
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button
                className="button primary"
                onClick={() => updateMut.mutate()}
                disabled={updateMut.isPending}
              >
                Save Correction
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
