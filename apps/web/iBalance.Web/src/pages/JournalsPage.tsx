import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createJournalEntry,
  createOpeningBalance,
  getAccounts,
  getDashboardSummary,
  getJournalEntries,
  getTenantReadableError,
  postJournalEntry,
  reverseJournalEntry,
  voidJournalEntry,
  type LedgerAccountDto,
  type JournalEntryDto,
  type JournalLineRequest,
} from '../lib/api';
import {
  canCreateJournals,
  canPostOrReverseJournals,
  canViewFinance,
} from '../lib/auth';

function statusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Voided';
    case 4: return 'Reversed';
    default: return 'Unavailable';
  }
}

function typeLabel(value: number) {
  switch (value) {
    case 1: return 'Journal Entry';
    case 2: return 'Opening Balance';
    case 3: return 'Reversal Entry';
    default: return 'Unavailable';
  }
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type LineForm = {
  ledgerAccountId: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
};

type JournalForm = {
  entryDateUtc: string;
  reference: string;
  description: string;
  lines: LineForm[];
};

const emptyJournalForm: JournalForm = {
  entryDateUtc: '',
  reference: '',
  description: '',
  lines: [
    { ledgerAccountId: '', description: '', debitAmount: '', creditAmount: '' },
    { ledgerAccountId: '', description: '', debitAmount: '', creditAmount: '' },
  ],
};

type ReverseForm = {
  reversalDateUtc: string;
  reference: string;
  description: string;
};

const emptyReverseForm: ReverseForm = {
  reversalDateUtc: '',
  reference: '',
  description: '',
};

function toUtcIsoFromLocalInput(localValue: string): string {
  return new Date(localValue).toISOString();
}

function parseMoney(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function JournalsPage() {
  const qc = useQueryClient();

  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'opening' | 'reverse'>(null);

  const [journalForm, setJournalForm] = useState<JournalForm>(emptyJournalForm);
  const [reverseForm, setReverseForm] = useState<ReverseForm>(emptyReverseForm);
  const [reverseTargetId, setReverseTargetId] = useState('');

  const canView = canViewFinance();
  const canCreate = canCreateJournals();
  const canPostReverse = canPostOrReverseJournals();

  const journalsQ = useQuery({
    queryKey: ['journal-entries'],
    queryFn: getJournalEntries,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const dashboardQ = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    enabled: canView,
  });

  const postingAccounts = useMemo(() => {
    const items = accountsQ.data?.items ?? [];
    return items
      .filter((x: LedgerAccountDto) => x.isActive && !x.isHeader && x.isPostingAllowed)
      .sort((a: LedgerAccountDto, b: LedgerAccountDto) => a.code.localeCompare(b.code));
  }, [accountsQ.data?.items]);

  const journalSummary = useMemo(() => {
    const items = journalsQ.data?.items ?? [];
    return {
      total: items.length,
      drafts: items.filter((x: JournalEntryDto) => x.status === 1).length,
      posted: items.filter((x: JournalEntryDto) => x.status === 2).length,
      reversed: items.filter((x: JournalEntryDto) => x.status === 4).length,
    };
  }, [journalsQ.data?.items]);

  const createJournalMut = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setModal(null);
      setJournalForm(emptyJournalForm);
      setErrorText('');
      setInfoText('The journal entry has been created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the journal entry at this time.'));
      setInfoText('');
    },
  });

  const createOpeningMut = useMutation({
    mutationFn: createOpeningBalance,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setModal(null);
      setJournalForm(emptyJournalForm);
      setErrorText('');
      setInfoText('The opening balance has been created and posted successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the opening balance at this time.'));
      setInfoText('');
    },
  });

  const postMut = useMutation({
    mutationFn: postJournalEntry,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setInfoText('The journal entry has been posted successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not post the journal entry at this time.'));
      setInfoText('');
    },
  });

  const voidMut = useMutation({
    mutationFn: voidJournalEntry,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setInfoText('The draft journal has been voided successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not void the draft journal at this time.'));
      setInfoText('');
    },
  });

  const reverseMut = useMutation({
    mutationFn: async (payload: { id: string; reversalDateUtc: string; reference: string; description: string }) =>
      reverseJournalEntry(payload.id, {
        reversalDateUtc: payload.reversalDateUtc,
        reference: payload.reference,
        description: payload.description,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setModal(null);
      setReverseForm(emptyReverseForm);
      setReverseTargetId('');
      setErrorText('');
      setInfoText('The journal entry has been reversed successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not reverse the journal entry at this time.'));
      setInfoText('');
    },
  });

  const journals = journalsQ.data?.items ?? [];

  const totals = useMemo(() => {
    const debit = journalForm.lines.reduce((s, l) => s + parseMoney(l.debitAmount), 0);
    const credit = journalForm.lines.reduce((s, l) => s + parseMoney(l.creditAmount), 0);
    return { debit, credit };
  }, [journalForm.lines]);

  const hasOpenPeriod = !!dashboardQ.data?.openFiscalPeriod;
  const hasPostingAccounts = postingAccounts.length > 0;

  function openCreate(kind: 'create' | 'opening') {
    if (!canCreate) {
      setErrorText('You currently have view access only for journal information.');
      setInfoText('');
      return;
    }

    setErrorText('');
    setInfoText('');
    setJournalForm(emptyJournalForm);
    setModal(kind);
  }

  function closeModal() {
    const busy = createJournalMut.isPending || createOpeningMut.isPending || reverseMut.isPending;
    if (!busy) {
      setModal(null);
      setErrorText('');
    }
  }

  function setLine(idx: number, patch: Partial<LineForm>) {
    setJournalForm((s) => {
      const next = [...s.lines];
      next[idx] = { ...next[idx], ...patch };
      return { ...s, lines: next };
    });
  }

  function addLine() {
    setJournalForm((s) => ({
      ...s,
      lines: [...s.lines, { ledgerAccountId: '', description: '', debitAmount: '', creditAmount: '' }],
    }));
  }

  function removeLine(idx: number) {
    setJournalForm((s) => {
      if (s.lines.length <= 2) return s;
      return { ...s, lines: s.lines.filter((_, i) => i !== idx) };
    });
  }

  function validateLines(lines: LineForm[]): { ok: boolean; message?: string } {
    if (!lines || lines.length < 2) {
      return { ok: false, message: 'Please enter at least two journal lines.' };
    }

    for (const [i, line] of lines.entries()) {
      if (!line.ledgerAccountId) {
        return { ok: false, message: `Line ${i + 1}: please choose an account.` };
      }

      const d = parseMoney(line.debitAmount);
      const c = parseMoney(line.creditAmount);

      if (d < 0 || c < 0) {
        return { ok: false, message: `Line ${i + 1}: amounts cannot be negative.` };
      }

      if (d === 0 && c === 0) {
        return { ok: false, message: `Line ${i + 1}: enter a debit or a credit amount.` };
      }

      if (d > 0 && c > 0) {
        return { ok: false, message: `Line ${i + 1}: enter either a debit or a credit amount, not both.` };
      }
    }

    const debit = lines.reduce((s, l) => s + parseMoney(l.debitAmount), 0);
    const credit = lines.reduce((s, l) => s + parseMoney(l.creditAmount), 0);

    if (Math.abs(debit - credit) > 0.000001) {
      return {
        ok: false,
        message: `The journal is not balanced. Total debit ${formatAmount(debit)} must equal total credit ${formatAmount(credit)}.`,
      };
    }

    return { ok: true };
  }

  function toLineRequests(lines: LineForm[]): JournalLineRequest[] {
    return lines.map((l) => ({
      ledgerAccountId: l.ledgerAccountId,
      description: l.description?.trim() || '',
      debitAmount: parseMoney(l.debitAmount),
      creditAmount: parseMoney(l.creditAmount),
    }));
  }

  async function submitJournal(kind: 'create' | 'opening') {
    setErrorText('');
    setInfoText('');

    if (!canCreate) {
      setErrorText('You currently have view access only for journal information.');
      return;
    }

    if (!journalForm.entryDateUtc) {
      setErrorText('Please enter the journal date and time.');
      return;
    }

    if (!journalForm.reference.trim()) {
      setErrorText('Please enter a journal reference.');
      return;
    }

    if (!journalForm.description.trim()) {
      setErrorText('Please enter a journal description.');
      return;
    }

    if (kind === 'opening' && !hasOpenPeriod) {
      setErrorText('There is no open fiscal period available for the selected opening balance date.');
      return;
    }

    if (!hasPostingAccounts) {
      setErrorText('No posting accounts are available yet. Please create posting-enabled accounts first.');
      return;
    }

    const validation = validateLines(journalForm.lines);
    if (!validation.ok) {
      setErrorText(validation.message || 'Please review the journal lines and try again.');
      return;
    }

    const payload = {
      entryDateUtc: toUtcIsoFromLocalInput(journalForm.entryDateUtc),
      reference: journalForm.reference.trim(),
      description: journalForm.description.trim(),
      lines: toLineRequests(journalForm.lines),
    };

    if (kind === 'create') {
      await createJournalMut.mutateAsync(payload);
    } else {
      await createOpeningMut.mutateAsync(payload);
    }
  }

  function openReverse(journalEntryId: string) {
    if (!canPostReverse) {
      setErrorText('You do not have access to reverse journal entries.');
      setInfoText('');
      return;
    }

    setErrorText('');
    setInfoText('');
    setReverseTargetId(journalEntryId);
    setReverseForm(emptyReverseForm);
    setModal('reverse');
  }

  async function submitReverse() {
    setErrorText('');
    setInfoText('');

    if (!canPostReverse) {
      setErrorText('You do not have access to reverse journal entries.');
      return;
    }

    if (!reverseTargetId) return;

    if (!reverseForm.reversalDateUtc) {
      setErrorText('Please enter the reversal date and time.');
      return;
    }

    if (!reverseForm.reference.trim()) {
      setErrorText('Please enter a reversal reference.');
      return;
    }

    if (!reverseForm.description.trim()) {
      setErrorText('Please enter a reversal description.');
      return;
    }

    await reverseMut.mutateAsync({
      id: reverseTargetId,
      reversalDateUtc: toUtcIsoFromLocalInput(reverseForm.reversalDateUtc),
      reference: reverseForm.reference.trim(),
      description: reverseForm.description.trim(),
    });
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view journal activity.</div>;
  }

  if (journalsQ.isLoading) {
    return <div className="panel">Loading journal activity...</div>;
  }

  if (journalsQ.error || !journalsQ.data) {
    return <div className="panel error-panel">We could not load journal activity at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Journal overview</h2>
            <div className="muted">Manage journal activity, posting readiness, and balanced entries.</div>
          </div>
        </div>

        <div className="kv">
          <div className="kv-row">
            <span>Total Journals</span>
            <span>{journalSummary.total}</span>
          </div>
          <div className="kv-row">
            <span>Draft Journals</span>
            <span>{journalSummary.drafts}</span>
          </div>
          <div className="kv-row">
            <span>Posted Journals</span>
            <span>{journalSummary.posted}</span>
          </div>
          <div className="kv-row">
            <span>Reversed Journals</span>
            <span>{journalSummary.reversed}</span>
          </div>
          <div className="kv-row">
            <span>Current Fiscal Period</span>
            <span>{hasOpenPeriod ? dashboardQ.data?.openFiscalPeriod?.name : 'No open period available'}</span>
          </div>
          <div className="kv-row">
            <span>Posting Accounts</span>
            <span>{hasPostingAccounts ? `${postingAccounts.length} available` : 'Not yet available'}</span>
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: 16 }}>
          {canCreate ? (
            <>
              <button className="button primary" onClick={() => openCreate('create')}>New Journal</button>
              <button className="button" onClick={() => openCreate('opening')}>Opening Balance</button>
            </>
          ) : null}
        </div>

        {!canCreate && !canPostReverse ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">You currently have read-only access to journal information.</div>
          </div>
        ) : null}

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
        <div className="section-heading">
          <h2>Journal register</h2>
          <span className="muted">{journalsQ.data.count} journal(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th style={{ width: 320 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((item: JournalEntryDto) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.entryDateUtc)}</td>
                  <td>{item.reference}</td>
                  <td>{item.description}</td>
                  <td>{typeLabel(item.type)}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(Number(item.totalDebit))}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(Number(item.totalCredit))}</td>
                  <td>
                    <div className="inline-actions">
                      {item.status === 1 && canPostReverse ? (
                        <button className="button" onClick={() => postMut.mutate(item.id)} disabled={postMut.isPending}>
                          Post
                        </button>
                      ) : null}

                      {item.status === 1 && canCreate ? (
                        <button className="button danger" onClick={() => voidMut.mutate(item.id)} disabled={voidMut.isPending}>
                          Void
                        </button>
                      ) : null}

                      {item.status === 2 && canPostReverse ? (
                        <button className="button" onClick={() => openReverse(item.id)}>
                          Reverse
                        </button>
                      ) : null}

                      <span className="muted">Lines: {item.lineCount}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal === 'create' || modal === 'opening' ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'opening' ? 'Create Opening Balance' : 'Create Journal Entry'}</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="panel error-panel" style={{ marginBottom: 12 }}>{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Date and Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={journalForm.entryDateUtc}
                  onChange={(e) => setJournalForm((s) => ({ ...s, entryDateUtc: e.target.value }))}
                />
              </div>

              <div className="form-row">
                <label>Reference</label>
                <input
                  className="input"
                  value={journalForm.reference}
                  onChange={(e) => setJournalForm((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="Enter reference"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="input"
                  value={journalForm.description}
                  onChange={(e) => setJournalForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Enter a clear description"
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="section-heading" style={{ marginBottom: 10 }}>
                <h2 style={{ fontSize: 18 }}>Journal lines</h2>
                <div className="inline-actions">
                  <span className="muted">
                    Debit {formatAmount(totals.debit)} / Credit {formatAmount(totals.credit)}
                  </span>
                  <button className="button" onClick={addLine}>Add Line</button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 340 }}>Account</th>
                      <th>Description</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Debit</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Credit</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {journalForm.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            className="select"
                            value={line.ledgerAccountId}
                            onChange={(e) => setLine(idx, { ledgerAccountId: e.target.value })}
                          >
                            <option value="">— Select Account —</option>
                            {postingAccounts.map((a: LedgerAccountDto) => (
                              <option key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="input"
                            value={line.description}
                            onChange={(e) => setLine(idx, { description: e.target.value })}
                            placeholder="Optional description"
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="decimal"
                            value={line.debitAmount}
                            onChange={(e) => setLine(idx, {
                              debitAmount: e.target.value,
                              creditAmount: e.target.value ? '' : line.creditAmount,
                            })}
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="decimal"
                            value={line.creditAmount}
                            onChange={(e) => setLine(idx, {
                              creditAmount: e.target.value,
                              debitAmount: e.target.value ? '' : line.debitAmount,
                            })}
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <button className="button danger" onClick={() => removeLine(idx)} disabled={journalForm.lines.length <= 2}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!hasPostingAccounts ? (
                <div className="panel error-panel" style={{ marginTop: 10 }}>
                  No posting accounts are currently available.
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={createJournalMut.isPending || createOpeningMut.isPending}>
                Cancel
              </button>
              <button
                className="button primary"
                onClick={() => submitJournal(modal === 'opening' ? 'opening' : 'create')}
                disabled={createJournalMut.isPending || createOpeningMut.isPending}
              >
                {createJournalMut.isPending || createOpeningMut.isPending
                  ? 'Saving…'
                  : modal === 'opening'
                    ? 'Create Opening Balance'
                    : 'Create Journal'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal === 'reverse' ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reverse Journal Entry</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="panel error-panel" style={{ marginBottom: 12 }}>{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Reversal Date and Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={reverseForm.reversalDateUtc}
                  onChange={(e) => setReverseForm((s) => ({ ...s, reversalDateUtc: e.target.value }))}
                />
              </div>

              <div className="form-row">
                <label>Reference</label>
                <input
                  className="input"
                  value={reverseForm.reference}
                  onChange={(e) => setReverseForm((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="Enter reversal reference"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="input"
                  value={reverseForm.description}
                  onChange={(e) => setReverseForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Enter reversal description"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={reverseMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitReverse} disabled={reverseMut.isPending}>
                {reverseMut.isPending ? 'Processing…' : 'Reverse Journal'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}