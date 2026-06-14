import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  approveOilGasProductionEntry,
  createOilGasAsset,
  updateOilGasAsset,
  createOilGasBusinessUnit,
  updateOilGasBusinessUnit,
  createOilGasLocation,
  updateOilGasLocation,
  createOilGasMeter,
  updateOilGasMeter,
  createOilGasPermit,
  updateOilGasPermit,
  createOilGasProduct,
  updateOilGasProduct,
  createOilGasProductionEntry,
  createOilGasTank,
  updateOilGasTank,
  getOilGasAssets,
  getOilGasBusinessUnits,
  getOilGasComplianceReport,
  getOilGasDashboard,
  getOilGasLedgerAccounts,
  getOilGasLocations,
  getOilGasMeters,
  getOilGasPermits,
  getOilGasPostingSetup,
  getOilGasProductionEntries,
  getOilGasProductionSummary,
  getOilGasProducts,
  getOilGasTanks,
  getTenantReadableError,
  rejectOilGasProductionEntry,
  saveOilGasPostingSetup,
  submitOilGasProductionEntry,
  updateOilGasProductionEntry,
  type OilGasAssetDto,
  type OilGasBusinessUnitDto,
  type OilGasDashboardDto,
  type OilGasLedgerAccountDto,
  type OilGasLocationDto,
  type OilGasMeterDto,
  type OilGasPermitDto,
  type OilGasProductDto,
  type OilGasProductionEntryDto,
  type OilGasTankDto,
} from '../lib/api';
import {
  canApproveOilGasProduction,
  canCreateOilGasProduction,
  canManageOilGasAssets,
  canManageOilGasMeters,
  canManageOilGasPermits,
  canManageOilGasProducts,
  canManageOilGasSetup,
  canManageOilGasTanks,
  canRejectOilGasProduction,
  canSubmitOilGasProduction,
  canUpdateOilGasProduction,
  canViewOilGas,
  canViewOilGasReports,
} from '../lib/auth';

type Tab = 'dashboard' | 'setup' | 'assets' | 'production' | 'compliance' | 'reports';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function asDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : '';
}

function enumValue(value: string | number | null | undefined, values: string[]) {
  if (typeof value === 'number') return value;

  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]/g, '');

  const target = normalize(String(value ?? ''));
  const index = values.findIndex((item) => normalize(item) === target);

  return index >= 0 ? index : 0;
}

const assetTypes = [
  '',
  'Upstream Asset',
  'Field',
  'Terminal',
  'Depot',
  'Gas Plant',
  'Pipeline System',
  'Retail Network',
  'Service Project',
];

const locationTypes = [
  '',
  'Facility',
  'Flow Station',
  'Well',
  'Tank Farm',
  'Tank',
  'Metering Point',
  'Pipeline Segment',
  'Loading Bay',
  'Retail Station',
  'Other',
];

const productCategories = [
  '',
  'Crude Oil',
  'Condensate',
  'Natural Gas',
  'PMS',
  'AGO',
  'DPK',
  'LPG',
  'CNG',
  'Produced Water',
  'Other',
];

const operationalStatuses = ['', 'Active', 'Inactive', 'Maintenance', 'Retired'];
const permitStatuses = ['', 'Active', 'Expired', 'Suspended', 'Revoked'];

export function OilGasOperationsPage() {
  const location = useLocation();
  const canView = canViewOilGas();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<OilGasDashboardDto | null>(null);
  const [businessUnits, setBusinessUnits] = useState<OilGasBusinessUnitDto[]>([]);
  const [assets, setAssets] = useState<OilGasAssetDto[]>([]);
  const [locations, setLocations] = useState<OilGasLocationDto[]>([]);
  const [products, setProducts] = useState<OilGasProductDto[]>([]);
  const [tanks, setTanks] = useState<OilGasTankDto[]>([]);
  const [meters, setMeters] = useState<OilGasMeterDto[]>([]);
  const [permits, setPermits] = useState<OilGasPermitDto[]>([]);
  const [selectedBusinessUnit, setSelectedBusinessUnit] =
    useState<OilGasBusinessUnitDto | null>(null);
  const [selectedAsset, setSelectedAsset] =
    useState<OilGasAssetDto | null>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<OilGasLocationDto | null>(null);
  const [selectedProduct, setSelectedProduct] =
    useState<OilGasProductDto | null>(null);
  const [selectedTank, setSelectedTank] =
    useState<OilGasTankDto | null>(null);
  const [selectedMeter, setSelectedMeter] =
    useState<OilGasMeterDto | null>(null);
  const [selectedPermit, setSelectedPermit] =
    useState<OilGasPermitDto | null>(null);
  const [setupSearch, setSetupSearch] = useState('');
  const [ledgerAccounts, setLedgerAccounts] = useState<OilGasLedgerAccountDto[]>([]);
  const [production, setProduction] = useState<OilGasProductionEntryDto[]>([]);
  const [productionStatus, setProductionStatus] = useState('');
  const [selectedProduction, setSelectedProduction] = useState<OilGasProductionEntryDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reportFrom, setReportFrom] = useState(monthStart);
  const [reportTo, setReportTo] = useState(today);
  const [report, setReport] = useState<any>(null);
  const [compliance, setCompliance] = useState<any>(null);
  const [postingSetup, setPostingSetup] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(true);

  const activeLocations = useMemo(() => locations.filter((x) => x.isActive), [locations]);
  const activeProducts = useMemo(() => products.filter((x) => x.isActive), [products]);

  async function loadAll() {
    if (!canView) return;
    setLoading(true);
    setErrorText('');
    try {
      const [
        dashboardData,
        businessUnitsData,
        assetsData,
        locationsData,
        productsData,
        tanksData,
        metersData,
        permitsData,
        accountData,
        setupData,
        productionData,
      ] = await Promise.all([
        getOilGasDashboard(),
        getOilGasBusinessUnits(),
        getOilGasAssets(),
        getOilGasLocations(),
        getOilGasProducts(),
        getOilGasTanks(),
        getOilGasMeters(),
        getOilGasPermits(),
        getOilGasLedgerAccounts(),
        getOilGasPostingSetup(),
        getOilGasProductionEntries(productionStatus ? { status: productionStatus } : undefined),
      ]);
      setDashboard(dashboardData);
      setBusinessUnits(businessUnitsData?.items ?? []);
      setAssets(assetsData?.items ?? []);
      setLocations(locationsData?.items ?? []);
      setProducts(productsData?.items ?? []);
      setTanks(tanksData?.items ?? []);
      setMeters(metersData?.items ?? []);
      setPermits(permitsData?.items ?? []);
      setLedgerAccounts(accountData?.items ?? []);
      setPostingSetup(setupData?.item ?? null);
      setProduction(productionData?.items ?? []);
    } catch (error) {
      setErrorText(getTenantReadableError(error, 'Unable to load Oil & Gas operations.'));
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/setup')) setTab('setup');
    else if (path.includes('/assets')) setTab('assets');
    else if (path.includes('/production')) {
      setTab('production');
      if (path.includes('/rejected')) setProductionStatus('Rejected');
    }
    else if (path.includes('/compliance')) setTab('compliance');
    else if (path.includes('/reports')) setTab('reports');
    else setTab('dashboard');
  }, [location.pathname]);

  useEffect(() => {
    void loadAll();
  }, [canView, productionStatus]);

  async function runAction(action: () => Promise<any>, successMessage: string) {
    setErrorText('');
    setMessage('');
    try {
      const response = await action();
      setMessage(response?.message || successMessage);
      await loadAll();
      return true;
    } catch (error) {
      setErrorText(getTenantReadableError(error, successMessage));
      return false;
    }
  }


  async function submitBusinessUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      code: String(data.get('code') ?? ''),
      name: String(data.get('name') ?? ''),
      description: String(data.get('description') ?? ''),
      isActive: String(data.get('isActive') ?? 'true') === 'true',
    };

    const ok = await runAction(
      selectedBusinessUnit
        ? () => updateOilGasBusinessUnit(selectedBusinessUnit.id, payload)
        : () => createOilGasBusinessUnit(payload),
      selectedBusinessUnit
        ? 'Business unit updated.'
        : 'Business unit created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedBusinessUnit(null);
    }
  }


  async function submitAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      businessUnitId: String(data.get('businessUnitId') ?? ''),
      code: String(data.get('code') ?? ''),
      name: String(data.get('name') ?? ''),
      assetType: numberValue(data.get('assetType')),
      operatorName: String(data.get('operatorName') ?? ''),
      ownershipPercentage: numberValue(data.get('ownershipPercentage')),
      organizationCostCenterId: null,
      locationDescription: String(data.get('locationDescription') ?? ''),
      commissioningDateUtc: data.get('commissioningDateUtc') || null,
      isActive: String(data.get('isActive') ?? 'true') === 'true',
      notes: String(data.get('notes') ?? ''),
    };

    const ok = await runAction(
      selectedAsset
        ? () => updateOilGasAsset(selectedAsset.id, payload)
        : () => createOilGasAsset(payload),
      selectedAsset ? 'Asset updated.' : 'Asset created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedAsset(null);
    }
  }


  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      assetId: String(data.get('assetId') ?? ''),
      parentLocationId: data.get('parentLocationId') || null,
      code: String(data.get('code') ?? ''),
      name: String(data.get('name') ?? ''),
      locationType: numberValue(data.get('locationType')),
      coordinates: String(data.get('coordinates') ?? ''),
      isActive: String(data.get('isActive') ?? 'true') === 'true',
      notes: String(data.get('notes') ?? ''),
    };

    const ok = await runAction(
      selectedLocation
        ? () => updateOilGasLocation(selectedLocation.id, payload)
        : () => createOilGasLocation(payload),
      selectedLocation
        ? 'Operational location updated.'
        : 'Operational location created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedLocation(null);
    }
  }


  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      code: String(data.get('code') ?? ''),
      name: String(data.get('name') ?? ''),
      category: numberValue(data.get('category')),
      unitOfMeasure: String(data.get('unitOfMeasure') ?? ''),
      standardDensity: optionalNumber(data.get('standardDensity')),
      isActive: String(data.get('isActive') ?? 'true') === 'true',
      notes: String(data.get('notes') ?? ''),
    };

    const ok = await runAction(
      selectedProduct
        ? () => updateOilGasProduct(selectedProduct.id, payload)
        : () => createOilGasProduct(payload),
      selectedProduct
        ? 'Petroleum product updated.'
        : 'Petroleum product created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedProduct(null);
    }
  }


  async function submitTank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      locationId: String(data.get('locationId') ?? ''),
      productId: String(data.get('productId') ?? ''),
      tankCode: String(data.get('tankCode') ?? ''),
      tankName: String(data.get('tankName') ?? ''),
      nominalCapacity: numberValue(data.get('nominalCapacity')),
      safeWorkingCapacity: numberValue(data.get('safeWorkingCapacity')),
      currentBookStock: selectedTank
        ? selectedTank.currentBookStock
        : numberValue(data.get('currentBookStock')),
      status: numberValue(data.get('status')),
      notes: String(data.get('notes') ?? ''),
    };

    const ok = await runAction(
      selectedTank
        ? () => updateOilGasTank(selectedTank.id, payload)
        : () => createOilGasTank(payload),
      selectedTank ? 'Tank updated.' : 'Tank created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedTank(null);
    }
  }


  async function submitMeter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      locationId: String(data.get('locationId') ?? ''),
      productId: String(data.get('productId') ?? ''),
      meterCode: String(data.get('meterCode') ?? ''),
      meterName: String(data.get('meterName') ?? ''),
      meterType: String(data.get('meterType') ?? ''),
      serialNumber: String(data.get('serialNumber') ?? ''),
      lastCalibrationDateUtc: data.get('lastCalibrationDateUtc') || null,
      nextCalibrationDateUtc: data.get('nextCalibrationDateUtc') || null,
      status: numberValue(data.get('status')),
      notes: String(data.get('notes') ?? ''),
    };

    const ok = await runAction(
      selectedMeter
        ? () => updateOilGasMeter(selectedMeter.id, payload)
        : () => createOilGasMeter(payload),
      selectedMeter ? 'Meter updated.' : 'Meter created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedMeter(null);
    }
  }


  async function submitPermit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      assetId: data.get('assetId') || null,
      locationId: data.get('locationId') || null,
      permitNumber: String(data.get('permitNumber') ?? ''),
      permitType: String(data.get('permitType') ?? ''),
      issuingAuthority: String(data.get('issuingAuthority') ?? ''),
      effectiveDateUtc: data.get('effectiveDateUtc'),
      expiryDateUtc: data.get('expiryDateUtc'),
      status: numberValue(data.get('status')),
      responsibleOfficer: String(data.get('responsibleOfficer') ?? ''),
      notes: String(data.get('notes') ?? ''),
    };

    const ok = await runAction(
      selectedPermit
        ? () => updateOilGasPermit(selectedPermit.id, payload)
        : () => createOilGasPermit(payload),
      selectedPermit
        ? 'Licence or permit updated.'
        : 'Licence or permit created.',
    );

    if (ok) {
      formElement.reset();
      setSelectedPermit(null);
    }
  }

  async function submitPostingSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await runAction(
      () => saveOilGasPostingSetup({
        inventoryAssetLedgerAccountId: String(data.get('inventoryAssetLedgerAccountId') ?? ''),
        productionRevenueLedgerAccountId: String(data.get('productionRevenueLedgerAccountId') ?? ''),
        productionLossExpenseLedgerAccountId: String(data.get('productionLossExpenseLedgerAccountId') ?? ''),
        gasFlareExpenseLedgerAccountId: String(data.get('gasFlareExpenseLedgerAccountId') ?? ''),
        productionCostLedgerAccountId: data.get('productionCostLedgerAccountId') || null,
        notes: String(data.get('notes') ?? ''),
      }),
      'Posting setup saved.'
    );
  }

  async function submitProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      productionDateUtc: data.get('productionDateUtc'),
      assetId: String(data.get('assetId') ?? ''),
      locationId: String(data.get('locationId') ?? ''),
      productId: String(data.get('productId') ?? ''),
      meterId: data.get('meterId') || null,
      grossOilVolume: numberValue(data.get('grossOilVolume')),
      netOilVolume: numberValue(data.get('netOilVolume')),
      gasProducedVolume: numberValue(data.get('gasProducedVolume')),
      gasFlaredVolume: numberValue(data.get('gasFlaredVolume')),
      waterProducedVolume: numberValue(data.get('waterProducedVolume')),
      openingStockVolume: numberValue(data.get('openingStockVolume')),
      closingStockVolume: numberValue(data.get('closingStockVolume')),
      lossAdjustmentVolume: numberValue(data.get('lossAdjustmentVolume')),
      downtimeHours: numberValue(data.get('downtimeHours')),
      downtimeReason: String(data.get('downtimeReason') ?? ''),
      meterReading: optionalNumber(data.get('meterReading')),
      notes: String(data.get('notes') ?? ''),
    };
    const action = selectedProduction
      ? () => updateOilGasProductionEntry(selectedProduction.id, payload)
      : () => createOilGasProductionEntry(payload);
    const ok = await runAction(action, selectedProduction ? 'Production entry updated.' : 'Production entry created.');
    if (ok) {
      event.currentTarget.reset();
      setSelectedProduction(null);
    }
  }

  async function loadReport() {
    setErrorText('');
    try {
      setReport(await getOilGasProductionSummary(reportFrom, reportTo));
    } catch (error) {
      setErrorText(getTenantReadableError(error, 'Unable to load Oil & Gas production report.'));
    }
  }

  async function loadCompliance() {
    setErrorText('');
    try {
      setCompliance(await getOilGasComplianceReport());
    } catch (error) {
      setErrorText(getTenantReadableError(error, 'Unable to load Oil & Gas compliance report.'));
    }
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Oil & Gas Operations.</div>;
  if (loading) return <div className="panel">Loading Oil & Gas Operations...</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Oil & Gas Operations</h2>
        <p className="muted">
          Tenant-aware operational management integrated with iBalance Chart of Accounts, approvals, audit trail and enterprise reporting.
        </p>
        <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
          {(['dashboard','setup','assets','production','compliance','reports'] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? 'button primary' : 'button secondary'} onClick={() => setTab(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        {message ? <div className="success-panel" style={{ marginTop: 12 }}>{message}</div> : null}
        {errorText ? <div className="error-panel" style={{ marginTop: 12 }}>{errorText}</div> : null}
      </section>

      {tab === 'dashboard' && dashboard ? (
        <>
          <section className="stats-grid">
            {[
              ['Assets', dashboard.assetCount],
              ['Locations', dashboard.locationCount],
              ['Tanks', dashboard.tankCount],
              ['Meters', dashboard.meterCount],
              ['Pending Approvals', dashboard.pendingProductionCount],
              ['Expiring Permits', dashboard.expiringPermitCount],
              ['Today Net Oil', dashboard.todayNetOilVolume],
              ['Today Gas Produced', dashboard.todayGasProducedVolume],
              ['Today Gas Flared', dashboard.todayGasFlaredVolume],
              ['Today Water', dashboard.todayWaterProducedVolume],
            ].map(([label, value]) => (
              <div className="stat-card" key={String(label)}>
                <div className="stat-label">{label}</div>
                <div className="stat-value">{Number(value).toLocaleString()}</div>
              </div>
            ))}
          </section>
          <section className="panel">
            <h3>Recent Production Entries</h3>
            <ProductionTable items={dashboard.recentEntries ?? []} compact />
          </section>
        </>
      ) : null}

      {tab === 'setup' ? (
        <div className="page-grid">
          <section className="panel">
            <div className="section-heading">
              <div>
                <h3>Oil & Gas Setup Registers</h3>
                <div className="muted">
                  Create, review and maintain all Oil & Gas master data from one place.
                </div>
              </div>
              <input
                className="input"
                style={{ maxWidth: 320 }}
                value={setupSearch}
                onChange={(event) => setSetupSearch(event.target.value)}
                placeholder="Search setup registers"
              />
            </div>
          </section>

          {canManageOilGasSetup() ? (
            <section className="panel">
              <h3>Shared Chart of Accounts Posting Setup</h3>
              <p className="muted">
                Only active, non-header, posting-enabled accounts from the shared
                iBalance Chart of Accounts are accepted.
              </p>
              <form onSubmit={submitPostingSetup} key={postingSetup?.id ?? 'new-posting-setup'}>
                <div className="form-grid two">
                  {[
                    ['inventoryAssetLedgerAccountId', 'Inventory Asset Account'],
                    ['productionRevenueLedgerAccountId', 'Production Revenue Account'],
                    ['productionLossExpenseLedgerAccountId', 'Production Loss Expense Account'],
                    ['gasFlareExpenseLedgerAccountId', 'Gas Flare Expense Account'],
                    ['productionCostLedgerAccountId', 'Production Cost Account (Optional)'],
                  ].map(([name, label]) => (
                    <div className="form-row" key={name}>
                      <label>{label}</label>
                      <select
                        className="input"
                        name={name}
                        defaultValue={postingSetup?.[name] ?? ''}
                        required={name !== 'productionCostLedgerAccountId'}
                      >
                        <option value="">Select posting account</option>
                        {ledgerAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="form-row">
                  <label>Notes</label>
                  <textarea className="input" name="notes" defaultValue={postingSetup?.notes ?? ''} />
                </div>
                <button className="button primary" type="submit">
                  Save Posting Setup
                </button>
              </form>
            </section>
          ) : null}

          {canManageOilGasAssets() ? (
            <section className="panel">
              <div className="section-heading">
                <h3>{selectedBusinessUnit ? 'Edit Business Unit' : 'New Business Unit'}</h3>
                {selectedBusinessUnit ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setSelectedBusinessUnit(null)}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
              <form
                onSubmit={submitBusinessUnit}
                key={selectedBusinessUnit?.id ?? 'new-business-unit'}
              >
                <div className="form-grid four">
                  <div className="form-row">
                    <label>Code</label>
                    <input className="input" name="code" defaultValue={selectedBusinessUnit?.code ?? ''} required />
                  </div>
                  <div className="form-row">
                    <label>Name</label>
                    <input className="input" name="name" defaultValue={selectedBusinessUnit?.name ?? ''} required />
                  </div>
                  <div className="form-row">
                    <label>Description</label>
                    <input className="input" name="description" defaultValue={selectedBusinessUnit?.description ?? ''} />
                  </div>
                  <div className="form-row">
                    <label>Status</label>
                    <select className="input" name="isActive" defaultValue={String(selectedBusinessUnit?.isActive ?? true)}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
                <button className="button primary" type="submit">
                  {selectedBusinessUnit ? 'Update Business Unit' : 'Create Business Unit'}
                </button>
              </form>

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Code</th><th>Name</th><th>Description</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {businessUnits
                      .filter((item) => `${item.code} ${item.name} ${item.description ?? ''}`.toLowerCase().includes(setupSearch.toLowerCase()))
                      .map((item) => (
                        <tr key={item.id}>
                          <td>{item.code}</td>
                          <td>{item.name}</td>
                          <td>{item.description || '—'}</td>
                          <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                          <td><button className="button secondary" type="button" onClick={() => setSelectedBusinessUnit(item)}>Edit</button></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {canManageOilGasProducts() ? (
            <section className="panel">
              <div className="section-heading">
                <h3>{selectedProduct ? 'Edit Petroleum Product' : 'New Petroleum Product'}</h3>
                {selectedProduct ? (
                  <button className="button secondary" type="button" onClick={() => setSelectedProduct(null)}>Cancel Edit</button>
                ) : null}
              </div>
              <form onSubmit={submitProduct} key={selectedProduct?.id ?? 'new-product'}>
                <div className="form-grid four">
                  <div className="form-row"><label>Code</label><input className="input" name="code" defaultValue={selectedProduct?.code ?? ''} required /></div>
                  <div className="form-row"><label>Name</label><input className="input" name="name" defaultValue={selectedProduct?.name ?? ''} required /></div>
                  <div className="form-row">
                    <label>Category</label>
                    <select className="input" name="category" defaultValue={enumValue(selectedProduct?.category, productCategories)} required>
                      {productCategories.map((item, index) => <option key={index} value={index}>{item || 'Select category'}</option>)}
                    </select>
                  </div>
                  <div className="form-row"><label>Unit of Measure</label><input className="input" name="unitOfMeasure" defaultValue={selectedProduct?.unitOfMeasure ?? ''} required /></div>
                  <div className="form-row"><label>Standard Density</label><input className="input" type="number" step="0.000001" name="standardDensity" defaultValue={selectedProduct?.standardDensity ?? ''} /></div>
                  <div className="form-row">
                    <label>Status</label>
                    <select className="input" name="isActive" defaultValue={String(selectedProduct?.isActive ?? true)}>
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedProduct?.notes ?? ''} /></div>
                </div>
                <button className="button primary" type="submit">
                  {selectedProduct ? 'Update Product' : 'Create Product'}
                </button>
              </form>

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Name</th><th>Category</th><th>UOM</th><th>Density</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {products
                      .filter((item) => `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(setupSearch.toLowerCase()))
                      .map((item) => (
                        <tr key={item.id}>
                          <td>{item.code}</td><td>{item.name}</td><td>{item.category}</td>
                          <td>{item.unitOfMeasure}</td><td>{item.standardDensity ?? '—'}</td>
                          <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                          <td><button className="button secondary" type="button" onClick={() => setSelectedProduct(item)}>Edit</button></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'assets' ? (
        <div className="page-grid">
          {canManageOilGasAssets() ? (
            <>
              <section className="panel">
                <div className="section-heading">
                  <h3>{selectedAsset ? 'Edit Operational Asset' : 'New Operational Asset'}</h3>
                  {selectedAsset ? <button className="button secondary" type="button" onClick={() => setSelectedAsset(null)}>Cancel Edit</button> : null}
                </div>
                <form onSubmit={submitAsset} key={selectedAsset?.id ?? 'new-asset'}>
                  <div className="form-grid four">
                    <div className="form-row"><label>Business Unit</label><select className="input" name="businessUnitId" defaultValue={selectedAsset?.businessUnitId ?? ''} required><option value="">Select</option>{businessUnits.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                    <div className="form-row"><label>Code</label><input className="input" name="code" defaultValue={selectedAsset?.code ?? ''} required /></div>
                    <div className="form-row"><label>Name</label><input className="input" name="name" defaultValue={selectedAsset?.name ?? ''} required /></div>
                    <div className="form-row"><label>Asset Type</label><select className="input" name="assetType" defaultValue={enumValue(selectedAsset?.assetType, assetTypes)} required>{assetTypes.map((x, i) => <option key={i} value={i}>{x || 'Select type'}</option>)}</select></div>
                    <div className="form-row"><label>Operator</label><input className="input" name="operatorName" defaultValue={selectedAsset?.operatorName ?? ''} /></div>
                    <div className="form-row"><label>Ownership %</label><input className="input" type="number" min="0" max="100" step="0.0001" name="ownershipPercentage" defaultValue={selectedAsset?.ownershipPercentage ?? 100} required /></div>
                    <div className="form-row"><label>Location Description</label><input className="input" name="locationDescription" defaultValue={selectedAsset?.locationDescription ?? ''} /></div>
                    <div className="form-row"><label>Commissioning Date</label><input className="input" type="date" name="commissioningDateUtc" defaultValue={dateInputValue(selectedAsset?.commissioningDateUtc)} /></div>
                    <div className="form-row"><label>Status</label><select className="input" name="isActive" defaultValue={String(selectedAsset?.isActive ?? true)}><option value="true">Active</option><option value="false">Inactive</option></select></div>
                    <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedAsset?.notes ?? ''} /></div>
                  </div>
                  <button className="button primary" type="submit">{selectedAsset ? 'Update Asset' : 'Create Asset'}</button>
                </form>

                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead><tr><th>Code</th><th>Name</th><th>Business Unit</th><th>Type</th><th>Operator</th><th>Ownership</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {assets.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.businessUnitName}</td><td>{item.assetType}</td><td>{item.operatorName || '—'}</td><td>{item.ownershipPercentage}%</td><td>{item.isActive ? 'Active' : 'Inactive'}</td><td><button className="button secondary" type="button" onClick={() => setSelectedAsset(item)}>Edit</button></td></tr>)}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel">
                <div className="section-heading">
                  <h3>{selectedLocation ? 'Edit Operational Location' : 'New Operational Location'}</h3>
                  {selectedLocation ? <button className="button secondary" type="button" onClick={() => setSelectedLocation(null)}>Cancel Edit</button> : null}
                </div>
                <form onSubmit={submitLocation} key={selectedLocation?.id ?? 'new-location'}>
                  <div className="form-grid four">
                    <div className="form-row"><label>Asset</label><select className="input" name="assetId" defaultValue={selectedLocation?.assetId ?? ''} required><option value="">Select</option>{assets.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                    <div className="form-row"><label>Parent Location</label><select className="input" name="parentLocationId" defaultValue={selectedLocation?.parentLocationId ?? ''}><option value="">None</option>{locations.filter((x) => x.id !== selectedLocation?.id).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                    <div className="form-row"><label>Code</label><input className="input" name="code" defaultValue={selectedLocation?.code ?? ''} required /></div>
                    <div className="form-row"><label>Name</label><input className="input" name="name" defaultValue={selectedLocation?.name ?? ''} required /></div>
                    <div className="form-row"><label>Type</label><select className="input" name="locationType" defaultValue={enumValue(selectedLocation?.locationType, locationTypes)} required>{locationTypes.map((x, i) => <option key={i} value={i}>{x || 'Select type'}</option>)}</select></div>
                    <div className="form-row"><label>Coordinates</label><input className="input" name="coordinates" defaultValue={selectedLocation?.coordinates ?? ''} /></div>
                    <div className="form-row"><label>Status</label><select className="input" name="isActive" defaultValue={String(selectedLocation?.isActive ?? true)}><option value="true">Active</option><option value="false">Inactive</option></select></div>
                    <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedLocation?.notes ?? ''} /></div>
                  </div>
                  <button className="button primary" type="submit">{selectedLocation ? 'Update Location' : 'Create Location'}</button>
                </form>
                <div className="table-wrap" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead><tr><th>Code</th><th>Name</th><th>Asset</th><th>Parent</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>{locations.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td>{item.assetName}</td><td>{item.parentLocationName || '—'}</td><td>{item.locationType}</td><td>{item.isActive ? 'Active' : 'Inactive'}</td><td><button className="button secondary" type="button" onClick={() => setSelectedLocation(item)}>Edit</button></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          {canManageOilGasTanks() ? (
            <section className="panel">
              <div className="section-heading">
                <div><h3>{selectedTank ? 'Edit Tank' : 'New Tank'}</h3><div className="muted">Current Book Stock is editable only during initial creation. Later changes must use controlled stock movements or reconciliation.</div></div>
                {selectedTank ? <button className="button secondary" type="button" onClick={() => setSelectedTank(null)}>Cancel Edit</button> : null}
              </div>
              <form onSubmit={submitTank} key={selectedTank?.id ?? 'new-tank'}>
                <div className="form-grid four">
                  <div className="form-row"><label>Location</label><select className="input" name="locationId" defaultValue={selectedTank?.locationId ?? ''} required><option value="">Select</option>{activeLocations.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Product</label><select className="input" name="productId" defaultValue={selectedTank?.productId ?? ''} required><option value="">Select</option>{activeProducts.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Tank Code</label><input className="input" name="tankCode" defaultValue={selectedTank?.tankCode ?? ''} required /></div>
                  <div className="form-row"><label>Tank Name</label><input className="input" name="tankName" defaultValue={selectedTank?.tankName ?? ''} required /></div>
                  <div className="form-row"><label>Nominal Capacity</label><input className="input" type="number" min="0.0001" step="0.0001" name="nominalCapacity" defaultValue={selectedTank?.nominalCapacity ?? ''} required /></div>
                  <div className="form-row"><label>Safe Working Capacity</label><input className="input" type="number" min="0.0001" step="0.0001" name="safeWorkingCapacity" defaultValue={selectedTank?.safeWorkingCapacity ?? ''} required /></div>
                  <div className="form-row"><label>Current Book Stock</label><input className="input" type="number" min="0" step="0.0001" name="currentBookStock" defaultValue={selectedTank?.currentBookStock ?? 0} disabled={Boolean(selectedTank)} /></div>
                  <div className="form-row"><label>Status</label><select className="input" name="status" defaultValue={selectedTank ? enumValue(selectedTank.status, operationalStatuses) : 1} required>{operationalStatuses.map((x, i) => <option key={i} value={i}>{x || 'Select status'}</option>)}</select></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedTank?.notes ?? ''} /></div>
                </div>
                <button className="button primary" type="submit">{selectedTank ? 'Update Tank' : 'Create Tank'}</button>
              </form>
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Name</th><th>Location</th><th>Product</th><th>Nominal</th><th>Safe</th><th>Book Stock</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{tanks.map((item) => <tr key={item.id}><td>{item.tankCode}</td><td>{item.tankName}</td><td>{item.locationName}</td><td>{item.productName}</td><td>{item.nominalCapacity.toLocaleString()}</td><td>{item.safeWorkingCapacity.toLocaleString()}</td><td>{item.currentBookStock.toLocaleString()}</td><td>{item.status}</td><td><button className="button secondary" type="button" onClick={() => setSelectedTank(item)}>Edit</button></td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}

          {canManageOilGasMeters() ? (
            <section className="panel">
              <div className="section-heading">
                <h3>{selectedMeter ? 'Edit Meter' : 'New Meter'}</h3>
                {selectedMeter ? <button className="button secondary" type="button" onClick={() => setSelectedMeter(null)}>Cancel Edit</button> : null}
              </div>
              <form onSubmit={submitMeter} key={selectedMeter?.id ?? 'new-meter'}>
                <div className="form-grid four">
                  <div className="form-row"><label>Location</label><select className="input" name="locationId" defaultValue={selectedMeter?.locationId ?? ''} required><option value="">Select</option>{activeLocations.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Product</label><select className="input" name="productId" defaultValue={selectedMeter?.productId ?? ''} required><option value="">Select</option>{activeProducts.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Meter Code</label><input className="input" name="meterCode" defaultValue={selectedMeter?.meterCode ?? ''} required /></div>
                  <div className="form-row"><label>Meter Name</label><input className="input" name="meterName" defaultValue={selectedMeter?.meterName ?? ''} required /></div>
                  <div className="form-row"><label>Meter Type</label><input className="input" name="meterType" defaultValue={selectedMeter?.meterType ?? ''} required /></div>
                  <div className="form-row"><label>Serial Number</label><input className="input" name="serialNumber" defaultValue={selectedMeter?.serialNumber ?? ''} /></div>
                  <div className="form-row"><label>Last Calibration</label><input className="input" type="date" name="lastCalibrationDateUtc" defaultValue={dateInputValue(selectedMeter?.lastCalibrationDateUtc)} /></div>
                  <div className="form-row"><label>Next Calibration</label><input className="input" type="date" name="nextCalibrationDateUtc" defaultValue={dateInputValue(selectedMeter?.nextCalibrationDateUtc)} /></div>
                  <div className="form-row"><label>Status</label><select className="input" name="status" defaultValue={selectedMeter ? enumValue(selectedMeter.status, operationalStatuses) : 1} required>{operationalStatuses.map((x, i) => <option key={i} value={i}>{x || 'Select status'}</option>)}</select></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedMeter?.notes ?? ''} /></div>
                </div>
                <button className="button primary" type="submit">{selectedMeter ? 'Update Meter' : 'Create Meter'}</button>
              </form>
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Serial</th><th>Location</th><th>Product</th><th>Next Calibration</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>{meters.map((item) => <tr key={item.id}><td>{item.meterCode}</td><td>{item.meterName}</td><td>{item.meterType}</td><td>{item.serialNumber || '—'}</td><td>{item.locationName}</td><td>{item.productName}</td><td>{asDate(item.nextCalibrationDateUtc)}</td><td>{item.status}</td><td><button className="button secondary" type="button" onClick={() => setSelectedMeter(item)}>Edit</button></td></tr>)}</tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'production' ? (
        <div className="page-grid">
          {canCreateOilGasProduction() || (selectedProduction && canUpdateOilGasProduction()) ? (
            <section className="panel">
              <h3>{selectedProduction ? `Edit ${selectedProduction.entryNumber}` : 'Daily Production Entry'}</h3>
              {selectedProduction?.rejectionReason ? <div className="error-panel">Rejection reason: {selectedProduction.rejectionReason}</div> : null}
              <form onSubmit={submitProduction} key={selectedProduction?.id ?? 'new'}>
                <div className="form-grid three">
                  <div className="form-row"><label>Production Date</label><input className="input" type="date" name="productionDateUtc" defaultValue={selectedProduction?.productionDateUtc?.slice(0,10) ?? today} required /></div>
                  <div className="form-row"><label>Asset</label><select className="input" name="assetId" defaultValue={selectedProduction?.assetId ?? ''} required><option value="">Select</option>{assets.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Location</label><select className="input" name="locationId" defaultValue={selectedProduction?.locationId ?? ''} required><option value="">Select</option>{activeLocations.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Product</label><select className="input" name="productId" defaultValue={selectedProduction?.productId ?? ''} required><option value="">Select</option>{activeProducts.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Meter</label><select className="input" name="meterId" defaultValue={selectedProduction?.meterId ?? ''}><option value="">None</option>{meters.map(x=><option key={x.id} value={x.id}>{x.meterCode} - {x.meterName}</option>)}</select></div>
                  {[
                    ['grossOilVolume','Gross Oil'],['netOilVolume','Net Oil'],['gasProducedVolume','Gas Produced'],
                    ['gasFlaredVolume','Gas Flared'],['waterProducedVolume','Water Produced'],['openingStockVolume','Opening Stock'],
                    ['closingStockVolume','Closing Stock'],['lossAdjustmentVolume','Loss / Adjustment'],['downtimeHours','Downtime Hours'],
                    ['meterReading','Meter Reading'],
                  ].map(([name,label]) => (
                    <div className="form-row" key={name}><label>{label}</label><input className="input" type="number" min={name === 'lossAdjustmentVolume' ? undefined : '0'} max={name === 'downtimeHours' ? '24' : undefined} step="0.0001" name={name} defaultValue={(selectedProduction as any)?.[name] ?? 0} /></div>
                  ))}
                  <div className="form-row"><label>Downtime Reason</label><input className="input" name="downtimeReason" defaultValue={selectedProduction?.downtimeReason ?? ''} /></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedProduction?.notes ?? ''} /></div>
                </div>
                <div className="inline-actions">
                  <button className="button primary" type="submit">{selectedProduction ? 'Update Entry' : 'Create Entry'}</button>
                  {selectedProduction ? <button className="button secondary" type="button" onClick={()=>setSelectedProduction(null)}>Cancel Edit</button> : null}
                </div>
              </form>
            </section>
          ) : null}
          <section className="panel">
            <div className="inline-actions" style={{ justifyContent:'space-between' }}>
              <h3>Production Register</h3>
              <select className="input" style={{ maxWidth:240 }} value={productionStatus} onChange={e=>setProductionStatus(e.target.value)}>
                <option value="">All statuses</option><option value="Draft">Draft</option><option value="Submitted">Submitted</option><option value="Approved">Approved</option><option value="Rejected">Rejected</option>
              </select>
            </div>
            <ProductionTable
              items={production}
              onEdit={(item)=>setSelectedProduction(item)}
              onSubmit={(item)=>void runAction(()=>submitOilGasProductionEntry(item.id),'Production entry submitted.')}
              onApprove={(item)=>void runAction(()=>approveOilGasProductionEntry(item.id),'Production entry approved.')}
              onReject={(item)=>void runAction(()=>rejectOilGasProductionEntry(item.id,rejectionReason),'Production entry rejected.')}
              rejectionReason={rejectionReason}
              setRejectionReason={setRejectionReason}
            />
          </section>
        </div>
      ) : null}

      {tab === 'compliance' ? (
        <div className="page-grid">
          {canManageOilGasPermits() ? (
            <section className="panel">
              <div className="section-heading">
                <h3>{selectedPermit ? 'Edit Licence or Permit' : 'New Licence or Permit'}</h3>
                {selectedPermit ? <button className="button secondary" type="button" onClick={() => setSelectedPermit(null)}>Cancel Edit</button> : null}
              </div>
              <form onSubmit={submitPermit} key={selectedPermit?.id ?? 'new-permit'}>
                <div className="form-grid four">
                  <div className="form-row"><label>Asset</label><select className="input" name="assetId" defaultValue={selectedPermit?.assetId ?? ''}><option value="">None</option>{assets.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Location</label><select className="input" name="locationId" defaultValue={selectedPermit?.locationId ?? ''}><option value="">None</option>{locations.map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Permit Number</label><input className="input" name="permitNumber" defaultValue={selectedPermit?.permitNumber ?? ''} required /></div>
                  <div className="form-row"><label>Permit Type</label><input className="input" name="permitType" defaultValue={selectedPermit?.permitType ?? ''} required /></div>
                  <div className="form-row"><label>Issuing Authority</label><input className="input" name="issuingAuthority" defaultValue={selectedPermit?.issuingAuthority ?? ''} required /></div>
                  <div className="form-row"><label>Effective Date</label><input className="input" type="date" name="effectiveDateUtc" defaultValue={dateInputValue(selectedPermit?.effectiveDateUtc)} required /></div>
                  <div className="form-row"><label>Expiry Date</label><input className="input" type="date" name="expiryDateUtc" defaultValue={dateInputValue(selectedPermit?.expiryDateUtc)} required /></div>
                  <div className="form-row"><label>Status</label><select className="input" name="status" defaultValue={selectedPermit ? enumValue(selectedPermit.status, permitStatuses) : 1} required>{permitStatuses.map((x, i) => <option key={i} value={i}>{x || 'Select status'}</option>)}</select></div>
                  <div className="form-row"><label>Responsible Officer</label><input className="input" name="responsibleOfficer" defaultValue={selectedPermit?.responsibleOfficer ?? ''} /></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" defaultValue={selectedPermit?.notes ?? ''} /></div>
                </div>
                <button className="button primary" type="submit">{selectedPermit ? 'Update Permit' : 'Create Permit'}</button>
              </form>
            </section>
          ) : null}

          <section className="panel">
            <div className="section-heading">
              <h3>Licence and Permit Register</h3>
              <button className="button primary" type="button" onClick={() => void loadCompliance()}>Refresh Compliance Report</button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Number</th><th>Type</th><th>Authority</th><th>Asset</th><th>Location</th><th>Effective</th><th>Expiry</th><th>Status</th><th>Officer</th><th>Action</th></tr></thead>
                <tbody>
                  {permits.length === 0 ? <tr><td colSpan={10} className="muted">No permits have been configured.</td></tr> : permits.map((item) => (
                    <tr key={item.id}>
                      <td>{item.permitNumber}</td><td>{item.permitType}</td><td>{item.issuingAuthority}</td>
                      <td>{item.assetName || '—'}</td><td>{item.locationName || '—'}</td>
                      <td>{asDate(item.effectiveDateUtc)}</td><td>{asDate(item.expiryDateUtc)}</td>
                      <td>{item.status}</td><td>{item.responsibleOfficer || '—'}</td>
                      <td>{canManageOilGasPermits() ? <button className="button secondary" type="button" onClick={() => setSelectedPermit(item)}>Edit</button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {compliance ? <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(compliance, null, 2)}</pre> : null}
          </section>
        </div>
      ) : null}

      {tab === 'reports' && canViewOilGasReports() ? (
        <section className="panel">
          <h3>Production Summary Report</h3>
          <div className="form-grid three">
            <div className="form-row"><label>From</label><input className="input" type="date" value={reportFrom} onChange={e=>setReportFrom(e.target.value)} /></div>
            <div className="form-row"><label>To</label><input className="input" type="date" value={reportTo} onChange={e=>setReportTo(e.target.value)} /></div>
            <div className="form-row"><label>&nbsp;</label><button className="button primary" type="button" onClick={()=>void loadReport()}>Load Report</button></div>
          </div>
          {report?.assetSummary ? (
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Entries</th><th>Gross Oil</th><th>Net Oil</th><th>Gas</th><th>Flared</th><th>Water</th><th>Downtime</th></tr></thead><tbody>{report.assetSummary.map((x:any)=><tr key={x.assetId}><td>{x.assetName}</td><td>{x.entryCount}</td><td>{x.grossOilVolume}</td><td>{x.netOilVolume}</td><td>{x.gasProducedVolume}</td><td>{x.gasFlaredVolume}</td><td>{x.waterProducedVolume}</td><td>{x.downtimeHours}</td></tr>)}</tbody></table></div>
          ) : <div className="muted">Load a report for the selected period.</div>}
        </section>
      ) : null}
    </div>
  );
}

function ProductionTable(props: {
  items: OilGasProductionEntryDto[];
  compact?: boolean;
  onEdit?: (item:OilGasProductionEntryDto)=>void;
  onSubmit?: (item:OilGasProductionEntryDto)=>void;
  onApprove?: (item:OilGasProductionEntryDto)=>void;
  onReject?: (item:OilGasProductionEntryDto)=>void;
  rejectionReason?: string;
  setRejectionReason?: (value:string)=>void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead><tr><th>Entry</th><th>Date</th><th>Asset / Location</th><th>Product</th><th>Net Oil</th><th>Gas</th><th>Flared</th><th>Status</th>{props.compact ? null : <th>Actions</th>}</tr></thead>
        <tbody>
          {props.items.length === 0 ? <tr><td colSpan={props.compact ? 8 : 9} className="muted">No production entries found.</td></tr> : props.items.map((item)=>(
            <tr key={item.id}>
              <td>{item.entryNumber}</td><td>{asDate(item.productionDateUtc)}</td><td>{item.assetName || '—'} / {item.locationName || '—'}</td><td>{item.productName || '—'}</td>
              <td>{Number(item.netOilVolume).toLocaleString()}</td><td>{Number(item.gasProducedVolume).toLocaleString()}</td><td>{Number(item.gasFlaredVolume).toLocaleString()}</td><td>{item.status}</td>
              {props.compact ? null : (
                <td>
                  <div className="inline-actions" style={{ flexWrap:'wrap' }}>
                    {(item.status === 'Draft' || item.status === 'Rejected') && canUpdateOilGasProduction() ? <button className="button secondary" type="button" onClick={()=>props.onEdit?.(item)}>Edit</button> : null}
                    {(item.status === 'Draft' || item.status === 'Rejected') && canSubmitOilGasProduction() ? <button className="button primary" type="button" onClick={()=>props.onSubmit?.(item)}>Submit</button> : null}
                    {item.status === 'Submitted' && canApproveOilGasProduction() ? <button className="button primary" type="button" onClick={()=>props.onApprove?.(item)}>Approve</button> : null}
                    {item.status === 'Submitted' && canRejectOilGasProduction() ? (
                      <>
                        <input className="input" style={{ minWidth:200 }} placeholder="Reason for rejection" value={props.rejectionReason ?? ''} onChange={e=>props.setRejectionReason?.(e.target.value)} />
                        <button className="button danger" type="button" disabled={!props.rejectionReason?.trim()} onClick={()=>props.onReject?.(item)}>Reject</button>
                      </>
                    ) : null}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
