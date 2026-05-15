import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getTenantReadableError } from '../../lib/api';
import { getFleetLedgerAccounts, getFleetPolicy, saveFleetPolicy, type LedgerAccountLookupDto } from '../../lib/fleetApi';
import { canManageFleetPolicy, useQuery } from './fleetShared';

export function FleetPolicySetupPage() {
  const canView = canManageFleetPolicy();
  const canManage = canManageFleetPolicy();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [form, setForm] = useState<any>({
    fuelExpenseLedgerAccountId: '',
    maintenanceExpenseLedgerAccountId: '',
    tripExpenseLedgerAccountId: '',
    payableOrCashLedgerAccountId: '',
    requiresMakerCheckerForFuel: true,
    requiresMakerCheckerForMaintenance: true,
    requiresTripApproval: true,
    maxFuelAmountPerEntry: 0,
    notes: '',
  });

  const policyQ = useQuery({ queryKey: ['fleet-policy'], queryFn: getFleetPolicy, enabled: canView });
  const accountsQ = useQuery({ queryKey: ['fleet-ledger-accounts'], queryFn: getFleetLedgerAccounts, enabled: canView });

  useEffect(() => {
    if (policyQ.data?.item) {
      setForm({
        fuelExpenseLedgerAccountId: policyQ.data.item.fuelExpenseLedgerAccountId,
        maintenanceExpenseLedgerAccountId: policyQ.data.item.maintenanceExpenseLedgerAccountId,
        tripExpenseLedgerAccountId: policyQ.data.item.tripExpenseLedgerAccountId,
        payableOrCashLedgerAccountId: policyQ.data.item.payableOrCashLedgerAccountId,
        requiresMakerCheckerForFuel: policyQ.data.item.requiresMakerCheckerForFuel,
        requiresMakerCheckerForMaintenance: policyQ.data.item.requiresMakerCheckerForMaintenance,
        requiresTripApproval: policyQ.data.item.requiresTripApproval,
        maxFuelAmountPerEntry: policyQ.data.item.maxFuelAmountPerEntry,
        notes: policyQ.data.item.notes ?? '',
      });
    }
  }, [policyQ.data?.item]);

  const saveMut = useMutation({
    mutationFn: saveFleetPolicy,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fleet-policy'] });
      setMessage('Fleet policy saved successfully.');
      setErrorText('');
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to save fleet policy.'));
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to Fleet policy setup.</div>;
  if (policyQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading fleet policy...</div>;
  if (policyQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(
          policyQ.error,
          'Unable to load fleet policy.',
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

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading"><h2>Fleet Policy Setup</h2><span className="muted">Posting, workflow, and control policy</span></div>
        {message ? <div className="success-panel" style={{ marginBottom: 16 }}>{message}</div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginBottom: 16 }}>{errorText}</div> : null}
        <div className="form-grid two">
          <div className="form-row"><label>Fuel Expense Ledger</label><select className="select" value={form.fuelExpenseLedgerAccountId} onChange={(e) => setForm((s: any) => ({ ...s, fuelExpenseLedgerAccountId: e.target.value }))}><option value="">Select ledger</option>{(accountsQ.data?.items ?? []).map((item: LedgerAccountLookupDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
          <div className="form-row"><label>Maintenance Expense Ledger</label><select className="select" value={form.maintenanceExpenseLedgerAccountId} onChange={(e) => setForm((s: any) => ({ ...s, maintenanceExpenseLedgerAccountId: e.target.value }))}><option value="">Select ledger</option>{(accountsQ.data?.items ?? []).map((item: LedgerAccountLookupDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
          <div className="form-row"><label>Trip Expense Ledger</label><select className="select" value={form.tripExpenseLedgerAccountId} onChange={(e) => setForm((s: any) => ({ ...s, tripExpenseLedgerAccountId: e.target.value }))}><option value="">Select ledger</option>{(accountsQ.data?.items ?? []).map((item: LedgerAccountLookupDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
          <div className="form-row"><label>Offset / Payable / Cash Ledger</label><select className="select" value={form.payableOrCashLedgerAccountId} onChange={(e) => setForm((s: any) => ({ ...s, payableOrCashLedgerAccountId: e.target.value }))}><option value="">Select ledger</option>{(accountsQ.data?.items ?? []).map((item: LedgerAccountLookupDto) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}</select></div>
          <div className="form-row"><label>Max Fuel Amount Per Entry</label><input className="input" type="number" value={form.maxFuelAmountPerEntry} onChange={(e) => setForm((s: any) => ({ ...s, maxFuelAmountPerEntry: Number(e.target.value) }))} /></div>
          <div className="form-row"><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((s: any) => ({ ...s, notes: e.target.value }))} /></div>
          <div className="form-row"><label><input type="checkbox" checked={form.requiresMakerCheckerForFuel} onChange={(e) => setForm((s: any) => ({ ...s, requiresMakerCheckerForFuel: e.target.checked }))} /> Requires maker-checker for fuel</label></div>
          <div className="form-row"><label><input type="checkbox" checked={form.requiresMakerCheckerForMaintenance} onChange={(e) => setForm((s: any) => ({ ...s, requiresMakerCheckerForMaintenance: e.target.checked }))} /> Requires maker-checker for maintenance</label></div>
          <div className="form-row"><label><input type="checkbox" checked={form.requiresTripApproval} onChange={(e) => setForm((s: any) => ({ ...s, requiresTripApproval: e.target.checked }))} /> Requires trip approval</label></div>
        </div>
        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="button primary" disabled={!canManage || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
            {saveMut.isPending ? 'Saving…' : 'Save Fleet Policy'}
          </button>
        </div>
      </section>
    </div>
  );
}
