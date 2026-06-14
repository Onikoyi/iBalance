import { useEffect, useMemo, useState } from 'react';
import {
  canManageBillingSetup,
  canViewBilling,
  getBillingPolicy,
  getBillingPostingAccounts,
  getBillingReadableError,
  saveBillingPolicy,
  useMutation,
  useQuery,
  useQueryClient,
  type BillingPostingAccountDto,
  type SaveBillingPolicyRequest,
} from './BillingShared';

const defaultForm: SaveBillingPolicyRequest = {
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  currencyCode: 'NGN',
  receivableControlAccountId: null,
  defaultRevenueAccountId: null,
  taxLiabilityAccountId: null,
  discountAccountId: null,
  writeOffAccountId: null,
  requireApprovalBeforePosting: true,
  enableMakerChecker: true,
  autoPostApprovedInvoices: false,
  defaultTaxRate: 0,
  defaultDueDays: 30,
  notes: '',
};

function accountLabel(account: BillingPostingAccountDto): string {
  return `${account.code} - ${account.name}`;
}

function formsAreEqual(
  left: SaveBillingPolicyRequest,
  right: SaveBillingPolicyRequest,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

type AccountSelectProps = {
  label: string;
  value?: string | null;
  accounts: BillingPostingAccountDto[];
  disabled: boolean;
  required?: boolean;
  onChange: (value: string | null) => void;
};

function AccountSelect({
  label,
  value,
  accounts,
  disabled,
  required,
  onChange,
}: AccountSelectProps) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <select
        className="input"
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{required ? 'Select account' : 'Optional'}</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {accountLabel(account)}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BillingSetupPage() {
  const queryClient = useQueryClient();
  const canView = canViewBilling();
  const canManage = canManageBillingSetup();

  const [form, setForm] = useState<SaveBillingPolicyRequest>(defaultForm);
  const [savedForm, setSavedForm] =
    useState<SaveBillingPolicyRequest>(defaultForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const policyQ = useQuery({
    queryKey: ['billing-policy'],
    queryFn: getBillingPolicy,
    enabled: canView,
  });

  const postingAccountsQ = useQuery({
    queryKey: ['billing-posting-accounts'],
    queryFn: getBillingPostingAccounts,
    enabled: canView,
    staleTime: 60_000,
  });

  const postingAccounts = useMemo(
    () => postingAccountsQ.data?.items ?? [],
    [postingAccountsQ.data?.items]
  );

  const isDirty = useMemo(
    () => !formsAreEqual(form, savedForm),
    [form, savedForm],
  );

  useEffect(() => {
    if (policyQ.data?.item) {
      const item = policyQ.data.item;
      const loadedForm: SaveBillingPolicyRequest = {
        invoicePrefix: item.invoicePrefix,
        nextInvoiceNumber: item.nextInvoiceNumber,
        currencyCode: item.currencyCode,
        receivableControlAccountId: item.receivableControlAccountId ?? null,
        defaultRevenueAccountId: item.defaultRevenueAccountId ?? null,
        taxLiabilityAccountId: item.taxLiabilityAccountId ?? null,
        discountAccountId: item.discountAccountId ?? null,
        writeOffAccountId: item.writeOffAccountId ?? null,
        requireApprovalBeforePosting: item.requireApprovalBeforePosting,
        enableMakerChecker: item.enableMakerChecker,
        autoPostApprovedInvoices: item.autoPostApprovedInvoices,
        defaultTaxRate: Number(item.defaultTaxRate || 0),
        defaultDueDays: Number(item.defaultDueDays || 30),
        notes: item.notes || '',
      };

      setForm(loadedForm);
      setSavedForm(loadedForm);
    }
  }, [policyQ.data?.item]);

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => {
      setMessage('');
    }, 10_000);

    return () => window.clearTimeout(timeoutId);
  }, [message]);

  const saveMut = useMutation({
    mutationFn: saveBillingPolicy,
    onMutate: () => {
      setMessage('');
      setErrorText('');
    },
    onSuccess: async (response) => {
      setSavedForm(form);
      setLastSavedAt(new Date());
      setMessage(
        response.message ||
          'Billing setup saved successfully. The values shown below are now active.',
      );
      setErrorText('');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['billing-policy'] }),
        queryClient.invalidateQueries({
          queryKey: ['billing-posting-accounts'],
        }),
      ]);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(
        getBillingReadableError(error, 'Unable to save Billing setup.'),
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  function resetChanges() {
    setForm(savedForm);
    setMessage('Unsaved changes were discarded.');
    setErrorText('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to Billing setup.</div>;
  }

  if (policyQ.isLoading) {
    return <div className="panel">Loading Billing setup...</div>;
  }

  if (policyQ.isError) {
    return <div className="panel error-panel">Unable to load Billing setup.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Billing Setup</h2>
        <div className="muted">
          Configure numbering, maker/checker behavior, default due days, tax defaults, and GL posting account mapping.
        </div>
        <div aria-live="polite">
          {message ? <div className="success-panel">{message}</div> : null}
          {errorText ? <div className="error-panel">{errorText}</div> : null}
        </div>

        {isDirty && canManage ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <strong>Unsaved changes</strong>
            <div className="muted">
              You have changed this setup. Click Save Billing Setup to make the
              new values active.
            </div>
          </div>
        ) : null}

        {!isDirty && lastSavedAt ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Last saved successfully at {lastSavedAt.toLocaleTimeString()}.
          </div>
        ) : null}
      </section>

      <section className="panel">
        <h3>Billing Policy</h3>
        <div className="form-grid three">
          <div className="form-row">
            <label>Invoice Prefix</label>
            <input
              className="input"
              value={form.invoicePrefix}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Next Invoice Number</label>
            <input
              className="input"
              type="number"
              value={form.nextInvoiceNumber}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, nextInvoiceNumber: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>Currency</label>
            <input
              className="input"
              value={form.currencyCode}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>Default Tax %</label>
            <input
              className="input"
              type="number"
              value={form.defaultTaxRate}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, defaultTaxRate: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>Default Due Days</label>
            <input
              className="input"
              type="number"
              value={form.defaultDueDays}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, defaultDueDays: Number(e.target.value) })}
            />
          </div>
          <div className="form-row">
            <label>Maker / Checker</label>
            <select
              className="input"
              disabled={!canManage}
              value={form.enableMakerChecker ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, enableMakerChecker: e.target.value === 'yes' })}
            >
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </select>
          </div>
          <div className="form-row">
            <label>Require Approval Before Posting</label>
            <select
              className="input"
              disabled={!canManage}
              value={form.requireApprovalBeforePosting ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, requireApprovalBeforePosting: e.target.value === 'yes' })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="form-row">
            <label>Auto-post Approved Invoices</label>
            <select
              className="input"
              disabled={!canManage}
              value={form.autoPostApprovedInvoices ? 'yes' : 'no'}
              onChange={(e) => setForm({ ...form, autoPostApprovedInvoices: e.target.value === 'yes' })}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>GL Posting Account Mapping</h3>
        <div className="muted">
          Select posting-enabled accounts from the existing Chart of Accounts. These accounts are used when Billing invoices are posted to the General Ledger.
        </div>

        {postingAccountsQ.isLoading ? (
          <div className="panel" style={{ marginTop: 12 }}>Loading posting-enabled GL accounts...</div>
        ) : null}

        {postingAccountsQ.isError ? (
          <div className="error-panel" style={{ marginTop: 12 }}>
            Unable to load posting-enabled GL accounts. Confirm that Chart of Accounts is configured for this tenant.
          </div>
        ) : null}

        {!postingAccountsQ.isLoading && !postingAccountsQ.isError && postingAccounts.length === 0 ? (
          <div className="error-panel" style={{ marginTop: 12 }}>
            No posting-enabled GL accounts were found. Create active, non-header, posting-enabled accounts in Chart of Accounts before posting Billing invoices.
          </div>
        ) : null}

        <div className="form-grid two" style={{ marginTop: 12 }}>
          <AccountSelect
            label="Receivable Control Account"
            value={form.receivableControlAccountId}
            accounts={postingAccounts}
            disabled={!canManage || postingAccounts.length === 0}
            required
            onChange={(value) => setForm({ ...form, receivableControlAccountId: value })}
          />
          <AccountSelect
            label="Default Revenue Account"
            value={form.defaultRevenueAccountId}
            accounts={postingAccounts}
            disabled={!canManage || postingAccounts.length === 0}
            required
            onChange={(value) => setForm({ ...form, defaultRevenueAccountId: value })}
          />
          <AccountSelect
            label="Tax Liability Account"
            value={form.taxLiabilityAccountId}
            accounts={postingAccounts}
            disabled={!canManage || postingAccounts.length === 0}
            onChange={(value) => setForm({ ...form, taxLiabilityAccountId: value })}
          />
          <AccountSelect
            label="Discount Allowed Account"
            value={form.discountAccountId}
            accounts={postingAccounts}
            disabled={!canManage || postingAccounts.length === 0}
            onChange={(value) => setForm({ ...form, discountAccountId: value })}
          />
          <AccountSelect
            label="Write-off Account"
            value={form.writeOffAccountId}
            accounts={postingAccounts}
            disabled={!canManage || postingAccounts.length === 0}
            onChange={(value) => setForm({ ...form, writeOffAccountId: value })}
          />
        </div>

        <div className="form-row">
          <label>Notes</label>
          <textarea
            className="input"
            value={form.notes || ''}
            disabled={!canManage}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        {canManage ? (
          <div className="inline-actions">
            <button
              className="button primary"
              type="button"
              onClick={() => saveMut.mutate(form)}
              disabled={saveMut.isPending || !isDirty}
            >
              {saveMut.isPending
                ? 'Saving...'
                : isDirty
                  ? 'Save Billing Setup'
                  : 'Saved'}
            </button>

            <button
              className="button secondary"
              type="button"
              onClick={resetChanges}
              disabled={saveMut.isPending || !isDirty}
            >
              Discard Changes
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
