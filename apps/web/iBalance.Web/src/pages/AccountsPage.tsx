import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createLedgerAccount, getAccounts, getTenantReadableError, type LedgerAccountDto } from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

function categoryLabel(value: number) {
  switch (value) {
    case 1: return 'Asset';
    case 2: return 'Liability';
    case 3: return 'Equity';
    case 4: return 'Income';
    case 5: return 'Expense';
    default: return 'Unclassified';
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

type UploadRow = {
  code: string;
  name: string;
  category: number;
  normalBalance: number;
  isHeader: boolean;
  isPostingAllowed: boolean;
  parentCode: string;
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

function csvEscape(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === '1';
}

function parseCategory(value: string) {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'asset': return 1;
    case 'liability': return 2;
    case 'equity': return 3;
    case 'income': return 4;
    case 'expense': return 5;
    default: return 0;
  }
}

function parseNormalBalance(value: string) {
  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'debit': return 1;
    case 'credit': return 2;
    default: return 0;
  }
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result.map((x) => x.trim());
}

function buildTemplateCsv() {
  const headers = [
    'Code',
    'Name',
    'Category',
    'NormalBalance',
    'IsHeader',
    'IsPostingAllowed',
    'ParentCode',
  ];

  const rows = [
    ['1000', 'Assets', 'Asset', 'Debit', 'true', 'false', ''],
    ['1010', 'Cash and Cash Equivalents', 'Asset', 'Debit', 'false', 'true', '1000'],
    ['2000', 'Liabilities', 'Liability', 'Credit', 'true', 'false', ''],
    ['2010', 'Trade Payables', 'Liability', 'Credit', 'false', 'true', '2000'],
    ['4000', 'Revenue', 'Income', 'Credit', 'false', 'true', ''],
    ['5000', 'Operating Expenses', 'Expense', 'Debit', 'true', 'false', ''],
  ];

  return [headers, ...rows]
    .map((row) => row.map((cell) => csvEscape(String(cell))).join(','))
    .join('\n');
}

function formatStatus(value: boolean, positiveLabel: string, negativeLabel: string) {
  return value ? positiveLabel : negativeLabel;
}

export function AccountsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isUploading, setIsUploading] = useState(false);

  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const headerAccounts = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((x) => x.isHeader).sort((a, b) => a.code.localeCompare(b.code));
  }, [data?.items]);

  const accountSummary = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: items.length,
      active: items.filter((x) => x.isActive).length,
      posting: items.filter((x) => x.isPostingAllowed && !x.isHeader).length,
      headers: items.filter((x) => x.isHeader).length,
    };
  }, [data?.items]);

  const createMut = useMutation({
    mutationFn: createLedgerAccount,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['accounts'] });
      setShowCreate(false);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('The account has been created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the account at this time.'));
      setInfoText('');
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function openModal() {
    if (!canManage) {
      setErrorText('You have view access only on this page.');
      setInfoText('');
      return;
    }

    setErrorText('');
    setInfoText('');
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
    setInfoText('');

    if (!canManage) {
      setErrorText('You have view access only on this page.');
      return;
    }

    if (!form.code.trim() || !form.name.trim()) {
      setErrorText('Please enter both the account code and account name.');
      return;
    }

    if (form.isHeader && form.isPostingAllowed) {
      setErrorText('A header account cannot be set as posting-enabled.');
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

  function downloadTemplate() {
    const content = buildTemplateCsv();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'ibalance-chart-of-accounts-template.csv';
    a.click();

    URL.revokeObjectURL(url);
  }

  async function onUploadFile(file: File | null) {
    if (!file) return;

    if (!canManage) {
      setInfoText('');
      setErrorText('You have view access only on this page.');
      return;
    }

    setErrorText('');
    setInfoText('');
    setIsUploading(true);

    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        throw new Error('The selected file does not contain any account rows.');
      }

      const header = splitCsvLine(lines[0]).map((x) => x.toLowerCase());
      const expected = ['code', 'name', 'category', 'normalbalance', 'isheader', 'ispostingallowed', 'parentcode'];

      if (expected.some((value, index) => header[index] !== value)) {
        throw new Error('The file format is not valid. Please use the provided template.');
      }

      const parsedRows: UploadRow[] = lines.slice(1).map((line, rowIndex) => {
        const cols = splitCsvLine(line);

        if (cols.length < 7) {
          throw new Error(`Row ${rowIndex + 2}: incomplete data.`);
        }

        const category = parseCategory(cols[2]);
        const normalBalance = parseNormalBalance(cols[3]);

        if (!category) {
          throw new Error(`Row ${rowIndex + 2}: invalid account category.`);
        }

        if (!normalBalance) {
          throw new Error(`Row ${rowIndex + 2}: invalid normal balance value.`);
        }

        return {
          code: cols[0],
          name: cols[1],
          category,
          normalBalance,
          isHeader: parseBoolean(cols[4]),
          isPostingAllowed: parseBoolean(cols[5]),
          parentCode: cols[6],
        };
      });

      const currentAccounts = (await qc.fetchQuery({
        queryKey: ['accounts'],
        queryFn: getAccounts,
      })).items;

      const codeToId = new Map(currentAccounts.map((x) => [x.code.toUpperCase(), x.id]));
      const pendingCreated = new Map<string, string>();

      let created = 0;
      const failures: string[] = [];

      for (const row of parsedRows) {
        try {
          if (!row.code.trim() || !row.name.trim()) {
            failures.push(`${row.code || 'Unnamed row'}: account code and name are required.`);
            continue;
          }

          if (row.isHeader && row.isPostingAllowed) {
            failures.push(`${row.code}: a header account cannot be posting-enabled.`);
            continue;
          }

          const parentCode = row.parentCode.trim().toUpperCase();
          const parentLedgerAccountId =
            (parentCode ? pendingCreated.get(parentCode) : null) ||
            (parentCode ? codeToId.get(parentCode) : null) ||
            null;

          if (parentCode && !parentLedgerAccountId) {
            failures.push(`${row.code}: parent account '${parentCode}' was not found.`);
            continue;
          }

          const result = await createLedgerAccount({
            code: row.code.trim(),
            name: row.name.trim(),
            category: row.category,
            normalBalance: row.normalBalance,
            isHeader: row.isHeader,
            isPostingAllowed: row.isPostingAllowed,
            parentLedgerAccountId,
          });

          const createdId = result?.id || result?.Id;
          if (createdId) {
            pendingCreated.set(row.code.trim().toUpperCase(), createdId);
          }

          created += 1;
        } catch (uploadError) {
          failures.push(`${row.code}: ${getTenantReadableError(uploadError, 'This row could not be imported.')}`);
        }
      }

      await qc.invalidateQueries({ queryKey: ['accounts'] });

      if (failures.length > 0) {
        setInfoText(`Import completed with ${created} account(s) created.`);
        setErrorText(failures.join(' | '));
      } else {
        setInfoText(`Import completed successfully. ${created} account(s) were created.`);
        setErrorText('');
      }
    } catch (uploadError) {
      setErrorText(getTenantReadableError(uploadError, 'We could not process the selected file.'));
      setInfoText('');
    } finally {
      setIsUploading(false);
    }
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view the chart of accounts.</div>;
  }

  if (isLoading) {
    return <div className="panel">Loading chart of accounts...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">We could not load the chart of accounts at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Chart of accounts</h2>
            <div className="muted">Manage your organization’s account structure and posting hierarchy.</div>
          </div>

          <div className="inline-actions">
            <button className="button" onClick={downloadTemplate}>Download Template</button>
            {canManage ? (
              <>
                <label
                  className="button"
                  style={{ cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.7 : 1 }}
                >
                  {isUploading ? 'Uploading…' : 'Import Accounts'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    disabled={isUploading}
                    onChange={(e) => onUploadFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button className="button primary" onClick={openModal}>New Account</button>
              </>
            ) : null}
          </div>
        </div>

        <div className="kv">
          <div className="kv-row">
            <span>Total Accounts</span>
            <span>{accountSummary.total}</span>
          </div>
          <div className="kv-row">
            <span>Active Accounts</span>
            <span>{accountSummary.active}</span>
          </div>
          <div className="kv-row">
            <span>Posting Accounts</span>
            <span>{accountSummary.posting}</span>
          </div>
          <div className="kv-row">
            <span>Header Accounts</span>
            <span>{accountSummary.headers}</span>
          </div>
        </div>

        {!canManage ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">You currently have read-only access to the chart of accounts.</div>
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
          <h2>Account listing</h2>
          <span className="muted">{data.count} account(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name</th>
                <th>Category</th>
                <th>Normal Balance</th>
                <th>Type</th>
                <th>Posting</th>
                <th>Parent Account</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: LedgerAccountDto) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{categoryLabel(item.category)}</td>
                  <td>{normalBalanceLabel(item.normalBalance)}</td>
                  <td>{formatStatus(item.isHeader, 'Header', 'Posting Account')}</td>
                  <td>{formatStatus(item.isPostingAllowed, 'Enabled', 'Not Enabled')}</td>
                  <td>{item.parentCode ? `${item.parentCode} - ${item.parentName}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create account</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Account Code</label>
                <input
                  className="input"
                  value={form.code}
                  onChange={(e) => update('code', e.target.value)}
                  placeholder="Enter account code"
                />
              </div>

              <div className="form-row">
                <label>Account Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Enter account name"
                />
              </div>

              <div className="form-row">
                <label>Category</label>
                <select
                  className="select"
                  value={form.category}
                  onChange={(e) => update('category', Number(e.target.value))}
                >
                  <option value={1}>Asset</option>
                  <option value={2}>Liability</option>
                  <option value={3}>Equity</option>
                  <option value={4}>Income</option>
                  <option value={5}>Expense</option>
                </select>
              </div>

              <div className="form-row">
                <label>Normal Balance</label>
                <select
                  className="select"
                  value={form.normalBalance}
                  onChange={(e) => update('normalBalance', Number(e.target.value))}
                >
                  <option value={1}>Debit</option>
                  <option value={2}>Credit</option>
                </select>
              </div>

              <div className="form-row">
                <label>Parent Account</label>
                <select
                  className="select"
                  value={form.parentLedgerAccountId}
                  onChange={(e) => update('parentLedgerAccountId', e.target.value)}
                >
                  <option value="">— No Parent Account —</option>
                  {headerAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <label>Account Options</label>
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
                    Allow posting
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
    </div>
  );
}