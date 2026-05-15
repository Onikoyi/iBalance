import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getEamAdvanceTypes,
  getPayrollEmployees,
  getRejectedExpenseAdvanceRequests,
  getTenantReadableError,
  submitExpenseAdvanceRequest,
  updateExpenseAdvanceRequest,
  type CreateExpenseAdvanceRequestRequest,
  type EamAdvanceTypeDto,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  type PayrollEmployeeDto,
  type PayrollEmployeesResponse,
} from './eamShared';
import {
  canCreateExpenseAdvances,
  canSubmitExpenseAdvances,
  canViewExpenseAdvances,
  dateInputToUtc,
  eamStatusLabel,
  formatAmount,
  formatDateTime,
  toDateInputValue,
} from './eamShared';

const emptyForm: CreateExpenseAdvanceRequestRequest = {
  advanceTypeId: '',
  employeeId: '',
  requestDateUtc: new Date().toISOString(),
  purpose: '',
  requestedAmount: 0,
  department: '',
  branch: '',
  costCenter: '',
  destination: '',
  expectedRetirementDateUtc: '',
  notes: '',
};

export function RejectedAdvanceRequestsPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canManage = canCreateExpenseAdvances();
  const canSubmit = canSubmitExpenseAdvances();

  const [selected, setSelected] = useState<ExpenseAdvanceRequestDto | null>(null);
  const [form, setForm] = useState<CreateExpenseAdvanceRequestRequest>(emptyForm);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestsQ = useQuery<ExpenseAdvanceRequestListResponse>({
    queryKey: ['eam-rejected-requests'],
    queryFn: getRejectedExpenseAdvanceRequests,
    enabled: canView,
  });

  const employeesQ = useQuery<PayrollEmployeesResponse>({
    queryKey: ['payroll-employees'],
    queryFn: getPayrollEmployees,
    enabled: canView,
  });

  const advanceTypesQ = useQuery<{ count: number; items: EamAdvanceTypeDto[] }>({
    queryKey: ['eam-advance-types'],
    queryFn: getEamAdvanceTypes,
    enabled: canView,
  });

  const liveAdvanceTypes = useMemo(
    () => (advanceTypesQ.data?.items ?? []).filter((x: EamAdvanceTypeDto) => x.isActive),
    [advanceTypesQ.data?.items]
  );

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-dashboard'] });
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
    await qc.invalidateQueries({ queryKey: ['eam-rejected-requests'] });
  }

  const updateMut = useMutation({
    mutationFn: () =>
      selected
        ? updateExpenseAdvanceRequest(selected.id, form)
        : Promise.reject(new Error('No request selected.')),
    onSuccess: async () => {
      await refresh();
      setInfoText(
        'Rejected advance request corrected successfully. It remains rejected until resubmitted.'
      );
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to update rejected advance request.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (requestId: string) => submitExpenseAdvanceRequest(requestId),
    onSuccess: async () => {
      await refresh();
      setSelected(null);
      setForm(emptyForm);
      setInfoText('Rejected advance request resubmitted successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(
        getTenantReadableError(e, 'Unable to resubmit rejected advance request.')
      );
      setInfoText('');
    },
  });

  function openEdit(item: ExpenseAdvanceRequestDto) {
    setSelected(item);
    setForm({
      advanceTypeId: item.advanceTypeId,
      employeeId: item.employeeId,
      requestDateUtc: item.requestDateUtc,
      purpose: item.purpose,
      requestedAmount: Number(item.requestedAmount || 0),
      department: item.department || '',
      branch: item.branch || '',
      costCenter: item.costCenter || '',
      destination: item.destination || '',
      expectedRetirementDateUtc: item.expectedRetirementDateUtc || '',
      notes: item.notes || '',
    });
    setErrorText('');
    setInfoText('');
  }

  function update<K extends keyof CreateExpenseAdvanceRequestRequest>(
    key: K,
    value: CreateExpenseAdvanceRequestRequest[K]
  ) {
    setForm((s: CreateExpenseAdvanceRequestRequest) => ({ ...s, [key]: value }));
  }

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to rejected advance requests.
      </div>
    );
  }

  if (requestsQ.isLoading || employeesQ.isLoading || advanceTypesQ.isLoading) {
    return <div className="panel">Loading rejected advance requests...</div>;
  }

  if (
    requestsQ.isError ||
    employeesQ.isError ||
    advanceTypesQ.isError ||
    !requestsQ.data ||
    !employeesQ.data ||
    !advanceTypesQ.data
  ) {
    return <div className="panel error-panel">Unable to load rejected advance requests.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Rejected Advance Requests</h2>
          <span className="muted">{requestsQ.data.count} rejected request(s)</span>
        </div>

        <div className="muted">
          Correct rejected requests and resubmit for fresh approval.
        </div>

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
                <th>Reference</th>
                <th>Purpose</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 180 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {(requestsQ.data.items ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No rejected requests found.
                  </td>
                </tr>
              ) : (
                (requestsQ.data.items ?? []).map((item: ExpenseAdvanceRequestDto) => (
                  <tr key={item.id}>
                    <td>{item.requestNumber}</td>
                    <td>{item.purpose}</td>
                    <td>{item.rejectionReason || '—'}</td>
                    <td>{eamStatusLabel(item.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(item.requestedAmount)}
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

      {selected ? (
        <section className="panel">
          <div className="section-heading">
            <h3>Edit Rejected Request</h3>
            <button className="button" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>

          <div className="muted">
            Rejected by {selected.rejectedBy || '—'} on {formatDateTime(selected.rejectedOnUtc)}.
          </div>

          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            <div>
              <label>Advance Type</label>
              <select
                className="input"
                value={form.advanceTypeId}
                onChange={(e) => update('advanceTypeId', e.target.value)}
              >
                <option value="">Select advance type</option>
                {liveAdvanceTypes.map((item: EamAdvanceTypeDto) => (
                  <option key={item.id} value={item.id}>
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Employee</label>
              <select
                className="input"
                value={form.employeeId}
                onChange={(e) => update('employeeId', e.target.value)}
              >
                <option value="">Select employee</option>
                {(employeesQ.data.items ?? []).map((emp: PayrollEmployeeDto) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employeeNumber} - {emp.fullName || emp.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Request Date</label>
              <input
                className="input"
                type="date"
                value={toDateInputValue(form.requestDateUtc)}
                onChange={(e) => update('requestDateUtc', dateInputToUtc(e.target.value))}
              />
            </div>

            <div>
              <label>Expected Retirement</label>
              <input
                className="input"
                type="date"
                value={toDateInputValue(form.expectedRetirementDateUtc)}
                onChange={(e) =>
                  update('expectedRetirementDateUtc', dateInputToUtc(e.target.value))
                }
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label>Purpose</label>
              <input
                className="input"
                value={form.purpose}
                onChange={(e) => update('purpose', e.target.value)}
              />
            </div>

            <div>
              <label>Amount</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.requestedAmount}
                onChange={(e) => update('requestedAmount', Number(e.target.value || 0))}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                className="input"
                rows={4}
                value={form.notes || ''}
                onChange={(e) => update('notes', e.target.value)}
              />
            </div>
          </div>

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
