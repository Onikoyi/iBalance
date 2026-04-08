import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createJournalEntry,
  createOpeningBalance,
  getAccounts,
  getJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  voidJournalEntry,
  type LedgerAccountDto,
  type JournalEntryDto,
  type JournalLineRequest,
} from './lib/api';

function statusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Voided';
    case 4: return 'Reversed';
    default: return 'Unknown';
  }
}

function typeLabel(value: number) {
  switch (value) {
    case 1: return 'Normal';
    case 2: return 'Opening Balance';
    default: return 'Unknown';
  }
}

type LineForm = {
  ledgerAccountId: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
};

type JournalForm = {
  entryDateUtc: string; // datetime-local
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
  reversalDateUtc: string; // datetime-local
  reference: string;
  description: string;
};

const emptyReverseForm: ReverseForm = {
  reversalDateUtc: '',
  reference: '',
  description: '',
};

function toUtcIsoFromLocalInput(localValue: string): string {
  // datetime-local => Date => ISO (UTC)
  const d = new Date(localValue);
  return d.toISOString();
}

function parseMoney(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return n;
}

export function JournalsPage() {
  const qc = useQueryClient();

  const [errorText, setErrorText] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'opening' | 'reverse'>(null);

  const [journalForm, setJournalForm] = useState<JournalForm>(emptyJournalForm);
  const [reverseForm, setReverseForm] = useState<ReverseForm>(emptyReverseForm);
  const [reverseTargetId, setReverseTargetId] = useState<string>('');

  const journalsQ = useQuery({
    queryKey: ['journal-entries'],
    queryFn: getJournalEntries,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const accountsById = useMemo(() => {
    const map = new Map<string, LedgerAccountDto>();
    (accountsQ.data?.items ?? []).forEach((a) => map.set(a.id, a));
    return map;
  }, [accountsQ.data?.items]);

  const postingAccounts = useMemo(() => {
    const items = accountsQ.data?.items ?? [];
    return items
      .filter((x) => x.isActive && !x.isHeader && x.isPostingAllowed)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accountsQ.data?.items]);

  const createJournalMut = useMutation({
    mutationFn: createJournalEntry,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setModal(null);
      setJournalForm(emptyJournalForm);
      setErrorText('');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.response?.data?.Message || e?.message || 'Failed to create journal entry.';
      setErrorText(String(msg));
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
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.response?.data?.Message || e?.message || 'Failed to create opening balance.';
      setErrorText(String(msg));
    },
  });

  const postMut = useMutation({
    mutationFn: postJournalEntry,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const voidMut = useMutation({
    mutationFn: voidJournalEntry,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['journal-entries'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
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
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.response?.data?.Message || e?.message || 'Failed to reverse journal entry.';
      setErrorText(String(msg));
    },
  });

  const journals = journalsQ.data?.items ?? [];

  const totals = useMemo(() => {
    const debit = journalForm.lines.reduce((s, l) => s + parseMoney(l.debitAmount), 0);
    const credit = journalForm.lines.reduce((s, l) => s + parseMoney(l.creditAmount), 0);
    return { debit, credit };
  }, [journalForm.lines]);

  function openCreate(kind: 'create' | 'opening') {
    setErrorText('');
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
      const next = s.lines.filter((_, i) => i !== idx);
      return { ...s, lines: next };
    });
  }

  function validateLines(lines: LineForm[]): { ok: boolean; message?: string } {
    if (!lines || lines.length < 2) return { ok: false, message: 'A journal must contain at least two lines.' };

    for (const [i, line] of lines.entries()) {
      if (!line.ledgerAccountId) return { ok: false, message: `Line ${i + 1}: ledger account is required.` };

      const d = parseMoney(line.debitAmount);
      const c = parseMoney(line.creditAmount);

      if (d < 0 || c < 0) return { ok: false, message: `Line ${i + 1}: amounts cannot be negative.` };
      if (d === 0 && c === 0) return { ok: false, message: `Line ${i + 1}: either debit or credit must be > 0.` };
      if (d > 0 && c > 0) return { ok: false, message: `Line ${i + 1}: cannot have both debit and credit.` };
    }

    const debit = lines.reduce((s, l) => s + parseMoney(l.debitAmount), 0);
    const credit = lines.reduce((s, l) => s + parseMoney(l.creditAmount), 0);

    if (Math.abs(debit - credit) > 0.000001) {
      return { ok: false, message: `Journal is out of balance (debit ${debit.toFixed(2)} vs credit ${credit.toFixed(2)}).` };
    }

    return { ok: true };
  }

  function toLineRequests(lines: LineForm[]): JournalLineRequest[] {
    return lines.map((l) => ({
      ledgerAccountId: l.ledgerAccountId,
      description: l.description?.trim() ? l.description.trim() : null,
      debitAmount: parseMoney(l.debitAmount),
      creditAmount: parseMoney(l.creditAmount),
    }));
  }

  async function submitJournal(kind: 'create' | 'opening') {
    setErrorText('');

    if (!journalForm.entryDateUtc) {
      setErrorText('Entry date/time is required.');
      return;
    }
    if (!journalForm.description.trim()) {
      setErrorText('Description is required.');
      return;
    }

    const validation = validateLines(journalForm.lines);
    if (!validation.ok) {
      setErrorText(validation.message || 'Invalid lines.');
      return;
    }

    const payload = {
      entryDateUtc: toUtcIsoFromLocalInput(journalForm.entryDateUtc),
      reference: journalForm.reference.trim() ? journalForm.reference.trim() : null,
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
    setErrorText('');
    setReverseTargetId(journalEntryId);
    setReverseForm(emptyReverseForm);
    setModal('reverse');
  }

  async function submitReverse() {
    setErrorText('');
    if (!reverseTargetId) return;

    if (!reverseForm.reversalDateUtc) {
      setErrorText('Reversal date/time is required.');
      return;
    }
    if (!reverseForm.reference.trim()) {
      setErrorText('Reference is required for reversal.');
      return;
    }
    if (!reverseForm.description.trim()) {
      setErrorText('Description is required for reversal.');
      return;
    }

    await reverseMut.mutateAsync({
      id: reverseTargetId,
      reversalDateUtc: toUtcIsoFromLocalInput(reverseForm.reversalDateUtc),
      reference: reverseForm.reference.trim(),
      description: reverseForm.description.trim(),
    });
  }

  if (journalsQ.isLoading) {
    return <div className="panel">Loading journal entries.</div>;
  }

  if (journalsQ.error || !journalsQ.data) {
    return <div className="panel error-panel">Unable to load journal entries.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Journal Entries</h2>
          <div className="muted">{journalsQ.data.count} journal(s)</div>
        </div>

        <div className="inline-actions">
          <button className="button primary" onClick={() => openCreate('create')}>New Journal</button>
          <button className="button" onClick={() => openCreate('opening')}>Opening Balance</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date (UTC)</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Type</th>
              <th>Status</th>
              <th>Debit</th>
              <th>Credit</th>
              <th style={{ width: 320 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {journals.map((item: JournalEntryDto) => (
              <tr key={item.id}>
                <td>{new Date(item.entryDateUtc).toLocaleString()}</td>
                <td>{item.reference}</td>
                <td>{item.description}</td>
                <td>{typeLabel(item.type)}</td>
                <td>{statusLabel(item.status)}</td>
                <td>{Number(item.totalDebit).toFixed(2)}</td>
                <td>{Number(item.totalCredit).toFixed(2)}</td>
                <td>
                  <div className="table-actions">
                    {item.status === 1 ? (
                      <>
                        <button className="button" onClick={() => postMut.mutate(item.id)} disabled={postMut.isPending}>
                          Post
                        </button>
                        <button className="button danger" onClick={() => voidMut.mutate(item.id)} disabled={voidMut.isPending}>
                          Void
                        </button>
                      </>
                    ) : null}

                    {item.status === 2 ? (
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

      {modal === 'create' || modal === 'opening' ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{modal === 'opening' ? 'Create Opening Balance' : 'Create Journal Entry'}</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Entry Date/Time</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={journalForm.entryDateUtc}
                  onChange={(e) => setJournalForm((s) => ({ ...s, entryDateUtc: e.target.value }))}
                />
                <div className="muted">Saved as UTC ISO for the API.</div>
              </div>

              <div className="form-row">
                <label>Reference (optional if sequence exists)</label>
                <input
                  className="input"
                  value={journalForm.reference}
                  onChange={(e) => setJournalForm((s) => ({ ...s, reference: e.target.value }))}
                  placeholder="Leave blank to auto-number if active sequence exists"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="input"
                  value={journalForm.description}
                  onChange={(e) => setJournalForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="e.g. April rent accrual"
                />
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="section-heading" style={{ marginBottom: 10 }}>
                <h2 style={{ fontSize: 18 }}>Lines</h2>
                <div className="inline-actions">
                  <span className="muted">Debit {totals.debit.toFixed(2)} / Credit {totals.credit.toFixed(2)}</span>
                  <button className="button" onClick={addLine}>Add line</button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 340 }}>Account</th>
                      <th>Description</th>
                      <th style={{ width: 140 }}>Debit</th>
                      <th style={{ width: 140 }}>Credit</th>
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
                            <option value="">— Select —</option>
                            {postingAccounts.map((a) => (
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
                            placeholder="Optional"
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="decimal"
                            value={line.debitAmount}
                            onChange={(e) => {
                              // enforce either debit or credit
                              setLine(idx, { debitAmount: e.target.value, creditAmount: e.target.value ? '' : line.creditAmount });
                            }}
                            placeholder="0.00"
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            inputMode="decimal"
                            value={line.creditAmount}
                            onChange={(e) => {
                              setLine(idx, { creditAmount: e.target.value, debitAmount: e.target.value ? '' : line.debitAmount });
                            }}
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

              {accountsQ.isLoading ? (
                <div className="muted" style={{ marginTop: 10 }}>Loading accounts…</div>
              ) : null}

              {accountsQ.data && postingAccounts.length === 0 ? (
                <div className="error-panel" style={{ marginTop: 10 }}>
                  No posting-enabled accounts found. Create posting accounts first.
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
                    ? 'Create & Post Opening Balance'
                    : 'Create Draft Journal'}
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

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Reversal Date/Time</label>
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
                  placeholder="Required"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="input"
                  value={reverseForm.description}
                  onChange={(e) => setReverseForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Required"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={reverseMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submitReverse} disabled={reverseMut.isPending}>
                {reverseMut.isPending ? 'Reversing…' : 'Reverse'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}