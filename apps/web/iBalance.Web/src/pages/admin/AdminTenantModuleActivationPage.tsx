import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPlatformAdminTenants, getTenantReadableError } from '../../lib/api';
import {
  getTenantModuleActivation,
  saveTenantModuleActivation,
  type TenantModuleActivationItemDto,
} from '../../lib/adminTenantModulesApi';

function tenantStatusLabel(value: number) {
  switch (value) {
    case 1:
      return 'Active';
    case 2:
      return 'Suspended';
    case 3:
      return 'Inactive';
    default:
      return 'Unknown';
  }
}

export function AdminTenantModuleActivationPage() {
  const qc = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [moduleState, setModuleState] = useState<Record<string, boolean>>({});
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const tenantsQ = useQuery({
    queryKey: ['platform-admin-tenants'],
    queryFn: getPlatformAdminTenants,
  });

  useEffect(() => {
    const firstTenantId = tenantsQ.data?.items?.[0]?.tenantId;
    if (!selectedTenantId && firstTenantId) {
      setSelectedTenantId(firstTenantId);
    }
  }, [selectedTenantId, tenantsQ.data?.items]);

  const activationQ = useQuery({
    queryKey: ['tenant-module-activation', selectedTenantId],
    queryFn: () => getTenantModuleActivation(selectedTenantId),
    enabled: !!selectedTenantId,
  });

  useEffect(() => {
    if (activationQ.data?.items) {
      const next: Record<string, boolean> = {};
      for (const item of activationQ.data.items) {
        next[item.code] = item.isEnabled;
      }
      setModuleState(next);
    }
  }, [activationQ.data?.items]);

  const saveMut = useMutation({
    mutationFn: async () =>
      saveTenantModuleActivation(selectedTenantId, {
        items: Object.keys(moduleState).map((moduleCode) => ({
          moduleCode,
          isEnabled: !!moduleState[moduleCode],
        })),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['tenant-module-activation', selectedTenantId] });
      setInfoText('Tenant module activation saved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to save tenant module activation.'));
      setInfoText('');
    },
  });

  const selectedTenant = useMemo(
    () => (tenantsQ.data?.items ?? []).find((x) => x.tenantId === selectedTenantId),
    [selectedTenantId, tenantsQ.data?.items]
  );

  if (tenantsQ.isLoading) {
    return <div className="panel">Loading tenants...</div>;
  }

  if (tenantsQ.isError || !tenantsQ.data) {
    return <div className="panel error-panel">Unable to load platform tenants.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Tenant Module Activation</h2>
            <div className="muted">
              PlatformAdmin-only feature to enable or disable whole modules per tenant.
              Disabled modules disappear because their tenant permissions are switched off.
            </div>
          </div>
        </div>

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

        <div className="form-grid two-columns" style={{ marginTop: 16 }}>
          <div>
            <label>Tenant</label>
            <select
              className="input"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              {(tenantsQ.data.items ?? []).map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.tenantName} ({tenant.tenantKey})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Tenant Status</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {selectedTenant ? tenantStatusLabel(selectedTenant.tenantStatus) : '—'}
            </div>
          </div>
        </div>
      </section>

      {activationQ.isLoading ? (
        <section className="panel">
          <div>Loading tenant module activation...</div>
        </section>
      ) : activationQ.isError || !activationQ.data ? (
        <section className="panel error-panel">
          Unable to load tenant module activation.
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="section-heading">
              <h3>Module Visibility</h3>
              <button
                className="button primary"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !selectedTenantId}
              >
                Save Activation
              </button>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Enabled</th>
                    <th style={{ textAlign: 'right' }}>Active Permissions</th>
                    <th style={{ textAlign: 'right' }}>Total Permissions</th>
                    <th>Manageable</th>
                  </tr>
                </thead>
                <tbody>
                  {(activationQ.data.items ?? []).map((item: TenantModuleActivationItemDto) => (
                    <tr key={item.code}>
                      <td>
                        <strong>{item.name}</strong>
                        <div className="muted">{item.code}</div>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!moduleState[item.code]}
                          disabled={!item.canBeManaged}
                          onChange={(e) =>
                            setModuleState((state) => ({
                              ...state,
                              [item.code]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>{item.activePermissionCount}</td>
                      <td style={{ textAlign: 'right' }}>{item.totalPermissionCount}</td>
                      <td>{item.canBeManaged ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <h3>How this works</h3>
            <div className="muted">
              This feature toggles tenant-level security permissions by module. Because login profile
              shaping already returns only active permissions for the tenant, disabled modules stop
              appearing in the tenant workspace without changing the underlying role structure.
            </div>
          </section>
        </>
      )}
    </div>
  );
}
