import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  approveOilGasStockMovement,
  createOilGasMeterCalibration,
  createOilGasMeterReading,
  createOilGasStockMovement,
  getOilGasAssets,
  getOilGasLocations,
  getOilGasMeterReadings,
  getOilGasMeters,
  getOilGasPermits,
  getOilGasProductionEntries,
  getOilGasProducts,
  getOilGasStockDashboard,
  getOilGasStockMovements,
  getOilGasStockReconciliation,
  getOilGasTanks,
  getTenantReadableError,
  postOilGasStockMovement,
  rejectOilGasStockMovement,
  renewOilGasPermit,
  submitOilGasStockMovement,
  updateOilGasStockMovement,
  type OilGasAssetDto,
  type OilGasLocationDto,
  type OilGasMeterDto,
  type OilGasPermitDto,
  type OilGasProductionEntryDto,
  type OilGasProductDto,
  type OilGasStockDashboardDto,
  type OilGasStockMovementDto,
  type OilGasTankDto,
} from '../lib/api';
import {
  canApproveOilGasMovement,
  canCreateOilGasMovement,
  canManageOilGasMeters,
  canManageOilGasPermits,
  canManageOilGasReconciliation,
  canPostOilGasMovement,
  canRejectOilGasMovement,
  canSubmitOilGasMovement,
  canUpdateOilGasMovement,
  canViewOilGas,
} from '../lib/auth';

type Tab = 'stock' | 'reconciliation' | 'metering' | 'renewals';
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const n = (v: FormDataEntryValue | null) => Number(v ?? 0) || 0;
const opt = (v: FormDataEntryValue | null) => {
  const x = String(v ?? '').trim();
  return x || null;
};
export function OilGasStockOperationsPage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('stock');
  const [dashboard, setDashboard] = useState<OilGasStockDashboardDto | null>(
    null,
  );
  const [movements, setMovements] = useState<OilGasStockMovementDto[]>([]);
  const [assets, setAssets] = useState<OilGasAssetDto[]>([]);
  const [locations, setLocations] = useState<OilGasLocationDto[]>([]);
  const [products, setProducts] = useState<OilGasProductDto[]>([]);
  const [tanks, setTanks] = useState<OilGasTankDto[]>([]);
  const [meters, setMeters] = useState<OilGasMeterDto[]>([]);
  const [permits, setPermits] = useState<OilGasPermitDto[]>([]);
  const [production, setProduction] = useState<OilGasProductionEntryDto[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [selected, setSelected] = useState<OilGasStockMovementDto | null>(null);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [reconciliation, setReconciliation] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const rejected = location.pathname.includes('/rejected');
  useEffect(() => {
    if (location.pathname.includes('reconciliation')) setTab('reconciliation');
    else if (location.pathname.includes('metering')) setTab('metering');
    else if (location.pathname.includes('renewals')) setTab('renewals');
    else setTab('stock');
  }, [location.pathname]);
  const activeTanks = useMemo(
    () => tanks.filter((x) => x.status === 'Active'),
    [tanks],
  );
  async function load() {
    if (!canViewOilGas()) return;
    setLoading(true);
    setError('');
    try {
      const [d, m, a, l, p, t, me, pe, pr, r] = await Promise.all([
        getOilGasStockDashboard(),
        getOilGasStockMovements(rejected ? { status: 'Rejected' } : undefined),
        getOilGasAssets(),
        getOilGasLocations(),
        getOilGasProducts(),
        getOilGasTanks(),
        getOilGasMeters(),
        getOilGasPermits(),
        getOilGasProductionEntries({ status: 'Approved' }),
        getOilGasMeterReadings(),
      ]);
      setDashboard(d);
      setMovements(m?.items ?? []);
      setAssets(a?.items ?? []);
      setLocations(l?.items ?? []);
      setProducts(p?.items ?? []);
      setTanks(t?.items ?? []);
      setMeters(me?.items ?? []);
      setPermits(pe?.items ?? []);
      setProduction(pr?.items ?? []);
      setReadings(r?.items ?? []);
    } catch (e) {
      setError(
        getTenantReadableError(e, 'Unable to load Oil & Gas stock operations.'),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [location.pathname]);
  async function action(fn: () => Promise<any>, ok: string) {
    setError('');
    setMessage('');
    try {
      const r = await fn();
      setMessage(r?.message || ok);
      await load();
      return true;
    } catch (e) {
      setError(getTenantReadableError(e, ok));
      return false;
    }
  }
  async function saveMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      movementDateUtc: String(f.get('movementDateUtc')),
      movementType: n(f.get('movementType')),
      assetId: String(f.get('assetId')),
      locationId: String(f.get('locationId')),
      productId: String(f.get('productId')),
      sourceTankId: opt(f.get('sourceTankId')),
      destinationTankId: opt(f.get('destinationTankId')),
      quantity: n(f.get('quantity')),
      unitOfMeasure: String(f.get('unitOfMeasure')),
      reference: String(f.get('reference')),
      productionEntryId: opt(f.get('productionEntryId')),
      customerId: opt(f.get('customerId')),
      salesInvoiceId: opt(f.get('salesInvoiceId')),
      billingInvoiceId: opt(f.get('billingInvoiceId')),
      inventoryTransactionId: opt(f.get('inventoryTransactionId')),
      transportType: n(f.get('transportType')),
      transportReference: opt(f.get('transportReference')),
      destinationDescription: opt(f.get('destinationDescription')),
      notes: opt(f.get('notes')),
    };
    const good = await action(
      () =>
        selected
          ? updateOilGasStockMovement(selected.id, payload)
          : createOilGasStockMovement(payload),
      selected ? 'Movement updated.' : 'Movement created.',
    );
    if (good) {
      setSelected(null);
      e.currentTarget.reset();
    }
  }
  async function runReconciliation() {
    try {
      setReconciliation(await getOilGasStockReconciliation(from, to));
    } catch (e) {
      setError(getTenantReadableError(e, 'Unable to run reconciliation.'));
    }
  }
  if (!canViewOilGas())
    return (
      <div className="panel error-panel">
        You do not have access to Oil & Gas Operations.
      </div>
    );
  if (loading)
    return <div className="panel">Loading Oil & Gas stock operations...</div>;
  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Oil & Gas Stock Movement & Reconciliation</h2>
        <p className="muted">
          Controlled tank receipts, transfers, liftings, consumption,
          calibration and permit renewal. Financial references remain linked to
          the existing iBalance Billing, AR, Inventory and shared Chart of
          Accounts.
        </p>
        <div className="button-row">
          <button className="button secondary" onClick={() => setTab('stock')}>
            Stock Movements
          </button>
          <button
            className="button secondary"
            onClick={() => setTab('reconciliation')}
          >
            Reconciliation
          </button>
          <button
            className="button secondary"
            onClick={() => setTab('metering')}
          >
            Metering
          </button>
          <button
            className="button secondary"
            onClick={() => setTab('renewals')}
          >
            Permit Renewals
          </button>
        </div>
        {message ? <div className="success-panel">{message}</div> : null}
        {error ? <div className="error-panel">{error}</div> : null}
      </section>
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Tank Book Stock</div>
          <div className="stat-value">
            {dashboard?.currentTankBookStock?.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today Receipts</div>
          <div className="stat-value">
            {dashboard?.todayReceipts?.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today Deliveries</div>
          <div className="stat-value">
            {dashboard?.todayDeliveries?.toLocaleString() ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value">
            {dashboard?.pendingMovementCount ?? 0}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Calibration Due</div>
          <div className="stat-value">
            {dashboard?.calibrationDueCount ?? 0}
          </div>
        </div>
      </section>
      {tab === 'stock' ? (
        <>
          <section className="panel">
            <h3>
              {selected ? 'Correct Stock Movement' : 'New Stock Movement'}
            </h3>
            {canCreateOilGasMovement() || canUpdateOilGasMovement() ? (
              <form onSubmit={saveMovement}>
                <div className="form-grid three">
                  <div className="form-row">
                    <label>Date</label>
                    <input
                      className="input"
                      type="date"
                      name="movementDateUtc"
                      defaultValue={
                        selected?.movementDateUtc?.slice(0, 10) || today
                      }
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label>Type</label>
                    <select
                      className="input"
                      name="movementType"
                      defaultValue="1"
                    >
                      <option value="1">Production Receipt</option>
                      <option value="2">External Receipt</option>
                      <option value="3">Tank Transfer</option>
                      <option value="4">Lifting / Delivery</option>
                      <option value="5">Operational Consumption</option>
                      <option value="6">Measurement Adjustment</option>
                      <option value="7">Approved Loss</option>
                      <option value="8">Return</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Asset</label>
                    <select className="input" name="assetId" required>
                      <option value="">Select</option>
                      {assets.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.code} - {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Location</label>
                    <select className="input" name="locationId" required>
                      <option value="">Select</option>
                      {locations.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.code} - {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Product</label>
                    <select className="input" name="productId" required>
                      <option value="">Select</option>
                      {products.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.code} - {x.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Source Tank</label>
                    <select className="input" name="sourceTankId">
                      <option value="">None</option>
                      {activeTanks.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.tankCode} - {x.tankName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Destination Tank</label>
                    <select className="input" name="destinationTankId">
                      <option value="">None</option>
                      {activeTanks.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.tankCode} - {x.tankName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Quantity</label>
                    <input
                      className="input"
                      name="quantity"
                      type="number"
                      step="0.0001"
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label>Unit</label>
                    <input
                      className="input"
                      name="unitOfMeasure"
                      defaultValue="bbl"
                      required
                    />
                  </div>
                  <div className="form-row">
                    <label>Reference</label>
                    <input className="input" name="reference" required />
                  </div>
                  <div className="form-row">
                    <label>Approved Production Entry</label>
                    <select className="input" name="productionEntryId">
                      <option value="">None</option>
                      {production.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.entryNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Customer ID (optional AR link)</label>
                    <input className="input" name="customerId" />
                  </div>
                  <div className="form-row">
                    <label>Sales Invoice ID</label>
                    <input className="input" name="salesInvoiceId" />
                  </div>
                  <div className="form-row">
                    <label>Billing Invoice ID</label>
                    <input className="input" name="billingInvoiceId" />
                  </div>
                  <div className="form-row">
                    <label>Inventory Transaction ID</label>
                    <input className="input" name="inventoryTransactionId" />
                  </div>
                  <div className="form-row">
                    <label>Transport Type</label>
                    <select className="input" name="transportType">
                      <option value="0">None</option>
                      <option value="1">Vessel</option>
                      <option value="2">Truck</option>
                      <option value="3">Pipeline</option>
                      <option value="4">Rail</option>
                      <option value="5">Other</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Transport Reference</label>
                    <input className="input" name="transportReference" />
                  </div>
                  <div className="form-row">
                    <label>Destination</label>
                    <input className="input" name="destinationDescription" />
                  </div>
                  <div className="form-row">
                    <label>Notes</label>
                    <textarea className="input" name="notes" />
                  </div>
                </div>
                <div className="button-row">
                  <button className="button" type="submit">
                    {selected ? 'Save Correction' : 'Create Movement'}
                  </button>
                  {selected ? (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setSelected(null)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </form>
            ) : null}
          </section>
          <section className="panel">
            <h3>Movement Register</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Number</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Quantity</th>
                    <th>Status</th>
                    <th>Reference</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="muted">
                        No stock movements found.
                      </td>
                    </tr>
                  ) : (
                    movements.map((x) => (
                      <tr key={x.id}>
                        <td>{x.movementNumber}</td>
                        <td>
                          {new Date(x.movementDateUtc).toLocaleDateString()}
                        </td>
                        <td>{x.movementType}</td>
                        <td>{x.productName}</td>
                        <td>{x.sourceTankName || '—'}</td>
                        <td>{x.destinationTankName || '—'}</td>
                        <td>
                          {x.quantity.toLocaleString()} {x.unitOfMeasure}
                        </td>
                        <td>{x.status}</td>
                        <td>{x.reference}</td>
                        <td>
                          <div className="button-row">
                            {(x.status === 'Draft' ||
                              x.status === 'Rejected') &&
                            canUpdateOilGasMovement() ? (
                              <button
                                className="button secondary"
                                onClick={() => setSelected(x)}
                              >
                                Edit
                              </button>
                            ) : null}
                            {x.status === 'Draft' &&
                            canSubmitOilGasMovement() ? (
                              <button
                                className="button"
                                onClick={() =>
                                  void action(
                                    () => submitOilGasStockMovement(x.id),
                                    'Submitted.',
                                  )
                                }
                              >
                                Submit
                              </button>
                            ) : null}
                            {x.status === 'Submitted' &&
                            canApproveOilGasMovement() ? (
                              <button
                                className="button"
                                onClick={() =>
                                  void action(
                                    () => approveOilGasStockMovement(x.id),
                                    'Approved.',
                                  )
                                }
                              >
                                Approve
                              </button>
                            ) : null}
                            {x.status === 'Submitted' &&
                            canRejectOilGasMovement() ? (
                              <button
                                className="button danger"
                                onClick={() => {
                                  const r = window.prompt(
                                    'Reason for rejection',
                                  );
                                  if (r)
                                    void action(
                                      () => rejectOilGasStockMovement(x.id, r),
                                      'Rejected.',
                                    );
                                }}
                              >
                                Reject
                              </button>
                            ) : null}
                            {x.status === 'Approved' &&
                            canPostOilGasMovement() ? (
                              <button
                                className="button"
                                onClick={() =>
                                  void action(
                                    () => postOilGasStockMovement(x.id),
                                    'Posted.',
                                  )
                                }
                              >
                                Post
                              </button>
                            ) : null}
                          </div>
                          {x.rejectionReason ? (
                            <div className="error-text">
                              {x.rejectionReason}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
      {tab === 'reconciliation' ? (
        <section className="panel">
          <h3>Tank Stock Reconciliation</h3>
          {canManageOilGasReconciliation() ? (
            <div className="form-grid three">
              <div className="form-row">
                <label>From</label>
                <input
                  className="input"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>To</label>
                <input
                  className="input"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>&nbsp;</label>
                <button
                  className="button"
                  onClick={() => void runReconciliation()}
                >
                  Run Reconciliation
                </button>
              </div>
            </div>
          ) : null}
          <p className="muted">
            Unposted movements: {reconciliation?.unpostedMovementCount ?? 0}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tank</th>
                  <th>Location</th>
                  <th>Product</th>
                  <th>Receipts</th>
                  <th>Issues</th>
                  <th>Adjustments</th>
                  <th>Current Book Stock</th>
                  <th>Movements</th>
                </tr>
              </thead>
              <tbody>
                {(reconciliation?.rows ?? []).map((x: any) => (
                  <tr key={x.id}>
                    <td>
                      {x.tankCode} - {x.tankName}
                    </td>
                    <td>{x.locationName}</td>
                    <td>{x.productName}</td>
                    <td>{x.receipts.toLocaleString()}</td>
                    <td>{x.issues.toLocaleString()}</td>
                    <td>{x.adjustments.toLocaleString()}</td>
                    <td>{x.currentBookStock.toLocaleString()}</td>
                    <td>{x.movementCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {tab === 'metering' ? (
        <section className="panel">
          <h3>Meter Readings & Calibration</h3>
          {canManageOilGasMeters() ? (
            <>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await action(
                      () =>
                        createOilGasMeterReading({
                          meterId: String(f.get('meterId')),
                          readingDateUtc: String(f.get('readingDateUtc')),
                          previousReading: n(f.get('previousReading')),
                          currentReading: n(f.get('currentReading')),
                          reference: opt(f.get('reference')),
                          notes: opt(f.get('notes')),
                        }),
                      'Reading recorded.',
                    )
                  )
                    e.currentTarget.reset();
                }}
              >
                <div className="form-grid three">
                  <select className="input" name="meterId" required>
                    <option value="">Select Meter</option>
                    {meters.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.meterCode} - {x.meterName}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="date"
                    name="readingDateUtc"
                    defaultValue={today}
                    required
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    name="previousReading"
                    placeholder="Previous reading"
                    required
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    name="currentReading"
                    placeholder="Current reading"
                    required
                  />
                  <input
                    className="input"
                    name="reference"
                    placeholder="Reference"
                  />
                  <input className="input" name="notes" placeholder="Notes" />
                </div>
                <button className="button" type="submit">
                  Record Reading
                </button>
              </form>
              <hr />
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  if (
                    await action(
                      () =>
                        createOilGasMeterCalibration({
                          meterId: String(f.get('meterId')),
                          calibrationDateUtc: String(
                            f.get('calibrationDateUtc'),
                          ),
                          nextCalibrationDateUtc: String(
                            f.get('nextCalibrationDateUtc'),
                          ),
                          certificateReference: String(
                            f.get('certificateReference'),
                          ),
                          calibratedBy: String(f.get('calibratedBy')),
                          result: opt(f.get('result')),
                          notes: opt(f.get('notes')),
                        }),
                      'Calibration recorded.',
                    )
                  )
                    e.currentTarget.reset();
                }}
              >
                <div className="form-grid three">
                  <select className="input" name="meterId" required>
                    <option value="">Select Meter</option>
                    {meters.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.meterCode} - {x.meterName}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="date"
                    name="calibrationDateUtc"
                    defaultValue={today}
                    required
                  />
                  <input
                    className="input"
                    type="date"
                    name="nextCalibrationDateUtc"
                    required
                  />
                  <input
                    className="input"
                    name="certificateReference"
                    placeholder="Certificate reference"
                    required
                  />
                  <input
                    className="input"
                    name="calibratedBy"
                    placeholder="Calibrated by"
                    required
                  />
                  <input className="input" name="result" placeholder="Result" />
                </div>
                <button className="button" type="submit">
                  Record Calibration
                </button>
              </form>
            </>
          ) : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Meter</th>
                  <th>Date</th>
                  <th>Previous</th>
                  <th>Current</th>
                  <th>Measured Quantity</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((x) => (
                  <tr key={x.id}>
                    <td>{x.meterCode}</td>
                    <td>{new Date(x.readingDateUtc).toLocaleDateString()}</td>
                    <td>{x.previousReading}</td>
                    <td>{x.currentReading}</td>
                    <td>{x.measuredQuantity}</td>
                    <td>{x.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {tab === 'renewals' ? (
        <section className="panel">
          <h3>Licence & Permit Renewals</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Permit</th>
                  <th>Type</th>
                  <th>Authority</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th>Renew</th>
                </tr>
              </thead>
              <tbody>
                {permits.map((x) => (
                  <tr key={x.id}>
                    <td>{x.permitNumber}</td>
                    <td>{x.permitType}</td>
                    <td>{x.issuingAuthority}</td>
                    <td>{new Date(x.expiryDateUtc).toLocaleDateString()}</td>
                    <td>{x.status}</td>
                    <td>
                      {canManageOilGasPermits() ? (
                        <button
                          className="button"
                          onClick={() => {
                            const number = window.prompt(
                              'New permit number',
                              x.permitNumber,
                            );
                            const expiry = window.prompt(
                              'New expiry date (YYYY-MM-DD)',
                            );
                            if (number && expiry)
                              void action(
                                () =>
                                  renewOilGasPermit(x.id, {
                                    newPermitNumber: number,
                                    renewalSubmittedOnUtc: today,
                                    renewalApprovedOnUtc: today,
                                    renewalDateUtc: today,
                                    newExpiryDateUtc: expiry,
                                    renewalCost: null,
                                    renewalReference: 'Demo renewal',
                                  }),
                                'Permit renewed.',
                              );
                          }}
                        >
                          Renew
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
