import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  canViewFinance,
  canCreateJournals,
  canPostOrReverseJournals,
} from '../lib/auth';
import {
  createFixedAsset,
  createFixedAssetClass,
  getAccounts,
  getFixedAssetClasses,
  getFixedAssetDepreciationRuns,
  getFixedAssetDetail,
  getFixedAssetRegister,
  getTenantReadableError,
  getPurchaseInvoices,
  previewFixedAssetDepreciation,
  runFixedAssetDepreciation,
  capitalizeFixedAsset,
  recordFixedAssetImprovement,
  transferFixedAsset,
  reclassifyFixedAsset,
  impairFixedAsset,
  disposeFixedAsset,
  type FixedAssetClassDto,
  type FixedAssetDepreciationMethod,
  type FixedAssetDepreciationPreviewItemDto,
  type FixedAssetDepreciationRunDto,
  type FixedAssetDisposalType,
  type FixedAssetRegisterItemDto,
  type LedgerAccountDto,
  type PurchaseInvoiceDto,
  type CreateFixedAssetClassRequest,
  type CreateFixedAssetRequest,
} from '../lib/api';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}


function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatFiscalPeriodUiError(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes('fiscal') ||
    lower.includes('period') ||
    lower.includes('posting is blocked') ||
    lower.includes('fiscal month is closed')
  ) {
    return 'Posting blocked: the selected fiscal month is closed or not open for posting.';
  }

  return message;
}


function assetStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Capitalized';
    case 3: return 'Active';
    case 4: return 'Fully Depreciated';
    case 5: return 'Impaired';
    case 6: return 'Disposed';
    default: return 'Unknown';
  }
}

function assetClassStatusLabel(value: number) {
  switch (value) {
    case 1: return 'Active';
    case 2: return 'Inactive';
    default: return 'Unknown';
  }
}

function depreciationMethodLabel(value: number) {
  switch (value) {
    case 1: return 'Straight Line';
    case 2: return 'Reducing Balance';
    case 3: return 'None';
    default: return 'Unknown';
  }
}

function disposalTypeLabel(value: number) {
  switch (value) {
    case 1: return 'Sale';
    case 2: return 'Scrap';
    case 3: return 'Write-off';
    case 4: return 'Donation';
    default: return 'Unknown';
  }
}

type ClassFormState = CreateFixedAssetClassRequest;
type AssetFormState = CreateFixedAssetRequest;

type CapitalizeFormState = {
  capitalizationDateUtc: string;
  creditLedgerAccountId: string;
  reference: string;
  description: string;
};

type ImprovementFormState = {
  transactionDateUtc: string;
  amount: string;
  creditLedgerAccountId: string;
  usefulLifeMonthsOverride: string;
  reference: string;
  description: string;
};

type TransferFormState = {
  transactionDateUtc: string;
  location: string;
  custodian: string;
  notes: string;
};

type ReclassifyFormState = {
  transactionDateUtc: string;
  targetFixedAssetClassId: string;
  notes: string;
};

type ImpairFormState = {
  transactionDateUtc: string;
  amount: string;
  reference: string;
  description: string;
};

type DisposeFormState = {
  disposalDateUtc: string;
  disposalType: FixedAssetDisposalType;
  disposalProceedsAmount: string;
  cashOrBankLedgerAccountId: string;
  reference: string;
  description: string;
  notes: string;
};

type DepreciationFormState = {
  periodStartUtc: string;
  periodEndUtc: string;
  runDateUtc: string;
  reference: string;
  description: string;
};

const emptyClassForm: ClassFormState = {
  code: '',
  name: '',
  description: '',
  capitalizationThreshold: 0,
  residualValuePercentDefault: 0,
  usefulLifeMonthsDefault: 60,
  depreciationMethodDefault: 1,
  assetCostLedgerAccountId: '',
  accumulatedDepreciationLedgerAccountId: '',
  depreciationExpenseLedgerAccountId: '',
  disposalGainLossLedgerAccountId: '',
};

const emptyAssetForm: AssetFormState = {
  fixedAssetClassId: '',
  assetNumber: '',
  assetName: '',
  description: '',
  acquisitionDateUtc: '',
  acquisitionCost: 0,
  residualValue: 0,
  usefulLifeMonths: 0,
  depreciationMethod: 3,
  assetCostLedgerAccountId: '',
  accumulatedDepreciationLedgerAccountId: '',
  depreciationExpenseLedgerAccountId: '',
  disposalGainLossLedgerAccountId: '',
  vendorId: null,
  purchaseInvoiceId: null,
  location: '',
  custodian: '',
  serialNumber: '',
  notes: '',
};

const emptyCapitalizeForm: CapitalizeFormState = {
  capitalizationDateUtc: '',
  creditLedgerAccountId: '',
  reference: '',
  description: '',
};

const emptyImprovementForm: ImprovementFormState = {
  transactionDateUtc: '',
  amount: '',
  creditLedgerAccountId: '',
  usefulLifeMonthsOverride: '',
  reference: '',
  description: '',
};

const emptyTransferForm: TransferFormState = {
  transactionDateUtc: '',
  location: '',
  custodian: '',
  notes: '',
};

const emptyReclassifyForm: ReclassifyFormState = {
  transactionDateUtc: '',
  targetFixedAssetClassId: '',
  notes: '',
};

const emptyImpairForm: ImpairFormState = {
  transactionDateUtc: '',
  amount: '',
  reference: '',
  description: '',
};

const emptyDisposeForm: DisposeFormState = {
  disposalDateUtc: '',
  disposalType: 1,
  disposalProceedsAmount: '',
  cashOrBankLedgerAccountId: '',
  reference: '',
  description: '',
  notes: '',
};

const emptyDepreciationForm: DepreciationFormState = {
  periodStartUtc: '',
  periodEndUtc: '',
  runDateUtc: '',
  reference: '',
  description: '',
};

export function FixedAssetsPage() {
  const qc = useQueryClient();
  const canView = canViewFinance();
  const canManage = canCreateJournals();
  const canPost = canPostOrReverseJournals();

  const [infoText, setInfoText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetDetailId, setAssetDetailId] = useState('');
  const [showClassForm, setShowClassForm] = useState(false);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [operationMode, setOperationMode] = useState<'' | 'capitalize' | 'improve' | 'transfer' | 'reclassify' | 'impair' | 'dispose'>('');

  const [classForm, setClassForm] = useState<ClassFormState>(emptyClassForm);
  const [assetForm, setAssetForm] = useState<AssetFormState>(emptyAssetForm);
  const [capitalizeForm, setCapitalizeForm] = useState<CapitalizeFormState>(emptyCapitalizeForm);
  const [improvementForm, setImprovementForm] = useState<ImprovementFormState>(emptyImprovementForm);
  const [transferForm, setTransferForm] = useState<TransferFormState>(emptyTransferForm);
  const [reclassifyForm, setReclassifyForm] = useState<ReclassifyFormState>(emptyReclassifyForm);
  const [impairForm, setImpairForm] = useState<ImpairFormState>(emptyImpairForm);
  const [disposeForm, setDisposeForm] = useState<DisposeFormState>(emptyDisposeForm);
  const [depreciationForm, setDepreciationForm] = useState<DepreciationFormState>(emptyDepreciationForm);

  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [previewItems, setPreviewItems] = useState<FixedAssetDepreciationPreviewItemDto[]>([]);

  const classesQ = useQuery({ queryKey: ['fixed-asset-classes'], queryFn: getFixedAssetClasses, enabled: canView });
  const registerQ = useQuery({
    queryKey: ['fixed-asset-register', classFilter, statusFilter],
    queryFn: () => getFixedAssetRegister(statusFilter === 'all' ? null : Number(statusFilter), classFilter === 'all' ? null : classFilter),
    enabled: canView,
  });
  const runsQ = useQuery({ queryKey: ['fixed-asset-depreciation-runs'], queryFn: getFixedAssetDepreciationRuns, enabled: canView });
  const accountsQ = useQuery({ queryKey: ['accounts'], queryFn: getAccounts, enabled: canView });
  const purchaseInvoicesQ = useQuery({ queryKey: ['ap-purchase-invoices'], queryFn: getPurchaseInvoices, enabled: canView });
  const detailQ = useQuery({
    queryKey: ['fixed-asset-detail', assetDetailId],
    queryFn: () => getFixedAssetDetail(assetDetailId),
    enabled: canView && !!assetDetailId,
  });

  const accounts = accountsQ.data?.items ?? [];
  const postingAccounts = useMemo(
    () => accounts.filter((x: LedgerAccountDto) => x.isActive && !x.isHeader && x.isPostingAllowed),
    [accounts]
  );
  const cashBankAccounts = useMemo(
    () => postingAccounts.filter((x: LedgerAccountDto) => x.isCashOrBankAccount),
    [postingAccounts]
  );

  const classMap = useMemo(() => {
    const map = new Map<string, FixedAssetClassDto>();
    (classesQ.data?.items ?? []).forEach((item) => map.set(item.id, item));
    return map;
  }, [classesQ.data?.items]);

  const purchaseInvoiceMap = useMemo(() => {
    const map = new Map<string, PurchaseInvoiceDto>();
    (purchaseInvoicesQ.data?.items ?? []).forEach((item) => map.set(item.id, item));
    return map;
  }, [purchaseInvoicesQ.data?.items]);

  function sourceInvoiceLabel(purchaseInvoiceId?: string | null) {
    if (!purchaseInvoiceId) return '—';

    const invoice = purchaseInvoiceMap.get(purchaseInvoiceId);
    if (!invoice) return purchaseInvoiceId;

    return invoice.invoiceNumber || purchaseInvoiceId;
  }

  function sourceVendorLabel(purchaseInvoiceId?: string | null, vendorId?: string | null) {
    if (!purchaseInvoiceId && !vendorId) return '—';

    const invoice = purchaseInvoiceId ? purchaseInvoiceMap.get(purchaseInvoiceId) : null;
    if (invoice) {
      return [invoice.vendorCode, invoice.vendorName].filter(Boolean).join(' - ') || vendorId || '—';
    }

    return vendorId || '—';
  }

  function isCapitalizedFromPurchaseInvoice(asset: unknown) {
    return !!(
      asset &&
      typeof asset === 'object' &&
      'purchaseInvoiceId' in asset &&
      typeof (asset as { purchaseInvoiceId?: unknown }).purchaseInvoiceId === 'string' &&
      (asset as { purchaseInvoiceId: string }).purchaseInvoiceId.trim().length > 0
    );
  }

  const filteredAssets = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return (registerQ.data?.items ?? []).filter((item: FixedAssetRegisterItemDto) => {
      const matchesSearch =
        !text ||
        item.assetNumber.toLowerCase().includes(text) ||
        item.assetName.toLowerCase().includes(text) ||
        (item.fixedAssetClassName || '').toLowerCase().includes(text) ||
        (item.location || '').toLowerCase().includes(text) ||
        (item.custodian || '').toLowerCase().includes(text) ||
        sourceInvoiceLabel(item.purchaseInvoiceId).toLowerCase().includes(text) ||
        sourceVendorLabel(item.purchaseInvoiceId, item.vendorId).toLowerCase().includes(text);
      return matchesSearch;
    });
  }, [registerQ.data?.items, searchText, purchaseInvoiceMap]);

  const stats = useMemo(() => {
    const items = registerQ.data?.items ?? [];
    return {
      total: items.length,
      acquisitionCost: items.reduce((s, x) => s + x.acquisitionCost, 0),
      nbv: items.reduce((s, x) => s + x.netBookValue, 0),
      draft: items.filter((x) => x.status === 1).length,
      capitalized: items.filter((x) => x.status === 2 || x.status === 3).length,
      impaired: items.filter((x) => x.status === 5).length,
      disposed: items.filter((x) => x.status === 6).length,
    };
  }, [registerQ.data?.items]);

  async function refreshAll() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['fixed-asset-classes'] }),
      qc.invalidateQueries({ queryKey: ['fixed-assets'] }),
      qc.invalidateQueries({ queryKey: ['fixed-asset-register'] }),
      qc.invalidateQueries({ queryKey: ['fixed-asset-depreciation-runs'] }),
      qc.invalidateQueries({ queryKey: ['fixed-asset-detail'] }),
      qc.invalidateQueries({ queryKey: ['journal-entries'] }),
      qc.invalidateQueries({ queryKey: ['accounts'] }),
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] }),
      qc.invalidateQueries({ queryKey: ['trial-balance'] }),
      qc.invalidateQueries({ queryKey: ['balance-sheet'] }),
      qc.invalidateQueries({ queryKey: ['income-statement'] }),
    ]);
  }

  const createClassMut = useMutation({
    mutationFn: createFixedAssetClass,
    onSuccess: async () => {
      await refreshAll();
      setShowClassForm(false);
      setClassForm(emptyClassForm);
      setErrorText('');
      setInfoText('Fixed asset class created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create fixed asset class.'));
      setInfoText('');
    },
  });

  const createAssetMut = useMutation({
    mutationFn: createFixedAsset,
    onSuccess: async () => {
      await refreshAll();
      setShowAssetForm(false);
      setAssetForm(emptyAssetForm);
      setErrorText('');
      setInfoText('Fixed asset created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create fixed asset.'));
      setInfoText('');
    },
  });

  const capitalizeMut = useMutation({
    mutationFn: () => capitalizeFixedAsset(selectedAssetId, capitalizeForm),
    onSuccess: async () => {
      await refreshAll();
      setOperationMode('');
      setCapitalizeForm(emptyCapitalizeForm);
      setErrorText('');
      setInfoText('Fixed asset capitalized successfully.');
    },
    onError: (error) => {
      setErrorText(formatFiscalPeriodUiError(getTenantReadableError(error, 'Unable to capitalize fixed asset.')));
      setInfoText('');
    },
  });

  const improvementMut = useMutation({
    mutationFn: () => recordFixedAssetImprovement(selectedAssetId, {
      transactionDateUtc: improvementForm.transactionDateUtc,
      amount: Number(improvementForm.amount),
      creditLedgerAccountId: improvementForm.creditLedgerAccountId,
      usefulLifeMonthsOverride: improvementForm.usefulLifeMonthsOverride ? Number(improvementForm.usefulLifeMonthsOverride) : null,
      reference: improvementForm.reference || null,
      description: improvementForm.description || null,
    }),
    onSuccess: async () => {
      await refreshAll();
      setOperationMode('');
      setImprovementForm(emptyImprovementForm);
      setErrorText('');
      setInfoText('Fixed asset improvement recorded successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to record fixed asset improvement.'));
      setInfoText('');
    },
  });

  const transferMut = useMutation({
    mutationFn: () => transferFixedAsset(selectedAssetId, transferForm),
    onSuccess: async () => {
      await refreshAll();
      setOperationMode('');
      setTransferForm(emptyTransferForm);
      setErrorText('');
      setInfoText('Fixed asset transfer recorded successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to transfer fixed asset.'));
      setInfoText('');
    },
  });

  const reclassifyMut = useMutation({
    mutationFn: () => reclassifyFixedAsset(selectedAssetId, reclassifyForm),
    onSuccess: async () => {
      await refreshAll();
      setOperationMode('');
      setReclassifyForm(emptyReclassifyForm);
      setErrorText('');
      setInfoText('Fixed asset reclassification recorded successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to reclassify fixed asset.'));
      setInfoText('');
    },
  });

  const impairMut = useMutation({
    mutationFn: () => impairFixedAsset(selectedAssetId, {
      transactionDateUtc: impairForm.transactionDateUtc,
      amount: Number(impairForm.amount),
      reference: impairForm.reference || null,
      description: impairForm.description || null,
    }),
    onSuccess: async () => {
      await refreshAll();
      setOperationMode('');
      setImpairForm(emptyImpairForm);
      setErrorText('');
      setInfoText('Fixed asset impairment recorded successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to record fixed asset impairment.'));
      setInfoText('');
    },
  });

  const disposeMut = useMutation({
    mutationFn: () => disposeFixedAsset(selectedAssetId, {
      disposalDateUtc: disposeForm.disposalDateUtc,
      disposalType: disposeForm.disposalType,
      disposalProceedsAmount: Number(disposeForm.disposalProceedsAmount),
      cashOrBankLedgerAccountId: disposeForm.cashOrBankLedgerAccountId || null,
      reference: disposeForm.reference || null,
      description: disposeForm.description || null,
      notes: disposeForm.notes || null,
    }),
    onSuccess: async () => {
      await refreshAll();
      setOperationMode('');
      setDisposeForm(emptyDisposeForm);
      setErrorText('');
      setInfoText('Fixed asset disposal posted successfully.');
    },
    onError: (error) => {
      setErrorText(formatFiscalPeriodUiError(getTenantReadableError(error, 'Unable to dispose fixed asset.')));
      setInfoText('');
    },
  });

  const previewMut = useMutation({
    mutationFn: () => previewFixedAssetDepreciation({
      periodStartUtc: depreciationForm.periodStartUtc,
      periodEndUtc: depreciationForm.periodEndUtc,
    }),
    onSuccess: (data) => {
      setPreviewItems(data.items);
      setErrorText('');
      setInfoText(`Depreciation preview loaded for ${data.count} asset(s).`);
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to preview depreciation.'));
      setInfoText('');
      setPreviewItems([]);
    },
  });

  const runMut = useMutation({
    mutationFn: () => runFixedAssetDepreciation(depreciationForm),
    onSuccess: async () => {
      await refreshAll();
      setErrorText('');
      setInfoText('Fixed asset depreciation run posted successfully.');
      setPreviewItems([]);
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to post depreciation run.'));
      setInfoText('');
    },
  });

  function openOperation(mode: typeof operationMode, assetId: string) {
    setSelectedAssetId(assetId);
    setOperationMode(mode);
    setErrorText('');
    setInfoText('');
  }

  function applyClassDefaults(fixedAssetClassId: string) {
    const assetClass = classMap.get(fixedAssetClassId);
    setAssetForm((state) => ({
      ...state,
      fixedAssetClassId,
      usefulLifeMonths: assetClass?.usefulLifeMonthsDefault || 0,
      depreciationMethod: (assetClass?.depreciationMethodDefault || 3) as FixedAssetDepreciationMethod,
      assetCostLedgerAccountId: assetClass?.assetCostLedgerAccountId || '',
      accumulatedDepreciationLedgerAccountId: assetClass?.accumulatedDepreciationLedgerAccountId || '',
      depreciationExpenseLedgerAccountId: assetClass?.depreciationExpenseLedgerAccountId || '',
      disposalGainLossLedgerAccountId: assetClass?.disposalGainLossLedgerAccountId || '',
      residualValue: assetClass ? Number(((state.acquisitionCost || 0) * assetClass.residualValuePercentDefault) / 100) : state.residualValue,
    }));
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view fixed asset information.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Fixed Assets Overview</h2>
            <div className="muted">Manage asset classes, the asset register, capitalization, depreciation, and asset lifecycle operations.</div>
          </div>
        </div>

        <div className="kv">
          <div className="kv-row"><span>Total Assets</span><span>{stats.total}</span></div>
          <div className="kv-row"><span>Total Cost</span><span>{formatAmount(stats.acquisitionCost)}</span></div>
          <div className="kv-row"><span>Total NBV</span><span>{formatAmount(stats.nbv)}</span></div>
          <div className="kv-row"><span>Draft Assets</span><span>{stats.draft}</span></div>
          <div className="kv-row"><span>Capitalized / Active</span><span>{stats.capitalized}</span></div>
          <div className="kv-row"><span>Impaired</span><span>{stats.impaired}</span></div>
          <div className="kv-row"><span>Disposed</span><span>{stats.disposed}</span></div>
        </div>

        <div className="hero-actions" style={{ marginTop: 16 }}>
          {canManage ? (
            <>
              <button className="button primary" onClick={() => setShowClassForm((v) => !v)}>New Asset Class</button>
              <button className="button" onClick={() => setShowAssetForm((v) => !v)}>New Fixed Asset</button>
            </>
          ) : null}
        </div>

        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
      </section>

      {showClassForm ? (
        <section className="panel">
          <div className="section-heading"><h2>Create Fixed Asset Class</h2></div>
          <div className="form-grid two">
            <div className="form-row"><label>Code</label><input className="input" value={classForm.code} onChange={(e) => setClassForm({ ...classForm, code: e.target.value })} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} /></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" value={classForm.description || ''} onChange={(e) => setClassForm({ ...classForm, description: e.target.value })} /></div>
            <div className="form-row"><label>Capitalization Threshold</label><input className="input" type="number" value={classForm.capitalizationThreshold} onChange={(e) => setClassForm({ ...classForm, capitalizationThreshold: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Residual Value % Default</label><input className="input" type="number" value={classForm.residualValuePercentDefault} onChange={(e) => setClassForm({ ...classForm, residualValuePercentDefault: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Useful Life Months Default</label><input className="input" type="number" value={classForm.usefulLifeMonthsDefault} onChange={(e) => setClassForm({ ...classForm, usefulLifeMonthsDefault: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Depreciation Method</label>
              <select className="select" value={classForm.depreciationMethodDefault} onChange={(e) => setClassForm({ ...classForm, depreciationMethodDefault: Number(e.target.value) as FixedAssetDepreciationMethod })}>
                <option value={1}>Straight Line</option>
                <option value={2}>Reducing Balance</option>
                <option value={3}>None</option>
              </select>
            </div>
            <div className="form-row"><label>Asset Cost Ledger</label>
              <select className="select" value={classForm.assetCostLedgerAccountId} onChange={(e) => setClassForm({ ...classForm, assetCostLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Accumulated Depreciation Ledger</label>
              <select className="select" value={classForm.accumulatedDepreciationLedgerAccountId} onChange={(e) => setClassForm({ ...classForm, accumulatedDepreciationLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Depreciation Expense Ledger</label>
              <select className="select" value={classForm.depreciationExpenseLedgerAccountId} onChange={(e) => setClassForm({ ...classForm, depreciationExpenseLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Disposal Gain/Loss Ledger</label>
              <select className="select" value={classForm.disposalGainLossLedgerAccountId} onChange={(e) => setClassForm({ ...classForm, disposalGainLossLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setShowClassForm(false)}>Cancel</button>
            <button className="button primary" onClick={() => createClassMut.mutate(classForm)} disabled={createClassMut.isPending}>Save Class</button>
          </div>
        </section>
      ) : null}

      {showAssetForm ? (
        <section className="panel">
          <div className="section-heading"><h2>Create Fixed Asset</h2></div>
          <div className="form-grid two">
            <div className="form-row"><label>Asset Class</label>
              <select className="select" value={assetForm.fixedAssetClassId} onChange={(e) => applyClassDefaults(e.target.value)}>
                <option value="">— Select —</option>
                {(classesQ.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Asset Number</label><input className="input" value={assetForm.assetNumber} onChange={(e) => setAssetForm({ ...assetForm, assetNumber: e.target.value })} /></div>
            <div className="form-row"><label>Asset Name</label><input className="input" value={assetForm.assetName} onChange={(e) => setAssetForm({ ...assetForm, assetName: e.target.value })} /></div>
            <div className="form-row"><label>Acquisition Date</label><input className="input" type="date" value={assetForm.acquisitionDateUtc} onChange={(e) => setAssetForm({ ...assetForm, acquisitionDateUtc: e.target.value })} /></div>
            <div className="form-row"><label>Acquisition Cost</label><input className="input" type="number" value={assetForm.acquisitionCost} onChange={(e) => setAssetForm({ ...assetForm, acquisitionCost: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Residual Value</label><input className="input" type="number" value={assetForm.residualValue} onChange={(e) => setAssetForm({ ...assetForm, residualValue: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Useful Life Months</label><input className="input" type="number" value={assetForm.usefulLifeMonths} onChange={(e) => setAssetForm({ ...assetForm, usefulLifeMonths: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Depreciation Method</label>
              <select className="select" value={assetForm.depreciationMethod} onChange={(e) => setAssetForm({ ...assetForm, depreciationMethod: Number(e.target.value) as FixedAssetDepreciationMethod })}>
                <option value={1}>Straight Line</option>
                <option value={2}>Reducing Balance</option>
                <option value={3}>None</option>
              </select>
            </div>
            <div className="form-row"><label>Location</label><input className="input" value={assetForm.location || ''} onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })} /></div>
            <div className="form-row"><label>Custodian</label><input className="input" value={assetForm.custodian || ''} onChange={(e) => setAssetForm({ ...assetForm, custodian: e.target.value })} /></div>
            <div className="form-row"><label>Serial Number</label><input className="input" value={assetForm.serialNumber || ''} onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })} /></div>
            <div className="form-row"><label>Asset Cost Ledger</label>
              <select className="select" value={assetForm.assetCostLedgerAccountId || ''} onChange={(e) => setAssetForm({ ...assetForm, assetCostLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Accumulated Depreciation Ledger</label>
              <select className="select" value={assetForm.accumulatedDepreciationLedgerAccountId || ''} onChange={(e) => setAssetForm({ ...assetForm, accumulatedDepreciationLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Depreciation Expense Ledger</label>
              <select className="select" value={assetForm.depreciationExpenseLedgerAccountId || ''} onChange={(e) => setAssetForm({ ...assetForm, depreciationExpenseLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Disposal Gain/Loss Ledger</label>
              <select className="select" value={assetForm.disposalGainLossLedgerAccountId || ''} onChange={(e) => setAssetForm({ ...assetForm, disposalGainLossLedgerAccountId: e.target.value })}>
                <option value="">— Select —</option>
                {postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Description</label><textarea className="input" rows={3} value={assetForm.description || ''} onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })} /></div>
            <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={assetForm.notes || ''} onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })} /></div>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setShowAssetForm(false)}>Cancel</button>
            <button className="button primary" onClick={() => createAssetMut.mutate(assetForm)} disabled={createAssetMut.isPending}>Save Asset</button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-heading"><h2>Fixed Asset Classes</h2><span className="muted">{classesQ.data?.count ?? 0} class(es)</span></div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Code</th><th>Name</th><th>Threshold</th><th>Useful Life</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {(classesQ.data?.items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>{item.code}</td>
                  <td>{item.name}</td>
                  <td>{formatAmount(item.capitalizationThreshold)}</td>
                  <td>{item.usefulLifeMonthsDefault} months</td>
                  <td>{depreciationMethodLabel(item.depreciationMethodDefault)}</td>
                  <td>{assetClassStatusLabel(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Asset Register</h2>
          <span className="muted">{filteredAssets.length} asset(s)</span>
        </div>
        <div className="form-grid three">
          <div className="form-row"><label>Search</label><input className="input" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Asset number, name, class, location, AP invoice, vendor" /></div>
          <div className="form-row"><label>Class</label><select className="select" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}><option value="all">All Classes</option>{(classesQ.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
          <div className="form-row"><label>Status</label><select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All Statuses</option><option value="1">Draft</option><option value="2">Capitalized</option><option value="3">Active</option><option value="4">Fully Depreciated</option><option value="5">Impaired</option><option value="6">Disposed</option></select></div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Asset</th><th>Class</th><th>Source</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Cost</th><th style={{ textAlign: 'right' }}>Acc. Dep</th><th style={{ textAlign: 'right' }}>NBV</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredAssets.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div>{item.assetNumber}</div>
                    <div className="muted">{item.assetName}</div>
                    {isCapitalizedFromPurchaseInvoice(item) ? <div className="muted">Capitalized from AP</div> : null}
                  </td>
                  <td>{item.fixedAssetClassCode || ''} {item.fixedAssetClassName || ''}</td>
                  <td>
                    {isCapitalizedFromPurchaseInvoice(item) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="muted">AP Purchase Invoice</span>
                        <span>{sourceInvoiceLabel(item.purchaseInvoiceId)}</span>
                        <span className="muted">{sourceVendorLabel(item.purchaseInvoiceId, item.vendorId)}</span>
                      </div>
                    ) : (
                      <span className="muted">Manual / Direct</span>
                    )}
                  </td>
                  <td>{formatDate(item.capitalizationDateUtc || item.acquisitionDateUtc)}</td>
                  <td>{assetStatusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.acquisitionCost)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.accumulatedDepreciationAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.netBookValue)}</td>
                  <td>
                    <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                      <button className="button" onClick={() => setAssetDetailId(item.id)}>View</button>
                      {canPost && item.status === 1 ? <button className="button" onClick={() => openOperation('capitalize', item.id)}>Capitalize</button> : null}
                      {canPost && item.status !== 1 && item.status !== 6 ? <button className="button" onClick={() => openOperation('improve', item.id)}>Improve</button> : null}
                      {canPost && item.status !== 6 ? <button className="button" onClick={() => openOperation('transfer', item.id)}>Transfer</button> : null}
                      {canPost && item.status !== 6 ? <button className="button" onClick={() => openOperation('reclassify', item.id)}>Reclassify</button> : null}
                      {canPost && item.status !== 1 && item.status !== 6 ? <button className="button" onClick={() => openOperation('impair', item.id)}>Impair</button> : null}
                      {canPost && item.status !== 1 && item.status !== 6 ? <button className="button danger" onClick={() => openOperation('dispose', item.id)}>Dispose</button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading"><h2>Depreciation</h2><span className="muted">Preview and post depreciation runs</span></div>
        <div className="form-grid three">
          <div className="form-row"><label>Period Start</label><input className="input" type="date" value={depreciationForm.periodStartUtc} onChange={(e) => setDepreciationForm({ ...depreciationForm, periodStartUtc: e.target.value })} /></div>
          <div className="form-row"><label>Period End</label><input className="input" type="date" value={depreciationForm.periodEndUtc} onChange={(e) => setDepreciationForm({ ...depreciationForm, periodEndUtc: e.target.value })} /></div>
          <div className="form-row"><label>Run Date</label><input className="input" type="date" value={depreciationForm.runDateUtc} onChange={(e) => setDepreciationForm({ ...depreciationForm, runDateUtc: e.target.value })} /></div>
          <div className="form-row"><label>Reference</label><input className="input" value={depreciationForm.reference} onChange={(e) => setDepreciationForm({ ...depreciationForm, reference: e.target.value })} /></div>
          <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Description</label><input className="input" value={depreciationForm.description} onChange={(e) => setDepreciationForm({ ...depreciationForm, description: e.target.value })} /></div>
        </div>
        <div className="hero-actions" style={{ marginTop: 12 }}>
          <button className="button" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>Preview</button>
          <button className="button primary" onClick={() => runMut.mutate()} disabled={runMut.isPending}>Post Depreciation Run</button>
        </div>
        {previewItems.length > 0 ? (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead><tr><th>Asset</th><th>Period</th><th style={{ textAlign: 'right' }}>Depreciation</th><th style={{ textAlign: 'right' }}>Projected Acc. Dep</th><th style={{ textAlign: 'right' }}>Projected NBV</th></tr></thead>
              <tbody>
                {previewItems.map((item) => (
                  <tr key={item.fixedAssetId}>
                    <td>
                    <div>{item.assetNumber}</div>
                    <div className="muted">{item.assetName}</div>
                    {isCapitalizedFromPurchaseInvoice(item) ? <div className="muted">Capitalized from AP</div> : null}
                  </td>
                    <td>{formatDate(item.periodStartUtc)} - {formatDate(item.periodEndUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.depreciationAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.projectedAccumulatedDepreciationAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.projectedNetBookValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead><tr><th>Run Date</th><th>Period</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th><th>Lines</th><th>Journal</th></tr></thead>
            <tbody>
              {(runsQ.data?.items ?? []).map((item: FixedAssetDepreciationRunDto) => (
                <tr key={item.id}>
                  <td>{formatDate(item.runDateUtc)}</td>
                  <td>{formatDate(item.periodStartUtc)} - {formatDate(item.periodEndUtc)}</td>
                  <td>{item.description}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.totalDepreciationAmount)}</td>
                  <td>{item.lineCount}</td>
                  <td>{item.journalEntryId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {assetDetailId && detailQ.data ? (
        <div className="modal-backdrop" onMouseDown={() => setAssetDetailId('')}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Fixed Asset Detail</h2><button className="button ghost" onClick={() => setAssetDetailId('')}>✕</button></div>
            <div className="kv" style={{ marginBottom: 16 }}>
              <div className="kv-row"><span>Asset Number</span><span>{detailQ.data.fixedAsset.assetNumber}</span></div>
              <div className="kv-row"><span>Asset Name</span><span>{detailQ.data.fixedAsset.assetName}</span></div>
              <div className="kv-row"><span>Status</span><span>{assetStatusLabel(detailQ.data.fixedAsset.status)}</span></div>
              <div className="kv-row"><span>Acquisition Cost</span><span>{formatAmount(detailQ.data.fixedAsset.acquisitionCost)}</span></div>
              <div className="kv-row"><span>Accumulated Depreciation</span><span>{formatAmount(detailQ.data.fixedAsset.accumulatedDepreciationAmount)}</span></div>
              <div className="kv-row"><span>Impairment</span><span>{formatAmount(detailQ.data.fixedAsset.impairmentAmount)}</span></div>
              <div className="kv-row"><span>NBV</span><span>{formatAmount(detailQ.data.fixedAsset.netBookValue)}</span></div>
              <div className="kv-row"><span>Capitalized On</span><span>{formatDate(detailQ.data.fixedAsset.capitalizationDateUtc)}</span></div>
              <div className="kv-row"><span>Source</span><span>{detailQ.data.fixedAsset.purchaseInvoiceId ? 'AP Purchase Invoice' : 'Manual / Direct'}</span></div>
              <div className="kv-row"><span>Source Invoice</span><span>{sourceInvoiceLabel(detailQ.data.fixedAsset.purchaseInvoiceId)}</span></div>
              <div className="kv-row"><span>Source Vendor</span><span>{sourceVendorLabel(detailQ.data.fixedAsset.purchaseInvoiceId, detailQ.data.fixedAsset.vendorId)}</span></div>
              <div className="kv-row"><span>Location</span><span>{detailQ.data.fixedAsset.location || '—'}</span></div>
              <div className="kv-row"><span>Custodian</span><span>{detailQ.data.fixedAsset.custodian || '—'}</span></div>
            </div>
            <div className="section-heading"><h2 style={{ fontSize: 18 }}>Transactions</h2></div>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th><th>Reference</th></tr></thead><tbody>{detailQ.data.transactions.map((item) => <tr key={item.id}><td>{formatDate(item.transactionDateUtc)}</td><td>{item.transactionTypeName}</td><td>{item.description}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</td><td>{item.reference || '—'}</td></tr>)}</tbody></table></div>
            <div className="section-heading" style={{ marginTop: 16 }}><h2 style={{ fontSize: 18 }}>Depreciation Lines</h2></div>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Period</th><th style={{ textAlign: 'right' }}>Amount</th><th>Journal</th></tr></thead><tbody>{detailQ.data.depreciationLines.map((item) => <tr key={item.id}><td>{formatDate(item.depreciationPeriodStartUtc)} - {formatDate(item.depreciationPeriodEndUtc)}</td><td style={{ textAlign: 'right' }}>{formatAmount(item.depreciationAmount)}</td><td>{item.journalEntryId || '—'}</td></tr>)}</tbody></table></div>
            {detailQ.data.disposal ? (
              <div style={{ marginTop: 16 }} className="panel">
                <div className="section-heading"><h2 style={{ fontSize: 18 }}>Disposal</h2></div>
                <div className="kv">
                  <div className="kv-row"><span>Disposal Date</span><span>{formatDate(detailQ.data.disposal.disposalDateUtc)}</span></div>
                  <div className="kv-row"><span>Disposal Type</span><span>{disposalTypeLabel(detailQ.data.disposal.disposalType)}</span></div>
                  <div className="kv-row"><span>Proceeds</span><span>{formatAmount(detailQ.data.disposal.disposalProceedsAmount)}</span></div>
                  <div className="kv-row"><span>Net Book Value</span><span>{formatAmount(detailQ.data.disposal.netBookValueAtDisposal)}</span></div>
                  <div className="kv-row"><span>Gain / Loss</span><span>{formatAmount(detailQ.data.disposal.gainOrLossAmount)}</span></div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {operationMode ? (
        <div className="modal-backdrop" onMouseDown={() => setOperationMode('')}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>{operationMode === 'capitalize' ? 'Capitalize Fixed Asset' : operationMode === 'improve' ? 'Record Improvement' : operationMode === 'transfer' ? 'Transfer Fixed Asset' : operationMode === 'reclassify' ? 'Reclassify Fixed Asset' : operationMode === 'impair' ? 'Impair Fixed Asset' : 'Dispose Fixed Asset'}</h2><button className="button ghost" onClick={() => setOperationMode('')}>✕</button></div>
            {operationMode === 'capitalize' ? (
              <div className="form-grid two">
                <div className="form-row"><label>Capitalization Date</label><input className="input" type="date" value={capitalizeForm.capitalizationDateUtc} onChange={(e) => setCapitalizeForm({ ...capitalizeForm, capitalizationDateUtc: e.target.value })} /></div>
                <div className="form-row"><label>Credit Ledger</label><select className="select" value={capitalizeForm.creditLedgerAccountId} onChange={(e) => setCapitalizeForm({ ...capitalizeForm, creditLedgerAccountId: e.target.value })}><option value="">— Select —</option>{postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
                <div className="form-row"><label>Reference</label><input className="input" value={capitalizeForm.reference} onChange={(e) => setCapitalizeForm({ ...capitalizeForm, reference: e.target.value })} /></div>
                <div className="form-row"><label>Description</label><input className="input" value={capitalizeForm.description} onChange={(e) => setCapitalizeForm({ ...capitalizeForm, description: e.target.value })} /></div>
              </div>
            ) : null}
            {operationMode === 'improve' ? (
              <div className="form-grid two">
                <div className="form-row"><label>Transaction Date</label><input className="input" type="date" value={improvementForm.transactionDateUtc} onChange={(e) => setImprovementForm({ ...improvementForm, transactionDateUtc: e.target.value })} /></div>
                <div className="form-row"><label>Amount</label><input className="input" type="number" value={improvementForm.amount} onChange={(e) => setImprovementForm({ ...improvementForm, amount: e.target.value })} /></div>
                <div className="form-row"><label>Credit Ledger</label><select className="select" value={improvementForm.creditLedgerAccountId} onChange={(e) => setImprovementForm({ ...improvementForm, creditLedgerAccountId: e.target.value })}><option value="">— Select —</option>{postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
                <div className="form-row"><label>Useful Life Override</label><input className="input" type="number" value={improvementForm.usefulLifeMonthsOverride} onChange={(e) => setImprovementForm({ ...improvementForm, usefulLifeMonthsOverride: e.target.value })} /></div>
                <div className="form-row"><label>Reference</label><input className="input" value={improvementForm.reference} onChange={(e) => setImprovementForm({ ...improvementForm, reference: e.target.value })} /></div>
                <div className="form-row"><label>Description</label><input className="input" value={improvementForm.description} onChange={(e) => setImprovementForm({ ...improvementForm, description: e.target.value })} /></div>
              </div>
            ) : null}
            {operationMode === 'transfer' ? (
              <div className="form-grid two">
                <div className="form-row"><label>Transaction Date</label><input className="input" type="date" value={transferForm.transactionDateUtc} onChange={(e) => setTransferForm({ ...transferForm, transactionDateUtc: e.target.value })} /></div>
                <div className="form-row"><label>Location</label><input className="input" value={transferForm.location} onChange={(e) => setTransferForm({ ...transferForm, location: e.target.value })} /></div>
                <div className="form-row"><label>Custodian</label><input className="input" value={transferForm.custodian} onChange={(e) => setTransferForm({ ...transferForm, custodian: e.target.value })} /></div>
                <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={transferForm.notes} onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })} /></div>
              </div>
            ) : null}
            {operationMode === 'reclassify' ? (
              <div className="form-grid two">
                <div className="form-row"><label>Transaction Date</label><input className="input" type="date" value={reclassifyForm.transactionDateUtc} onChange={(e) => setReclassifyForm({ ...reclassifyForm, transactionDateUtc: e.target.value })} /></div>
                <div className="form-row"><label>Target Class</label><select className="select" value={reclassifyForm.targetFixedAssetClassId} onChange={(e) => setReclassifyForm({ ...reclassifyForm, targetFixedAssetClassId: e.target.value })}><option value="">— Select —</option>{(classesQ.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
                <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={reclassifyForm.notes} onChange={(e) => setReclassifyForm({ ...reclassifyForm, notes: e.target.value })} /></div>
              </div>
            ) : null}
            {operationMode === 'impair' ? (
              <div className="form-grid two">
                <div className="form-row"><label>Transaction Date</label><input className="input" type="date" value={impairForm.transactionDateUtc} onChange={(e) => setImpairForm({ ...impairForm, transactionDateUtc: e.target.value })} /></div>
                <div className="form-row"><label>Amount</label><input className="input" type="number" value={impairForm.amount} onChange={(e) => setImpairForm({ ...impairForm, amount: e.target.value })} /></div>
                <div className="form-row"><label>Reference</label><input className="input" value={impairForm.reference} onChange={(e) => setImpairForm({ ...impairForm, reference: e.target.value })} /></div>
                <div className="form-row"><label>Description</label><input className="input" value={impairForm.description} onChange={(e) => setImpairForm({ ...impairForm, description: e.target.value })} /></div>
              </div>
            ) : null}
            {operationMode === 'dispose' ? (
              <div className="form-grid two">
                <div className="form-row"><label>Disposal Date</label><input className="input" type="date" value={disposeForm.disposalDateUtc} onChange={(e) => setDisposeForm({ ...disposeForm, disposalDateUtc: e.target.value })} /></div>
                <div className="form-row"><label>Disposal Type</label><select className="select" value={disposeForm.disposalType} onChange={(e) => setDisposeForm({ ...disposeForm, disposalType: Number(e.target.value) as FixedAssetDisposalType })}><option value={1}>Sale</option><option value={2}>Scrap</option><option value={3}>Write-off</option><option value={4}>Donation</option></select></div>
                <div className="form-row"><label>Proceeds</label><input className="input" type="number" value={disposeForm.disposalProceedsAmount} onChange={(e) => setDisposeForm({ ...disposeForm, disposalProceedsAmount: e.target.value })} /></div>
                <div className="form-row"><label>Cash / Bank Ledger</label><select className="select" value={disposeForm.cashOrBankLedgerAccountId} onChange={(e) => setDisposeForm({ ...disposeForm, cashOrBankLedgerAccountId: e.target.value })}><option value="">— Select —</option>{cashBankAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
                <div className="form-row"><label>Reference</label><input className="input" value={disposeForm.reference} onChange={(e) => setDisposeForm({ ...disposeForm, reference: e.target.value })} /></div>
                <div className="form-row"><label>Description</label><input className="input" value={disposeForm.description} onChange={(e) => setDisposeForm({ ...disposeForm, description: e.target.value })} /></div>
                <div className="form-row" style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={disposeForm.notes} onChange={(e) => setDisposeForm({ ...disposeForm, notes: e.target.value })} /></div>
              </div>
            ) : null}
            <div className="modal-footer">
              <button className="button" onClick={() => setOperationMode('')}>Cancel</button>
              {operationMode === 'capitalize' ? <button className="button primary" onClick={() => capitalizeMut.mutate()} disabled={capitalizeMut.isPending}>Post Capitalization</button> : null}
              {operationMode === 'improve' ? <button className="button primary" onClick={() => improvementMut.mutate()} disabled={improvementMut.isPending}>Post Improvement</button> : null}
              {operationMode === 'transfer' ? <button className="button primary" onClick={() => transferMut.mutate()} disabled={transferMut.isPending}>Save Transfer</button> : null}
              {operationMode === 'reclassify' ? <button className="button primary" onClick={() => reclassifyMut.mutate()} disabled={reclassifyMut.isPending}>Save Reclassification</button> : null}
              {operationMode === 'impair' ? <button className="button primary" onClick={() => impairMut.mutate()} disabled={impairMut.isPending}>Post Impairment</button> : null}
              {operationMode === 'dispose' ? <button className="button danger" onClick={() => disposeMut.mutate()} disabled={disposeMut.isPending}>Post Disposal</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default FixedAssetsPage;
