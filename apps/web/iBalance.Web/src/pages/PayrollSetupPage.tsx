import {
  createPayrollPayElement,
  createPayrollPayGroup,
  createPayrollSalaryStructure,
  deletePayrollPayElement,
  deletePayrollPayGroup,
  deletePayrollSalaryStructure,
  formatAmount,
  dateInputToUtc,
  getAccounts,
  getPayrollEmployees,
  getPayrollPayElements,
  getPayrollPayGroups,
  getPayrollSalaryStructures,
  getTenantReadableError,
  toDateInputValue,
  updatePayrollPayElement,
  updatePayrollPayGroup,
  updatePayrollSalaryStructure,
  useMemo,
  useMutation,
  useQuery,
  useQueryClient,
  useState,
  type PayrollEmployeeDto,
  type PayrollPayElementDto,
  type PayrollPayGroupDto,
  type PayrollSalaryStructureDto,
  type UpdatePayrollPayElementRequest,
  type UpdatePayrollPayGroupRequest,
  type UpdatePayrollSalaryStructureRequest,
  canManageFinanceSetup,
  canViewFinance,
} from './PayrollShared';

export function PayrollSetupPage() {
  const queryClient = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');

  const [payGroupForm, setPayGroupForm] = useState({ code: '', name: '', description: '', isActive: true });
  const [payElementForm, setPayElementForm] = useState({
    code: '',
    name: '',
    elementKind: 1,
    calculationMode: 1,
    defaultAmount: 0,
    defaultRate: 0,
    ledgerAccountId: '',
    isTaxable: true,
    isActive: true,
    description: '',
  });
  const [salaryForm, setSalaryForm] = useState({
    employeeId: '',
    payGroupId: '',
    basicSalary: 0,
    currencyCode: 'NGN',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    isActive: true,
    notes: '',
  });

  const [showEditPayGroup, setShowEditPayGroup] = useState(false);
  const [editingPayGroupId, setEditingPayGroupId] = useState('');
  const [editPayGroupForm, setEditPayGroupForm] = useState<UpdatePayrollPayGroupRequest>({
    name: '',
    description: '',
    isActive: true,
  });

  const [showEditPayElement, setShowEditPayElement] = useState(false);
  const [editingPayElementId, setEditingPayElementId] = useState('');
  const [editingPayElementCode, setEditingPayElementCode] = useState('');
  const [editPayElementForm, setEditPayElementForm] = useState<UpdatePayrollPayElementRequest>({
    name: '',
    elementKind: 1,
    calculationMode: 1,
    defaultAmount: 0,
    defaultRate: 0,
    ledgerAccountId: '',
    isTaxable: true,
    isActive: true,
    description: '',
  });

  const [showEditSalaryStructure, setShowEditSalaryStructure] = useState(false);
  const [editingSalaryStructureId, setEditingSalaryStructureId] = useState('');
  const [editSalaryStructureForm, setEditSalaryStructureForm] = useState<UpdatePayrollSalaryStructureRequest>({
    employeeId: '',
    payGroupId: '',
    basicSalary: 0,
    currencyCode: 'NGN',
    effectiveFromUtc: dateInputToUtc(new Date().toISOString().slice(0, 10)),
    isActive: true,
    notes: '',
  });

  const employeesQ = useQuery({ queryKey: ['payroll-employees'], queryFn: getPayrollEmployees, enabled: canView });
  const payGroupsQ = useQuery({ queryKey: ['payroll-pay-groups'], queryFn: getPayrollPayGroups, enabled: canView });
  const payElementsQ = useQuery({ queryKey: ['payroll-pay-elements'], queryFn: getPayrollPayElements, enabled: canView });
  const salaryQ = useQuery({ queryKey: ['payroll-salary-structures'], queryFn: getPayrollSalaryStructures, enabled: canView });
  const accountsQ = useQuery({ queryKey: ['ledger-accounts'], queryFn: getAccounts, enabled: canView });

  const postingAccounts = useMemo(
    () => ((accountsQ.data as any)?.items ?? []).filter((x: any) => x.isActive && x.isPostingAllowed && !x.isHeader),
    [accountsQ.data]
  );

  function clearFeedback() {
    setMessage('');
    setErrorText('');
  }

  function invalidateSetupQueries() {
    queryClient.invalidateQueries({ queryKey: ['payroll-pay-groups'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
  }

  const createPayGroupMut = useMutation({
    mutationFn: createPayrollPayGroup,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group created.');
      setErrorText('');
      setPayGroupForm({ code: '', name: '', description: '', isActive: true });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-groups'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create pay group.'));
    },
  });

  const updatePayGroupMut = useMutation({
    mutationFn: ({ payGroupId, payload }: { payGroupId: string; payload: UpdatePayrollPayGroupRequest }) =>
      updatePayrollPayGroup(payGroupId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group updated.');
      setErrorText('');
      setShowEditPayGroup(false);
      setEditingPayGroupId('');
      setEditPayGroupForm({ name: '', description: '', isActive: true });
      invalidateSetupQueries();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update pay group.'));
    },
  });

  const deletePayGroupMut = useMutation({
    mutationFn: deletePayrollPayGroup,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group deleted.');
      setErrorText('');
      invalidateSetupQueries();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete pay group.'));
    },
  });

  const createPayElementMut = useMutation({
    mutationFn: createPayrollPayElement,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay element created.');
      setErrorText('');
      setPayElementForm({
        code: '',
        name: '',
        elementKind: 1,
        calculationMode: 1,
        defaultAmount: 0,
        defaultRate: 0,
        ledgerAccountId: '',
        isTaxable: true,
        isActive: true,
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create pay element.'));
    },
  });

  const updatePayElementMut = useMutation({
    mutationFn: ({ payElementId, payload }: { payElementId: string; payload: UpdatePayrollPayElementRequest }) =>
      updatePayrollPayElement(payElementId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay element updated.');
      setErrorText('');
      setShowEditPayElement(false);
      setEditingPayElementId('');
      setEditingPayElementCode('');
      setEditPayElementForm({
        name: '',
        elementKind: 1,
        calculationMode: 1,
        defaultAmount: 0,
        defaultRate: 0,
        ledgerAccountId: '',
        isTaxable: true,
        isActive: true,
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update pay element.'));
    },
  });

  const deletePayElementMut = useMutation({
    mutationFn: deletePayrollPayElement,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay element deleted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete pay element.'));
    },
  });

  const createSalaryMut = useMutation({
    mutationFn: createPayrollSalaryStructure,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure created.');
      setErrorText('');
      setSalaryForm({ employeeId: '', payGroupId: '', basicSalary: 0, currencyCode: 'NGN', effectiveFrom: new Date().toISOString().slice(0, 10), isActive: true, notes: '' });
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create salary structure.'));
    },
  });

  const updateSalaryMut = useMutation({
    mutationFn: ({ salaryStructureId, payload }: { salaryStructureId: string; payload: UpdatePayrollSalaryStructureRequest }) =>
      updatePayrollSalaryStructure(salaryStructureId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure updated.');
      setErrorText('');
      setShowEditSalaryStructure(false);
      setEditingSalaryStructureId('');
      setEditSalaryStructureForm({
        employeeId: '',
        payGroupId: '',
        basicSalary: 0,
        currencyCode: 'NGN',
        effectiveFromUtc: dateInputToUtc(new Date().toISOString().slice(0, 10)),
        isActive: true,
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update salary structure.'));
    },
  });

  const deleteSalaryMut = useMutation({
    mutationFn: deletePayrollSalaryStructure,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure deleted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete salary structure.'));
    },
  });

  function beginEditPayGroup(group: PayrollPayGroupDto) {
    clearFeedback();
    setEditingPayGroupId(group.id);
    setEditPayGroupForm({
      name: group.name,
      description: group.description || '',
      isActive: group.isActive,
    });
    setShowEditPayGroup(true);
  }

  async function submitEditPayGroup() {
    clearFeedback();

    if (!editingPayGroupId) {
      setErrorText('Pay group selection is required.');
      return;
    }

    if (!editPayGroupForm.name.trim()) {
      setErrorText('Pay group name is required.');
      return;
    }

    await updatePayGroupMut.mutateAsync({
      payGroupId: editingPayGroupId,
      payload: {
        name: editPayGroupForm.name.trim(),
        description: editPayGroupForm.description?.trim() || null,
        isActive: editPayGroupForm.isActive,
      },
    });
  }

  async function removePayGroup(group: PayrollPayGroupDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete pay group "${group.code} - ${group.name}"? This will only succeed if it is not used in any salary structure.`
    );

    if (!confirmed) return;

    await deletePayGroupMut.mutateAsync(group.id);
  }

  function beginEditPayElement(element: PayrollPayElementDto) {
    clearFeedback();
    setEditingPayElementId(element.id);
    setEditingPayElementCode(element.code);
    setEditPayElementForm({
      name: element.name,
      elementKind: element.elementKind,
      calculationMode: element.calculationMode,
      defaultAmount: Number(element.defaultAmount || 0),
      defaultRate: Number(element.defaultRate || 0),
      ledgerAccountId: element.ledgerAccountId,
      isTaxable: element.isTaxable,
      isActive: element.isActive,
      description: element.description || '',
    });
    setShowEditPayElement(true);
  }

  async function submitEditPayElement() {
    clearFeedback();

    if (!editingPayElementId) {
      setErrorText('Pay element selection is required.');
      return;
    }

    if (!editPayElementForm.name.trim()) {
      setErrorText('Pay element name is required.');
      return;
    }

    if (!editPayElementForm.ledgerAccountId) {
      setErrorText('Ledger account is required for pay element posting setup.');
      return;
    }

    await updatePayElementMut.mutateAsync({
      payElementId: editingPayElementId,
      payload: {
        ...editPayElementForm,
        name: editPayElementForm.name.trim(),
        description: editPayElementForm.description?.trim() || null,
      },
    });
  }

  async function removePayElement(element: PayrollPayElementDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete pay element "${element.code} - ${element.name}"?`
    );

    if (!confirmed) return;

    await deletePayElementMut.mutateAsync(element.id);
  }

  function beginEditSalaryStructure(structure: PayrollSalaryStructureDto) {
    clearFeedback();
    setEditingSalaryStructureId(structure.id);
    setEditSalaryStructureForm({
      employeeId: structure.employeeId,
      payGroupId: structure.payGroupId,
      basicSalary: Number(structure.basicSalary || 0),
      currencyCode: structure.currencyCode || 'NGN',
      effectiveFromUtc: structure.effectiveFromUtc,
      isActive: structure.isActive,
      notes: structure.notes || '',
    });
    setShowEditSalaryStructure(true);
  }

  async function submitEditSalaryStructure() {
    clearFeedback();

    if (!editingSalaryStructureId) {
      setErrorText('Salary structure selection is required.');
      return;
    }

    if (!editSalaryStructureForm.employeeId || !editSalaryStructureForm.payGroupId) {
      setErrorText('Employee and pay group are required.');
      return;
    }

    if (editSalaryStructureForm.basicSalary < 0) {
      setErrorText('Basic salary cannot be negative.');
      return;
    }

    await updateSalaryMut.mutateAsync({
      salaryStructureId: editingSalaryStructureId,
      payload: {
        ...editSalaryStructureForm,
        currencyCode: (editSalaryStructureForm.currencyCode || 'NGN').trim() || 'NGN',
        notes: editSalaryStructureForm.notes?.trim() || null,
      },
    });
  }

  async function removeSalaryStructure(structure: PayrollSalaryStructureDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete salary structure for "${structure.employeeNumber} - ${structure.employeeName}"?`
    );

    if (!confirmed) return;

    await deleteSalaryMut.mutateAsync(structure.id);
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Payroll Setup.</div>;
  if (employeesQ.isLoading || payGroupsQ.isLoading || payElementsQ.isLoading || salaryQ.isLoading || accountsQ.isLoading) return <div className="panel">Loading Payroll setup...</div>;
  if (employeesQ.isError || payGroupsQ.isError || payElementsQ.isError || salaryQ.isError || accountsQ.isError) return <div className="panel error-panel">Unable to load Payroll setup.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Payroll Setup</h2>
        <div className="muted">Configure pay groups, pay elements, salary structures, and GL mapping.</div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Pay Groups</h3>
          <div className="form-grid three">
            <div className="form-row"><label>Code</label><input className="input" value={payGroupForm.code} onChange={(e) => setPayGroupForm({ ...payGroupForm, code: e.target.value })} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={payGroupForm.name} onChange={(e) => setPayGroupForm({ ...payGroupForm, name: e.target.value })} /></div>
            <div className="form-row"><label>Description</label><input className="input" value={payGroupForm.description} onChange={(e) => setPayGroupForm({ ...payGroupForm, description: e.target.value })} /></div>
          </div>
          <button className="button" type="button" onClick={() => createPayGroupMut.mutate({ ...payGroupForm, description: payGroupForm.description || null })} disabled={createPayGroupMut.isPending}>
            {createPayGroupMut.isPending ? 'Creating…' : 'Create Pay Group'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Pay Groups</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 220 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(payGroupsQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={canManage ? 5 : 4} className="muted">No pay groups found.</td></tr>
              ) : (
                (payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => (
                  <tr key={group.id}>
                    <td>{group.code}</td>
                    <td>{group.name}</td>
                    <td>{group.description || '—'}</td>
                    <td>{group.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginEditPayGroup(group)} disabled={updatePayGroupMut.isPending || deletePayGroupMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removePayGroup(group)} disabled={updatePayGroupMut.isPending || deletePayGroupMut.isPending}>Delete</button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Pay Elements</h3>
          <div className="muted">Element Kind: 1 = Earning, 2 = Employee Deduction, 3 = Employer Cost. Calculation Mode: 1 = Fixed Amount, 2 = Percentage.</div>
          <div className="form-grid three">
            <div className="form-row"><label>Code</label><input className="input" value={payElementForm.code} onChange={(e) => setPayElementForm({ ...payElementForm, code: e.target.value })} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={payElementForm.name} onChange={(e) => setPayElementForm({ ...payElementForm, name: e.target.value })} /></div>
            <div className="form-row"><label>Kind</label><input className="input" type="number" value={payElementForm.elementKind} onChange={(e) => setPayElementForm({ ...payElementForm, elementKind: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Mode</label><input className="input" type="number" value={payElementForm.calculationMode} onChange={(e) => setPayElementForm({ ...payElementForm, calculationMode: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Default Amount</label><input className="input" type="number" value={payElementForm.defaultAmount} onChange={(e) => setPayElementForm({ ...payElementForm, defaultAmount: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Default Rate</label><input className="input" type="number" value={payElementForm.defaultRate} onChange={(e) => setPayElementForm({ ...payElementForm, defaultRate: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Ledger Account</label><select className="input" value={payElementForm.ledgerAccountId} onChange={(e) => setPayElementForm({ ...payElementForm, ledgerAccountId: e.target.value })}><option value="">Select account</option>{postingAccounts.map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
            <div className="form-row"><label>Description</label><input className="input" value={payElementForm.description} onChange={(e) => setPayElementForm({ ...payElementForm, description: e.target.value })} /></div>
          </div>
          <button className="button" type="button" onClick={() => createPayElementMut.mutate({ ...payElementForm, description: payElementForm.description || null })} disabled={createPayElementMut.isPending}>
            {createPayElementMut.isPending ? 'Creating…' : 'Create Pay Element'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Pay Elements</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Mode</th>
                <th>Default Amount</th>
                <th>Default Rate</th>
                <th>Ledger</th>
                <th>Taxable</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 220 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(payElementsQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={canManage ? 10 : 9} className="muted">No pay elements found.</td></tr>
              ) : (
                (payElementsQ.data?.items ?? []).map((element: PayrollPayElementDto) => (
                  <tr key={element.id}>
                    <td>{element.code}</td>
                    <td>{element.name}</td>
                    <td>{element.elementKind}</td>
                    <td>{element.calculationMode}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(element.defaultAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(element.defaultRate)}</td>
                    <td>{element.ledgerAccountCode} - {element.ledgerAccountName}</td>
                    <td>{element.isTaxable ? 'Yes' : 'No'}</td>
                    <td>{element.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginEditPayElement(element)} disabled={updatePayElementMut.isPending || deletePayElementMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removePayElement(element)} disabled={updatePayElementMut.isPending || deletePayElementMut.isPending}>Delete</button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Salary Structure</h3>
          <div className="form-grid three">
            <div className="form-row"><label>Employee</label><select className="input" value={salaryForm.employeeId} onChange={(e) => setSalaryForm({ ...salaryForm, employeeId: e.target.value })}><option value="">Select employee</option>{(employeesQ.data?.items ?? []).map((employee: PayrollEmployeeDto) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} - {employee.displayName}</option>)}</select></div>
            <div className="form-row"><label>Pay Group</label><select className="input" value={salaryForm.payGroupId} onChange={(e) => setSalaryForm({ ...salaryForm, payGroupId: e.target.value })}><option value="">Select pay group</option>{(payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => <option key={group.id} value={group.id}>{group.code} - {group.name}</option>)}</select></div>
            <div className="form-row"><label>Basic Salary</label><input className="input" type="number" value={salaryForm.basicSalary} onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Currency</label><input className="input" value={salaryForm.currencyCode} onChange={(e) => setSalaryForm({ ...salaryForm, currencyCode: e.target.value })} /></div>
            <div className="form-row"><label>Effective From</label><input className="input" type="date" value={salaryForm.effectiveFrom} onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Notes</label><textarea className="input" value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} /></div>
          <button className="button" type="button" onClick={() => createSalaryMut.mutate({ employeeId: salaryForm.employeeId, payGroupId: salaryForm.payGroupId, basicSalary: salaryForm.basicSalary, currencyCode: salaryForm.currencyCode, effectiveFromUtc: dateInputToUtc(salaryForm.effectiveFrom), isActive: salaryForm.isActive, notes: salaryForm.notes || null })} disabled={createSalaryMut.isPending}>
            {createSalaryMut.isPending ? 'Creating…' : 'Create Salary Structure'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Salary Structures</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Pay Group</th>
                <th>Basic Salary</th>
                <th>Currency</th>
                <th>Effective From</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 220 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(salaryQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={canManage ? 7 : 6} className="muted">No salary structures found.</td></tr>
              ) : (
                (salaryQ.data?.items ?? []).map((structure: PayrollSalaryStructureDto) => (
                  <tr key={structure.id}>
                    <td>{structure.employeeNumber} - {structure.employeeName}</td>
                    <td>{structure.payGroupCode} - {structure.payGroupName}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(structure.basicSalary)}</td>
                    <td>{structure.currencyCode}</td>
                    <td>{toDateInputValue(structure.effectiveFromUtc)}</td>
                    <td>{structure.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginEditSalaryStructure(structure)} disabled={updateSalaryMut.isPending || deleteSalaryMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removeSalaryStructure(structure)} disabled={updateSalaryMut.isPending || deleteSalaryMut.isPending}>Delete</button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showEditPayGroup ? (
        <div className="modal-backdrop" onMouseDown={() => !updatePayGroupMut.isPending && setShowEditPayGroup(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pay Group</h2>
              <button className="button ghost" onClick={() => !updatePayGroupMut.isPending && setShowEditPayGroup(false)} aria-label="Close">✕</button>
            </div>
            {errorText ? <div className="error-panel">{errorText}</div> : null}
            <div className="form-grid two">
              <div className="form-row"><label>Name</label><input className="input" value={editPayGroupForm.name} onChange={(e) => setEditPayGroupForm({ ...editPayGroupForm, name: e.target.value })} /></div>
              <div className="form-row"><label>Status</label><select className="input" value={editPayGroupForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditPayGroupForm({ ...editPayGroupForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="form-row"><label>Description</label><input className="input" value={editPayGroupForm.description || ''} onChange={(e) => setEditPayGroupForm({ ...editPayGroupForm, description: e.target.value })} /></div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditPayGroup(false)} disabled={updatePayGroupMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditPayGroup} disabled={updatePayGroupMut.isPending}>{updatePayGroupMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditPayElement ? (
        <div className="modal-backdrop" onMouseDown={() => !updatePayElementMut.isPending && setShowEditPayElement(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pay Element</h2>
              <button className="button ghost" onClick={() => !updatePayElementMut.isPending && setShowEditPayElement(false)} aria-label="Close">✕</button>
            </div>
            {errorText ? <div className="error-panel">{errorText}</div> : null}
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="muted">Code: {editingPayElementCode}</div>
            </div>
            <div className="form-grid three">
              <div className="form-row"><label>Name</label><input className="input" value={editPayElementForm.name} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, name: e.target.value })} /></div>
              <div className="form-row"><label>Kind</label><input className="input" type="number" value={editPayElementForm.elementKind} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, elementKind: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Mode</label><input className="input" type="number" value={editPayElementForm.calculationMode} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, calculationMode: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Default Amount</label><input className="input" type="number" value={editPayElementForm.defaultAmount} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, defaultAmount: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Default Rate</label><input className="input" type="number" value={editPayElementForm.defaultRate} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, defaultRate: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Ledger Account</label><select className="input" value={editPayElementForm.ledgerAccountId} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, ledgerAccountId: e.target.value })}><option value="">Select account</option>{postingAccounts.map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
              <div className="form-row"><label>Taxable</label><select className="input" value={editPayElementForm.isTaxable ? 'yes' : 'no'} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, isTaxable: e.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select></div>
              <div className="form-row"><label>Status</label><select className="input" value={editPayElementForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Description</label><input className="input" value={editPayElementForm.description || ''} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, description: e.target.value })} /></div>
            </div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditPayElement(false)} disabled={updatePayElementMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditPayElement} disabled={updatePayElementMut.isPending}>{updatePayElementMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditSalaryStructure ? (
        <div className="modal-backdrop" onMouseDown={() => !updateSalaryMut.isPending && setShowEditSalaryStructure(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Salary Structure</h2>
              <button className="button ghost" onClick={() => !updateSalaryMut.isPending && setShowEditSalaryStructure(false)} aria-label="Close">✕</button>
            </div>
            {errorText ? <div className="error-panel">{errorText}</div> : null}
            <div className="form-grid two">
              <div className="form-row"><label>Employee</label><select className="input" value={editSalaryStructureForm.employeeId} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, employeeId: e.target.value })}><option value="">Select employee</option>{(employeesQ.data?.items ?? []).map((employee: PayrollEmployeeDto) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} - {employee.displayName}</option>)}</select></div>
              <div className="form-row"><label>Pay Group</label><select className="input" value={editSalaryStructureForm.payGroupId} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, payGroupId: e.target.value })}><option value="">Select pay group</option>{(payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => <option key={group.id} value={group.id}>{group.code} - {group.name}</option>)}</select></div>
              <div className="form-row"><label>Basic Salary</label><input className="input" type="number" value={editSalaryStructureForm.basicSalary} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, basicSalary: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Currency</label><input className="input" value={editSalaryStructureForm.currencyCode} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, currencyCode: e.target.value })} /></div>
              <div className="form-row"><label>Effective From</label><input className="input" type="date" value={toDateInputValue(editSalaryStructureForm.effectiveFromUtc)} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, effectiveFromUtc: dateInputToUtc(e.target.value) })} /></div>
              <div className="form-row"><label>Status</label><select className="input" value={editSalaryStructureForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="form-row"><label>Notes</label><textarea className="input" value={editSalaryStructureForm.notes || ''} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditSalaryStructure(false)} disabled={updateSalaryMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditSalaryStructure} disabled={updateSalaryMut.isPending}>{updateSalaryMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
