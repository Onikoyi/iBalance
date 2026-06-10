import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  approveOilGasAfe,
  approveOilGasProductionPeriod,
  approveOilGasUpstreamLifting,
  closeOilGasAfe,
  closeOilGasHseIncident,
  closeOilGasProductionPeriod,
  completeOilGasUpstreamLifting,
  createOilGasAfe,
  createOilGasCorrectiveAction,
  createOilGasDocument,
  createOilGasEquipment,
  createOilGasHseIncident,
  createOilGasPartner,
  createOilGasPartnerFunding,
  createOilGasPartnerInterest,
  createOilGasProductionPeriod,
  createOilGasUpstreamLifting,
  getOilGasAfes,
  getOilGasAssets,
  getOilGasDocuments,
  getOilGasEquipment,
  getOilGasHseIncidents,
  getOilGasLocations,
  getOilGasPartners,
  getOilGasProductionPeriods,
  getOilGasProducts,
  getOilGasTanks,
  getOilGasUpstreamDashboard,
  getOilGasUpstreamLiftings,
  getOilGasUpstreamManagementReport,
  getTenantReadableError,
  rejectOilGasAfe,
  rejectOilGasProductionPeriod,
  rejectOilGasUpstreamLifting,
  submitOilGasAfe,
  submitOilGasProductionPeriod,
  submitOilGasUpstreamLifting,
  type OilGasAssetDto,
  type OilGasLocationDto,
  type OilGasProductDto,
  type OilGasTankDto,
  type OilGasUpstreamDashboardDto,
} from "../lib/api";
import { canViewOilGas, hasPermission } from "../lib/auth";

type UpstreamTab =
  | "dashboard"
  | "liftings"
  | "afe"
  | "partners"
  | "production-close"
  | "hse"
  | "equipment"
  | "documents"
  | "reports";

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

function text(data: FormData, name: string) {
  return String(data.get(name) ?? "").trim();
}

function nullableText(data: FormData, name: string) {
  const value = text(data, name);
  return value || null;
}

function numberValue(data: FormData, name: string) {
  const parsed = Number(data.get(name) ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableGuid(data: FormData, name: string) {
  const value = text(data, name);
  return value || null;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString();
}

function formatAmount(value?: number | null, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function promptReason(label: string) {
  const value = window.prompt(label)?.trim();
  return value || null;
}

export function OilGasUpstreamCompletionPage() {
  const location = useLocation();
  const [tab, setTab] = useState<UpstreamTab>("dashboard");
  const [dashboard, setDashboard] = useState<OilGasUpstreamDashboardDto | null>(
    null,
  );
  const [assets, setAssets] = useState<OilGasAssetDto[]>([]);
  const [locations, setLocations] = useState<OilGasLocationDto[]>([]);
  const [products, setProducts] = useState<OilGasProductDto[]>([]);
  const [tanks, setTanks] = useState<OilGasTankDto[]>([]);
  const [liftings, setLiftings] = useState<any[]>([]);
  const [afes, setAfes] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [reportFrom, setReportFrom] = useState(monthStart);
  const [reportTo, setReportTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");

  const canView = canViewOilGas();
  const canManageLifting = hasPermission("oilgas.lifting.manage");
  const canApproveLifting = hasPermission("oilgas.lifting.approve");
  const canCompleteLifting = hasPermission("oilgas.lifting.complete");
  const canManageAfe = hasPermission("oilgas.afe.manage");
  const canApproveAfe = hasPermission("oilgas.afe.approve");
  const canManagePartners = hasPermission("oilgas.partner.manage");
  const canManageClose = hasPermission("oilgas.production-close.manage");
  const canApproveClose = hasPermission("oilgas.production-close.approve");
  const canManageHse = hasPermission("oilgas.hse.manage");
  const canManageEquipment = hasPermission("oilgas.equipment.manage");
  const canManageDocuments = hasPermission("oilgas.document.manage");

  const activeAssets = useMemo(
    () => assets.filter((item) => item.isActive),
    [assets],
  );
  const activeLocations = useMemo(
    () => locations.filter((item) => item.isActive),
    [locations],
  );
  const activeProducts = useMemo(
    () => products.filter((item) => item.isActive),
    [products],
  );
  const activeTanks = useMemo(
    () => tanks.filter((item) => item.status === "Active"),
    [tanks],
  );

  useEffect(() => {
    const path = location.pathname;
    if (path.endsWith("/liftings")) setTab("liftings");
    else if (path.endsWith("/afe")) setTab("afe");
    else if (path.endsWith("/partners")) setTab("partners");
    else if (path.endsWith("/production-close")) setTab("production-close");
    else if (path.endsWith("/hse")) setTab("hse");
    else if (path.endsWith("/equipment")) setTab("equipment");
    else if (path.endsWith("/documents")) setTab("documents");
    else if (path.endsWith("/reports")) setTab("reports");
    else setTab("dashboard");
  }, [location.pathname]);

  async function loadAll() {
    if (!canView) return;
    setLoading(true);
    setErrorText("");

    try {
      const [
        dashboardData,
        assetData,
        locationData,
        productData,
        tankData,
        liftingData,
        afeData,
        partnerData,
        periodData,
        incidentData,
        equipmentData,
        documentData,
      ] = await Promise.all([
        getOilGasUpstreamDashboard(),
        getOilGasAssets(),
        getOilGasLocations(),
        getOilGasProducts(),
        getOilGasTanks(),
        getOilGasUpstreamLiftings(),
        getOilGasAfes(),
        getOilGasPartners(),
        getOilGasProductionPeriods(),
        getOilGasHseIncidents(),
        getOilGasEquipment(),
        getOilGasDocuments(),
      ]);

      setDashboard(dashboardData);
      setAssets(assetData?.items ?? []);
      setLocations(locationData?.items ?? []);
      setProducts(productData?.items ?? []);
      setTanks(tankData?.items ?? []);
      setLiftings(liftingData?.items ?? []);
      setAfes(afeData?.items ?? []);
      setPartners(partnerData?.items ?? []);
      setPeriods(periodData?.items ?? []);
      setIncidents(incidentData?.items ?? []);
      setEquipment(equipmentData?.items ?? []);
      setDocuments(documentData?.items ?? []);
    } catch (error) {
      setErrorText(
        getTenantReadableError(error, "Unable to load upstream operations."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [canView]);

  async function runAction(action: () => Promise<any>, successMessage: string) {
    setMessage("");
    setErrorText("");

    try {
      const response = await action();
      setMessage(response?.message || successMessage);
      await loadAll();
      return true;
    } catch (error) {
      setErrorText(getTenantReadableError(error, "Operation failed."));
      return false;
    }
  }

  async function submitLifting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasUpstreamLifting({
          nominationReference: nullableText(data, "nominationReference"),
          assetId: text(data, "assetId"),
          locationId: text(data, "locationId"),
          productId: text(data, "productId"),
          sourceTankId: text(data, "sourceTankId"),
          customerId: nullableGuid(data, "customerId"),
          offtakerName: text(data, "offtakerName"),
          plannedQuantity: numberValue(data, "plannedQuantity"),
          actualLoadedQuantity: numberValue(data, "actualLoadedQuantity"),
          deliveredQuantity: numberValue(data, "deliveredQuantity") || null,
          unitOfMeasure: text(data, "unitOfMeasure"),
          plannedLoadingDateUtc: text(data, "plannedLoadingDateUtc"),
          transportType: numberValue(data, "transportType"),
          vesselOrTruckReference: nullableText(data, "vesselOrTruckReference"),
          billOfLadingNumber: nullableText(data, "billOfLadingNumber"),
          unitPrice: numberValue(data, "unitPrice") || null,
          currencyCode: text(data, "currencyCode") || "NGN",
          billingInvoiceId: nullableGuid(data, "billingInvoiceId"),
          salesInvoiceId: nullableGuid(data, "salesInvoiceId"),
          stockMovementId: nullableGuid(data, "stockMovementId"),
          destination: nullableText(data, "destination"),
          qualityCertificateReference: nullableText(
            data,
            "qualityCertificateReference",
          ),
          notes: nullableText(data, "notes"),
        }),
      "Lifting created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function submitAfe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasAfe({
          assetId: text(data, "assetId"),
          locationId: nullableGuid(data, "locationId"),
          title: text(data, "title"),
          description: text(data, "description"),
          costCategory: text(data, "costCategory"),
          budgetId: nullableGuid(data, "budgetId"),
          purchaseRequisitionId: nullableGuid(data, "purchaseRequisitionId"),
          purchaseOrderId: nullableGuid(data, "purchaseOrderId"),
          purchaseInvoiceId: nullableGuid(data, "purchaseInvoiceId"),
          fixedAssetId: nullableGuid(data, "fixedAssetId"),
          organizationCostCenterId: nullableGuid(
            data,
            "organizationCostCenterId",
          ),
          originalEstimate: numberValue(data, "originalEstimate"),
          revisedAmount: numberValue(data, "revisedAmount"),
          committedAmount: numberValue(data, "committedAmount"),
          actualExpenditure: numberValue(data, "actualExpenditure"),
          forecastAtCompletion: numberValue(data, "forecastAtCompletion"),
          requestDateUtc: text(data, "requestDateUtc"),
          expectedCompletionDateUtc: nullableText(
            data,
            "expectedCompletionDateUtc",
          ),
          justification: text(data, "justification"),
          notes: nullableText(data, "notes"),
        }),
      "AFE created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function submitPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasPartner({
          partnerCode: text(data, "partnerCode"),
          partnerName: text(data, "partnerName"),
          registrationNumber: nullableText(data, "registrationNumber"),
          contactEmail: nullableText(data, "contactEmail"),
          contactPhone: nullableText(data, "contactPhone"),
          notes: nullableText(data, "notes"),
        }),
      "Partner created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function submitProductionPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasProductionPeriod({
          periodCode: text(data, "periodCode"),
          startDateUtc: text(data, "startDateUtc"),
          endDateUtc: text(data, "endDateUtc"),
          notes: nullableText(data, "notes"),
        }),
      "Production period created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function submitIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasHseIncident({
          incidentDateUtc: text(data, "incidentDateUtc"),
          assetId: text(data, "assetId"),
          locationId: nullableGuid(data, "locationId"),
          incidentCategory: text(data, "incidentCategory"),
          severity: numberValue(data, "severity"),
          description: text(data, "description"),
          immediateAction: text(data, "immediateAction"),
          rootCause: nullableText(data, "rootCause"),
          responsibleOfficer: text(data, "responsibleOfficer"),
          targetClosureDateUtc: nullableText(data, "targetClosureDateUtc"),
          evidenceReference: nullableText(data, "evidenceReference"),
          notes: nullableText(data, "notes"),
        }),
      "HSE incident created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function submitEquipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasEquipment({
          equipmentNumber: text(data, "equipmentNumber"),
          equipmentName: text(data, "equipmentName"),
          assetId: text(data, "assetId"),
          locationId: nullableGuid(data, "locationId"),
          fixedAssetId: nullableGuid(data, "fixedAssetId"),
          equipmentCategory: text(data, "equipmentCategory"),
          manufacturer: nullableText(data, "manufacturer"),
          model: nullableText(data, "model"),
          serialNumber: nullableText(data, "serialNumber"),
          criticalityLevel: numberValue(data, "criticalityLevel"),
          commissioningDateUtc: nullableText(data, "commissioningDateUtc"),
          lastMaintenanceDateUtc: nullableText(data, "lastMaintenanceDateUtc"),
          nextMaintenanceDateUtc: nullableText(data, "nextMaintenanceDateUtc"),
          nextInspectionDateUtc: nullableText(data, "nextInspectionDateUtc"),
          status: numberValue(data, "status"),
          notes: nullableText(data, "notes"),
        }),
      "Equipment created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function submitDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasDocument({
          documentType: numberValue(data, "documentType"),
          relatedEntityType: text(data, "relatedEntityType"),
          relatedEntityId: text(data, "relatedEntityId"),
          documentReference: text(data, "documentReference"),
          fileName: nullableText(data, "fileName"),
          issueDateUtc: nullableText(data, "issueDateUtc"),
          expiryDateUtc: nullableText(data, "expiryDateUtc"),
          description: nullableText(data, "description"),
        }),
      "Document reference created successfully.",
    );

    if (ok) event.currentTarget.reset();
  }

  async function loadReport() {
    setErrorText("");
    try {
      setReport(await getOilGasUpstreamManagementReport(reportFrom, reportTo));
    } catch (error) {
      setErrorText(
        getTenantReadableError(error, "Unable to load upstream report."),
      );
    }
  }

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to Oil & Gas Upstream Operations.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="panel">Loading Oil & Gas Upstream Operations...</div>
    );
  }

  return (
    <div className="page-grid oilgas-upstream-page">
      {message ? <div className="panel success-panel">{message}</div> : null}
      {errorText ? <div className="panel error-panel">{errorText}</div> : null}

      {tab === "dashboard" ? (
        <>
          <section className="panel">
            <h2>Upstream Operations Control Centre</h2>
            <p className="muted">
              Monitor liftings, AFE commitments, joint-venture participation,
              monthly production close, HSE exceptions, equipment integrity and
              expiring operational evidence.
            </p>
          </section>
          <section className="oilgas-metric-grid">
            {[
              ["Open Liftings", dashboard?.openLiftings],
              ["Pending AFE Approvals", dashboard?.pendingAfeApprovals],
              ["Active Partners", dashboard?.activePartners],
              ["Open Production Periods", dashboard?.openProductionPeriods],
              ["Open HSE Incidents", dashboard?.openHseIncidents],
              [
                "Overdue Corrective Actions",
                dashboard?.overdueCorrectiveActions,
              ],
              ["Maintenance/Inspection Due", dashboard?.maintenanceDue],
              ["Permit Expiry Alerts", dashboard?.permitExpiryAlerts],
              [
                "Completed Liftings Awaiting Billing",
                dashboard?.unbilledCompletedLiftings,
              ],
              ["Open AFE Value", formatAmount(dashboard?.openAfeValue)],
            ].map(([label, value]) => (
              <div className="panel oilgas-metric-card" key={String(label)}>
                <div className="muted">{label}</div>
                <strong>{value ?? 0}</strong>
              </div>
            ))}
          </section>
        </>
      ) : null}

      {tab === "liftings" ? (
        <>
          {canManageLifting ? (
            <section className="panel">
              <h2>Create Upstream Lifting</h2>
              <form className="form-grid three" onSubmit={submitLifting}>
                <label>
                  Nomination Reference
                  <input className="input" name="nominationReference" />
                </label>
                <label>
                  Asset
                  <select className="input" name="assetId" required>
                    <option value="">Select asset</option>
                    {activeAssets.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select className="input" name="locationId" required>
                    <option value="">Select location</option>
                    {activeLocations.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Product
                  <select className="input" name="productId" required>
                    <option value="">Select product</option>
                    {activeProducts.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source Tank
                  <select className="input" name="sourceTankId" required>
                    <option value="">Select tank</option>
                    {activeTanks.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.tankCode} - {x.tankName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Offtaker Name
                  <input className="input" name="offtakerName" required />
                </label>
                <label>
                  Planned Quantity
                  <input
                    className="input"
                    name="plannedQuantity"
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    required
                  />
                </label>
                <label>
                  Actual Loaded Quantity
                  <input
                    className="input"
                    name="actualLoadedQuantity"
                    type="number"
                    min="0"
                    step="0.0001"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Delivered Quantity
                  <input
                    className="input"
                    name="deliveredQuantity"
                    type="number"
                    min="0"
                    step="0.0001"
                  />
                </label>
                <label>
                  Unit of Measure
                  <input
                    className="input"
                    name="unitOfMeasure"
                    defaultValue="BBL"
                    required
                  />
                </label>
                <label>
                  Planned Loading Date
                  <input
                    className="input"
                    name="plannedLoadingDateUtc"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </label>
                <label>
                  Transport Type
                  <select className="input" name="transportType">
                    <option value="1">Vessel</option>
                    <option value="2">Truck</option>
                    <option value="3">Pipeline</option>
                    <option value="5">Other</option>
                  </select>
                </label>
                <label>
                  Vessel/Truck Reference
                  <input className="input" name="vesselOrTruckReference" />
                </label>
                <label>
                  Bill of Lading Number
                  <input className="input" name="billOfLadingNumber" />
                </label>
                <label>
                  Unit Price
                  <input
                    className="input"
                    name="unitPrice"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </label>
                <label>
                  Currency
                  <input
                    className="input"
                    name="currencyCode"
                    defaultValue="USD"
                    maxLength={3}
                  />
                </label>
                <label>
                  Customer ID
                  <input
                    className="input"
                    name="customerId"
                    placeholder="Existing AR customer GUID"
                  />
                </label>
                <label>
                  Billing Invoice ID
                  <input
                    className="input"
                    name="billingInvoiceId"
                    placeholder="Existing Billing invoice GUID"
                  />
                </label>
                <label>
                  Sales Invoice ID
                  <input
                    className="input"
                    name="salesInvoiceId"
                    placeholder="Existing AR invoice GUID"
                  />
                </label>
                <label>
                  Stock Movement ID
                  <input
                    className="input"
                    name="stockMovementId"
                    placeholder="Posted lifting movement GUID"
                  />
                </label>
                <label>
                  Destination
                  <input className="input" name="destination" />
                </label>
                <label>
                  Quality Certificate
                  <input className="input" name="qualityCertificateReference" />
                </label>
                <label className="form-span-full">
                  Notes
                  <textarea className="input" name="notes" rows={3} />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Create Lifting
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="Upstream Liftings"
            columns={[
              "Lifting No.",
              "Offtaker",
              "Product",
              "Planned",
              "Actual",
              "Status",
              "Loading Date",
              "Actions",
            ]}
            rows={liftings.map((item) => [
              item.liftingNumber,
              item.offtakerName,
              item.productName,
              `${item.plannedQuantity ?? 0} ${item.unitOfMeasure ?? ""}`,
              `${item.actualLoadedQuantity ?? 0} ${item.unitOfMeasure ?? ""}`,
              item.statusName ?? item.status,
              formatDate(item.plannedLoadingDateUtc),
              <div className="inline-actions" key={item.id}>
                {canManageLifting && item.statusName === "Draft" ? (
                  <button
                    className="button"
                    onClick={() =>
                      void runAction(
                        () => submitOilGasUpstreamLifting(item.id),
                        "Lifting submitted.",
                      )
                    }
                  >
                    Submit
                  </button>
                ) : null}
                {canApproveLifting && item.statusName === "Submitted" ? (
                  <button
                    className="button"
                    onClick={() =>
                      void runAction(
                        () => approveOilGasUpstreamLifting(item.id),
                        "Lifting approved.",
                      )
                    }
                  >
                    Approve
                  </button>
                ) : null}
                {canApproveLifting && item.statusName === "Submitted" ? (
                  <button
                    className="button danger"
                    onClick={() => {
                      const reason = promptReason("Reason for rejection");
                      if (reason)
                        void runAction(
                          () => rejectOilGasUpstreamLifting(item.id, reason),
                          "Lifting rejected.",
                        );
                    }}
                  >
                    Reject
                  </button>
                ) : null}
                {canCompleteLifting && item.statusName === "Approved" ? (
                  <button
                    className="button primary"
                    onClick={() =>
                      void runAction(
                        () =>
                          completeOilGasUpstreamLifting(item.id, {
                            actualLoadedQuantity: item.actualLoadedQuantity,
                            deliveredQuantity: item.deliveredQuantity,
                            billOfLadingNumber: item.billOfLadingNumber,
                            billingInvoiceId: item.billingInvoiceId,
                            salesInvoiceId: item.salesInvoiceId,
                            loadingCompletedOnUtc: new Date().toISOString(),
                          }),
                        "Lifting completed.",
                      )
                    }
                  >
                    Complete
                  </button>
                ) : null}
              </div>,
            ])}
          />
        </>
      ) : null}

      {tab === "afe" ? (
        <>
          {canManageAfe ? (
            <section className="panel">
              <h2>Create Authorisation for Expenditure (AFE)</h2>
              <form className="form-grid three" onSubmit={submitAfe}>
                <label>
                  Asset
                  <select className="input" name="assetId" required>
                    <option value="">Select asset</option>
                    {activeAssets.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select className="input" name="locationId">
                    <option value="">Optional</option>
                    {activeLocations.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Title
                  <input className="input" name="title" required />
                </label>
                <label>
                  Cost Category
                  <input className="input" name="costCategory" required />
                </label>
                <label>
                  Request Date
                  <input
                    className="input"
                    name="requestDateUtc"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </label>
                <label>
                  Expected Completion
                  <input
                    className="input"
                    name="expectedCompletionDateUtc"
                    type="date"
                  />
                </label>
                <label>
                  Original Estimate
                  <input
                    className="input"
                    name="originalEstimate"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Revised Amount
                  <input
                    className="input"
                    name="revisedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Committed Amount
                  <input
                    className="input"
                    name="committedAmount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Actual Expenditure
                  <input
                    className="input"
                    name="actualExpenditure"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Forecast at Completion
                  <input
                    className="input"
                    name="forecastAtCompletion"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue="0"
                  />
                </label>
                <label>
                  Budget ID
                  <input
                    className="input"
                    name="budgetId"
                    placeholder="Existing approved budget GUID"
                  />
                </label>
                <label>
                  Purchase Requisition ID
                  <input className="input" name="purchaseRequisitionId" />
                </label>
                <label>
                  Purchase Order ID
                  <input className="input" name="purchaseOrderId" />
                </label>
                <label>
                  Purchase Invoice ID
                  <input className="input" name="purchaseInvoiceId" />
                </label>
                <label>
                  Fixed Asset ID
                  <input className="input" name="fixedAssetId" />
                </label>
                <label>
                  Cost Centre ID
                  <input className="input" name="organizationCostCenterId" />
                </label>
                <label className="form-span-full">
                  Description
                  <textarea
                    className="input"
                    name="description"
                    rows={3}
                    required
                  />
                </label>
                <label className="form-span-full">
                  Justification
                  <textarea
                    className="input"
                    name="justification"
                    rows={3}
                    required
                  />
                </label>
                <label className="form-span-full">
                  Notes
                  <textarea className="input" name="notes" rows={2} />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Create AFE
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="AFE Register"
            columns={[
              "AFE No.",
              "Asset",
              "Title",
              "Approved/Revised",
              "Committed",
              "Actual",
              "Available",
              "Status",
              "Actions",
            ]}
            rows={afes.map((item) => [
              item.afeNumber,
              item.assetName,
              item.title,
              formatAmount(
                item.revisedAmount > 0
                  ? item.revisedAmount
                  : item.approvedAmount,
              ),
              formatAmount(item.committedAmount),
              formatAmount(item.actualExpenditure),
              formatAmount(item.availableBalance),
              item.statusName ?? item.status,
              <div className="inline-actions" key={item.id}>
                {canManageAfe && item.statusName === "Draft" ? (
                  <button
                    className="button"
                    onClick={() =>
                      void runAction(
                        () => submitOilGasAfe(item.id),
                        "AFE submitted.",
                      )
                    }
                  >
                    Submit
                  </button>
                ) : null}
                {canApproveAfe && item.statusName === "Submitted" ? (
                  <button
                    className="button"
                    onClick={() =>
                      void runAction(
                        () => approveOilGasAfe(item.id),
                        "AFE approved.",
                      )
                    }
                  >
                    Approve
                  </button>
                ) : null}
                {canApproveAfe && item.statusName === "Submitted" ? (
                  <button
                    className="button danger"
                    onClick={() => {
                      const reason = promptReason("Reason for rejection");
                      if (reason)
                        void runAction(
                          () => rejectOilGasAfe(item.id, reason),
                          "AFE rejected.",
                        );
                    }}
                  >
                    Reject
                  </button>
                ) : null}
                {canManageAfe && item.statusName === "Approved" ? (
                  <button
                    className="button primary"
                    onClick={() =>
                      void runAction(
                        () => closeOilGasAfe(item.id),
                        "AFE closed.",
                      )
                    }
                  >
                    Close
                  </button>
                ) : null}
              </div>,
            ])}
          />
        </>
      ) : null}

      {tab === "partners" ? (
        <>
          {canManagePartners ? (
            <section className="panel">
              <h2>Create Joint-Venture Partner</h2>
              <form className="form-grid three" onSubmit={submitPartner}>
                <label>
                  Partner Code
                  <input className="input" name="partnerCode" required />
                </label>
                <label>
                  Partner Name
                  <input className="input" name="partnerName" required />
                </label>
                <label>
                  Registration Number
                  <input className="input" name="registrationNumber" />
                </label>
                <label>
                  Email
                  <input className="input" name="contactEmail" type="email" />
                </label>
                <label>
                  Phone
                  <input className="input" name="contactPhone" />
                </label>
                <label>
                  Notes
                  <input className="input" name="notes" />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Create Partner
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="Joint-Venture Partner Register"
            columns={[
              "Code",
              "Partner",
              "Registration",
              "Email",
              "Interests",
              "Funding Records",
            ]}
            rows={partners.map((item) => [
              item.partnerCode,
              item.partnerName,
              item.registrationNumber ?? "—",
              item.contactEmail ?? "—",
              item.interestCount ?? item.interests?.length ?? 0,
              item.fundingCount ?? item.funding?.length ?? 0,
            ])}
          />
          {canManagePartners && partners.length > 0 ? (
            <PartnerTransactions
              partners={partners}
              assets={activeAssets}
              afes={afes}
              runAction={runAction}
            />
          ) : null}
        </>
      ) : null}

      {tab === "production-close" ? (
        <>
          {canManageClose ? (
            <section className="panel">
              <h2>Create Monthly Production Period</h2>
              <form
                className="form-grid three"
                onSubmit={submitProductionPeriod}
              >
                <label>
                  Period Code
                  <input
                    className="input"
                    name="periodCode"
                    placeholder="2026-06"
                    required
                  />
                </label>
                <label>
                  Start Date
                  <input
                    className="input"
                    name="startDateUtc"
                    type="date"
                    defaultValue={monthStart}
                    required
                  />
                </label>
                <label>
                  End Date
                  <input
                    className="input"
                    name="endDateUtc"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </label>
                <label className="form-span-full">
                  Notes
                  <textarea className="input" name="notes" rows={2} />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Prepare Period
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="Monthly Production Close"
            columns={[
              "Period",
              "Asset",
              "Dates",
              "Net Oil",
              "Gas",
              "Flare",
              "Variance",
              "Status",
              "Actions",
            ]}
            rows={periods.map((item) => [
              item.periodNumber ?? item.periodCode,
              item.assetName ?? "All assets",
              `${formatDate(item.periodStartUtc)} – ${formatDate(item.periodEndUtc)}`,
              item.netOilVolume ?? 0,
              item.gasProducedVolume ?? 0,
              item.gasFlaredVolume ?? 0,
              item.reconciliationVariance ?? 0,
              item.statusName ?? item.status,
              <div className="inline-actions" key={item.id}>
                {canManageClose && item.statusName === "Draft" ? (
                  <button
                    className="button"
                    onClick={() =>
                      void runAction(
                        () => submitOilGasProductionPeriod(item.id),
                        "Production period submitted.",
                      )
                    }
                  >
                    Submit
                  </button>
                ) : null}
                {canApproveClose && item.statusName === "Submitted" ? (
                  <button
                    className="button"
                    onClick={() =>
                      void runAction(
                        () => approveOilGasProductionPeriod(item.id),
                        "Production period approved.",
                      )
                    }
                  >
                    Approve
                  </button>
                ) : null}
                {canApproveClose && item.statusName === "Submitted" ? (
                  <button
                    className="button danger"
                    onClick={() => {
                      const reason = promptReason("Reason for rejection");
                      if (reason)
                        void runAction(
                          () => rejectOilGasProductionPeriod(item.id, reason),
                          "Production period rejected.",
                        );
                    }}
                  >
                    Reject
                  </button>
                ) : null}
                {canApproveClose && item.statusName === "Approved" ? (
                  <button
                    className="button primary"
                    onClick={() =>
                      void runAction(
                        () => closeOilGasProductionPeriod(item.id),
                        "Production period closed.",
                      )
                    }
                  >
                    Lock & Close
                  </button>
                ) : null}
              </div>,
            ])}
          />
        </>
      ) : null}

      {tab === "hse" ? (
        <>
          {canManageHse ? (
            <section className="panel">
              <h2>Record HSE Incident</h2>
              <form className="form-grid three" onSubmit={submitIncident}>
                <label>
                  Incident Date
                  <input
                    className="input"
                    name="incidentDateUtc"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </label>
                <label>
                  Asset
                  <select className="input" name="assetId" required>
                    <option value="">Select asset</option>
                    {activeAssets.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select className="input" name="locationId">
                    <option value="">Optional</option>
                    {activeLocations.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category
                  <input
                    className="input"
                    name="incidentCategory"
                    placeholder="Near Miss, Spill, Injury..."
                    required
                  />
                </label>
                <label>
                  Severity
                  <select className="input" name="severity">
                    <option value="1">Low</option>
                    <option value="2">Moderate</option>
                    <option value="3">High</option>
                    <option value="4">Critical</option>
                  </select>
                </label>
                <label>
                  Responsible Officer
                  <input className="input" name="responsibleOfficer" required />
                </label>
                <label>
                  Target Closure Date
                  <input
                    className="input"
                    name="targetClosureDateUtc"
                    type="date"
                  />
                </label>
                <label>
                  Evidence Reference
                  <input className="input" name="evidenceReference" />
                </label>
                <label className="form-span-full">
                  Description
                  <textarea
                    className="input"
                    name="description"
                    rows={3}
                    required
                  />
                </label>
                <label className="form-span-full">
                  Immediate Action
                  <textarea
                    className="input"
                    name="immediateAction"
                    rows={3}
                    required
                  />
                </label>
                <label className="form-span-full">
                  Root Cause
                  <textarea className="input" name="rootCause" rows={2} />
                </label>
                <label className="form-span-full">
                  Notes
                  <textarea className="input" name="notes" rows={2} />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Record Incident
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="HSE Incident Register"
            columns={[
              "Incident No.",
              "Date",
              "Asset",
              "Category",
              "Severity",
              "Officer",
              "Open Actions",
              "Status",
              "Actions",
            ]}
            rows={incidents.map((item) => [
              item.incidentNumber,
              formatDate(item.incidentDateUtc),
              item.assetName,
              item.incidentCategory,
              item.severityName ?? item.severity,
              item.responsibleOfficer,
              item.openCorrectiveActionCount ?? 0,
              item.statusName ?? item.status,
              canManageHse && item.statusName !== "Closed" ? (
                <button
                  className="button primary"
                  key={item.id}
                  onClick={() =>
                    void runAction(
                      () => closeOilGasHseIncident(item.id),
                      "Incident closed.",
                    )
                  }
                >
                  Close Incident
                </button>
              ) : (
                "—"
              ),
            ])}
          />
          {canManageHse && incidents.length > 0 ? (
            <CorrectiveActionForm incidents={incidents} runAction={runAction} />
          ) : null}
        </>
      ) : null}

      {tab === "equipment" ? (
        <>
          {canManageEquipment ? (
            <section className="panel">
              <h2>Register Operational Equipment</h2>
              <form className="form-grid three" onSubmit={submitEquipment}>
                <label>
                  Equipment Number
                  <input className="input" name="equipmentNumber" required />
                </label>
                <label>
                  Equipment Name
                  <input className="input" name="equipmentName" required />
                </label>
                <label>
                  Category
                  <input className="input" name="equipmentCategory" required />
                </label>
                <label>
                  Asset
                  <select className="input" name="assetId" required>
                    <option value="">Select asset</option>
                    {activeAssets.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location
                  <select className="input" name="locationId">
                    <option value="">Optional</option>
                    {activeLocations.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.code} - {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fixed Asset ID
                  <input
                    className="input"
                    name="fixedAssetId"
                    placeholder="Existing fixed asset GUID"
                  />
                </label>
                <label>
                  Manufacturer
                  <input className="input" name="manufacturer" />
                </label>
                <label>
                  Model
                  <input className="input" name="model" />
                </label>
                <label>
                  Serial Number
                  <input className="input" name="serialNumber" />
                </label>
                <label>
                  Criticality
                  <select className="input" name="criticalityLevel">
                    <option value="1">Low</option>
                    <option value="2">Medium</option>
                    <option value="3">High</option>
                    <option value="4">Critical</option>
                  </select>
                </label>
                <label>
                  Commissioning Date
                  <input
                    className="input"
                    name="commissioningDateUtc"
                    type="date"
                  />
                </label>
                <label>
                  Last Maintenance
                  <input
                    className="input"
                    name="lastMaintenanceDateUtc"
                    type="date"
                  />
                </label>
                <label>
                  Next Maintenance
                  <input
                    className="input"
                    name="nextMaintenanceDateUtc"
                    type="date"
                  />
                </label>
                <label>
                  Next Inspection
                  <input
                    className="input"
                    name="nextInspectionDateUtc"
                    type="date"
                  />
                </label>
                <label>
                  Status
                  <select className="input" name="status">
                    <option value="1">Operational</option>
                    <option value="2">Maintenance</option>
                    <option value="3">Out of Service</option>
                    <option value="4">Retired</option>
                  </select>
                </label>
                <label className="form-span-full">
                  Notes
                  <textarea className="input" name="notes" rows={2} />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Register Equipment
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="Operational Equipment & Integrity Register"
            columns={[
              "Equipment No.",
              "Name",
              "Asset",
              "Category",
              "Criticality",
              "Next Maintenance",
              "Next Inspection",
              "Status",
            ]}
            rows={equipment.map((item) => [
              item.equipmentNumber,
              item.equipmentName,
              item.assetName,
              item.equipmentCategory,
              item.criticalityLevel,
              formatDate(item.nextMaintenanceDateUtc),
              formatDate(item.nextInspectionDateUtc),
              item.statusName ?? item.status,
            ])}
          />
        </>
      ) : null}

      {tab === "documents" ? (
        <>
          {canManageDocuments ? (
            <section className="panel">
              <h2>Register Operational Document/Evidence</h2>
              <form className="form-grid three" onSubmit={submitDocument}>
                <label>
                  Document Type
                  <select className="input" name="documentType">
                    <option value="1">Permit</option>
                    <option value="2">Calibration Certificate</option>
                    <option value="3">Bill of Lading</option>
                    <option value="4">Quality Certificate</option>
                    <option value="5">HSE Evidence</option>
                    <option value="6">AFE Evidence</option>
                    <option value="7">Production Close</option>
                    <option value="8">Other</option>
                  </select>
                </label>
                <label>
                  Related Entity Type
                  <input
                    className="input"
                    name="relatedEntityType"
                    placeholder="Lifting, AFE, Permit..."
                    required
                  />
                </label>
                <label>
                  Related Record ID
                  <input className="input" name="relatedEntityId" required />
                </label>
                <label>
                  Document Reference
                  <input className="input" name="documentReference" required />
                </label>
                <label>
                  File Name/Location
                  <input className="input" name="fileName" />
                </label>
                <label>
                  Issue Date
                  <input className="input" name="issueDateUtc" type="date" />
                </label>
                <label>
                  Expiry Date
                  <input className="input" name="expiryDateUtc" type="date" />
                </label>
                <label className="form-span-full">
                  Description
                  <textarea className="input" name="description" rows={2} />
                </label>
                <div className="form-span-full">
                  <button className="button primary" type="submit">
                    Register Document
                  </button>
                </div>
              </form>
            </section>
          ) : null}
          <RecordTable
            title="Operational Document Register"
            columns={[
              "Type",
              "Reference",
              "Related Entity",
              "File",
              "Issue Date",
              "Expiry Date",
              "Created",
            ]}
            rows={documents.map((item) => [
              item.documentTypeName ?? item.documentType,
              item.documentReference,
              `${item.relatedEntityType} / ${item.relatedEntityId}`,
              item.fileName ?? "—",
              formatDate(item.issueDateUtc),
              formatDate(item.expiryDateUtc),
              formatDate(item.createdOnUtc),
            ])}
          />
        </>
      ) : null}

      {tab === "reports" ? (
        <>
          <section className="panel">
            <h2>Upstream Management Report</h2>
            <div className="form-grid three">
              <label>
                From
                <input
                  className="input"
                  type="date"
                  value={reportFrom}
                  onChange={(event) => setReportFrom(event.target.value)}
                />
              </label>
              <label>
                To
                <input
                  className="input"
                  type="date"
                  value={reportTo}
                  onChange={(event) => setReportTo(event.target.value)}
                />
              </label>
              <label>
                Run Report
                <button
                  className="button primary"
                  type="button"
                  onClick={() => void loadReport()}
                >
                  Load Report
                </button>
              </label>
            </div>
          </section>
          {report ? (
            <section className="panel">
              <h3>Management Summary</h3>
              <pre className="oilgas-report-output">
                {JSON.stringify(report, null, 2)}
              </pre>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function RecordTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: Array<Array<ReactNode>>;
}) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="muted">
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PartnerTransactions({
  partners,
  assets,
  afes,
  runAction,
}: {
  partners: any[];
  assets: OilGasAssetDto[];
  afes: any[];
  runAction: (
    action: () => Promise<any>,
    successMessage: string,
  ) => Promise<boolean>;
}) {
  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasPartnerInterest(text(data, "partnerId"), {
          assetId: text(data, "assetId"),
          isOperator: data.get("isOperator") === "on",
          workingInterestPercentage: numberValue(
            data,
            "workingInterestPercentage",
          ),
          costSharePercentage: numberValue(data, "costSharePercentage"),
          effectiveFromUtc: text(data, "effectiveFromUtc"),
          effectiveToUtc: nullableText(data, "effectiveToUtc"),
          notes: nullableText(data, "notes"),
        }),
      "Partner interest created.",
    );
    if (ok) event.currentTarget.reset();
  }

  async function submitFunding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasPartnerFunding(text(data, "partnerId"), {
          assetId: text(data, "assetId"),
          afeId: nullableGuid(data, "afeId"),
          fundingType: numberValue(data, "fundingType"),
          reference: text(data, "reference"),
          transactionDateUtc: text(data, "transactionDateUtc"),
          amount: numberValue(data, "amount"),
          currencyCode: text(data, "currencyCode") || "USD",
          notes: nullableText(data, "notes"),
        }),
      "Partner funding record created.",
    );
    if (ok) event.currentTarget.reset();
  }

  return (
    <section className="panel">
      <h2>Partner Interests and Funding</h2>
      <div className="oilgas-split-grid">
        <form className="form-grid" onSubmit={submitInterest}>
          <h3>Working Interest</h3>
          <label>
            Partner
            <select className="input" name="partnerId" required>
              <option value="">Select partner</option>
              {partners.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.partnerCode} - {x.partnerName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asset
            <select className="input" name="assetId" required>
              <option value="">Select asset</option>
              {assets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} - {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Working Interest %
            <input
              className="input"
              name="workingInterestPercentage"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              required
            />
          </label>
          <label>
            Cost Share %
            <input
              className="input"
              name="costSharePercentage"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              required
            />
          </label>
          <label>
            Effective From
            <input
              className="input"
              name="effectiveFromUtc"
              type="date"
              defaultValue={today}
              required
            />
          </label>
          <label>
            Effective To
            <input className="input" name="effectiveToUtc" type="date" />
          </label>
          <label>
            <input name="isOperator" type="checkbox" /> Partner is Operator
          </label>
          <label>
            Notes
            <textarea className="input" name="notes" rows={2} />
          </label>
          <button className="button primary" type="submit">
            Add Interest
          </button>
        </form>

        <form className="form-grid" onSubmit={submitFunding}>
          <h3>Cash Call / Funding</h3>
          <label>
            Partner
            <select className="input" name="partnerId" required>
              <option value="">Select partner</option>
              {partners.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.partnerCode} - {x.partnerName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asset
            <select className="input" name="assetId" required>
              <option value="">Select asset</option>
              {assets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.code} - {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            AFE
            <select className="input" name="afeId">
              <option value="">Optional</option>
              {afes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.afeNumber} - {x.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Funding Type
            <select className="input" name="fundingType">
              <option value="1">Cash Call</option>
              <option value="2">Funding Receipt</option>
              <option value="3">Cost Allocation</option>
              <option value="4">Adjustment</option>
            </select>
          </label>
          <label>
            Reference
            <input className="input" name="reference" required />
          </label>
          <label>
            Transaction Date
            <input
              className="input"
              name="transactionDateUtc"
              type="date"
              defaultValue={today}
              required
            />
          </label>
          <label>
            Amount
            <input
              className="input"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              required
            />
          </label>
          <label>
            Currency
            <input
              className="input"
              name="currencyCode"
              defaultValue="USD"
              maxLength={3}
            />
          </label>
          <label>
            Notes
            <textarea className="input" name="notes" rows={2} />
          </label>
          <button className="button primary" type="submit">
            Record Funding
          </button>
        </form>
      </div>
    </section>
  );
}

function CorrectiveActionForm({
  incidents,
  runAction,
}: {
  incidents: any[];
  runAction: (
    action: () => Promise<any>,
    successMessage: string,
  ) => Promise<boolean>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const ok = await runAction(
      () =>
        createOilGasCorrectiveAction(text(data, "incidentId"), {
          actionDescription: text(data, "actionDescription"),
          responsibleOfficer: text(data, "responsibleOfficer"),
          targetDateUtc: text(data, "targetDateUtc"),
          completionEvidenceReference: nullableText(
            data,
            "completionEvidenceReference",
          ),
          notes: nullableText(data, "notes"),
        }),
      "Corrective action created.",
    );
    if (ok) event.currentTarget.reset();
  }

  return (
    <section className="panel">
      <h2>Add Corrective Action</h2>
      <form className="form-grid three" onSubmit={submit}>
        <label>
          Incident
          <select className="input" name="incidentId" required>
            <option value="">Select incident</option>
            {incidents
              .filter((x) => x.statusName !== "Closed")
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.incidentNumber} - {x.incidentCategory}
                </option>
              ))}
          </select>
        </label>
        <label>
          Responsible Officer
          <input className="input" name="responsibleOfficer" required />
        </label>
        <label>
          Target Date
          <input className="input" name="targetDateUtc" type="date" required />
        </label>
        <label className="form-span-full">
          Action Description
          <textarea
            className="input"
            name="actionDescription"
            rows={3}
            required
          />
        </label>
        <label>
          Evidence Reference
          <input className="input" name="completionEvidenceReference" />
        </label>
        <label>
          Notes
          <input className="input" name="notes" />
        </label>
        <div className="form-span-full">
          <button className="button primary" type="submit">
            Add Corrective Action
          </button>
        </div>
      </form>
    </section>
  );
}
