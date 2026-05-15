import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createExpenseAdvanceRequest,
  getEamAdvanceTypes,
  getExpenseAdvanceRequests,
  getPayrollEmployees,
  getTenantReadableError,
  submitExpenseAdvanceRequest,
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

export function AdvanceRequestsPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canCreate = canCreateExpenseAdvances();
  const canSubmit = canSubmitExpenseAdvances();

  const [showCreate, setShowCreate] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CreateExpenseAdvanceRequestRequest>(emptyForm);

  const requestsQ = useQuery<ExpenseAdvanceRequestListResponse>({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
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

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-dashboard'] });
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
    await qc.invalidateQueries({ queryKey: ['eam-rejected-requests'] });
  }

  const createMut = useMutation({
    mutationFn: createExpenseAdvanceRequest,
    onSuccess: async () => {
      await refresh();
      setShowCreate(false);
      setForm({
        ...emptyForm,
        requestDateUtc: new Date().toISOString(),
      });
      setErrorText('');
      setInfoText('Advance request created successfully and saved as draft.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to create advance request.'));
      setInfoText('');
    },
  });

  const submitMut = useMutation({
    mutationFn: (requestId: string) => submitExpenseAdvanceRequest(requestId),
    onSuccess: async () => {
      await refresh();
      setErrorText('');
      setInfoText('Advance request submitted for approval successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to submit advance request for approval.'));
      setInfoText('');
    },
  });

  const liveAdvanceTypes = useMemo(
    () => (advanceTypesQ.data?.items ?? []).filter((x: EamAdvanceTypeDto) => x.isActive),
    [advanceTypesQ.data?.items]
  );

  const visibleItems = useMemo(() => {
    const text = search.trim().toLowerCase();
    const items = (requestsQ.data?.items ?? []).filter((x: ExpenseAdvanceRequestDto) => x.status !== 4);

    if (!text) {
      return items;
    }

    return items.filter(
      (item: ExpenseAdvanceRequestDto) =>
        item.requestNumber.toLowerCase().includes(text) ||
        item.purpose.toLowerCase().includes(text) ||
        (item.department || '').toLowerCase().includes(text) ||
        (item.destination || '').toLowerCase().includes(text)
    );
  }, [requestsQ.data?.items, search]);

  function update<K extends keyof CreateExpenseAdvanceRequestRequest>(
    key: K,
    value: CreateExpenseAdvanceRequestRequest[K]
  ) {
    setForm((s: CreateExpenseAdvanceRequestRequest) => ({ ...s, [key]: value }));
  }

  async function submitCreate() {
    setErrorText('');
    setInfoText('');

    if (!form.employeeId) {
      setErrorText('Employee is required.');
      return;
    }

    if (!form.advanceTypeId) {
      setErrorText('Advance type is required.');
      return;
    }

    if (!form.purpose.trim()) {
      setErrorText('Purpose is required.');
      return;
    }

    if (Number(form.requestedAmount || 0) <= 0) {
      setErrorText('Requested amount must be greater than zero.');
      return;
    }

    await createMut.mutateAsync({
      ...form,
      purpose: form.purpose.trim(),
      notes: form.notes?.trim() || null,
    });
  }

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to Expense & Advance Management.
      </div>
    );
  }

  if (requestsQ.isLoading || employeesQ.isLoading || advanceTypesQ.isLoading) {
    return <div className="panel">Loading advance requests...</div>;
  }

  if (
    requestsQ.isError ||
    employeesQ.isError ||
    advanceTypesQ.isError ||
    !requestsQ.data ||
    !employeesQ.data ||
    !advanceTypesQ.data
  ) {
    return <div className="panel error-panel">Unable to load advance requests.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Advance Requests</h2>
            <div className="muted">
              Prepare advance requests, save as draft, and submit into the maker-checker
              workflow.
            </div>
          </div>

          {canCreate ? (
            <button className="button primary" onClick={() => setShowCreate(true)}>
              New Advance Request
            </button>
          ) : null}
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <label>Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Reference, purpose, department, destination"
          />
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
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Purpose</th>
                <th>Status</th>
                <th>Department</th>
                <th>Request Date</th>
                <th>Expected Retirement</th>
                <th style={{ textAlign: 'right' }}>Requested</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ width: 180 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No advance requests found.
                  </td>
                </tr>
              ) : (
                visibleItems.map((item: ExpenseAdvanceRequestDto) => (
                  <tr key={item.id}>
                    <td>{item.requestNumber}</td>
                    <td>{item.purpose}</td>
                    <td>{eamStatusLabel(item.status)}</td>
                    <td>{item.department || '—'}</td>
                    <td>{formatDateTime(item.requestDateUtc)}</td>
                    <td>{formatDateTime(item.expectedRetirementDateUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.requestedAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.outstandingAmount)}</td>
                    <td>
                      {item.status === 1 && canSubmit ? (
                        <button
                          className="button small"
                          onClick={() => submitMut.mutate(item.id)}
                          disabled={submitMut.isPending}
                        >
                          Submit
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <section className="panel">
          <div className="section-heading">
            <h3>New Advance Request</h3>
            <button className="button" onClick={() => setShowCreate(false)}>
              Close
            </button>
          </div>

          <div className="form-grid two-columns">
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
              <label>Expected Retirement Date</label>
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
              <label>Requested Amount</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.requestedAmount}
                onChange={(e) => update('requestedAmount', Number(e.target.value || 0))}
              />
            </div>

            <div>
              <label>Department</label>
              <input
                className="input"
                value={form.department || ''}
                onChange={(e) => update('department', e.target.value)}
              />
            </div>

            <div>
              <label>Destination</label>
              <input
                className="input"
                value={form.destination || ''}
                onChange={(e) => update('destination', e.target.value)}
              />
            </div>

            <div>
              <label>Branch</label>
              <input
                className="input"
                value={form.branch || ''}
                onChange={(e) => update('branch', e.target.value)}
              />
            </div>

            <div>
              <label>Cost Center</label>
              <input
                className="input"
                value={form.costCenter || ''}
                onChange={(e) => update('costCenter', e.target.value)}
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

          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button
              className="button primary"
              onClick={submitCreate}
              disabled={createMut.isPending}
            >
              Save Draft
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
