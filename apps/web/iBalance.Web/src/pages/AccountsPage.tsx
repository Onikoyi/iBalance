import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLedgerAccount, getAccounts, type LedgerAccountDto } from './lib/api';

function categoryLabel(value: number) {
  switch (value) {
    case 1: return 'Asset';
    case 2: return 'Liability';
    case 3: return 'Equity';
    case 4: return 'Income';
    case 5: return 'Expense';
    default: return 'Unknown';
  }
}

function normalBalanceLabel(value: number) {
  return value === 1 ? 'Debit' : 'Credit';
}

type FormState = {
  code: string;
  name: string;
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  parentLedgerAccountId: string;
};

const emptyForm: FormState = {
  code: '',
  name: '',
  category: 1,
  normalBalance: 1,
  isHeader: false,
  isPostingAllowed: true,
  parentLedgerAccountId: '',
};

export function AccountsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  const headerAccounts = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((x) => x.isHeader).sort((a, b) => a.code.localeCompare(b.code));
  }, [data?.items]);

  const createMut = useMutation({
    mutationFn: createLedgerAccount,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowCreate(false);
      setForm(emptyForm);
      setErrorText('');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.response?.data?.Message || e?.message || 'Failed to create account.';
      setErrorText(String(msg));
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function openModal() {
    setErrorText('');
    setForm(emptyForm);
    setShowCreate(true);
  }

  function closeModal() {
    if (!createMut.isPending) {
      setShowCreate(false);
      setErrorText('');
    }
  }

  async function submit() {
    setErrorText('');

    if (!form.code.trim() || !form.name.trim()) {
      setErrorText('Code and Name are required.');
      return;
    }

    if (form.isHeader && form.isPostingAllowed) {
      setErrorText('Header accounts cannot allow posting.');
      return;
    }

    await createMut.mutateAsync({
      code: form.code.trim(),
      name: form.name.trim(),
      category: form.category,
      normalBalance: form.normalBalance,
      isHeader: form.isHeader,
      isPostingAllowed: form.isPostingAllowed,
      parentLedgerAccountId: form.parentLedgerAccountId ? form.parentLedgerAccountId : null,
    });
  }

  if (isLoading) {
    return <div className="panel">Loading chart of accounts.</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load chart of accounts.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Chart of Accounts</h2>
          <div className="muted">{data.count} account(s)</div>
        </div>
        <button className="button primary" onClick={openModal}>New Account</button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Normal Balance</th>
              <th>Header</th>
              <th>Posting</th>
              <th>Parent</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: LedgerAccountDto) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{categoryLabel(item.category)}</td>
                <td>{normalBalanceLabel(item.normalBalance)}</td>
                <td>{item.isHeader ? 'Yes' : 'No'}</td>
                <td>{item.isPostingAllowed ? 'Allowed' : 'Blocked'}</td>
                <td>{item.parentCode ? `${item.parentCode} - ${item.parentName}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Ledger Account</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Code</label>
                <input className="input" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="e.g. 1000" />
              </div>

              <div className="form-row">
                <label>Name</label>
                <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Cash" />
              </div>

              <div className="form-row">
                <label>Category</label>
                <select className="select" value={form.category} onChange={(e) => update('category', Number(e.target.value))}>
                  <option value={1}>Asset</option>
                  <option value={2}>Liability</option>
                  <option value={3}>Equity</option>
                  <option value={4}>Income</option>
                  <option value={5}>Expense</option>
                </select>
              </div>

              <div className="form-row">
                <label>Normal Balance</label>
                <select className="select" value={form.normalBalance} onChange={(e) => update('normalBalance', Number(e.target.value))}>
                  <option value={1}>Debit</option>
                  <option value={2}>Credit</option>
                </select>
              </div>

              <div className="form-row">
                <label>Parent (optional — must be header)</label>
                <select className="select" value={form.parentLedgerAccountId} onChange={(e) => update('parentLedgerAccountId', e.target.value)}>
                  <option value="">— None —</option>
                  {headerAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Flags</label>
                <div className="inline-actions">
                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.isHeader}
                      onChange={(e) => {
                        const isHeader = e.target.checked;
                        update('isHeader', isHeader);
                        if (isHeader) update('isPostingAllowed', false);
                      }}
                    />
                    Header account
                  </label>

                  <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={form.isPostingAllowed}
                      disabled={form.isHeader}
                      onChange={(e) => update('isPostingAllowed', e.target.checked)}
                    />
                    Posting allowed
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={createMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}