import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAccounts,
  getRejectedJournalEntries,
  getTenantReadableError,
  submitJournalEntryForApproval,
  updateJournalEntry,
  voidJournalEntry,
  type JournalEntryDto,
  type JournalLineRequest,
  type LedgerAccountDto,
  type UpdateJournalEntryRequest,
} from '../lib/api';
import { canCreateJournals, canViewFinance } from '../lib/auth';

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

function statusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Submitted for Approval';
    case 3: return 'Approved';
    case 4: return 'Rejected';
    case 5: return 'Posted';
    case 6: return 'Voided';
    case 7: return 'Reversed';
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

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return 'Not available';

  return parsed.toLocaleString();
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function parseMoney(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toUtcIsoFromLocalInput(localValue: string): string {
  return new Date(localValue).toISOString();
}

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return '';

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return '';

  const offsetMs = parsed.getTimezoneOffset() * 60_000;
  const local = new Date(parsed.getTime() - offsetMs);

  return local.toISOString().slice(0, 16);
}

function actorName(value?: string | null, displayName?: string | null) {
  return displayName || value || '—';
}

export function RejectedJournalEntriesPage() {
  const qc = useQueryClient();

  const canView = canViewFinance();
  const canCreate = canCreateJournals();

  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [search, setSearch] = useState('');
  const [selectedJournal, setSelectedJournal] = useState<JournalEntryDto | null>(null);
  const [detailJournal, setDetailJournal] = useState<JournalEntryDto | null>(null);
  const [form, setForm] = useState<JournalForm>(emptyJournalForm);

  const rejectedJournalsQ = useQuery({
    queryKey: ['rejected-journal-entries'],
    queryFn: getRejectedJournalEntries,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const postingAccounts = useMemo(() => {
    const items = accountsQ.data?.items ?? [];

    return items
      .filter((x: LedgerAccountDto) => x.isActive && !x.isHeader && x.isPostingAllowed)
      .sort((a: LedgerAccountDto, b: LedgerAccountDto) => a.code.localeCompare(b.code));
  }, [accountsQ.data?.items]);

  const accountMap = useMemo(() => {
    return new Map((accountsQ.data?.items || []).map((account) => [account.id, account]));
  }, [accountsQ.data?.items]);

  const filteredJournals = useMemo(() => {
    const items = rejectedJournalsQ.data?.items || [];
    const text = search.trim().toLowerCase();

    if (!text) return items;

    return items.filter((journal) => {
      return (
        journal.reference.toLowerCase().includes(text) ||
        journal.description.toLowerCase().includes(text) ||
        (journal.rejectionReason || '').toLowerCase().includes(text) ||
        typeLabel(journal.type).toLowerCase().includes(text)
      );
    });
  }, [rejectedJournalsQ.data?.items, search]);

  const formTotals = useMemo(() => {
    return {
      debit: form.lines.reduce((sum, line) => sum + parseMoney(line.debitAmount), 0),
      credit: form.lines.reduce((sum, line) => sum + parseMoney(line.creditAmount), 0),
    };
  }, [form.lines]);

  async function refreshAll() {
    await qc.invalidateQueries({ queryKey: ['journal-entries'] });
    await qc.invalidateQueries({ queryKey: ['rejected-journal-entries'] });
    await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  }

  const updateMut = useMutation({
    mutationFn: (payload: { journalEntryId: string; request: UpdateJournalEntryRequest }) =>
      updateJournalEntry(payload.journalEntryId, payload.request),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('Rejected journal correction saved successfully. You can now resubmit it for approval.');
      setErrorText('');
      setSelectedJournal(null);
      setForm(emptyJournalForm);
    },
    onError: (error) => {
      setInfoText('');
      setErrorText(getTenantReadableError(error, 'Unable to save rejected journal correction.'));
    },
  });

  const submitMut = useMutation({
    mutationFn: (journalEntryId: string) => submitJournalEntryForApproval(journalEntryId),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('Rejected journal resubmitted for approval successfully.');
      setErrorText('');
    },
    onError: (error) => {
      setInfoText('');
      setErrorText(getTenantReadableError(error, 'Unable to resubmit rejected journal.'));
    },
  });

  const voidMut = useMutation({
    mutationFn: (journalEntryId: string) => voidJournalEntry(journalEntryId),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('Rejected journal voided successfully.');
      setErrorText('');
    },
    onError: (error) => {
      setInfoText('');
      setErrorText(getTenantReadableError(error, 'Unable to void rejected journal.'));
    },
  });

  function updateForm<K extends keyof JournalForm>(key: K, value: JournalForm[K]) {
    setForm((state) => ({ ...state, [key]: value }));
  }

  function updateLine(index: number, key: keyof LineForm, value: string) {
    setForm((state) => {
      const lines = [...state.lines];
      lines[index] = { ...lines[index], [key]: value };
      return { ...state, lines };
    });
  }

  function addLine() {
    setForm((state) => ({
      ...state,
      lines: [
        ...state.lines,
        { ledgerAccountId: '', description: '', debitAmount: '', creditAmount: '' },
      ],
    }));
  }

  function removeLine(index: number) {
    setForm((state) => ({
      ...state,
      lines: state.lines.filter((_, i) => i !== index),
    }));
  }

  function openEdit(journal: JournalEntryDto) {
    if (!canCreate) {
      setErrorText('You do not have permission to edit rejected journals.');
      setInfoText('');
      return;
    }

    setSelectedJournal(journal);
    setDetailJournal(null);
    setForm({
      entryDateUtc: toLocalDateTimeInput(journal.entryDateUtc),
      reference: journal.reference,
      description: journal.description,
      lines: journal.lines.length > 0
        ? journal.lines.map((line) => ({
            ledgerAccountId: line.ledgerAccountId,
            description: line.description || '',
            debitAmount: line.debitAmount ? String(line.debitAmount) : '',
            creditAmount: line.creditAmount ? String(line.creditAmount) : '',
          }))
        : emptyJournalForm.lines,
    });

    setErrorText('');
    setInfoText('');
  }

  function closeEdit() {
    if (updateMut.isPending) return;

    setSelectedJournal(null);
    setForm(emptyJournalForm);
    setErrorText('');
    setInfoText('');
  }

  function validateLines(lines: LineForm[]) {
    if (lines.length < 2) {
      return { ok: false, message: 'A journal entry must contain at least two lines.' };
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const debit = parseMoney(line.debitAmount);
      const credit = parseMoney(line.creditAmount);

      if (!line.ledgerAccountId) {
        return { ok: false, message: `Line ${i + 1}: please select a ledger account.` };
      }

      if (!line.description.trim()) {
        return { ok: false, message: `Line ${i + 1}: description is required.` };
      }

      if (debit < 0 || credit < 0) {
        return { ok: false, message: `Line ${i + 1}: amounts cannot be negative.` };
      }

      if (debit === 0 && credit === 0) {
        return { ok: false, message: `Line ${i + 1}: enter a debit or credit amount.` };
      }

      if (debit > 0 && credit > 0) {
        return { ok: false, message: `Line ${i + 1}: enter either debit or credit, not both.` };
      }
    }

    const totalDebit = lines.reduce((sum, line) => sum + parseMoney(line.debitAmount), 0);
    const totalCredit = lines.reduce((sum, line) => sum + parseMoney(line.creditAmount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.000001) {
      return {
        ok: false,
        message: `The journal is not balanced. Total debit ${formatAmount(totalDebit)} must equal total credit ${formatAmount(totalCredit)}.`,
      };
    }

    return { ok: true, message: '' };
  }

  function toLineRequests(lines: LineForm[]): JournalLineRequest[] {
    return lines.map((line) => ({
      ledgerAccountId: line.ledgerAccountId,
      description: line.description.trim(),
      debitAmount: parseMoney(line.debitAmount),
      creditAmount: parseMoney(line.creditAmount),
    }));
  }

  function saveCorrection() {
    setErrorText('');
    setInfoText('');

    if (!selectedJournal) {
      setErrorText('Please select a rejected journal to edit.');
      return;
    }

    if (!canCreate) {
      setErrorText('You do not have permission to edit rejected journals.');
      return;
    }

    if (!form.entryDateUtc) {
      setErrorText('Journal date is required.');
      return;
    }

    if (!form.reference.trim()) {
      setErrorText('Journal reference is required.');
      return;
    }

    if (!form.description.trim()) {
      setErrorText('Journal description is required.');
      return;
    }

    const validation = validateLines(form.lines);

    if (!validation.ok) {
      setErrorText(validation.message || 'Please review the journal lines.');
      return;
    }

    updateMut.mutate({
      journalEntryId: selectedJournal.id,
      request: {
        entryDateUtc: toUtcIsoFromLocalInput(form.entryDateUtc),
        reference: form.reference.trim(),
        description: form.description.trim(),
        lines: toLineRequests(form.lines),
      },
    });
  }

  function resubmitJournal(journal: JournalEntryDto) {
    setErrorText('');
    setInfoText('');

    if (!canCreate) {
      setErrorText('You do not have permission to resubmit rejected journals.');
      return;
    }

    submitMut.mutate(journal.id);
  }

  function voidRejectedJournal(journal: JournalEntryDto) {
    setErrorText('');
    setInfoText('');

    if (!canCreate) {
      setErrorText('You do not have permission to void rejected journals.');
      return;
    }

    const confirmed = window.confirm(
      `Void rejected journal ${journal.reference}? This keeps the audit trail but removes it from active processing.`
    );

    if (!confirmed) return;

    voidMut.mutate(journal.id);
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view rejected journals.</div>;
  }

  if (rejectedJournalsQ.isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading rejected journals...</div>;
  }

  if (rejectedJournalsQ.isError || accountsQ.isError || !rejectedJournalsQ.data || !accountsQ.data) {
    return <div className="panel error-panel">We could not load rejected journals at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Rejected Journal Entries</h2>
            <div className="muted">
              Correct rejected journals, view details, resubmit them for approval, or void them if no longer needed.
            </div>
          </div>

          <div className="inline-actions">
            <Link to="/journals" className="button">Back to Journals</Link>
          </div>
        </div>

        {errorText ? <div className="error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}
        {infoText ? <div className="panel" style={{ marginBottom: 16 }}>{infoText}</div> : null}

        <div className="form-row" style={{ marginBottom: 16 }}>
          <label>Search</label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Reference, description, rejection reason, type"
          />
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Status</th>
                <th>Rejected By</th>
                <th>Rejected On</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Debit</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredJournals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="muted">No rejected journals found.</td>
                </tr>
              ) : (
                filteredJournals.map((journal) => (
                  <tr key={journal.id}>
                    <td>{journal.reference}</td>
                    <td>{formatDateTime(journal.entryDateUtc)}</td>
                    <td>{journal.description}</td>
                    <td>{typeLabel(journal.type)}</td>
                    <td>{statusLabel(journal.status)}</td>
                    <td>{actorName(journal.rejectedBy, journal.rejectedByDisplayName)}</td>
                    <td>{formatDateTime(journal.rejectedOnUtc)}</td>
                    <td>{journal.rejectionReason || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(journal.totalDebit)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(journal.totalCredit)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="button" onClick={() => setDetailJournal(journal)}>
                          View
                        </button>

                        <button className="button" onClick={() => openEdit(journal)} disabled={!canCreate}>
                          Edit
                        </button>

                        <button
                          className="button"
                          onClick={() => resubmitJournal(journal)}
                          disabled={submitMut.isPending || !canCreate}
                        >
                          {submitMut.isPending ? 'Submitting…' : 'Resubmit'}
                        </button>

                        <button
                          className="button danger"
                          onClick={() => voidRejectedJournal(journal)}
                          disabled={voidMut.isPending || !canCreate}
                        >
                          {voidMut.isPending ? 'Voiding…' : 'Void'}
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

      {detailJournal ? (
        <div className="modal-backdrop" onMouseDown={() => setDetailJournal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Journal Detail</h2>
              <button className="button ghost" onClick={() => setDetailJournal(null)} aria-label="Close">✕</button>
            </div>

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row"><span>Reference</span><span>{detailJournal.reference}</span></div>
              <div className="kv-row"><span>Description</span><span>{detailJournal.description}</span></div>
              <div className="kv-row"><span>Date</span><span>{formatDateTime(detailJournal.entryDateUtc)}</span></div>
              <div className="kv-row"><span>Type</span><span>{typeLabel(detailJournal.type)}</span></div>
              <div className="kv-row"><span>Status</span><span>{statusLabel(detailJournal.status)}</span></div>
              <div className="kv-row"><span>Submitted By</span><span>{actorName(detailJournal.submittedBy, detailJournal.submittedByDisplayName)}</span></div>
              <div className="kv-row"><span>Submitted On</span><span>{formatDateTime(detailJournal.submittedOnUtc)}</span></div>
              <div className="kv-row"><span>Approved By</span><span>{actorName(detailJournal.approvedBy, detailJournal.approvedByDisplayName)}</span></div>
              <div className="kv-row"><span>Approved On</span><span>{formatDateTime(detailJournal.approvedOnUtc)}</span></div>
              <div className="kv-row"><span>Rejected By</span><span>{actorName(detailJournal.rejectedBy, detailJournal.rejectedByDisplayName)}</span></div>
              <div className="kv-row"><span>Rejected On</span><span>{formatDateTime(detailJournal.rejectedOnUtc)}</span></div>
              <div className="kv-row"><span>Rejection Reason</span><span>{detailJournal.rejectionReason || '—'}</span></div>
              <div className="kv-row"><span>Total Debit</span><span>{formatAmount(detailJournal.totalDebit)}</span></div>
              <div className="kv-row"><span>Total Credit</span><span>{formatAmount(detailJournal.totalCredit)}</span></div>
            </div>

            <JournalLinesTable journal={detailJournal} accountMap={accountMap} />

            <div className="modal-footer">
              <button className="button" onClick={() => setDetailJournal(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedJournal ? (
        <div className="modal-backdrop" onMouseDown={closeEdit}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Rejected Journal</h2>
              <button className="button ghost" onClick={closeEdit} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}
            {infoText ? <div className="panel" style={{ marginBottom: 16 }}>{infoText}</div> : null}

            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row"><span>Current Status</span><span>{statusLabel(selectedJournal.status)}</span></div>
              <div className="kv-row"><span>Rejected By</span><span>{actorName(selectedJournal.rejectedBy, selectedJournal.rejectedByDisplayName)}</span></div>
              <div className="kv-row"><span>Rejected On</span><span>{formatDateTime(selectedJournal.rejectedOnUtc)}</span></div>
              <div className="kv-row"><span>Reason</span><span>{selectedJournal.rejectionReason || '—'}</span></div>
            </div>

            <div className="form-grid two">
              <div className="form-row">
                <label>Entry Date</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.entryDateUtc}
                  onChange={(e) => updateForm('entryDateUtc', e.target.value)}
                />
              </div>

              <div className="form-row">
                <label>Reference</label>
                <input
                  className="input"
                  value={form.reference}
                  onChange={(e) => updateForm('reference', e.target.value)}
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                />
              </div>
            </div>

            <div className="section-heading" style={{ marginTop: 18 }}>
              <h2>Journal Lines</h2>
              <button className="button" onClick={addLine}>Add Line</button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ledger Account</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
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
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          value={line.debitAmount}
                          onChange={(e) => updateLine(index, 'debitAmount', e.target.value)}
                        />
                      </td>

                      <td>
                        <input
                          className="input"
                          type="number"
                          value={line.creditAmount}
                          onChange={(e) => updateLine(index, 'creditAmount', e.target.value)}
                        />
                      </td>

                      <td>
                        <button
                          className="button"
                          disabled={form.lines.length <= 2}
                          onClick={() => removeLine(index)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr>
                    <th colSpan={2}>Total</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(formTotals.debit)}</th>
                    <th style={{ textAlign: 'right' }}>{formatAmount(formTotals.credit)}</th>
                    <th>{Math.abs(formTotals.debit - formTotals.credit) < 0.000001 ? 'Balanced' : 'Not Balanced'}</th>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeEdit} disabled={updateMut.isPending}>
                Cancel
              </button>

              <button className="button primary" onClick={saveCorrection} disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Saving…' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JournalLinesTable({
  journal,
  accountMap,
}: {
  journal: JournalEntryDto;
  accountMap: Map<string, LedgerAccountDto>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ledger Account</th>
            <th>Description</th>
            <th style={{ textAlign: 'right' }}>Debit</th>
            <th style={{ textAlign: 'right' }}>Credit</th>
          </tr>
        </thead>

        <tbody>
          {journal.lines.map((line) => {
            const account = accountMap.get(line.ledgerAccountId);

            return (
              <tr key={line.id}>
                <td>
                  {account ? `${account.code} - ${account.name}` : line.ledgerAccountId}
                </td>
                <td>{line.description}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <th colSpan={2}>Total</th>
            <th style={{ textAlign: 'right' }}>{formatAmount(journal.totalDebit)}</th>
            <th style={{ textAlign: 'right' }}>{formatAmount(journal.totalCredit)}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}