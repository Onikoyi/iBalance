import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  approveOilGasProductionEntry,
  createOilGasAsset,
  createOilGasBusinessUnit,
  createOilGasLocation,
  createOilGasMeter,
  createOilGasPermit,
  createOilGasProduct,
  createOilGasProductionEntry,
  createOilGasTank,
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
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasBusinessUnit({
        code: String(data.get('code') ?? ''),
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? ''),
        isActive: true,
      }),
      'Business unit created.'
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasAsset({
        businessUnitId: String(data.get('businessUnitId') ?? ''),
        code: String(data.get('code') ?? ''),
        name: String(data.get('name') ?? ''),
        assetType: numberValue(data.get('assetType')),
        operatorName: String(data.get('operatorName') ?? ''),
        ownershipPercentage: numberValue(data.get('ownershipPercentage')),
        organizationCostCenterId: null,
        locationDescription: String(data.get('locationDescription') ?? ''),
        commissioningDateUtc: data.get('commissioningDateUtc') || null,
        isActive: true,
        notes: String(data.get('notes') ?? ''),
      }),
      'Asset created.'
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasLocation({
        assetId: String(data.get('assetId') ?? ''),
        parentLocationId: data.get('parentLocationId') || null,
        code: String(data.get('code') ?? ''),
        name: String(data.get('name') ?? ''),
        locationType: numberValue(data.get('locationType')),
        coordinates: String(data.get('coordinates') ?? ''),
        isActive: true,
        notes: String(data.get('notes') ?? ''),
      }),
      'Operational location created.'
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasProduct({
        code: String(data.get('code') ?? ''),
        name: String(data.get('name') ?? ''),
        category: numberValue(data.get('category')),
        unitOfMeasure: String(data.get('unitOfMeasure') ?? ''),
        standardDensity: optionalNumber(data.get('standardDensity')),
        isActive: true,
        notes: String(data.get('notes') ?? ''),
      }),
      'Petroleum product created.'
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitTank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasTank({
        locationId: String(data.get('locationId') ?? ''),
        productId: String(data.get('productId') ?? ''),
        tankCode: String(data.get('tankCode') ?? ''),
        tankName: String(data.get('tankName') ?? ''),
        nominalCapacity: numberValue(data.get('nominalCapacity')),
        safeWorkingCapacity: numberValue(data.get('safeWorkingCapacity')),
        currentBookStock: numberValue(data.get('currentBookStock')),
        status: 1,
        notes: String(data.get('notes') ?? ''),
      }),
      'Tank created.'
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitMeter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasMeter({
        locationId: String(data.get('locationId') ?? ''),
        productId: String(data.get('productId') ?? ''),
        meterCode: String(data.get('meterCode') ?? ''),
        meterName: String(data.get('meterName') ?? ''),
        meterType: String(data.get('meterType') ?? ''),
        serialNumber: String(data.get('serialNumber') ?? ''),
        lastCalibrationDateUtc: data.get('lastCalibrationDateUtc') || null,
        nextCalibrationDateUtc: data.get('nextCalibrationDateUtc') || null,
        status: 1,
        notes: String(data.get('notes') ?? ''),
      }),
      'Meter created.'
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitPermit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () => createOilGasPermit({
        assetId: data.get('assetId') || null,
        locationId: data.get('locationId') || null,
        permitNumber: String(data.get('permitNumber') ?? ''),
        permitType: String(data.get('permitType') ?? ''),
        issuingAuthority: String(data.get('issuingAuthority') ?? ''),
        effectiveDateUtc: data.get('effectiveDateUtc'),
        expiryDateUtc: data.get('expiryDateUtc'),
        status: 1,
        responsibleOfficer: String(data.get('responsibleOfficer') ?? ''),
        notes: String(data.get('notes') ?? ''),
      }),
      'Licence or permit created.'
    );
    if (ok) event.currentTarget.reset();
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
          {canManageOilGasSetup() ? (
            <section className="panel">
              <h3>Shared Chart of Accounts Posting Setup</h3>
              <p className="muted">Only active, posting-enabled accounts from the existing iBalance Chart of Accounts are accepted.</p>
              <form onSubmit={submitPostingSetup}>
                <div className="form-grid two">
                  {[
                    ['inventoryAssetLedgerAccountId','Inventory Asset Account'],
                    ['productionRevenueLedgerAccountId','Production Revenue Account'],
                    ['productionLossExpenseLedgerAccountId','Production Loss Expense Account'],
                    ['gasFlareExpenseLedgerAccountId','Gas Flare Expense Account'],
                    ['productionCostLedgerAccountId','Production Cost Account (Optional)'],
                  ].map(([name,label]) => (
                    <div className="form-row" key={name}>
                      <label>{label}</label>
                      <select className="input" name={name} defaultValue={postingSetup?.[name] ?? ''} required={name !== 'productionCostLedgerAccountId'}>
                        <option value="">Select posting account</option>
                        {ledgerAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="form-row"><label>Notes</label><textarea className="input" name="notes" defaultValue={postingSetup?.notes ?? ''} /></div>
                <button className="button primary" type="submit">Save Posting Setup</button>
              </form>
            </section>
          ) : null}

          {canManageOilGasAssets() ? (
            <section className="panel">
              <h3>Business Unit</h3>
              <form onSubmit={submitBusinessUnit}>
                <div className="form-grid three">
                  <div className="form-row"><label>Code</label><input className="input" name="code" required /></div>
                  <div className="form-row"><label>Name</label><input className="input" name="name" required /></div>
                  <div className="form-row"><label>Description</label><input className="input" name="description" /></div>
                </div>
                <button className="button primary" type="submit">Create Business Unit</button>
              </form>
            </section>
          ) : null}

          {canManageOilGasProducts() ? (
            <section className="panel">
              <h3>Petroleum Product</h3>
              <form onSubmit={submitProduct}>
                <div className="form-grid three">
                  <div className="form-row"><label>Code</label><input className="input" name="code" required /></div>
                  <div className="form-row"><label>Name</label><input className="input" name="name" required /></div>
                  <div className="form-row"><label>Category</label><select className="input" name="category" required>{['','Crude Oil','Condensate','Natural Gas','PMS','AGO','DPK','LPG','CNG','Produced Water','Other'].map((x,i)=><option key={i} value={i}>{x || 'Select category'}</option>)}</select></div>
                  <div className="form-row"><label>Unit of Measure</label><input className="input" name="unitOfMeasure" placeholder="bbl, MMSCF, MT, Litre" required /></div>
                  <div className="form-row"><label>Standard Density</label><input className="input" type="number" step="0.000001" name="standardDensity" /></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" /></div>
                </div>
                <button className="button primary" type="submit">Create Product</button>
              </form>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === 'assets' ? (
        <div className="page-grid">
          {canManageOilGasAssets() ? (
            <>
              <section className="panel">
                <h3>Operational Asset</h3>
                <form onSubmit={submitAsset}>
                  <div className="form-grid three">
                    <div className="form-row"><label>Business Unit</label><select className="input" name="businessUnitId" required><option value="">Select</option>{businessUnits.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                    <div className="form-row"><label>Code</label><input className="input" name="code" required /></div>
                    <div className="form-row"><label>Name</label><input className="input" name="name" required /></div>
                    <div className="form-row"><label>Asset Type</label><select className="input" name="assetType" required>{['','Upstream Asset','Field','Terminal','Depot','Gas Plant','Pipeline System','Retail Network','Service Project'].map((x,i)=><option key={i} value={i}>{x || 'Select type'}</option>)}</select></div>
                    <div className="form-row"><label>Operator</label><input className="input" name="operatorName" /></div>
                    <div className="form-row"><label>Ownership %</label><input className="input" type="number" min="0" max="100" step="0.0001" name="ownershipPercentage" defaultValue="100" required /></div>
                    <div className="form-row"><label>Location</label><input className="input" name="locationDescription" /></div>
                    <div className="form-row"><label>Commissioning Date</label><input className="input" type="date" name="commissioningDateUtc" /></div>
                    <div className="form-row"><label>Notes</label><input className="input" name="notes" /></div>
                  </div>
                  <button className="button primary" type="submit">Create Asset</button>
                </form>
              </section>
              <section className="panel">
                <h3>Operational Location</h3>
                <form onSubmit={submitLocation}>
                  <div className="form-grid three">
                    <div className="form-row"><label>Asset</label><select className="input" name="assetId" required><option value="">Select</option>{assets.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                    <div className="form-row"><label>Parent Location</label><select className="input" name="parentLocationId"><option value="">None</option>{locations.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                    <div className="form-row"><label>Code</label><input className="input" name="code" required /></div>
                    <div className="form-row"><label>Name</label><input className="input" name="name" required /></div>
                    <div className="form-row"><label>Type</label><select className="input" name="locationType" required>{['','Facility','Flow Station','Well','Tank Farm','Tank','Metering Point','Pipeline Segment','Loading Bay','Retail Station','Other'].map((x,i)=><option key={i} value={i}>{x || 'Select type'}</option>)}</select></div>
                    <div className="form-row"><label>Coordinates</label><input className="input" name="coordinates" /></div>
                    <div className="form-row"><label>Notes</label><input className="input" name="notes" /></div>
                  </div>
                  <button className="button primary" type="submit">Create Location</button>
                </form>
              </section>
            </>
          ) : null}

          {canManageOilGasTanks() ? (
            <section className="panel">
              <h3>Tank Register</h3>
              <form onSubmit={submitTank}>
                <div className="form-grid three">
                  <div className="form-row"><label>Location</label><select className="input" name="locationId" required><option value="">Select</option>{activeLocations.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Product</label><select className="input" name="productId" required><option value="">Select</option>{activeProducts.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Tank Code</label><input className="input" name="tankCode" required /></div>
                  <div className="form-row"><label>Tank Name</label><input className="input" name="tankName" required /></div>
                  <div className="form-row"><label>Nominal Capacity</label><input className="input" type="number" min="0.0001" step="0.0001" name="nominalCapacity" required /></div>
                  <div className="form-row"><label>Safe Working Capacity</label><input className="input" type="number" min="0.0001" step="0.0001" name="safeWorkingCapacity" required /></div>
                  <div className="form-row"><label>Current Book Stock</label><input className="input" type="number" min="0" step="0.0001" name="currentBookStock" defaultValue="0" /></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" /></div>
                </div>
                <button className="button primary" type="submit">Create Tank</button>
              </form>

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tank Code</th>
                      <th>Tank Name</th>
                      <th>Location</th>
                      <th>Product</th>
                      <th style={{ textAlign: 'right' }}>Nominal Capacity</th>
                      <th style={{ textAlign: 'right' }}>Safe Capacity</th>
                      <th style={{ textAlign: 'right' }}>Book Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tanks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="muted">No tanks have been configured.</td>
                      </tr>
                    ) : (
                      tanks.map((tank) => (
                        <tr key={tank.id}>
                          <td>{tank.tankCode}</td>
                          <td>{tank.tankName}</td>
                          <td>{tank.locationName}</td>
                          <td>{tank.productName}</td>
                          <td style={{ textAlign: 'right' }}>{tank.nominalCapacity.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{tank.safeWorkingCapacity.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{tank.currentBookStock.toLocaleString()}</td>
                          <td>{tank.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {canManageOilGasMeters() ? (
            <section className="panel">
              <h3>Meter Register</h3>
              <form onSubmit={submitMeter}>
                <div className="form-grid three">
                  <div className="form-row"><label>Location</label><select className="input" name="locationId" required><option value="">Select</option>{activeLocations.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Product</label><select className="input" name="productId" required><option value="">Select</option>{activeProducts.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Meter Code</label><input className="input" name="meterCode" required /></div>
                  <div className="form-row"><label>Meter Name</label><input className="input" name="meterName" required /></div>
                  <div className="form-row"><label>Meter Type</label><input className="input" name="meterType" required /></div>
                  <div className="form-row"><label>Serial Number</label><input className="input" name="serialNumber" /></div>
                  <div className="form-row"><label>Last Calibration</label><input className="input" type="date" name="lastCalibrationDateUtc" /></div>
                  <div className="form-row"><label>Next Calibration</label><input className="input" type="date" name="nextCalibrationDateUtc" /></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" /></div>
                </div>
                <button className="button primary" type="submit">Create Meter</button>
              </form>
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
              <h3>Licence and Permit Register</h3>
              <form onSubmit={submitPermit}>
                <div className="form-grid three">
                  <div className="form-row"><label>Asset</label><select className="input" name="assetId"><option value="">None</option>{assets.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Location</label><select className="input" name="locationId"><option value="">None</option>{locations.map(x=><option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
                  <div className="form-row"><label>Permit Number</label><input className="input" name="permitNumber" required /></div>
                  <div className="form-row"><label>Permit Type</label><input className="input" name="permitType" required /></div>
                  <div className="form-row"><label>Issuing Authority</label><select className="input" name="issuingAuthority" required><option value="">Select</option><option>NUPRC</option><option>NMDPRA</option><option>Federal Ministry of Environment</option><option>State Environmental Authority</option><option>Other</option></select></div>
                  <div className="form-row"><label>Effective Date</label><input className="input" type="date" name="effectiveDateUtc" required /></div>
                  <div className="form-row"><label>Expiry Date</label><input className="input" type="date" name="expiryDateUtc" required /></div>
                  <div className="form-row"><label>Responsible Officer</label><input className="input" name="responsibleOfficer" /></div>
                  <div className="form-row"><label>Notes</label><input className="input" name="notes" /></div>
                </div>
                <button className="button primary" type="submit">Create Permit</button>
              </form>
            </section>
          ) : null}
          <section className="panel">
            <div className="inline-actions"><button className="button primary" type="button" onClick={()=>void loadCompliance()}>Load Compliance Report</button></div>
            <h3>Permits</h3>
            <div className="table-wrap"><table className="data-table"><thead><tr><th>Number</th><th>Type</th><th>Authority</th><th>Asset / Location</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{permits.map(x=><tr key={x.id}><td>{x.permitNumber}</td><td>{x.permitType}</td><td>{x.issuingAuthority}</td><td>{x.assetName || x.locationName || '—'}</td><td>{asDate(x.expiryDateUtc)}</td><td>{x.status}</td></tr>)}</tbody></table></div>
            {compliance ? <pre style={{ whiteSpace:'pre-wrap' }}>{JSON.stringify(compliance,null,2)}</pre> : null}
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
