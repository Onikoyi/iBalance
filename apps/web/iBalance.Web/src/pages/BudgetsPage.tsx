import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveBudget,
  closeBudget,
  createBudget,
  deleteBudget,
  downloadBudgetUploadTemplate,
  getAccounts,
  getBudgetDetail,
  getBudgets,
  getFiscalPeriods,
  getTenantReadableError,
  lockBudget,
  rejectBudget,
  setBudgetOverrunPolicy,
  submitBudgetForApproval,
  transferBudgetAmount,
  uploadBudget,
  type BudgetDto,
  type BudgetLineRequest,
  type BudgetOverrunPolicy,
  type BudgetType,
  type CreateBudgetRequest,
  type UploadBudgetRowRequest,
} from '../lib/api';
import { canApproveWorkflows, canManageFinanceSetup, canViewFinance } from '../lib/auth';

type BudgetFormState = {
  fiscalPeriodId: string;
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
  fiscalPeriodId: '',
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
  
    return `${value}T00:00:00.000Z`;
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

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}

function parseBudgetCsv(text: string): UploadBudgetRowRequest[] {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const rows: UploadBudgetRowRequest[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);

    rows.push({
      budgetNumber: cells[0] || '',
      budgetName: cells[1] || '',
      description: cells[2] || '',
      budgetType: cells[3] || '',
      periodStart: toUtcFromDateInput(cells[4] || ''),
      periodEnd: toUtcFromDateInput(cells[5] || ''),
      overrunPolicy: cells[6] || 'WarnOnly',
      ledgerAccountCode: cells[7] || '',
      linePeriodStart: toUtcFromDateInput(cells[8] || ''),
      linePeriodEnd: toUtcFromDateInput(cells[9] || ''),
      budgetAmount: Number(cells[10] || 0),
      notes: cells[11] || '',
    });
  }

  return rows;
}

export function BudgetsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();
  const canApprove = canApproveWorkflows();

  const [form, setForm] = useState<BudgetFormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [policyBudgetId, setPolicyBudgetId] = useState('');
  const [policyValue, setPolicyValue] = useState<BudgetOverrunPolicy>(2);
  const [transferBudgetId, setTransferBudgetId] = useState('');
  const [fromBudgetLineId, setFromBudgetLineId] = useState('');
  const [toBudgetLineId, setToBudgetLineId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadRows, setUploadRows] = useState<UploadBudgetRowRequest[]>([]);

  const budgetsQ = useQuery({
    queryKey: ['budgets'],
    queryFn: getBudgets,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const fiscalPeriodsQ = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: getFiscalPeriods,
    enabled: canView,
  });

  function applyFiscalPeriod(fiscalPeriodId: string) {
    const selectedPeriod = (fiscalPeriodsQ.data?.items || []).find(
      (period) => period.id === fiscalPeriodId
    );

    if (!selectedPeriod) {
      setForm((state) => ({
        ...state,
        fiscalPeriodId: '',
        periodStartUtc: '',
        periodEndUtc: '',
        lines: state.lines.map((line) => ({
          ...line,
          periodStartUtc: '',
          periodEndUtc: '',
        })),
      }));

      return;
    }

    const periodStartUtc = toUtcFromDateInput(toDateInput(selectedPeriod.startDate));
    const periodEndUtc = toUtcFromDateInput(toDateInput(selectedPeriod.endDate));

    setForm((state) => ({
      ...state,
      fiscalPeriodId,
      periodStartUtc,
      periodEndUtc,
      lines: state.lines.map((line) => ({
        ...line,
        periodStartUtc: line.periodStartUtc || periodStartUtc,
        periodEndUtc: line.periodEndUtc || periodEndUtc,
      })),
    }));
  }

  const detailQ = useQuery({
    queryKey: ['budget-detail', selectedBudgetId],
    queryFn: () => getBudgetDetail(selectedBudgetId),
    enabled: canView && !!selectedBudgetId,
  });

  const transferDetailQ = useQuery({
    queryKey: ['budget-detail', transferBudgetId],
    queryFn: () => getBudgetDetail(transferBudgetId),
    enabled: canView && !!transferBudgetId,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['budgets'] });
    await qc.invalidateQueries({ queryKey: ['rejected-budgets'] });
    await qc.invalidateQueries({ queryKey: ['budget-detail'] });
    await qc.invalidateQueries({ queryKey: ['budget-vs-actual'] });
    await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }

  const createMut = useMutation({
    mutationFn: (payload: CreateBudgetRequest) => createBudget(payload),
    onSuccess: async () => {
      await refresh();
      setForm(emptyForm);
      setMessage('Budget created successfully as draft.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to create budget.'));
    },
  });

  const uploadMut = useMutation({
    mutationFn: () => uploadBudget({ notes: uploadNotes.trim() || null, rows: uploadRows }),
    onSuccess: async () => {
      await refresh();
      setUploadRows([]);
      setUploadNotes('');
      setMessage('Budget uploaded successfully as draft.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to upload budget.'));
    },
  });

  const submitMut = useMutation({
    mutationFn: (budgetId: string) => submitBudgetForApproval(budgetId),
    onSuccess: async () => {
      await refresh();
      setMessage('Budget submitted for approval successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to submit budget for approval.'));
    },
  });

  const approveMut = useMutation({
    mutationFn: (budgetId: string) => approveBudget(budgetId),
    onSuccess: async () => {
      await refresh();
      setMessage('Budget approved successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to approve budget.'));
    },
  });

  const rejectMut = useMutation({
    mutationFn: (budgetId: string) => rejectBudget(budgetId, { reason: rejectReason.trim() }),
    onSuccess: async () => {
      await refresh();
      setRejectReason('');
      setMessage('Budget rejected successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to reject budget.'));
    },
  });

  const lockMut = useMutation({
    mutationFn: (budgetId: string) => lockBudget(budgetId),
    onSuccess: async () => {
      await refresh();
      setMessage('Budget locked successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to lock budget.'));
    },
  });

  const closeMut = useMutation({
    mutationFn: (budgetId: string) => closeBudget(budgetId, { reason: closeReason.trim() }),
    onSuccess: async () => {
      await refresh();
      setCloseReason('');
      setMessage('Budget closed successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to close budget.'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (budgetId: string) => deleteBudget(budgetId),
    onSuccess: async () => {
      await refresh();
      setMessage('Budget deleted successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to delete budget.'));
    },
  });

  const policyMut = useMutation({
    mutationFn: () => setBudgetOverrunPolicy(policyBudgetId, { overrunPolicy: policyValue }),
    onSuccess: async () => {
      await refresh();
      setPolicyBudgetId('');
      setMessage('Budget overrun policy updated successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to update budget overrun policy.'));
    },
  });

  const transferMut = useMutation({
    mutationFn: () =>
      transferBudgetAmount(transferBudgetId, {
        fromBudgetLineId,
        toBudgetLineId,
        amount: Number(transferAmount),
        reason: transferReason.trim(),
      }),
    onSuccess: async () => {
      await refresh();
      setFromBudgetLineId('');
      setToBudgetLineId('');
      setTransferAmount('');
      setTransferReason('');
      setMessage('Budget transfer completed successfully.');
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to complete budget transfer.'));
    },
  });

  const postingAccounts = useMemo(() => {
    return (accountsQ.data?.items || [])
      .filter((account) => account.isActive && !account.isHeader && account.isPostingAllowed)
      .sort((a, b) => `${a.code} ${a.name}`.localeCompare(`${b.code} ${b.name}`));
  }, [accountsQ.data?.items]);

  const visibleBudgets = useMemo(() => {
    const items = (budgetsQ.data?.items || []).filter((budget) => budget.status !== 4);
    const text = search.trim().toLowerCase();

    return items.filter((budget) => {
      const matchesSearch =
        !text ||
        budget.budgetNumber.toLowerCase().includes(text) ||
        budget.name.toLowerCase().includes(text) ||
        budget.description.toLowerCase().includes(text);

      const matchesStatus =
        statusFilter === 'all' ||
        String(budget.status) === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [budgetsQ.data?.items, search, statusFilter]);

  const activeBudgetStats = useMemo(() => {
    return (budgetsQ.data?.items || []).filter((budget) => budget.status !== 4);
  }, [budgetsQ.data?.items]);

  const formTotal = useMemo(() => {
    return form.lines.reduce((sum, line) => sum + Number(line.budgetAmount || 0), 0);
  }, [form.lines]);

  const selectedBudgetDetail = detailQ.data?.budget ?? null;
  const transferBudgetDetail = transferDetailQ.data?.budget ?? null;

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

  function buildPayload(): CreateBudgetRequest | null {
    setMessage('');

    if (!canManage) {
      setMessage('You do not have permission to create budgets.');
      return null;
    }

    if (!form.budgetNumber.trim()) {
      setMessage('Budget number is required.');
      return null;
    }

    if (!form.name.trim()) {
      setMessage('Budget name is required.');
      return null;
    }

    if (!form.description.trim()) {
      setMessage('Budget description is required.');
      return null;
    }

    if (!form.fiscalPeriodId) {
      setMessage('Please select a fiscal period for this budget.');
      return null;
    }

    if (!form.periodStartUtc || !form.periodEndUtc) {
      setMessage('Budget period start and end dates are required.');
      return null;
    }

    if (form.lines.length === 0) {
      setMessage('At least one budget line is required.');
      return null;
    }

    for (const line of form.lines) {
      if (!line.ledgerAccountId) {
        setMessage('Each budget line must have a ledger account.');
        return null;
      }

      if (!line.periodStartUtc || !line.periodEndUtc) {
        setMessage('Each budget line must have start and end dates.');
        return null;
      }

      if (Number(line.budgetAmount || 0) < 0) {
        setMessage('Budget amount cannot be negative.');
        return null;
      }
    }

    return {
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
  }

  function submitCreate() {
    const payload = buildPayload();

    if (!payload) return;

    createMut.mutate(payload);
  }

  function handleReject(budget: BudgetDto) {
    setMessage('');

    if (!canApprove) {
      setMessage('You do not have permission to reject budgets.');
      return;
    }

    if (!rejectReason.trim()) {
      setMessage('Rejection reason is required before rejecting a budget.');
      return;
    }

    rejectMut.mutate(budget.id);
  }

  function handleClose(budget: BudgetDto) {
    setMessage('');

    if (!canApprove) {
      setMessage('You do not have permission to close budgets.');
      return;
    }

    if (!closeReason.trim()) {
      setMessage('Closure reason is required before closing a budget.');
      return;
    }

    closeMut.mutate(budget.id);
  }

  function handleDelete(budget: BudgetDto) {
    setMessage('');

    if (!canManage) {
      setMessage('You do not have permission to delete budgets.');
      return;
    }

    const confirmed = window.confirm(`Delete budget ${budget.budgetNumber}? This cannot be undone.`);

    if (!confirmed) return;

    deleteMut.mutate(budget.id);
  }

  function submitPolicyUpdate() {
    setMessage('');

    if (!policyBudgetId) {
      setMessage('Please select a budget for policy update.');
      return;
    }

    policyMut.mutate();
  }

  function submitTransfer() {
    setMessage('');

    if (!transferBudgetId) {
      setMessage('Please select a budget for transfer.');
      return;
    }

    if (!fromBudgetLineId || !toBudgetLineId) {
      setMessage('Please select both source and destination budget lines.');
      return;
    }

    if (fromBudgetLineId === toBudgetLineId) {
      setMessage('Source and destination budget lines cannot be the same.');
      return;
    }

    if (Number(transferAmount || 0) <= 0) {
      setMessage('Transfer amount must be greater than zero.');
      return;
    }

    if (!transferReason.trim()) {
      setMessage('Transfer reason is required.');
      return;
    }

    transferMut.mutate();
  }

  async function handleCsvFile(file?: File) {
    setMessage('');

    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseBudgetCsv(text);

      if (rows.length === 0) {
        setMessage('The uploaded CSV does not contain budget rows.');
        return;
      }

      setUploadRows(rows);
      setMessage(`${rows.length} budget upload row(s) loaded. Click Upload Budget CSV to validate and create draft budget.`);
    } catch {
      setMessage('Unable to read the selected CSV file.');
    }
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view budgets.</div>;
  }

  if (budgetsQ.isLoading || accountsQ.isLoading || fiscalPeriodsQ.isLoading) {
    return <div className="panel">Loading budgets...</div>;
  }

  if (
    budgetsQ.isError ||
    accountsQ.isError ||
    fiscalPeriodsQ.isError ||
    !budgetsQ.data ||
    !accountsQ.data ||
    !fiscalPeriodsQ.data
  ) {
    return <div className="panel error-panel">We could not load budget information at this time.</div>;
  }

  const openFiscalPeriods = (fiscalPeriodsQ.data?.items || []).filter((period) => period.status === 1);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Budgets</h2>
            <div className="muted">
              Create budgets, upload budget templates, approve budgets, transfer budget balances, and monitor budget controls.
            </div>
          </div>

          <div className="inline-actions">
            <Link to="/budgets/rejected" className="button">Rejected Budgets</Link>
            <Link to="/budget-vs-actual" className="button">Budget vs Actual</Link>
          </div>
        </div>

        {message ? (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="muted">{message}</div>
          </div>
        ) : null}

        <div className="stats-grid">
          <StatLike label="Total Budgets" value={activeBudgetStats.length} />
          <StatLike label="Draft" value={activeBudgetStats.filter((x) => x.status === 1).length} />
          <StatLike label="Submitted" value={activeBudgetStats.filter((x) => x.status === 2).length} />
          <StatLike label="Approved" value={activeBudgetStats.filter((x) => x.status === 3).length} />
          <StatLike label="Locked" value={activeBudgetStats.filter((x) => x.status === 5).length} />
          <StatLike label="Closed" value={activeBudgetStats.filter((x) => x.status === 7).length} />
          <StatLike
            label="Total Budget Amount"
            value={formatAmount(activeBudgetStats.reduce((sum, x) => sum + Number(x.totalAmount || 0), 0))}
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Create Budget Manually</h2>
          <span className="muted">Budget is created as Draft</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Budget Number</label>
            <input
              className="input"
              value={form.budgetNumber}
              onChange={(e) => updateForm('budgetNumber', e.target.value)}
              placeholder="BUD-2026-001"
            />
          </div>

          <div className="form-row">
            <label>Budget Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="2026 Operating Budget"
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
            <label>Fiscal Period</label>
            <select
              className="select"
              value={form.fiscalPeriodId}
              onChange={(e) => applyFiscalPeriod(e.target.value)}
            >
              <option value="">— Select Fiscal Period —</option>
              {(fiscalPeriodsQ.data?.items || [])
                .filter((period) => period.status === 1)
                .map((period) => (
                    <option key={period.id} value={period.id}>
                    {period.name} ({period.startDate} - {period.endDate}) - Open
                    </option>
                ))}
            </select>
          </div>

             {(fiscalPeriodsQ.data?.items || []).filter((period) => period.status === 1).length === 0 ? (
            <div className="muted" style={{ marginTop: 6 }}>
                No open fiscal period is available. Please open a fiscal period before creating a budget.
            </div>
            ) : null}

          <div className="form-row">
            <label>Budget Period</label>
            <input
              className="input"
              value={
                form.periodStartUtc && form.periodEndUtc
                  ? `${toDateInput(form.periodStartUtc)} to ${toDateInput(form.periodEndUtc)}`
                  : ''
              }
              readOnly
              placeholder="Selected fiscal period dates will appear here"
            />
          </div>

          <div className="form-row">
            <label>Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="Budget description"
            />
          </div>

          <div className="form-row">
            <label>Notes</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => updateForm('notes', e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div className="section-heading" style={{ marginTop: 18 }}>
          <h2>Budget Lines</h2>
          <button className="button" onClick={addLine}>Add Line</button>
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
                <tr key={index}>
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
        </div>

        <div className="inline-actions" style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <button className="button" onClick={() => setForm(emptyForm)}>
            Reset
          </button>

          <button
            className="button primary"
            onClick={submitCreate}
            disabled={createMut.isPending || !canManage || openFiscalPeriods.length === 0}
            >
            {createMut.isPending ? 'Creating…' : 'Create Budget'}
            </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Budget Upload</h2>
          <span className="muted">Download template, fill, and upload CSV</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>CSV File</label>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleCsvFile(e.target.files?.[0])}
            />
          </div>

          <div className="form-row">
            <label>Upload Notes</label>
            <input
              className="input"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              placeholder="Optional upload notes"
            />
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="button" onClick={downloadBudgetUploadTemplate}>
            Download Template
          </button>

          <button
            className="button primary"
            onClick={() => uploadMut.mutate()}
            disabled={uploadMut.isPending || uploadRows.length === 0 || !canManage}
          >
            {uploadMut.isPending ? 'Uploading…' : `Upload Budget CSV (${uploadRows.length})`}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Budget Register</h2>
          <span className="muted">{visibleBudgets.length} budget(s)</span>
        </div>

        <div className="form-grid two" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Budget number, name, description"
            />
          </div>

          <div className="form-row">
            <label>Status</label>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="1">Draft</option>
              <option value="2">Submitted for Approval</option>
              <option value="3">Approved</option>
              <option value="5">Locked</option>
              <option value="6">Cancelled</option>
              <option value="7">Closed</option>
            </select>
          </div>
        </div>

        <div className="form-grid two" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Rejection Reason</label>
            <input
              className="input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Required when rejecting"
            />
          </div>

          <div className="form-row">
            <label>Closure Reason</label>
            <input
              className="input"
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Required when closing"
            />
          </div>
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
                <th>Overrun Policy</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Workflow</th>
              </tr>
            </thead>

            <tbody>
              {visibleBudgets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">No budgets found.</td>
                </tr>
              ) : (
                visibleBudgets.map((budget) => (
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
                    <td>{overrunPolicyLabel(budget.overrunPolicy)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(budget.totalAmount)}</td>

                    <td>
                      <div className="inline-actions">
                        <button className="button" onClick={() => setSelectedBudgetId(budget.id)}>
                          Detail
                        </button>

                        {budget.status === 1 && canManage ? (
                          <button
                            className="button"
                            onClick={() => submitMut.mutate(budget.id)}
                            disabled={submitMut.isPending}
                          >
                            Submit
                          </button>
                        ) : null}

                        {budget.status === 2 && canApprove ? (
                          <>
                            <button
                              className="button"
                              onClick={() => approveMut.mutate(budget.id)}
                              disabled={approveMut.isPending}
                            >
                              Approve
                            </button>

                            <button
                              className="button danger"
                              onClick={() => handleReject(budget)}
                              disabled={rejectMut.isPending}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}

                        {budget.status === 3 && canApprove ? (
                          <button
                            className="button"
                            onClick={() => lockMut.mutate(budget.id)}
                            disabled={lockMut.isPending}
                          >
                            Lock
                          </button>
                        ) : null}

                        {(budget.status === 3 || budget.status === 5) && canApprove ? (
                          <button
                            className="button danger"
                            onClick={() => handleClose(budget)}
                            disabled={closeMut.isPending}
                          >
                            Close
                          </button>
                        ) : null}

                        {budget.status === 1 && canManage ? (
                          <button
                            className="button danger"
                            onClick={() => handleDelete(budget)}
                            disabled={deleteMut.isPending}
                          >
                            Delete
                          </button>
                        ) : null}

                        <Link to={`/budget-vs-actual?budgetId=${budget.id}`} className="button">
                          Vs Actual
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Overrun Policy Update</h2>
          <span className="muted">Change budget overrun policy without touching budget lines</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Budget</label>
            <select
              className="select"
              value={policyBudgetId}
              onChange={(e) => setPolicyBudgetId(e.target.value)}
            >
              <option value="">— Select Budget —</option>
              {activeBudgetStats
                .filter((x) => x.status !== 6 && x.status !== 7)
                .map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.budgetNumber} - {budget.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-row">
            <label>Policy</label>
            <select
              className="select"
              value={policyValue}
              onChange={(e) => setPolicyValue(Number(e.target.value) as BudgetOverrunPolicy)}
            >
              <option value={1}>Disallow</option>
              <option value={2}>Warn Only</option>
              <option value={3}>Allow</option>
              <option value={4}>Require Approval</option>
            </select>
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button
            className="button primary"
            onClick={submitPolicyUpdate}
            disabled={policyMut.isPending || !canApprove}
          >
            {policyMut.isPending ? 'Updating…' : 'Update Overrun Policy'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Budget Transfer</h2>
          <span className="muted">Transfer budget amount from one head/account line to another</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Budget</label>
            <select
              className="select"
              value={transferBudgetId}
              onChange={(e) => {
                setTransferBudgetId(e.target.value);
                setFromBudgetLineId('');
                setToBudgetLineId('');
              }}
            >
              <option value="">— Select Approved / Locked Budget —</option>
              {activeBudgetStats
                .filter((x) => x.status === 3 || x.status === 5)
                .map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.budgetNumber} - {budget.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-row">
            <label>Transfer Amount</label>
            <input
              className="input"
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="form-row">
            <label>From Budget Line</label>
            <select
              className="select"
              value={fromBudgetLineId}
              onChange={(e) => setFromBudgetLineId(e.target.value)}
            >
              <option value="">— Select Source Line —</option>
              {(transferBudgetDetail?.lines || []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.ledgerAccountCode} - {line.ledgerAccountName} - {formatAmount(line.budgetAmount)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>To Budget Line</label>
            <select
              className="select"
              value={toBudgetLineId}
              onChange={(e) => setToBudgetLineId(e.target.value)}
            >
              <option value="">— Select Destination Line —</option>
              {(transferBudgetDetail?.lines || []).map((line) => (
                <option key={line.id} value={line.id}>
                  {line.ledgerAccountCode} - {line.ledgerAccountName} - {formatAmount(line.budgetAmount)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ gridColumn: '1 / -1' }}>
            <label>Transfer Reason</label>
            <input
              className="input"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="Explain why this budget transfer is required"
            />
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button
            className="button primary"
            onClick={submitTransfer}
            disabled={transferMut.isPending || !canApprove}
          >
            {transferMut.isPending ? 'Transferring…' : 'Transfer Budget'}
          </button>
        </div>
      </section>

      {selectedBudgetDetail ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Budget Detail</h2>
              <div className="muted">{selectedBudgetDetail.budgetNumber} - {selectedBudgetDetail.name}</div>
            </div>

            <button className="button" onClick={() => setSelectedBudgetId('')}>
              Close Detail
            </button>
          </div>

          <div className="kv-row">
                <span>Submitted By</span>
                <span>{selectedBudgetDetail.submittedByDisplayName || selectedBudgetDetail.submittedBy || '—'}</span>
                </div>

                <div className="kv-row">
                <span>Submitted On</span>
                <span>{formatDateTime(selectedBudgetDetail.submittedOnUtc)}</span>
                </div>

                <div className="kv-row">
                <span>Approved By</span>
                <span>{selectedBudgetDetail.approvedByDisplayName || selectedBudgetDetail.approvedBy || '—'}</span>
                </div>

                <div className="kv-row">
                <span>Approved On</span>
                <span>{formatDateTime(selectedBudgetDetail.approvedOnUtc)}</span>
                </div>

                <div className="kv-row">
                <span>Rejected By</span>
                <span>{selectedBudgetDetail.rejectedByDisplayName || selectedBudgetDetail.rejectedBy || '—'}</span>
                </div>

                <div className="kv-row">
                <span>Rejected On</span>
                <span>{formatDateTime(selectedBudgetDetail.rejectedOnUtc)}</span>
                </div>

                <div className="kv-row">
                <span>Rejection Reason</span>
                <span>{selectedBudgetDetail.rejectionReason || '—'}</span>
                </div>

                <div className="kv-row">
                <span>Locked By</span>
                <span>{selectedBudgetDetail.lockedByDisplayName || selectedBudgetDetail.lockedBy || '—'}</span>
                </div>

                <div className="kv-row">
                <span>Locked On</span>
                <span>{formatDateTime(selectedBudgetDetail.lockedOnUtc)}</span>
                </div>

                <div className="kv-row">
                <span>Closed By</span>
                <span>{selectedBudgetDetail.closedByDisplayName || selectedBudgetDetail.closedBy || '—'}</span>
                </div>

                <div className="kv-row">
                <span>Closed On</span>
                <span>{formatDateTime(selectedBudgetDetail.closedOnUtc)}</span>
                </div>

                <div className="kv-row">
                <span>Closure Reason</span>
                <span>{selectedBudgetDetail.closureReason || '—'}</span>
                </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Budget Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {selectedBudgetDetail.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.ledgerAccountCode} - {line.ledgerAccountName}</td>
                    <td>{formatDate(line.periodStartUtc)} - {formatDate(line.periodEndUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(line.budgetAmount)}</td>
                    <td>{line.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detailQ.data?.transfers?.length ? (
            <>
              <div className="section-heading" style={{ marginTop: 18 }}>
                <h2>Budget Transfer History</h2>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Transferred On</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Transferred By</th>
                    </tr>
                  </thead>

                  <tbody>
                    {detailQ.data.transfers.map((transfer) => (
                      <tr key={transfer.id}>
                        <td>{formatDateTime(transfer.transferredOnUtc)}</td>
                        <td>{formatAmount(transfer.amount)}</td>
                        <td>{transfer.reason}</td>
                        <td>{transfer.transferredByDisplayName || transfer.transferredBy || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function StatLike({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <div className="muted">{label}</div>
      <div style={{ fontWeight: 800, fontSize: 24, marginTop: 8 }}>{value}</div>
    </div>
  );
}