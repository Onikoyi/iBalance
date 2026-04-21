import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteBudget,
  getAccounts,
  getRejectedBudgets,
  getTenantReadableError,
  submitBudgetForApproval,
  updateBudget,
  type BudgetDetailDto,
  type BudgetLineRequest,
  type BudgetOverrunPolicy,
  type BudgetType,
  type CreateBudgetRequest,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

type BudgetFormState = {
  budgetNumber: string;
  name: string;
  description: string;
  type: BudgetType;
  periodStartUtc: string;
  periodEndUtc: string;
  notes: string;
  overrunPolicy: BudgetOverrunPolicy;
  lines: BudgetLineRequest[];
};

const emptyLine: BudgetLineRequest = {
  id: null,
  ledgerAccountId: '',
  periodStartUtc: '',
  periodEndUtc: '',
  budgetAmount: 0,
  notes: '',
};

const emptyForm: BudgetFormState = {
  budgetNumber: '',
  name: '',
  description: '',
  type: 1,
  periodStartUtc: '',
  periodEndUtc: '',
  notes: '',
  overrunPolicy: 2,
  lines: [{ ...emptyLine }],
};

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '—';

  return parsed.toLocaleString();
}

function toUtcFromDateInput(value: string) {
  if (!value) return '';

  if (value.includes('T')) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toISOString();
  }

  return new Date(`${value}T00:00:00`).toISOString();
}

function toDateInput(value?: string | null) {
  if (!value) return '';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toISOString().slice(0, 10);
}

function budgetStatusLabel(value: number) {
  switch (value) {
    case 1:
      return 'Draft';
    case 2:
      return 'Submitted for Approval';
    case 3:
      return 'Approved';
    case 4:
      return 'Rejected';
    case 5:
      return 'Locked';
    case 6:
      return 'Cancelled';
    case 7:
      return 'Closed';
    default:
      return 'Unknown';
  }
}

function budgetTypeLabel(value: number) {
  switch (value) {
    case 1:
      return 'Operating';
    case 2:
      return 'Capital';
    case 3:
      return 'Cash Flow';
    case 4:
      return 'Project';
    default:
      return 'Unknown';
  }
}

function overrunPolicyLabel(value: number) {
  switch (value) {
    case 1:
      return 'Disallow';
    case 2:
      return 'Warn Only';
    case 3:
      return 'Allow';
    case 4:
      return 'Require Approval';
    default:
      return 'Unknown';
  }
}

export function RejectedBudgetsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [selectedBudget, setSelectedBudget] = useState<BudgetDetailDto | null>(null);
  const [form, setForm] = useState<BudgetFormState>(emptyForm);
  const [showEdit, setShowEdit] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const rejectedBudgetsQ = useQuery({
    queryKey: ['rejected-budgets'],
    queryFn: getRejectedBudgets,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['budgets'] });
    await qc.invalidateQueries({ queryKey: ['rejected-budgets'] });
    await qc.invalidateQueries({ queryKey: ['budget-detail'] });
    await qc.invalidateQueries({ queryKey: ['budget-vs-actual'] });
    await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selectedBudget) {
        throw new Error('No rejected budget selected.');
      }

      const payload: CreateBudgetRequest = {
        budgetNumber: form.budgetNumber.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        type: form.type,
        periodStartUtc: form.periodStartUtc,
        periodEndUtc: form.periodEndUtc,
        notes: form.notes.trim() || null,
        overrunPolicy: form.overrunPolicy,
        lines: form.lines.map((line) => ({
          id: line.id || null,
          ledgerAccountId: line.ledgerAccountId,
          periodStartUtc: line.periodStartUtc,
          periodEndUtc: line.periodEndUtc,
          budgetAmount: Number(line.budgetAmount || 0),
          notes: line.notes?.trim() || null,
        })),
      };

      return updateBudget(selectedBudget.id, payload);
    },
    onSuccess: async () => {
      await refresh();
      setShowEdit(false);
      setSelectedBudget(null);
      setForm(emptyForm);
      setMessage('Rejected budget updated successfully. It remains rejected until resubmitted.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to update rejected budget.'));
    },
  });

  const submitMut = useMutation({
    mutationFn: (budgetId: string) => submitBudgetForApproval(budgetId),
    onSuccess: async () => {
      await refresh();
      setMessage('Budget resubmitted for approval successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to resubmit budget.'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (budgetId: string) => deleteBudget(budgetId),
    onSuccess: async () => {
      await refresh();
      setMessage('Rejected budget deleted successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to delete rejected budget.'));
    },
  });

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items || [])
      .filter((account) => account.isActive && !account.isHeader && account.isPostingAllowed)
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  }, [accountsQ.data?.items]);

  const filteredBudgets = useMemo(() => {
    const items = rejectedBudgetsQ.data?.items || [];
    const text = search.trim().toLowerCase();

    if (!text) return items;

    return items.filter((budget) => {
      return (
        budget.budgetNumber.toLowerCase().includes(text) ||
        budget.name.toLowerCase().includes(text) ||
        budget.description.toLowerCase().includes(text) ||
        (budget.rejectionReason || '').toLowerCase().includes(text)
      );
    });
  }, [rejectedBudgetsQ.data?.items, search]);

  const formTotal = useMemo(() => {
    return form.lines.reduce((sum, line) => sum + Number(line.budgetAmount || 0), 0);
  }, [form.lines]);

  function updateForm<K extends keyof BudgetFormState>(key: K, value: BudgetFormState[K]) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  function updateLine(index: number, key: keyof BudgetLineRequest, value: string | number | null) {
    setForm((state) => {
      const lines = [...state.lines];

      lines[index] = {
        ...lines[index],
        [key]: value,
      };

      return { ...state, lines };
    });
  }

  function addLine() {
    setForm((state) => ({
      ...state,
      lines: [
        ...state.lines,
        {
          ...emptyLine,
          periodStartUtc: state.periodStartUtc,
          periodEndUtc: state.periodEndUtc,
        },
      ],
    }));
  }

  function removeLine(index: number) {
    setForm((state) => ({
      ...state,
      lines: state.lines.filter((_, i) => i !== index),
    }));
  }

  function openEdit(budget: BudgetDetailDto) {
    if (!canManage) {
      setMessage('You do not have permission to edit rejected budgets.');
      return;
    }

    setSelectedBudget(budget);
    setForm({
      budgetNumber: budget.budgetNumber,
      name: budget.name,
      description: budget.description,
      type: budget.type,
      periodStartUtc: budget.periodStartUtc,
      periodEndUtc: budget.periodEndUtc,
      notes: budget.notes || '',
      overrunPolicy: budget.overrunPolicy,
      lines: budget.lines.length > 0
        ? budget.lines.map((line) => ({
            id: line.id,
            ledgerAccountId: line.ledgerAccountId,
            periodStartUtc: line.periodStartUtc,
            periodEndUtc: line.periodEndUtc,
            budgetAmount: Number(line.budgetAmount || 0),
            notes: line.notes || '',
          }))
        : [{ ...emptyLine }],
    });

    setMessage('');
    setShowEdit(true);
  }

  function closeEdit() {
    if (!updateMut.isPending) {
      setShowEdit(false);
      setSelectedBudget(null);
      setForm(emptyForm);
      setMessage('');
    }
  }

  function validateAndSaveCorrection() {
    setMessage('');

    if (!canManage) {
      setMessage('You do not have permission to edit rejected budgets.');
      return;
    }

    if (!selectedBudget) {
      setMessage('Please select a rejected budget.');
      return;
    }

    if (!form.budgetNumber.trim()) {
      setMessage('Budget number is required.');
      return;
    }

    if (!form.name.trim()) {
      setMessage('Budget name is required.');
      return;
    }

    if (!form.description.trim()) {
      setMessage('Budget description is required.');
      return;
    }

    if (!form.periodStartUtc || !form.periodEndUtc) {
      setMessage('Budget period start and end dates are required.');
      return;
    }

    if (form.lines.length === 0) {
      setMessage('At least one budget line is required.');
      return;
    }

    for (const line of form.lines) {
      if (!line.ledgerAccountId) {
        setMessage('Each budget line must have a ledger account.');
        return;
      }

      if (!line.periodStartUtc || !line.periodEndUtc) {
        setMessage('Each budget line must have period start and end dates.');
        return;
      }

      if (Number(line.budgetAmount || 0) < 0) {
        setMessage('Budget amount cannot be negative.');
        return;
      }
    }

    updateMut.mutate();
  }

  function resubmitBudget(budget: BudgetDetailDto) {
    setMessage('');

    if (!canManage) {
      setMessage('You do not have permission to submit rejected budgets.');
      return;
    }

    submitMut.mutate(budget.id);
  }

  function deleteRejectedBudget(budget: BudgetDetailDto) {
    setMessage('');

    if (!canManage) {
      setMessage('You do not have permission to delete rejected budgets.');
      return;
    }

    const confirmed = window.confirm(`Delete rejected budget ${budget.budgetNumber}? This cannot be undone.`);

    if (!confirmed) return;

    deleteMut.mutate(budget.id);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view rejected budgets.</div>;
  }

  if (rejectedBudgetsQ.isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading rejected budgets...</div>;
  }

  if (
    rejectedBudgetsQ.isError ||
    accountsQ.isError ||
    !rejectedBudgetsQ.data ||
    !accountsQ.data
  ) {
    return <div className="panel error-panel">We could not load rejected budgets at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Rejected Budgets</h2>
            <div className="muted">
              Correct rejected budgets, resubmit them for approval, or delete budgets no longer needed.
            </div>
          </div>

          <div className="inline-actions">
            <Link to="/budgets" className="button">Back to Budgets</Link>
          </div>
        </div>

        {message ? (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="muted">{message}</div>
          </div>
        ) : null}

        <div className="form-row" style={{ marginBottom: 16 }}>
          <label>Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Budget number, name, description, rejection reason"
          />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Budget Number</th>
                <th>Name</th>
                <th>Type</th>
                <th>Period</th>
                <th>Status</th>
                <th>Rejected By</th>
                <th>Rejected On</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ width: 260 }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredBudgets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted">No rejected budgets found.</td>
                </tr>
              ) : (
                filteredBudgets.map((budget) => (
                  <tr key={budget.id}>
                    <td>{budget.budgetNumber}</td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span>{budget.name}</span>
                        <span className="muted">{budget.description}</span>
                      </div>
                    </td>

                    <td>{budgetTypeLabel(budget.type)}</td>
                    <td>{formatDate(budget.periodStartUtc)} - {formatDate(budget.periodEndUtc)}</td>
                    <td>{budgetStatusLabel(budget.status)}</td>
                    <td>{budget.rejectedByDisplayName || budget.rejectedBy || '—'}</td>
                    <td>{formatDateTime(budget.rejectedOnUtc)}</td>
                    <td>{budget.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(budget.totalAmount)}</td>

                    <td>
                      <div className="inline-actions">
                        <button className="button" onClick={() => openEdit(budget)}>
                          Edit
                        </button>

                        <button
                          className="button"
                          onClick={() => resubmitBudget(budget)}
                          disabled={submitMut.isPending}
                        >
                          {submitMut.isPending ? 'Submitting…' : 'Resubmit'}
                        </button>

                        <button
                          className="button danger"
                          onClick={() => deleteRejectedBudget(budget)}
                          disabled={deleteMut.isPending}
                        >
                          {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showEdit && selectedBudget ? (
        <div className="modal-backdrop" onMouseDown={closeEdit}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Rejected Budget</h2>
              <button className="button ghost" onClick={closeEdit} aria-label="Close">✕</button>
            </div>

            {message ? (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="muted">{message}</div>
              </div>
            ) : null}

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row">
                <span>Status</span>
                <span>{budgetStatusLabel(selectedBudget.status)}</span>
              </div>

              <div className="kv-row">
                <span>Rejected By</span>
                <span>{selectedBudget.rejectedByDisplayName || selectedBudget.rejectedBy || '—'}</span>
              </div>

              <div className="kv-row">
                <span>Rejected On</span>
                <span>{formatDateTime(selectedBudget.rejectedOnUtc)}</span>
              </div>

              <div className="kv-row">
                <span>Rejection Reason</span>
                <span>{selectedBudget.rejectionReason || '—'}</span>
              </div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Budget Number</label>
                <input
                  className="input"
                  value={form.budgetNumber}
                  onChange={(e) => updateForm('budgetNumber', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Budget Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Budget Type</label>
                <select
                  className="select"
                  value={form.type}
                  onChange={(e) => updateForm('type', Number(e.target.value) as BudgetType)}
                >
                  <option value={1}>Operating</option>
                  <option value={2}>Capital</option>
                  <option value={3}>Cash Flow</option>
                  <option value={4}>Project</option>
                </select>
              </div>

              <div className="form-row">
                <label>Overrun Policy</label>
                <select
                  className="select"
                  value={form.overrunPolicy}
                  onChange={(e) => updateForm('overrunPolicy', Number(e.target.value) as BudgetOverrunPolicy)}
                >
                  <option value={1}>Disallow</option>
                  <option value={2}>Warn Only</option>
                  <option value={3}>Allow</option>
                  <option value={4}>Require Approval</option>
                </select>
              </div>

              <div className="form-row">
                <label>Period Start</label>
                <input
                  className="input"
                  type="date"
                  value={toDateInput(form.periodStartUtc)}
                  onChange={(e) => updateForm('periodStartUtc', toUtcFromDateInput(e.target.value))}
                />
              </div>

              <div className="form-row">
                <label>Period End</label>
                <input
                  className="input"
                  type="date"
                  value={toDateInput(form.periodEndUtc)}
                  onChange={(e) => updateForm('periodEndUtc', toUtcFromDateInput(e.target.value))}
                />
              </div>

              <div className="form-row">
                <label>Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Notes</label>
                <input
                  className="input"
                  value={form.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                />
              </div>
            </div>

            <div className="section-heading" style={{ marginTop: 18 }}>
              <div>
                <h2>Budget Lines</h2>
                <span className="muted">Update ledger heads/accounts and amounts before resubmission.</span>
              </div>

              <button className="button" onClick={addLine}>
                Add Line
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ledger Account</th>
                    <th>Period Start</th>
                    <th>Period End</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {form.lines.map((line, index) => (
                    <tr key={`${line.id || 'new'}-${index}`}>
                      <td>
                        <select
                          className="select"
                          value={line.ledgerAccountId}
                          onChange={(e) => updateLine(index, 'ledgerAccountId', e.target.value)}
                        >
                          <option value="">— Select Account —</option>
                          {postingAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.code} - {account.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          className="input"
                          type="date"
                          value={toDateInput(line.periodStartUtc)}
                          onChange={(e) => updateLine(index, 'periodStartUtc', toUtcFromDateInput(e.target.value))}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="date"
                          value={toDateInput(line.periodEndUtc)}
                          onChange={(e) => updateLine(index, 'periodEndUtc', toUtcFromDateInput(e.target.value))}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          value={line.budgetAmount}
                          onChange={(e) => updateLine(index, 'budgetAmount', Number(e.target.value))}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          value={line.notes || ''}
                          onChange={(e) => updateLine(index, 'notes', e.target.value)}
                        />
                      </td>

                      <td>
                        <button
                          className="button"
                          disabled={form.lines.length === 1}
                          onClick={() => removeLine(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="kv" style={{ marginTop: 16 }}>
              <div className="kv-row">
                <span>Total Budget Amount</span>
                <span>{formatAmount(formTotal)}</span>
              </div>

              <div className="kv-row">
                <span>Overrun Policy</span>
                <span>{overrunPolicyLabel(form.overrunPolicy)}</span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeEdit} disabled={updateMut.isPending}>
                Cancel
              </button>

              <button
                className="button primary"
                onClick={validateAndSaveCorrection}
                disabled={updateMut.isPending}
              >
                {updateMut.isPending ? 'Saving…' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}