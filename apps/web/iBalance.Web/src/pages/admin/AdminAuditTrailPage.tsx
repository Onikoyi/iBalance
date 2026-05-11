import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, getTenantReadableError } from '../../lib/api';
import { getSession, isPlatformAdmin } from '../../lib/auth';

type AuditTrailItemDto = {
  id: string;
  tenantId?: string | null;
  tenantKey?: string | null;
  tenantName?: string | null;
  moduleCode: string;
  entityName: string;
  entityId?: string | null;
  action: string;
  reference?: string | null;
  description?: string | null;
  actorUserId?: string | null;
  actorIdentifier?: string | null;
  metadataJson?: string | null;
  occurredOnUtc?: string | null;
};

type AuditTrailResponse = {
  tenantContextAvailable: boolean;
  tenantId: string | null;
  tenantKey: string | null;
  wholePlatformMode: boolean;
  fromUtc?: string | null;
  toUtc?: string | null;
  take: number;
  hardMaxRows: number;
  hardMaxLookbackDays: number;
  count: number;
  items: AuditTrailItemDto[];
};

function toUtcStart(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function toUtcEnd(value: string) {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function humanizeModule(value: string) {
  switch ((value || '').toLowerCase()) {
    case 'admin':
      return 'Administration';
    case 'finance':
      return 'Finance';
    case 'ar':
      return 'Accounts Receivable';
    case 'ap':
      return 'Accounts Payable';
    case 'budget':
      return 'Budget';
    case 'treasury':
      return 'Treasury';
    case 'inventory':
      return 'Inventory';
    case 'payroll':
      return 'Payroll';
    case 'procurement':
      return 'Procurement';
    case 'fixedassets':
      return 'Fixed Assets';
    default:
      return value || 'Other';
  }
}

function formatEntityName(value?: string | null) {
  if (!value) return '—';

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .trim();
}

function toCsv(items: AuditTrailItemDto[]) {
  const rows = [
    ['When', 'Module', 'Tenant Key', 'Tenant Name', 'Entity', 'Action', 'Reference', 'Description', 'Actor'],
    ...items.map((item) => [
      item.occurredOnUtc || '',
      humanizeModule(item.moduleCode),
      item.tenantKey || '',
      item.tenantName || '',
      formatEntityName(item.entityName),
      item.action || '',
      item.reference || '',
      item.description || '',
      item.actorIdentifier || item.actorUserId || '',
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? '');
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replaceAll('"', '""')}"`;
          }
          return value;
        })
        .join(','),
    )
    .join('\n');
}

function downloadCsv(items: AuditTrailItemDto[]) {
  const csv = toCsv(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ibalance-audit-trail-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminAuditTrailPage() {
  const session = getSession();
  const platformModeAllowed = isPlatformAdmin();

  const [moduleCode, setModuleCode] = useState('');
  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [take, setTake] = useState('200');
  const [includeAllTenants, setIncludeAllTenants] = useState(platformModeAllowed);
  const [tenantKeyFilter, setTenantKeyFilter] = useState('');

  const query = useMemo(
    () => ({
      moduleCode: moduleCode || undefined,
      search: searchText.trim() || undefined,
      fromUtc: toUtcStart(fromDate),
      toUtc: toUtcEnd(toDate),
      take: Number(take || 200),
      includeAllTenants: platformModeAllowed ? includeAllTenants : false,
      tenantKey: platformModeAllowed ? tenantKeyFilter.trim() || undefined : undefined,
    }),
    [fromDate, includeAllTenants, moduleCode, platformModeAllowed, searchText, take, tenantKeyFilter, toDate],
  );

  const auditQ = useQuery({
    queryKey: [
      'admin-audit-trail',
      query.moduleCode,
      query.search,
      query.fromUtc,
      query.toUtc,
      query.take,
      query.includeAllTenants,
      query.tenantKey,
    ],
    queryFn: async () => {
      const { data } = await api.get<AuditTrailResponse>('/api/admin/audit-trail', { params: query });
      return data;
    },
  });

  const items = auditQ.data?.items ?? [];

  const summary = useMemo(() => {
    const byModule = new Map<string, number>();
    const byTenant = new Set<string>();

    for (const item of items) {
      byModule.set(item.moduleCode, (byModule.get(item.moduleCode) ?? 0) + 1);
      if (item.tenantId) {
        byTenant.add(item.tenantId);
      }
    }

    return {
      total: items.length,
      tenants: byTenant.size,
      admin: byModule.get('admin') ?? 0,
      treasury: byModule.get('treasury') ?? 0,
      finance: byModule.get('finance') ?? 0,
      operations:
        (byModule.get('ar') ?? 0) +
        (byModule.get('ap') ?? 0) +
        (byModule.get('budget') ?? 0) +
        (byModule.get('inventory') ?? 0),
    };
  }, [items]);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Audit Trail</h2>
            <div className="muted">
              Professional administrative audit visibility powered by persisted audit events. Tenant Administrators are restricted to their organization. Platform Administrators can review audit events across the whole ERP.
            </div>
          </div>

          <div className="inline-actions">
            <button className="button" type="button" onClick={() => downloadCsv(items)} disabled={items.length === 0}>
              Export CSV
            </button>
            <Link to="/admin" className="button">
              Back to Admin Dashboard
            </Link>
          </div>
        </div>

        <div className="kv">
          <div className="kv-row">
            <span>Total Rows</span>
            <span>{summary.total}</span>
          </div>
          <div className="kv-row">
            <span>Tenants</span>
            <span>{summary.tenants}</span>
          </div>
          <div className="kv-row">
            <span>Administration</span>
            <span>{summary.admin}</span>
          </div>
          <div className="kv-row">
            <span>Treasury</span>
            <span>{summary.treasury}</span>
          </div>
          <div className="kv-row">
            <span>Finance</span>
            <span>{summary.finance}</span>
          </div>
          <div className="kv-row">
            <span>AR/AP/Budget/Inventory</span>
            <span>{summary.operations}</span>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="muted">
            Performance controls are enforced server-side: default lookback 90 days, search lookback 180 days, hard lookback cap 365 days, and hard row cap 500.
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Max rows: {auditQ.data?.hardMaxRows ?? 500} · Max lookback: {auditQ.data?.hardMaxLookbackDays ?? 365} day(s)
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Session role: {session?.role || 'Unknown'} · Platform-wide mode: {auditQ.data?.wholePlatformMode ? 'Enabled' : 'Disabled'}
          </div>
        </div>

        <div className="form-grid four" style={{ marginTop: 16 }}>
          <div className="form-row">
            <label>Module</label>
            <select className="select" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)}>
              <option value="">All modules</option>
              <option value="admin">Administration</option>
              <option value="finance">Finance</option>
              <option value="ar">Accounts Receivable</option>
              <option value="ap">Accounts Payable</option>
              <option value="budget">Budget</option>
              <option value="treasury">Treasury</option>
              <option value="inventory">Inventory</option>
              <option value="payroll">Payroll</option>
              <option value="procurement">Procurement</option>
              <option value="fixedassets">Fixed Assets</option>
            </select>
          </div>

          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Reference, description, actor, entity"
            />
          </div>

          <div className="form-row">
            <label>From</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>To</label>
            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Rows</label>
            <select className="select" value={take} onChange={(e) => setTake(e.target.value)}>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="500">500</option>
            </select>
          </div>

          {platformModeAllowed ? (
            <>
              <div className="form-row">
                <label>Tenant Key Filter</label>
                <input
                  className="input"
                  value={tenantKeyFilter}
                  onChange={(e) => setTenantKeyFilter(e.target.value)}
                  placeholder="Optional tenant key"
                />
              </div>

              <label className="checkbox-row" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={includeAllTenants}
                  onChange={(e) => setIncludeAllTenants(e.target.checked)}
                />
                <span>Platform-wide mode</span>
              </label>
            </>
          ) : null}
        </div>

        {auditQ.isLoading ? <div className="panel" style={{ marginTop: 16 }}>Loading audit trail...</div> : null}

        {auditQ.isError ? (
          <div className="panel error-panel" style={{ marginTop: 16 }}>
            {getTenantReadableError(auditQ.error, 'Unable to load audit trail at this time.')}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Audit Events</h2>
          <span className="muted">{items.length} row(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Module</th>
                <th>Tenant</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Reference</th>
                <th>Description</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No audit rows matched the current filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.occurredOnUtc)}</td>
                    <td>{humanizeModule(item.moduleCode)}</td>
                    <td>
                      <div>{item.tenantName || '—'}</div>
                      <div className="muted">{item.tenantKey || '—'}</div>
                    </td>
                    <td>
                      <div>{formatEntityName(item.entityName)}</div>
                      <div className="muted">{item.entityId || '—'}</div>
                    </td>
                    <td>{item.action || 'Recorded'}</td>
                    <td>{item.reference || '—'}</td>
                    <td>{item.description || '—'}</td>
                    <td>{item.actorIdentifier || item.actorUserId || 'System'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
