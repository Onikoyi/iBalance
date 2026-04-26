import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateBankAccount,
  createBankAccount,
  deactivateBankAccount,
  getAccounts,
  getBankAccounts,
  getCompanyLogoDataUrl,
  getTenantKey,
  getTenantLogoDataUrl,
  getTenantReadableError,
  updateBankAccount,
  type BankAccountDto,
  type CreateBankAccountRequest,
  type LedgerAccountDto,
  type UpdateBankAccountRequest,
} from '../lib/api';
import { canManageFinanceSetup, canViewFinance } from '../lib/auth';

const emptyForm: CreateBankAccountRequest = {
  name: '',
  bankName: '',
  accountNumber: '',
  branch: '',
  currencyCode: 'NGN',
  ledgerAccountId: '',
  notes: '',
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function accountLabel(account?: LedgerAccountDto | null) {
  if (!account) return '—';
  return `${account.code} - ${account.name}`;
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '—')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function logoHtml(src: string, fallback: string) {
  if (src) {
    return `<img src="${src}" alt="${escapeHtml(fallback)}" style="height:42px;max-width:180px;object-fit:contain;" />`;
  }

  return `<div class="print-logo-fallback">${escapeHtml(fallback)}</div>`;
}

function buildBankRegisterPrintHtml(args: {
  tenantLogo: string;
  companyLogo: string;
  tenantKey: string;
  statusLabel: string;
  searchText: string;
  summary: {
    total: number;
    active: number;
    inactive: number;
    currencies: number;
  };
  rows: Array<{
    item: BankAccountDto;
    ledgerAccount?: LedgerAccountDto | null;
  }>;
}) {
  const printedAt = formatDateTime(new Date().toISOString());
  const rowsHtml = args.rows.map(({ item, ledgerAccount }) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.bankName)}</td>
      <td>${escapeHtml(item.branch || '—')}</td>
      <td>${escapeHtml(item.accountNumber)}</td>
      <td>${escapeHtml(item.currencyCode)}</td>
      <td>${escapeHtml(accountLabel(ledgerAccount))}</td>
      <td>${escapeHtml(item.isActive ? 'Active' : 'Inactive')}</td>
      <td>${escapeHtml(formatDate(item.lastModifiedOnUtc || item.createdOnUtc))}</td>
      <td>${escapeHtml(item.notes || '—')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Bank Account Register</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
    }

    body {
      padding: 18px;
    }

    .page {
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .print-report-header {
      display: grid;
      gap: 14px;
      margin: 0 0 18px 0;
      padding: 0 0 14px 0;
      border-bottom: 2px solid #111827;
    }

    .print-report-brand-row {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: center;
    }

    .print-brand-block {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .print-brand-meta {
      display: grid;
      gap: 2px;
    }

    .print-brand-meta strong {
      font-size: 14px;
      color: #111827;
    }

    .print-brand-meta span {
      color: #4b5563;
      font-size: 12px;
    }

    .print-logo-fallback {
      min-width: 92px;
      height: 42px;
      padding: 0 12px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      font-weight: 700;
      color: #111827;
    }

    .print-report-title-block h1 {
      margin: 0 0 6px 0;
      font-size: 24px;
      color: #111827;
    }

    .muted {
      color: #4b5563;
      font-size: 12px;
    }

    .kv {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }

    .kv-card {
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 8px 10px;
      display: grid;
      gap: 3px;
      break-inside: avoid;
    }

    .kv-card span {
      color: #4b5563;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kv-card strong {
      color: #111827;
      font-size: 14px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    th,
    td {
      border: 1px solid #d1d5db;
      padding: 6px 7px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #f3f4f6;
      color: #111827;
      font-weight: 700;
    }

    tr {
      break-inside: avoid;
    }

    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #d1d5db;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      color: #4b5563;
      font-size: 11px;
    }

    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="print-report-header">
      <div class="print-report-brand-row">
        <div class="print-brand-block">
          ${logoHtml(args.companyLogo, 'iBalance')}
          <div class="print-brand-meta">
            <strong>Nikosoft Technologies</strong>
            <span>iBalance Accounting Cloud</span>
          </div>
        </div>

        <div class="print-brand-block">
          ${logoHtml(args.tenantLogo, 'Organization')}
          <div class="print-brand-meta">
            <strong>${escapeHtml(args.tenantKey || 'Organization')}</strong>
            <span>Client Workspace</span>
          </div>
        </div>
      </div>

      <div class="print-report-title-block">
        <h1>Bank Account Register</h1>
        <div class="muted">Status: ${escapeHtml(args.statusLabel)} | Search: ${escapeHtml(args.searchText.trim() || 'None')} | Printed: ${escapeHtml(printedAt)}</div>
      </div>
    </header>

    <section class="kv">
      <div class="kv-card"><span>Total Bank Accounts</span><strong>${args.summary.total}</strong></div>
      <div class="kv-card"><span>Active</span><strong>${args.summary.active}</strong></div>
      <div class="kv-card"><span>Inactive</span><strong>${args.summary.inactive}</strong></div>
      <div class="kv-card"><span>Currencies</span><strong>${args.summary.currencies}</strong></div>
      <div class="kv-card"><span>Displayed Rows</span><strong>${args.rows.length}</strong></div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Account Name</th>
          <th>Bank</th>
          <th>Branch</th>
          <th>Account Number</th>
          <th>Currency</th>
          <th>Linked Ledger</th>
          <th>Status</th>
          <th>Last Updated</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <footer class="footer">
      <span>Generated from iBalance Bank & Cash Setup</span>
      <span>${escapeHtml(args.tenantKey || 'Organization')}</span>
    </footer>
  </main>
</body>
</html>`;
}

export function BankAccountsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState<CreateBankAccountRequest>(emptyForm);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const tenantLogo = getTenantLogoDataUrl();
  const companyLogo = getCompanyLogoDataUrl();
  const tenantKey = getTenantKey();

  const bankAccountsQ = useQuery({
    queryKey: ['bank-accounts'],
    queryFn: getBankAccounts,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const cashBankLedgerAccounts = useMemo(() => {
    return (accountsQ.data?.items ?? []).filter(
      (account) => account.isActive && account.isCashOrBankAccount && account.isPostingAllowed && !account.isHeader
    );
  }, [accountsQ.data?.items]);

  const ledgerAccountMap = useMemo(() => {
    const map = new Map<string, LedgerAccountDto>();
    (accountsQ.data?.items ?? []).forEach((account) => map.set(account.id, account));
    return map;
  }, [accountsQ.data?.items]);

  const bankAccounts = bankAccountsQ.data?.items ?? [];

  const filteredBankAccounts = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    return bankAccounts.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);

      const ledgerAccount = ledgerAccountMap.get(item.ledgerAccountId);
      const matchesSearch =
        !text ||
        item.name.toLowerCase().includes(text) ||
        item.bankName.toLowerCase().includes(text) ||
        item.accountNumber.toLowerCase().includes(text) ||
        (item.branch || '').toLowerCase().includes(text) ||
        item.currencyCode.toLowerCase().includes(text) ||
        (item.notes || '').toLowerCase().includes(text) ||
        accountLabel(ledgerAccount).toLowerCase().includes(text);

      return matchesStatus && matchesSearch;
    });
  }, [bankAccounts, ledgerAccountMap, searchText, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: bankAccounts.length,
      active: bankAccounts.filter((item) => item.isActive).length,
      inactive: bankAccounts.filter((item) => !item.isActive).length,
      currencies: new Set(bankAccounts.map((item) => item.currencyCode)).size,
    };
  }, [bankAccounts]);

  const printableStatusLabel = useMemo(() => {
    switch (statusFilter) {
      case 'active':
        return 'Active only';
      case 'inactive':
        return 'Inactive only';
      default:
        return 'All bank accounts';
    }
  }, [statusFilter]);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['bank-accounts'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['cashbook'] }),
      qc.invalidateQueries({ queryKey: ['cashbook-summary'] }),
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] }),
      qc.invalidateQueries({ queryKey: ['bank-statement-imports'] }),
    ]);
  }

  const createMut = useMutation({
    mutationFn: createBankAccount,
    onSuccess: async () => {
      await refreshAll();
      setShowForm(false);
      setEditingId('');
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Bank account created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create bank account.'));
      setInfoText('');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBankAccountRequest }) => updateBankAccount(id, payload),
    onSuccess: async () => {
      await refreshAll();
      setShowForm(false);
      setEditingId('');
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Bank account updated successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update bank account.'));
      setInfoText('');
    },
  });

  const activateMut = useMutation({
    mutationFn: activateBankAccount,
    onSuccess: async () => {
      await refreshAll();
      setErrorText('');
      setInfoText('Bank account activated successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to activate bank account.'));
      setInfoText('');
    },
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateBankAccount,
    onSuccess: async () => {
      await refreshAll();
      setErrorText('');
      setInfoText('Bank account deactivated successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to deactivate bank account.'));
      setInfoText('');
    },
  });

  function openCreateForm() {
    if (!canManage) {
      setErrorText('You do not have permission to manage bank setup.');
      setInfoText('');
      return;
    }

    setEditingId('');
    setForm(emptyForm);
    setErrorText('');
    setInfoText('');
    setShowForm(true);
  }

  function openEditForm(item: BankAccountDto) {
    if (!canManage) {
      setErrorText('You do not have permission to manage bank setup.');
      setInfoText('');
      return;
    }

    setEditingId(item.id);
    setForm({
      name: item.name,
      bankName: item.bankName,
      accountNumber: item.accountNumber,
      branch: item.branch || '',
      currencyCode: item.currencyCode,
      ledgerAccountId: item.ledgerAccountId,
      notes: item.notes || '',
    });
    setErrorText('');
    setInfoText('');
    setShowForm(true);
  }

  function closeForm() {
    if (!createMut.isPending && !updateMut.isPending) {
      setShowForm(false);
      setEditingId('');
      setForm(emptyForm);
      setErrorText('');
    }
  }

  async function submitForm() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to manage bank setup.');
      return;
    }

    if (!form.name.trim()) {
      setErrorText('Bank account name is required.');
      return;
    }

    if (!form.bankName.trim()) {
      setErrorText('Bank name is required.');
      return;
    }

    if (!form.accountNumber.trim()) {
      setErrorText('Account number is required.');
      return;
    }

    if (!form.currencyCode.trim()) {
      setErrorText('Currency code is required.');
      return;
    }

    if (!form.ledgerAccountId) {
      setErrorText('Linked cash/bank ledger account is required.');
      return;
    }

    const payload: CreateBankAccountRequest = {
      name: form.name.trim(),
      bankName: form.bankName.trim(),
      accountNumber: form.accountNumber.trim(),
      branch: form.branch?.trim() || null,
      currencyCode: form.currencyCode.trim().toUpperCase(),
      ledgerAccountId: form.ledgerAccountId,
      notes: form.notes?.trim() || null,
    };

    if (editingId) {
      const existing = bankAccounts.find((item) => item.id === editingId);
      await updateMut.mutateAsync({
        id: editingId,
        payload: {
          ...payload,
          isActive: existing?.isActive ?? true,
        },
      });
      return;
    }

    await createMut.mutateAsync(payload);
  }

  function printBankRegister() {
    setErrorText('');

    if (filteredBankAccounts.length === 0) {
      setErrorText('There are no bank accounts to print under the current filter.');
      return;
    }

    const rows = filteredBankAccounts.map((item) => ({
      item,
      ledgerAccount: ledgerAccountMap.get(item.ledgerAccountId),
    }));

    const html = buildBankRegisterPrintHtml({
      tenantLogo,
      companyLogo,
      tenantKey,
      statusLabel: printableStatusLabel,
      searchText,
      summary,
      rows,
    });

    const iframe = document.createElement('iframe');
    iframe.title = 'Bank Account Register Print Frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';

    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDocument = iframe.contentDocument || frameWindow?.document;

    if (!frameWindow || !frameDocument) {
      document.body.removeChild(iframe);
      setErrorText('Unable to prepare the print report. Please try again.');
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    iframe.onload = () => {
      frameWindow.focus();
      frameWindow.print();

      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 500);
    };
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view bank setup.</div>;
  }

  if (bankAccountsQ.isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading bank setup...</div>;
  }

  if (bankAccountsQ.isError || accountsQ.isError || !bankAccountsQ.data || !accountsQ.data) {
    return <div className="panel error-panel">We could not load bank setup at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Bank & Cash Setup</h2>
            <div className="muted">
              Maintain operational bank accounts and link them to cash/bank ledger accounts used by cashbook, reconciliation, and statement import.
            </div>
          </div>

          <div className="inline-actions">
            <button className="button" onClick={printBankRegister}>Print Bank Register</button>
            {canManage ? <button className="button primary" onClick={openCreateForm}>New Bank Account</button> : null}
          </div>
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Bank Accounts</span><span>{summary.total}</span></div>
          <div className="kv-row"><span>Active</span><span>{summary.active}</span></div>
          <div className="kv-row"><span>Inactive</span><span>{summary.inactive}</span></div>
          <div className="kv-row"><span>Currencies</span><span>{summary.currencies}</span></div>
        </div>

        {cashBankLedgerAccounts.length === 0 ? (
          <div className="panel error-panel" style={{ marginTop: 16 }}>
            No active posting ledger account is currently marked as Cash/Bank. Create or update a ledger account before adding bank accounts.
          </div>
        ) : null}

        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
      </section>

      {showForm ? (
        <section className="panel">
          <div className="section-heading">
            <h2>{editingId ? 'Edit Bank Account' : 'Create Bank Account'}</h2>
            <button className="button ghost" onClick={closeForm}>Close</button>
          </div>

          <div className="form-grid two">
            <div className="form-row">
              <label>Account Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm((state) => ({ ...state, name: e.target.value }))} placeholder="e.g. Main Operating Account" />
            </div>

            <div className="form-row">
              <label>Bank Name</label>
              <input className="input" value={form.bankName} onChange={(e) => setForm((state) => ({ ...state, bankName: e.target.value }))} placeholder="e.g. Zenith Bank" />
            </div>

            <div className="form-row">
              <label>Account Number</label>
              <input className="input" value={form.accountNumber} onChange={(e) => setForm((state) => ({ ...state, accountNumber: e.target.value }))} placeholder="Bank account number" />
            </div>

            <div className="form-row">
              <label>Branch</label>
              <input className="input" value={form.branch || ''} onChange={(e) => setForm((state) => ({ ...state, branch: e.target.value }))} placeholder="Optional branch/location" />
            </div>

            <div className="form-row">
              <label>Currency</label>
              <input className="input" value={form.currencyCode} onChange={(e) => setForm((state) => ({ ...state, currencyCode: e.target.value.toUpperCase() }))} placeholder="NGN" maxLength={10} />
            </div>

            <div className="form-row">
              <label>Linked Cash/Bank Ledger Account</label>
              <select className="select" value={form.ledgerAccountId} onChange={(e) => setForm((state) => ({ ...state, ledgerAccountId: e.target.value }))}>
                <option value="">— Select Ledger Account —</option>
                {cashBankLedgerAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                ))}
              </select>
            </div>

            <div className="form-row" style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea className="textarea" value={form.notes || ''} onChange={(e) => setForm((state) => ({ ...state, notes: e.target.value }))} placeholder="Optional internal setup notes" />
            </div>
          </div>

          <div className="modal-footer">
            <button className="button" onClick={closeForm} disabled={createMut.isPending || updateMut.isPending}>Cancel</button>
            <button className="button primary" onClick={submitForm} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Create Bank Account'}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-heading">
          <h2>Bank Account Register</h2>
          <span className="muted">{filteredBankAccounts.length} account(s)</span>
        </div>

        <div className="form-grid two" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label>Search</label>
            <input className="input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Bank, account number, ledger account, currency" />
          </div>

          <div className="form-row">
            <label>Status</label>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bank Account</th>
                <th>Bank</th>
                <th>Account Number</th>
                <th>Currency</th>
                <th>Linked Ledger</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBankAccounts.length === 0 ? (
                <tr><td colSpan={8} className="muted">No bank accounts match the current filter.</td></tr>
              ) : (
                filteredBankAccounts.map((item) => {
                  const ledgerAccount = ledgerAccountMap.get(item.ledgerAccountId);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div>{item.name}</div>
                        {item.notes ? <div className="muted">{item.notes}</div> : null}
                      </td>
                      <td>
                        <div>{item.bankName}</div>
                        {item.branch ? <div className="muted">{item.branch}</div> : null}
                      </td>
                      <td>{item.accountNumber}</td>
                      <td>{item.currencyCode}</td>
                      <td>
                        <div>{accountLabel(ledgerAccount)}</div>
                        {ledgerAccount && !ledgerAccount.isCashOrBankAccount ? <div className="muted">Ledger not marked as cash/bank</div> : null}
                      </td>
                      <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                      <td>{formatDateTime(item.lastModifiedOnUtc || item.createdOnUtc)}</td>
                      <td>
                        <div className="inline-actions">
                          {canManage ? <button className="button" onClick={() => openEditForm(item)}>Edit</button> : null}
                          {canManage && item.isActive ? (
                            <button className="button danger" onClick={() => deactivateMut.mutate(item.id)} disabled={deactivateMut.isPending}>Deactivate</button>
                          ) : null}
                          {canManage && !item.isActive ? (
                            <button className="button" onClick={() => activateMut.mutate(item.id)} disabled={activateMut.isPending}>Activate</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
