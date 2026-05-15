import { useState } from 'react';
import { getTenantReadableError } from '../../lib/api';
import { getFleetFuelLogs, getFleetLedgerAccounts } from '../../lib/fleetApi';
import {
  canApproveFleetFuel,
  canManageFleetFuel,
  canPostFleetFuel,
  formatAmount,
  useQuery,
} from './fleetShared';

export function FleetFuelLogsPage() {
  const canView =
    canManageFleetFuel() ||
    canApproveFleetFuel() ||
    canPostFleetFuel();

  const fuelLogsQ = useQuery({
    queryKey: ['fleet-fuel-logs'],
    queryFn: getFleetFuelLogs,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['fleet-ledger-accounts'],
    queryFn: getFleetLedgerAccounts,
    enabled: canView,
  });

  const [form, setForm] = useState<any>({
    expenseLedgerAccountId: '',
    offsetLedgerAccountId: '',
  });

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to Fleet Fuel Logs.
      </div>
    );
  }

  if (fuelLogsQ.isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading fleet fuel logs...</div>;
  }

  if (fuelLogsQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(
          fuelLogsQ.error,
          'Unable to load fleet fuel logs.',
        )}
      </div>
    );
  }

  if (accountsQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(
          accountsQ.error,
          'Unable to load ledger accounts.',
        )}
      </div>
    );
  }

  const accounts = accountsQ.data?.items ?? [];
const fuelLogs = fuelLogsQ.data?.items ?? [];

if (!Array.isArray(fuelLogs)) {
  return (
    <div className="panel error-panel">
      Fleet fuel logs response format is invalid.
    </div>
  );
}

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Fuel Logs</h2>

        <div className="form-row">
          <label>Expense Ledger</label>
          <select
            className="select"
            value={form.expenseLedgerAccountId}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                expenseLedgerAccountId: e.target.value,
              }))
            }
          >
            <option value="">Use policy default</option>

            {accounts.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label>Offset Ledger</label>

          <select
            className="select"
            value={form.offsetLedgerAccountId}
            onChange={(e) =>
              setForm((s: any) => ({
                ...s,
                offsetLedgerAccountId: e.target.value,
              }))
            }
          >
            <option value="">Use policy default</option>

            {accounts.map((item: any) => (
              <option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Fuel Log No</th>
                <th>Vehicle</th>
                <th>Date</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {fuelLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No fuel logs found.
                  </td>
                </tr>
              ) : (
                fuelLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td>{log.fuelLogNumber}</td>
                    <td>{log.vehicleId}</td>
                    <td>{log.fuelDateUtc}</td>
                    <td>{formatAmount(log.totalAmount)}</td>
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