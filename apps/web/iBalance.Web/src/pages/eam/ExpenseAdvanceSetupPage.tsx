import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  canManageExpenseAdvancePolicies,
  canViewExpenseAdvances,
  getEamAdvanceTypes,
  getEamExpenseCategories,
  getEamPolicy,
  getEamPostingSetup,
  getTenantReadableError,
  saveEamAdvanceType,
  saveEamExpenseCategory,
  saveEamPolicy,
  saveEamPostingSetup,
  type EamAdvanceTypeDto,
  type EamExpenseCategoryDto,
  type EamPolicyDto,
  type EamPostingSetupDto,
  useQuery,
} from './eamShared';
import { getAccounts } from '../../lib/api';

const emptyType: Partial<EamAdvanceTypeDto> = { code: '', name: '', isSystemDefined: false, isActive: true, notes: '' };
const emptyCategory: Partial<EamExpenseCategoryDto> = { code: '', name: '', defaultExpenseLedgerAccountId: '', isActive: true, notes: '' };

export function ExpenseAdvanceSetupPage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canManage = canManageExpenseAdvancePolicies();

  const [tab, setTab] = useState<'policy' | 'types' | 'categories' | 'posting'>('policy');
  const [policyForm, setPolicyForm] = useState<EamPolicyDto | null>(null);
  const [typeForm, setTypeForm] = useState<Partial<EamAdvanceTypeDto>>(emptyType);
  const [categoryForm, setCategoryForm] = useState<Partial<EamExpenseCategoryDto>>(emptyCategory);
  const [postingForm, setPostingForm] = useState<EamPostingSetupDto>({
    advanceControlLedgerAccountId: '',
    refundLedgerAccountId: '',
    salaryRecoveryLedgerAccountId: '',
    reimbursementPayableLedgerAccountId: '',
    recoveryClearingLedgerAccountId: '',
    defaultCashBankLedgerAccountId: '',
  });
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const policyQ = useQuery({
    queryKey: ['eam-policy'],
    queryFn: getEamPolicy,
    enabled: canView,
  });

  const typesQ = useQuery({
    queryKey: ['eam-advance-types'],
    queryFn: getEamAdvanceTypes,
    enabled: canView,
  });

  const categoriesQ = useQuery({
    queryKey: ['eam-expense-categories'],
    queryFn: getEamExpenseCategories,
    enabled: canView,
  });

  const postingQ = useQuery({
    queryKey: ['eam-posting-setup'],
    queryFn: getEamPostingSetup,
    enabled: canView,
  });

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  useMemo(() => {
    if (policyQ.data && !policyForm) {
      setPolicyForm(policyQ.data);
    }
  }, [policyQ.data, policyForm]);

  useMemo(() => {
    if (postingQ.data && !postingForm.tenantId) {
      setPostingForm(postingQ.data);
    }
  }, [postingQ.data, postingForm.tenantId]);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-policy'] });
    await qc.invalidateQueries({ queryKey: ['eam-advance-types'] });
    await qc.invalidateQueries({ queryKey: ['eam-expense-categories'] });
    await qc.invalidateQueries({ queryKey: ['eam-posting-setup'] });
  }

  const savePolicyMut = useMutation({
    mutationFn: saveEamPolicy,
    onSuccess: async () => {
      await refresh();
      setInfoText('Expense & Advance policy saved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to save EAM policy.'));
      setInfoText('');
    },
  });

  const saveTypeMut = useMutation({
    mutationFn: saveEamAdvanceType,
    onSuccess: async () => {
      await refresh();
      setTypeForm(emptyType);
      setInfoText('Advance type saved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to save advance type.'));
      setInfoText('');
    },
  });

  const saveCategoryMut = useMutation({
    mutationFn: saveEamExpenseCategory,
    onSuccess: async () => {
      await refresh();
      setCategoryForm(emptyCategory);
      setInfoText('Expense category saved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to save expense category.'));
      setInfoText('');
    },
  });

  const savePostingMut = useMutation({
    mutationFn: saveEamPostingSetup,
    onSuccess: async () => {
      await refresh();
      setInfoText('Posting setup saved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to save posting setup.'));
      setInfoText('');
    },
  });

  if (!canView) return <div className="panel error-panel">You do not have access to Expense & Advance setup.</div>;
  if (policyQ.isLoading || typesQ.isLoading || categoriesQ.isLoading || postingQ.isLoading || accountsQ.isLoading || !policyForm) {
    return <div className="panel">Loading Expense & Advance setup...</div>;
  }
  if (policyQ.isError || typesQ.isError || categoriesQ.isError || postingQ.isError || accountsQ.isError || !policyQ.data || !typesQ.data || !categoriesQ.data || !postingQ.data || !accountsQ.data) {
    return <div className="panel error-panel">Unable to load Expense & Advance setup.</div>;
  }

  const accounts = accountsQ.data.items ?? [];

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Expense & Advance Setup</h2>
            <div className="muted">Configure policy, master data, and posting controls for requests, disbursement, retirement, refunds, and recoveries.</div>
          </div>
          <span className="muted">{canManage ? 'Manage' : 'Read only'}</span>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className={`button ${tab === 'policy' ? 'primary' : ''}`} onClick={() => setTab('policy')}>Policy</button>
          <button className={`button ${tab === 'types' ? 'primary' : ''}`} onClick={() => setTab('types')}>Advance Types</button>
          <button className={`button ${tab === 'categories' ? 'primary' : ''}`} onClick={() => setTab('categories')}>Expense Categories</button>
          <button className={`button ${tab === 'posting' ? 'primary' : ''}`} onClick={() => setTab('posting')}>Posting Setup</button>
        </div>

        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
      </section>

      {tab === 'policy' ? (
        <section className="panel">
          <h3>Policy Controls</h3>
          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            <div><label>Max Amount</label><input className="input" type="number" min="0" value={policyForm.maxAmount} onChange={(e) => setPolicyForm({ ...policyForm, maxAmount: Number(e.target.value || 0) })} /></div>
            <div><label>Allowed Open Advances Per Staff</label><input className="input" type="number" min="0" value={policyForm.allowedOpenAdvancesPerStaff} onChange={(e) => setPolicyForm({ ...policyForm, allowedOpenAdvancesPerStaff: Number(e.target.value || 0) })} /></div>
            <div><label>Retirement Due Days</label><input className="input" type="number" min="0" value={policyForm.retirementDueDays} onChange={(e) => setPolicyForm({ ...policyForm, retirementDueDays: Number(e.target.value || 0) })} /></div>
            <div><label>Attachment Required</label><input type="checkbox" checked={policyForm.attachmentRequired} onChange={(e) => setPolicyForm({ ...policyForm, attachmentRequired: e.target.checked })} /></div>
            <div><label>Block Same User Approval</label><input type="checkbox" checked={policyForm.blockSelfApproval} onChange={(e) => setPolicyForm({ ...policyForm, blockSelfApproval: e.target.checked })} /></div>
            <div><label>Allow Excess Reimbursement</label><input type="checkbox" checked={policyForm.allowExcessReimbursement} onChange={(e) => setPolicyForm({ ...policyForm, allowExcessReimbursement: e.target.checked })} /></div>
            <div><label>Allow Salary Recovery</label><input type="checkbox" checked={policyForm.allowSalaryRecovery} onChange={(e) => setPolicyForm({ ...policyForm, allowSalaryRecovery: e.target.checked })} /></div>
            <div><label>Require Department Scope</label><input type="checkbox" checked={policyForm.requireDepartmentScope} onChange={(e) => setPolicyForm({ ...policyForm, requireDepartmentScope: e.target.checked })} /></div>
            <div><label>Require Branch Scope</label><input type="checkbox" checked={policyForm.requireBranchScope} onChange={(e) => setPolicyForm({ ...policyForm, requireBranchScope: e.target.checked })} /></div>
            <div><label>Require Cost Center Scope</label><input type="checkbox" checked={policyForm.requireCostCenterScope} onChange={(e) => setPolicyForm({ ...policyForm, requireCostCenterScope: e.target.checked })} /></div>
            <div><label>Travel Advance Requires Destination</label><input type="checkbox" checked={policyForm.travelAdvanceRequiresDestination} onChange={(e) => setPolicyForm({ ...policyForm, travelAdvanceRequiresDestination: e.target.checked })} /></div>
            <div><label>Imprest Requires Retirement</label><input type="checkbox" checked={policyForm.imprestRequiresRetirement} onChange={(e) => setPolicyForm({ ...policyForm, imprestRequiresRetirement: e.target.checked })} /></div>
            <div><label>Policy Active</label><input type="checkbox" checked={policyForm.isActive} onChange={(e) => setPolicyForm({ ...policyForm, isActive: e.target.checked })} /></div>
          </div>

          {canManage ? (
            <div className="inline-actions" style={{ marginTop: 16 }}>
              <button className="button primary" onClick={() => savePolicyMut.mutate(policyForm)} disabled={savePolicyMut.isPending}>Save Policy</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'types' ? (
        <>
          <section className="panel">
            <h3>Advance Types</h3>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead><tr><th>Code</th><th>Name</th><th>System</th><th>Active</th></tr></thead>
                <tbody>
                  {(typesQ.data.items ?? []).length === 0 ? <tr><td colSpan={4} className="muted">No advance types configured.</td></tr> :
                    (typesQ.data.items ?? []).map((item: EamAdvanceTypeDto) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.isSystemDefined ? 'Yes' : 'No'}</td>
                        <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h3>Create / Update Advance Type</h3>
            <div className="form-grid two-columns" style={{ marginTop: 16 }}>
              <div><label>Code</label><input className="input" value={typeForm.code || ''} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} /></div>
              <div><label>Name</label><input className="input" value={typeForm.name || ''} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} /></div>
              <div><label>Active</label><input type="checkbox" checked={typeForm.isActive ?? true} onChange={(e) => setTypeForm({ ...typeForm, isActive: e.target.checked })} /></div>
              <div><label>System Defined</label><input type="checkbox" checked={typeForm.isSystemDefined ?? false} onChange={(e) => setTypeForm({ ...typeForm, isSystemDefined: e.target.checked })} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={typeForm.notes || ''} onChange={(e) => setTypeForm({ ...typeForm, notes: e.target.value })} /></div>
            </div>
            {canManage ? <div className="inline-actions" style={{ marginTop: 16 }}><button className="button primary" onClick={() => saveTypeMut.mutate(typeForm)} disabled={saveTypeMut.isPending}>Save Advance Type</button></div> : null}
          </section>
        </>
      ) : null}

      {tab === 'categories' ? (
        <>
          <section className="panel">
            <h3>Expense Categories</h3>
            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table className="data-table">
                <thead><tr><th>Code</th><th>Name</th><th>Default Account</th><th>Active</th></tr></thead>
                <tbody>
                  {(categoriesQ.data.items ?? []).length === 0 ? <tr><td colSpan={4} className="muted">No expense categories configured.</td></tr> :
                    (categoriesQ.data.items ?? []).map((item: EamExpenseCategoryDto) => (
                      <tr key={item.id}>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.defaultExpenseLedgerAccountCode || '—'}</td>
                        <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h3>Create / Update Expense Category</h3>
            <div className="form-grid two-columns" style={{ marginTop: 16 }}>
              <div><label>Code</label><input className="input" value={categoryForm.code || ''} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} /></div>
              <div><label>Name</label><input className="input" value={categoryForm.name || ''} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /></div>
              <div><label>Default Expense Account</label>
                <select className="input" value={categoryForm.defaultExpenseLedgerAccountId || ''} onChange={(e) => setCategoryForm({ ...categoryForm, defaultExpenseLedgerAccountId: e.target.value })}>
                  <option value="">Select account</option>
                  {(accounts ?? []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
              <div><label>Active</label><input type="checkbox" checked={categoryForm.isActive ?? true} onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label>Notes</label><textarea className="input" rows={3} value={categoryForm.notes || ''} onChange={(e) => setCategoryForm({ ...categoryForm, notes: e.target.value })} /></div>
            </div>
            {canManage ? <div className="inline-actions" style={{ marginTop: 16 }}><button className="button primary" onClick={() => saveCategoryMut.mutate(categoryForm)} disabled={saveCategoryMut.isPending}>Save Expense Category</button></div> : null}
          </section>
        </>
      ) : null}

      {tab === 'posting' ? (
        <section className="panel">
          <h3>Posting Setup</h3>
          <div className="form-grid two-columns" style={{ marginTop: 16 }}>
            {[
              ['Advance Control Account', 'advanceControlLedgerAccountId'],
              ['Refund Account', 'refundLedgerAccountId'],
              ['Salary Recovery Account', 'salaryRecoveryLedgerAccountId'],
              ['Reimbursement Payable', 'reimbursementPayableLedgerAccountId'],
              ['Recovery Clearing Account', 'recoveryClearingLedgerAccountId'],
              ['Default Cash / Bank Account', 'defaultCashBankLedgerAccountId'],
            ].map(([label, key]) => (
              <div key={key}>
                <label>{label}</label>
                <select
                  className="input"
                  value={(postingForm as any)[key] || ''}
                  onChange={(e) => setPostingForm({ ...postingForm, [key]: e.target.value } as EamPostingSetupDto)}
                >
                  <option value="">Select account</option>
                  {(accounts ?? []).map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                </select>
              </div>
            ))}
          </div>
          {canManage ? <div className="inline-actions" style={{ marginTop: 16 }}><button className="button primary" onClick={() => savePostingMut.mutate(postingForm)} disabled={savePostingMut.isPending}>Save Posting Setup</button></div> : null}
        </section>
      ) : null}
    </div>
  );
}
