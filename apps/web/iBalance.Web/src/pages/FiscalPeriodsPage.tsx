import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeFiscalPeriod,
  createFiscalPeriod,
  createFiscalYear,
  getAccounts,
  getFiscalPeriods,
  getTenantReadableError,
  openFiscalPeriod,
  runYearEndClose,
  type FiscalPeriodDto,
  type LedgerAccountDto,
} from '../lib/api';
import { canManageFiscalPeriods, canViewFinance } from '../lib/auth';

function statusLabel(value: number) {
  return value === 1 ? 'Open' : 'Closed';
}

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return value;
}

function accountLabel(account?: LedgerAccountDto | null) {
  if (!account) return '—';
  return `${account.code} - ${account.name}`;
}

function fiscalYearKey(period: FiscalPeriodDto) {
  const startYear = Number(period.startDate.slice(0, 4));
  const startMonth = Number(period.startDate.slice(5, 7));
  const fiscalYear = startMonth >= 1 ? startYear : startYear - 1;
  return `FY ${fiscalYear}`;
}

function fiscalYearRangeLabel(periods: FiscalPeriodDto[]) {
  if (periods.length === 0) return '—';
  return `${periods[0].startDate} to ${periods[periods.length - 1].endDate}`;
}

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

type FiscalYearFormState = {
  fiscalYearName: string;
  fiscalYearStartDate: string;
  createMonthsOpen: boolean;
};

type YearEndFormState = {
  fiscalYearStartDate: string;
  fiscalYearEndDate: string;
  retainedEarningsLedgerAccountId: string;
  reference: string;
  description: string;
};

const emptyForm: FormState = {
  name: '',
  startDate: '',
  endDate: '',
  isOpen: true,
};

const emptyFiscalYearForm: FiscalYearFormState = {
  fiscalYearName: '',
  fiscalYearStartDate: '',
  createMonthsOpen: true,
};

const emptyYearEndForm: YearEndFormState = {
  fiscalYearStartDate: '',
  fiscalYearEndDate: '',
  retainedEarningsLedgerAccountId: '',
  reference: '',
  description: '',
};

export function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [showCreateYear, setShowCreateYear] = useState(false);
  const [showYearEndClose, setShowYearEndClose] = useState(false);
  const [expandedYearKeys, setExpandedYearKeys] = useState<Record<string, boolean>>({});
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fiscalYearForm, setFiscalYearForm] = useState<FiscalYearFormState>(emptyFiscalYearForm);
  const [yearEndForm, setYearEndForm] = useState<YearEndFormState>(emptyYearEndForm);

  const canView = canViewFinance();
  const canManage = canManageFiscalPeriods();

  const { data, isLoading, error } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: getFiscalPeriods,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const invalidateFiscalData = async () => {
    await qc.invalidateQueries({ queryKey: ['fiscal-periods'] });
    await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    await qc.invalidateQueries({ queryKey: ['journal-entries'] });
    await qc.invalidateQueries({ queryKey: ['trial-balance'] });
    await qc.invalidateQueries({ queryKey: ['balance-sheet'] });
    await qc.invalidateQueries({ queryKey: ['income-statement'] });
  };

  const createPeriodMut = useMutation({
    mutationFn: createFiscalPeriod,
    onSuccess: async () => {
      await invalidateFiscalData();
      setShowCreatePeriod(false);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Fiscal period created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Failed to create fiscal period.'));
      setInfoText('');
    },
  });

  const createYearMut = useMutation({
    mutationFn: createFiscalYear,
    onSuccess: async (result) => {
      await invalidateFiscalData();
      setShowCreateYear(false);
      setFiscalYearForm(emptyFiscalYearForm);
      setErrorText('');
      setInfoText(`Fiscal year ${result.fiscalYearName} created with ${result.count} monthly period(s).`);
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Failed to create fiscal year.'));
      setInfoText('');
    },
  });

  const openMut = useMutation({
    mutationFn: openFiscalPeriod,
    onSuccess: async () => {
      await invalidateFiscalData();
      setErrorText('');
      setInfoText('Fiscal month re-opened successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Failed to open fiscal month.'));
      setInfoText('');
    },
  });

  const closeMut = useMutation({
    mutationFn: closeFiscalPeriod,
    onSuccess: async () => {
      await invalidateFiscalData();
      setErrorText('');
      setInfoText('Fiscal month closed successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Failed to close fiscal month.'));
      setInfoText('');
    },
  });

  const yearEndCloseMut = useMutation({
    mutationFn: runYearEndClose,
    onSuccess: async (result) => {
      await invalidateFiscalData();
      setShowYearEndClose(false);
      setYearEndForm(emptyYearEndForm);
      setErrorText('');
      setInfoText(`Year end close completed. Reference ${result.reference}. Net income transferred: ${formatAmount(result.netIncome)}.`);
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Failed to run year end close.'));
      setInfoText('');
    },
  });

  const sorted = useMemo(() => {
    const items = data?.items ?? [];
    return [...items].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }, [data?.items]);

  const fiscalYears = useMemo(() => {
    const groups = new Map<string, FiscalPeriodDto[]>();

    for (const period of sorted) {
      const key = fiscalYearKey(period);
      const current = groups.get(key) ?? [];
      current.push(period);
      groups.set(key, current);
    }

    return [...groups.entries()]
      .map(([key, periods]) => ({
        key,
        periods: periods.sort((a, b) => a.startDate.localeCompare(b.startDate)),
      }))
      .sort((a, b) => a.periods[0].startDate.localeCompare(b.periods[0].startDate));
  }, [sorted]);

  const openPeriods = useMemo(() => sorted.filter((item) => item.status === 1), [sorted]);
  const closedPeriods = useMemo(() => sorted.filter((item) => item.status !== 1), [sorted]);

  const retainedEarningsAccounts = useMemo(() => {
    return (accountsQ.data?.items ?? []).filter((account: LedgerAccountDto) =>
      account.isActive &&
      account.isPostingAllowed &&
      !account.isHeader &&
      account.category === 3
    );
  }, [accountsQ.data?.items]);

  function toggleFiscalYear(yearKey: string) {
    setExpandedYearKeys((current) => ({
      ...current,
      [yearKey]: !current[yearKey],
    }));
  }

  function openCreatePeriodModal() {
    if (!canManage) {
      setErrorText('You do not have permission to manage fiscal periods.');
      return;
    }

    setErrorText('');
    setInfoText('');
    setForm(emptyForm);
    setShowCreatePeriod(true);
  }

  function openCreateYearModal() {
    if (!canManage) {
      setErrorText('You do not have permission to manage fiscal years.');
      return;
    }

    const year = new Date().getFullYear();
    setErrorText('');
    setInfoText('');
    setFiscalYearForm({
      fiscalYearName: `FY ${year}`,
      fiscalYearStartDate: `${year}-01-01`,
      createMonthsOpen: true,
    });
    setShowCreateYear(true);
  }

  function closeCreatePeriodModal() {
    if (!createPeriodMut.isPending) setShowCreatePeriod(false);
  }

  function closeCreateYearModal() {
    if (!createYearMut.isPending) setShowCreateYear(false);
  }

  function openYearEndModal(year: { key: string; periods: FiscalPeriodDto[] } | null) {
    if (!canManage) {
      setErrorText('You do not have permission to manage fiscal periods.');
      return;
    }

    if (!year || year.periods.length === 0) {
      setErrorText('Create fiscal periods before running year end close.');
      return;
    }

    const first = year.periods[0];
    const last = year.periods[year.periods.length - 1];

    setErrorText('');
    setInfoText('');
    setYearEndForm({
      fiscalYearStartDate: first.startDate,
      fiscalYearEndDate: last.endDate,
      retainedEarningsLedgerAccountId: retainedEarningsAccounts[0]?.id ?? '',
      reference: `YEC-${last.endDate.replaceAll('-', '')}`,
      description: `Year end close ${first.startDate} to ${last.endDate}`,
    });
    setShowYearEndClose(true);
  }

  function closeYearEndModal() {
    if (!yearEndCloseMut.isPending) setShowYearEndClose(false);
  }

  async function submitPeriod() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to manage fiscal periods.');
      return;
    }

    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setErrorText('Name, Start Date, and End Date are required.');
      return;
    }

    if (form.endDate < form.startDate) {
      setErrorText('End Date cannot be earlier than Start Date.');
      return;
    }

    await createPeriodMut.mutateAsync({
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      isOpen: form.isOpen,
    });
  }

  async function submitFiscalYear() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to manage fiscal years.');
      return;
    }

    if (!fiscalYearForm.fiscalYearName.trim() || !fiscalYearForm.fiscalYearStartDate) {
      setErrorText('Fiscal year name and start date are required.');
      return;
    }

    await createYearMut.mutateAsync({
      fiscalYearName: fiscalYearForm.fiscalYearName.trim(),
      fiscalYearStartDate: fiscalYearForm.fiscalYearStartDate,
      createMonthsOpen: fiscalYearForm.createMonthsOpen,
    });
  }

  async function submitYearEndClose() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to run year end close.');
      return;
    }

    if (!yearEndForm.fiscalYearStartDate || !yearEndForm.fiscalYearEndDate || !yearEndForm.retainedEarningsLedgerAccountId) {
      setErrorText('Fiscal year start date, fiscal year end date, and retained earnings account are required.');
      return;
    }

    if (yearEndForm.fiscalYearEndDate < yearEndForm.fiscalYearStartDate) {
      setErrorText('Fiscal year end date cannot be earlier than fiscal year start date.');
      return;
    }

    await yearEndCloseMut.mutateAsync({
      fiscalYearStartDate: yearEndForm.fiscalYearStartDate,
      fiscalYearEndDate: yearEndForm.fiscalYearEndDate,
      retainedEarningsLedgerAccountId: yearEndForm.retainedEarningsLedgerAccountId,
      reference: yearEndForm.reference.trim() || null,
      description: yearEndForm.description.trim() || null,
    });
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have permission to view fiscal periods.</div>;
  }

  if (isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading fiscal year setup.</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load fiscal periods.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Fiscal Year Setup</h2>
            <div className="muted">
              {data.count} monthly period(s). {openPeriods.length} open, {closedPeriods.length} closed.
            </div>
          </div>

          {canManage ? (
            <div className="inline-actions">
              <button className="button" onClick={openCreatePeriodModal}>New Manual Period</button>
              <button className="button primary" onClick={openCreateYearModal}>Create Fiscal Year</button>
            </div>
          ) : null}
        </div>

        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="muted">
            Fiscal years are managed annually. Each year contains monthly periods. A checked month is closed and locked against posting.
            Year-end close is available only after all months in the selected fiscal year are closed.
          </div>
        </div>

        {infoText ? <div className="panel" style={{ marginBottom: 12 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      {fiscalYears.length === 0 ? (
        <section className="panel">
          <h2>No Fiscal Year Setup Found</h2>
          <div className="muted">Create a fiscal year to generate the 12 monthly posting periods.</div>
        </section>
      ) : null}

      {fiscalYears.map((year) => {
  const allClosed = year.periods.every((period) => period.status !== 1);
  const closedCount = year.periods.filter((period) => period.status !== 1).length;
  const isExpanded = expandedYearKeys[year.key] === true;

  return (
    <section className="panel" key={year.key}>
      <div className="section-heading">
        <div>
          <h2>{year.key}</h2>
          <div className="muted">
            {fiscalYearRangeLabel(year.periods)} · {closedCount}/{year.periods.length} month(s) closed
          </div>
        </div>

        <div className="inline-actions">
          <button className="button" onClick={() => toggleFiscalYear(year.key)}>
            {isExpanded ? 'Hide Months' : 'View Months'}
          </button>

          {canManage ? (
            <button
              className="button"
              onClick={() => openYearEndModal(year)}
              disabled={!allClosed || yearEndCloseMut.isPending}
            >
              Year End Close
            </button>
          ) : null}
        </div>
      </div>

      {!allClosed ? (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="muted">Close all months before running year-end close.</div>
        </div>
      ) : null}

      {isExpanded ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Closed</th>
                <th>Month</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th style={{ width: 260 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {year.periods.map((item) => {
                const isClosed = item.status !== 1;

                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isClosed}
                        disabled={!canManage || closeMut.isPending || openMut.isPending || yearEndCloseMut.isPending}
                        onChange={(e) => {
                          if (e.target.checked) {
                            closeMut.mutate(item.id);
                          } else {
                            openMut.mutate(item.id);
                          }
                        }}
                      />
                    </td>
                    <td>{item.name}</td>
                    <td>{formatDate(item.startDate)}</td>
                    <td>{formatDate(item.endDate)}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td>
                      {canManage ? (
                        isClosed ? (
                          <button
                            className="button"
                            onClick={() => openMut.mutate(item.id)}
                            disabled={openMut.isPending || yearEndCloseMut.isPending}
                          >
                            Re-open Month
                          </button>
                        ) : (
                          <button
                            className="button"
                            onClick={() => closeMut.mutate(item.id)}
                            disabled={closeMut.isPending || yearEndCloseMut.isPending}
                          >
                            Close Month
                          </button>
                        )
                      ) : (
                        <span className="muted">Read only</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
})}

      {showCreateYear ? (
        <div className="modal-backdrop" onMouseDown={closeCreateYearModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Fiscal Year</h2>
              <button className="button ghost" onClick={closeCreateYearModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="muted">
                This creates 12 monthly fiscal periods under the selected fiscal year. Existing overlapping periods are blocked.
              </div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Fiscal Year Name</label>
                <input className="input" value={fiscalYearForm.fiscalYearName} onChange={(e) => setFiscalYearForm((s) => ({ ...s, fiscalYearName: e.target.value }))} placeholder="e.g. FY 2026" />
              </div>

              <div className="form-row">
                <label>Fiscal Year Start Date</label>
                <input type="date" className="input" value={fiscalYearForm.fiscalYearStartDate} onChange={(e) => setFiscalYearForm((s) => ({ ...s, fiscalYearStartDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>Monthly Period Status</label>
                <select className="select" value={fiscalYearForm.createMonthsOpen ? 'open' : 'closed'} onChange={(e) => setFiscalYearForm((s) => ({ ...s, createMonthsOpen: e.target.value === 'open' }))}>
                  <option value="open">Create all months open</option>
                  <option value="closed">Create all months closed</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeCreateYearModal} disabled={createYearMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitFiscalYear} disabled={createYearMut.isPending}>
                {createYearMut.isPending ? 'Creating Fiscal Year…' : 'Create Fiscal Year'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreatePeriod ? (
        <div className="modal-backdrop" onMouseDown={closeCreatePeriodModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Manual Fiscal Period</h2>
              <button className="button ghost" onClick={closeCreatePeriodModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. Adjustment Period 2026" />
              </div>

              <div className="form-row">
                <label>Start Date</label>
                <input type="date" className="input" value={form.startDate} onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>End Date</label>
                <input type="date" className="input" value={form.endDate} onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>Status on create</label>
                <select className="select" value={form.isOpen ? 'open' : 'closed'} onChange={(e) => setForm((s) => ({ ...s, isOpen: e.target.value === 'open' }))}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeCreatePeriodModal} disabled={createPeriodMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitPeriod} disabled={createPeriodMut.isPending}>
                {createPeriodMut.isPending ? 'Creating…' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showYearEndClose ? (
        <div className="modal-backdrop" onMouseDown={closeYearEndModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Year End Close</h2>
              <button className="button ghost" onClick={closeYearEndModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="muted">
                This posts a closing journal that debits income accounts, credits expense accounts, and transfers net income/loss to retained earnings.
                All months in the selected fiscal year must already be closed.
              </div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Fiscal Year Start Date</label>
                <input type="date" className="input" value={yearEndForm.fiscalYearStartDate} onChange={(e) => setYearEndForm((s) => ({ ...s, fiscalYearStartDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>Fiscal Year End Date</label>
                <input type="date" className="input" value={yearEndForm.fiscalYearEndDate} onChange={(e) => setYearEndForm((s) => ({ ...s, fiscalYearEndDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>Retained Earnings Account</label>
                <select className="select" value={yearEndForm.retainedEarningsLedgerAccountId} onChange={(e) => setYearEndForm((s) => ({ ...s, retainedEarningsLedgerAccountId: e.target.value }))}>
                  <option value="">— Select Equity Account —</option>
                  {retainedEarningsAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{accountLabel(account)}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Reference</label>
                <input className="input" value={yearEndForm.reference} onChange={(e) => setYearEndForm((s) => ({ ...s, reference: e.target.value }))} placeholder="e.g. YEC-20261231" />
              </div>

              <div className="form-row">
                <label>Description</label>
                <input className="input" value={yearEndForm.description} onChange={(e) => setYearEndForm((s) => ({ ...s, description: e.target.value }))} placeholder="Year end close description" />
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeYearEndModal} disabled={yearEndCloseMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitYearEndClose} disabled={yearEndCloseMut.isPending}>
                {yearEndCloseMut.isPending ? 'Running Year End Close…' : 'Run Year End Close'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
