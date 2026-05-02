import {
  dateInputToUtc,
  downloadCsv,
  employeeTemplateHeader,
  employeeTemplateRows,
  getPayrollEmployees,
  getTenantReadableError,
  importPayrollEmployees,
  createPayrollEmployee,
  updatePayrollEmployee,
  deletePayrollEmployee,
  mapEmployeeRows,
  parseCsv,
  toDateInputValue,
  useMemo,
  useMutation,
  useQuery,
  useQueryClient,
  useState,
  type ChangeEvent,
  type PayrollEmployeeDto,
  type UpdatePayrollEmployeeRequest,
  canManageFinanceSetup,
  canViewFinance,
} from './PayrollShared';

export function PayrollEmployeesPage() {
  const queryClient = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const [showViewEmployee, setShowViewEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollEmployeeDto | null>(null);
  const [showEditEmployee, setShowEditEmployee] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState('');
  const [editForm, setEditForm] = useState<UpdatePayrollEmployeeRequest>({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    department: '',
    jobTitle: '',
    hireDateUtc: dateInputToUtc(new Date().toISOString().slice(0, 10)),
    bankName: '',
    bankAccountNumber: '',
    pensionNumber: '',
    taxIdentificationNumber: '',
    isActive: true,
    notes: '',
  });

  const [form, setForm] = useState({
    employeeNumber: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    department: '',
    jobTitle: '',
    hireDate: new Date().toISOString().slice(0, 10),
    bankName: '',
    bankAccountNumber: '',
    pensionNumber: '',
    taxIdentificationNumber: '',
    isActive: true,
    notes: '',
  });

  const employeesQ = useQuery({
    queryKey: ['payroll-employees'],
    queryFn: getPayrollEmployees,
    enabled: canView,
  });

  function clearFeedback() {
    setMessage('');
    setErrorText('');
  }

  function refreshEmployees() {
    queryClient.invalidateQueries({ queryKey: ['payroll-employees'] });
  }

  const createMut = useMutation({
    mutationFn: createPayrollEmployee,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Employee created.');
      setErrorText('');
      setForm({
        employeeNumber: '',
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        department: '',
        jobTitle: '',
        hireDate: new Date().toISOString().slice(0, 10),
        bankName: '',
        bankAccountNumber: '',
        pensionNumber: '',
        taxIdentificationNumber: '',
        isActive: true,
        notes: '',
      });
      refreshEmployees();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create employee.'));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: UpdatePayrollEmployeeRequest }) =>
      updatePayrollEmployee(employeeId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Employee updated.');
      setErrorText('');
      setShowEditEmployee(false);
      setEditingEmployeeId('');
      refreshEmployees();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update employee.'));
    },
  });

  const deleteMut = useMutation({
    mutationFn: deletePayrollEmployee,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Employee deleted.');
      setErrorText('');
      if (selectedEmployee) {
        setSelectedEmployee(null);
        setShowViewEmployee(false);
      }
      refreshEmployees();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete employee.'));
    },
  });

  const importMut = useMutation({
    mutationFn: importPayrollEmployees,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Employees imported.');
      setErrorText('');
      refreshEmployees();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to import employees.'));
    },
  });

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    clearFeedback();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const rows = parseCsv(await file.text());
    const items = mapEmployeeRows(rows);

    if (items.length === 0) {
      setErrorText('The selected payroll employee CSV did not contain any importable rows.');
      return;
    }

    importMut.mutate({ items });
  };

  function beginViewEmployee(employee: PayrollEmployeeDto) {
    clearFeedback();
    setSelectedEmployee(employee);
    setShowViewEmployee(true);
  }

  function beginEditEmployee(employee: PayrollEmployeeDto) {
    clearFeedback();
    setEditingEmployeeId(employee.id);
    setEditForm({
      firstName: employee.firstName,
      middleName: employee.middleName || '',
      lastName: employee.lastName,
      email: employee.email || '',
      phoneNumber: employee.phoneNumber || '',
      department: employee.department || '',
      jobTitle: employee.jobTitle || '',
      hireDateUtc: employee.hireDateUtc,
      bankName: employee.bankName || '',
      bankAccountNumber: employee.bankAccountNumber || '',
      pensionNumber: employee.pensionNumber || '',
      taxIdentificationNumber: employee.taxIdentificationNumber || '',
      isActive: employee.isActive,
      notes: employee.notes || '',
    });
    setShowEditEmployee(true);
  }

  async function submitEditEmployee() {
    clearFeedback();

    if (!editingEmployeeId) {
      setErrorText('Employee selection is required.');
      return;
    }

    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      setErrorText('First name and last name are required.');
      return;
    }

    await updateMut.mutateAsync({
      employeeId: editingEmployeeId,
      payload: {
        firstName: editForm.firstName.trim(),
        middleName: editForm.middleName?.trim() || null,
        lastName: editForm.lastName.trim(),
        email: editForm.email?.trim() || null,
        phoneNumber: editForm.phoneNumber?.trim() || null,
        department: editForm.department?.trim() || null,
        jobTitle: editForm.jobTitle?.trim() || null,
        hireDateUtc: editForm.hireDateUtc,
        bankName: editForm.bankName?.trim() || null,
        bankAccountNumber: editForm.bankAccountNumber?.trim() || null,
        pensionNumber: editForm.pensionNumber?.trim() || null,
        taxIdentificationNumber: editForm.taxIdentificationNumber?.trim() || null,
        isActive: editForm.isActive,
        notes: editForm.notes?.trim() || null,
      },
    });
  }

  async function removeEmployee(employee: PayrollEmployeeDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete employee "${employee.employeeNumber} - ${employee.fullName}"? This should only be used where the employee has no dependent payroll history.`
    );

    if (!confirmed) return;

    await deleteMut.mutateAsync(employee.id);
  }

  const employees = (employeesQ.data?.items ?? []) as PayrollEmployeeDto[];

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        employees
          .map((employee) => (employee.department || '').trim())
          .filter((value) => value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          employee.employeeNumber,
          employee.firstName,
          employee.middleName || '',
          employee.lastName,
          employee.fullName,
          employee.email || '',
          employee.phoneNumber || '',
          employee.department || '',
          employee.jobTitle || '',
          employee.bankName || '',
          employee.bankAccountNumber || '',
          employee.pensionNumber || '',
          employee.taxIdentificationNumber || '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && employee.isActive) ||
        (statusFilter === 'inactive' && !employee.isActive);

      const matchesDepartment =
        departmentFilter === 'all' ||
        (employee.department || '').trim().toLowerCase() === departmentFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [employees, searchText, statusFilter, departmentFilter]);

  if (!canView) return <div className="panel error-panel">You do not have access to Payroll Employees.</div>;
  if (employeesQ.isLoading) return <div className="panel">Loading employees...</div>;
  if (employeesQ.isError) return <div className="panel error-panel">Unable to load employees.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Payroll Employees</h2>
            <div className="muted">Manage employee master records and bulk employee import.</div>
          </div>
          <button
            className="button secondary"
            type="button"
            onClick={() => downloadCsv('payroll-employees-upload-template.csv', [employeeTemplateHeader, ...employeeTemplateRows])}
          >
            Download Employee Upload Template
          </button>
        </div>

        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}

        {canManage ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Upload Employees</h3>
            <p className="muted">Upload CSV using the template. Duplicate employee numbers are rejected.</p>
            <input className="input" type="file" accept=".csv,text/csv" onChange={handleUpload} />
          </div>
        ) : null}
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Create Employee</h3>
          <div className="form-grid three">
            <div className="form-row"><label>Employee No.</label><input className="input" value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></div>
            <div className="form-row"><label>First Name</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div className="form-row"><label>Middle Name</label><input className="input" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></div>
            <div className="form-row"><label>Last Name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div className="form-row"><label>Email</label><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="form-row"><label>Phone</label><input className="input" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} /></div>
            <div className="form-row"><label>Department</label><input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
            <div className="form-row"><label>Job Title</label><input className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></div>
            <div className="form-row"><label>Hire Date</label><input className="input" type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></div>
            <div className="form-row"><label>Bank Name</label><input className="input" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
            <div className="form-row"><label>Bank Account No.</label><input className="input" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} /></div>
            <div className="form-row"><label>Pension No.</label><input className="input" value={form.pensionNumber} onChange={(e) => setForm({ ...form, pensionNumber: e.target.value })} /></div>
            <div className="form-row"><label>Tax ID</label><input className="input" value={form.taxIdentificationNumber} onChange={(e) => setForm({ ...form, taxIdentificationNumber: e.target.value })} /></div>
            <div className="form-row"><label>Status</label><select className="input" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
          </div>

          <div className="form-row"><label>Notes</label><textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <button
            className="button primary"
            type="button"
            disabled={createMut.isPending}
            onClick={() =>
              createMut.mutate({
                employeeNumber: form.employeeNumber.trim(),
                firstName: form.firstName.trim(),
                middleName: form.middleName.trim() || null,
                lastName: form.lastName.trim(),
                email: form.email.trim() || null,
                phoneNumber: form.phoneNumber.trim() || null,
                department: form.department.trim() || null,
                jobTitle: form.jobTitle.trim() || null,
                hireDateUtc: dateInputToUtc(form.hireDate),
                bankName: form.bankName.trim() || null,
                bankAccountNumber: form.bankAccountNumber.trim() || null,
                pensionNumber: form.pensionNumber.trim() || null,
                taxIdentificationNumber: form.taxIdentificationNumber.trim() || null,
                isActive: form.isActive,
                notes: form.notes.trim() || null,
              })
            }
          >
            {createMut.isPending ? 'Creating…' : 'Create Employee'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>Employee Register</h3>
            <div className="muted">Search and filter the register by employee details, status, and department.</div>
          </div>
        </div>

        <div className="form-grid three" style={{ marginBottom: 12 }}>
          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search name, employee no., department, bank, tax ID..."
            />
          </div>

          <div className="form-row">
            <label>Status</label>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div className="form-row">
            <label>Department</label>
            <select className="input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="all">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="muted" style={{ marginBottom: 12 }}>
          Showing {filteredEmployees.length} of {employees.length} employee(s).
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee No.</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Job Title</th>
                <th>Hire Date</th>
                <th>Bank</th>
                <th>Pension No.</th>
                <th>Tax ID</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 260 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan={canManage ? 15 : 14} className="muted">No employees match the current filter.</td></tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.employeeNumber}</td>
                    <td>{employee.firstName}</td>
                    <td>{employee.middleName || '—'}</td>
                    <td>{employee.lastName}</td>
                    <td>{employee.fullName}</td>
                    <td>{employee.email || '—'}</td>
                    <td>{employee.phoneNumber || '—'}</td>
                    <td>{employee.department || '—'}</td>
                    <td>{employee.jobTitle || '—'}</td>
                    <td>{toDateInputValue(employee.hireDateUtc) || '—'}</td>
                    <td>{[employee.bankName, employee.bankAccountNumber].filter(Boolean).join(' - ') || '—'}</td>
                    <td>{employee.pensionNumber || '—'}</td>
                    <td>{employee.taxIdentificationNumber || '—'}</td>
                    <td>{employee.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginViewEmployee(employee)} disabled={updateMut.isPending || deleteMut.isPending}>View</button>
                          <button className="button" type="button" onClick={() => beginEditEmployee(employee)} disabled={updateMut.isPending || deleteMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removeEmployee(employee)} disabled={updateMut.isPending || deleteMut.isPending}>Delete</button>
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

      {showViewEmployee && selectedEmployee ? (
        <div className="modal-backdrop" onMouseDown={() => setShowViewEmployee(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Employee Details</h2>
              <button className="button ghost" onClick={() => setShowViewEmployee(false)} aria-label="Close">✕</button>
            </div>

            <div className="form-grid two">
              <div className="kv-row"><span>Employee No.</span><span>{selectedEmployee.employeeNumber}</span></div>
              <div className="kv-row"><span>Full Name</span><span>{selectedEmployee.fullName}</span></div>
              <div className="kv-row"><span>First Name</span><span>{selectedEmployee.firstName}</span></div>
              <div className="kv-row"><span>Middle Name</span><span>{selectedEmployee.middleName || '—'}</span></div>
              <div className="kv-row"><span>Last Name</span><span>{selectedEmployee.lastName}</span></div>
              <div className="kv-row"><span>Email</span><span>{selectedEmployee.email || '—'}</span></div>
              <div className="kv-row"><span>Phone</span><span>{selectedEmployee.phoneNumber || '—'}</span></div>
              <div className="kv-row"><span>Department</span><span>{selectedEmployee.department || '—'}</span></div>
              <div className="kv-row"><span>Job Title</span><span>{selectedEmployee.jobTitle || '—'}</span></div>
              <div className="kv-row"><span>Hire Date</span><span>{toDateInputValue(selectedEmployee.hireDateUtc) || '—'}</span></div>
              <div className="kv-row"><span>Bank Name</span><span>{selectedEmployee.bankName || '—'}</span></div>
              <div className="kv-row"><span>Bank Account No.</span><span>{selectedEmployee.bankAccountNumber || '—'}</span></div>
              <div className="kv-row"><span>Pension No.</span><span>{selectedEmployee.pensionNumber || '—'}</span></div>
              <div className="kv-row"><span>Tax ID</span><span>{selectedEmployee.taxIdentificationNumber || '—'}</span></div>
              <div className="kv-row"><span>Status</span><span>{selectedEmployee.isActive ? 'Active' : 'Inactive'}</span></div>
            </div>

            <div className="form-row">
              <label>Notes</label>
              <div className="input" style={{ minHeight: 80 }}>{selectedEmployee.notes || '—'}</div>
            </div>

            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowViewEmployee(false)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditEmployee ? (
        <div className="modal-backdrop" onMouseDown={() => !updateMut.isPending && setShowEditEmployee(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Employee</h2>
              <button className="button ghost" onClick={() => !updateMut.isPending && setShowEditEmployee(false)} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid three">
              <div className="form-row"><label>First Name</label><input className="input" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} /></div>
              <div className="form-row"><label>Middle Name</label><input className="input" value={editForm.middleName || ''} onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })} /></div>
              <div className="form-row"><label>Last Name</label><input className="input" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} /></div>
              <div className="form-row"><label>Email</label><input className="input" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="form-row"><label>Phone</label><input className="input" value={editForm.phoneNumber || ''} onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })} /></div>
              <div className="form-row"><label>Department</label><input className="input" value={editForm.department || ''} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} /></div>
              <div className="form-row"><label>Job Title</label><input className="input" value={editForm.jobTitle || ''} onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })} /></div>
              <div className="form-row"><label>Hire Date</label><input className="input" type="date" value={toDateInputValue(editForm.hireDateUtc)} onChange={(e) => setEditForm({ ...editForm, hireDateUtc: dateInputToUtc(e.target.value) })} /></div>
              <div className="form-row"><label>Status</label><select className="input" value={editForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Bank Name</label><input className="input" value={editForm.bankName || ''} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} /></div>
              <div className="form-row"><label>Bank Account No.</label><input className="input" value={editForm.bankAccountNumber || ''} onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })} /></div>
              <div className="form-row"><label>Pension No.</label><input className="input" value={editForm.pensionNumber || ''} onChange={(e) => setEditForm({ ...editForm, pensionNumber: e.target.value })} /></div>
              <div className="form-row"><label>Tax ID</label><input className="input" value={editForm.taxIdentificationNumber || ''} onChange={(e) => setEditForm({ ...editForm, taxIdentificationNumber: e.target.value })} /></div>
            </div>

            <div className="form-row"><label>Notes</label><textarea className="input" value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>

            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditEmployee(false)} disabled={updateMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditEmployee} disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
