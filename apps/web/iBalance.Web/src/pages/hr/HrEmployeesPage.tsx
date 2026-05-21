import {
    canCreateHrEmployees,
    canTerminateHrEmployees,
    canUpdateHrEmployees,
    canViewHumanResources,
    createHrEmployee,
    dateInputToUtc,
    downloadCsv,
    employeeStatusLabel,
    getHrDepartments,
    getHrDesignations,
    getHrEmployees,
    getHrGrades,
    getHrReadableError,
    hrEmployeeTemplateHeader,
    hrEmployeeTemplateRows,
    importHrEmployees,
    mapHrEmployeeRows,
    parseCsv,
    terminateHrEmployee,
    toDateInputValue,
    updateHrEmployee,
    useMemo,
    useMutation,
    useQuery,
    useQueryClient,
    useState,
    type ChangeEvent,
    type HrEmployeeDto,
    type SaveHrEmployeeRequest,
  } from './HrShared';
  
  const today = new Date().toISOString().slice(0, 10);
  
  const emptyForm: SaveHrEmployeeRequest = {
    employeeNumber: '',
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    departmentId: null,
    designationId: null,
    gradeId: null,
    gender: 0,
    employmentType: 1,
    status: 2,
    hireDateUtc: dateInputToUtc(today),
    dateOfBirthUtc: null,
    bankName: '',
    bankAccountNumber: '',
    pensionNumber: '',
    taxIdentificationNumber: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    notes: '',
  };
  
  function toForm(item: HrEmployeeDto): SaveHrEmployeeRequest {
    return {
      employeeNumber: item.employeeNumber,
      firstName: item.firstName,
      middleName: item.middleName || '',
      lastName: item.lastName,
      email: item.email || '',
      phoneNumber: item.phoneNumber || '',
      departmentId: item.departmentId || null,
      designationId: item.designationId || null,
      gradeId: item.gradeId || null,
      gender: item.gender || 0,
      employmentType: item.employmentType || 1,
      status: item.status || 2,
      hireDateUtc: item.hireDateUtc,
      dateOfBirthUtc: item.dateOfBirthUtc || null,
      bankName: item.bankName || '',
      bankAccountNumber: item.bankAccountNumber || '',
      pensionNumber: item.pensionNumber || '',
      taxIdentificationNumber: item.taxIdentificationNumber || '',
      address: item.address || '',
      emergencyContactName: item.emergencyContactName || '',
      emergencyContactPhone: item.emergencyContactPhone || '',
      notes: item.notes || '',
    };
  }
  
  function employeeSearchText(employee: HrEmployeeDto): string {
    return [
      employee.employeeNumber,
      employee.firstName,
      employee.middleName,
      employee.lastName,
      employee.fullName,
      employee.email,
      employee.phoneNumber,
      employee.departmentCode,
      employee.departmentName,
      employee.designationCode,
      employee.designationName,
      employee.gradeCode,
      employee.gradeName,
      employee.genderName,
      employee.employmentTypeName,
      employee.statusName,
      employee.bankName,
      employee.bankAccountNumber,
      employee.pensionNumber,
      employee.taxIdentificationNumber,
      employee.address,
      employee.emergencyContactName,
      employee.emergencyContactPhone,
      employee.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  
  function escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  function printEmployeeRegister(employees: HrEmployeeDto[]) {
    const printedAt = new Date().toLocaleString();
    const rows = employees
      .map(
        (employee, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(employee.employeeNumber)}</td>
            <td>${escapeHtml(employee.fullName)}</td>
            <td>${escapeHtml(employee.email || '')}</td>
            <td>${escapeHtml(employee.phoneNumber || '')}</td>
            <td>${escapeHtml(employee.departmentName || '')}</td>
            <td>${escapeHtml(employee.designationName || '')}</td>
            <td>${escapeHtml(employee.gradeName || '')}</td>
            <td>${escapeHtml(employee.employmentTypeName || '')}</td>
            <td>${escapeHtml(employee.statusName || employeeStatusLabel(employee.status))}</td>
            <td>${escapeHtml(toDateInputValue(employee.hireDateUtc))}</td>
          </tr>`
      )
      .join('');
  
    const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <title>Employee Register</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 14mm;
      }
  
      * {
        box-sizing: border-box;
      }
  
      body {
        font-family: Arial, Helvetica, sans-serif;
        color: #111827;
        margin: 0;
        background: #ffffff;
        font-size: 11px;
      }
  
      .report-header {
        border-bottom: 2px solid #111827;
        padding-bottom: 10px;
        margin-bottom: 14px;
      }
  
      .report-title {
        font-size: 20px;
        font-weight: 700;
        margin: 0 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
  
      .report-subtitle {
        font-size: 12px;
        color: #4b5563;
        margin: 0;
      }
  
      .report-meta {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 10px;
        font-size: 11px;
        color: #374151;
      }
  
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
  
      thead {
        display: table-header-group;
      }
  
      tr {
        page-break-inside: avoid;
      }
  
      th {
        background: #f3f4f6;
        border: 1px solid #9ca3af;
        padding: 6px 5px;
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
      }
  
      td {
        border: 1px solid #d1d5db;
        padding: 5px;
        vertical-align: top;
        word-wrap: break-word;
      }
  
      .footer {
        margin-top: 12px;
        font-size: 10px;
        color: #6b7280;
        border-top: 1px solid #d1d5db;
        padding-top: 8px;
      }
    </style>
  </head>
  <body>
    <div class="report-header">
      <h1 class="report-title">Employee Register</h1>
      <p class="report-subtitle">Human Resources Management</p>
      <div class="report-meta">
        <div><strong>Total Records:</strong> ${employees.length.toLocaleString()}</div>
        <div><strong>Printed:</strong> ${escapeHtml(printedAt)}</div>
      </div>
    </div>
  
    <table>
      <thead>
        <tr>
          <th style="width: 36px;">#</th>
          <th style="width: 82px;">Employee No.</th>
          <th style="width: 145px;">Name</th>
          <th style="width: 150px;">Email</th>
          <th style="width: 95px;">Phone</th>
          <th style="width: 120px;">Department</th>
          <th style="width: 130px;">Designation</th>
          <th style="width: 75px;">Grade</th>
          <th style="width: 95px;">Employment</th>
          <th style="width: 82px;">Status</th>
          <th style="width: 82px;">Hire Date</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="11">No employee records available for the current filters.</td></tr>'}
      </tbody>
    </table>
  
    <div class="footer">
      Generated from iBalance ERP Human Resources Management. This printout reflects the currently filtered Employee Register.
    </div>
  
  </body>
  </html>`;
  
    const existingFrame = document.getElementById('hr-employee-register-print-frame');
    if (existingFrame) {
      existingFrame.remove();
    }
  
    const iframe = document.createElement('iframe');
    iframe.id = 'hr-employee-register-print-frame';
    iframe.title = 'Employee Register Print Frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
  
    document.body.appendChild(iframe);
  
    const printDocument = iframe.contentWindow?.document;
  
    if (!printDocument) {
      window.alert('Unable to prepare the print document. Please try again.');
      iframe.remove();
      return;
    }
  
    printDocument.open();
    printDocument.write(html);
    printDocument.close();
  
    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;
  
      if (!frameWindow) {
        iframe.remove();
        return;
      }
  
      frameWindow.focus();
      frameWindow.print();
  
      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
    };
  }
  
  export function HrEmployeesPage() {
    const queryClient = useQueryClient();
    const canView = canViewHumanResources();
    const canCreate = canCreateHrEmployees();
    const canUpdate = canUpdateHrEmployees();
    const canTerminate = canTerminateHrEmployees();
  
    const [selectedId, setSelectedId] = useState('');
    const [form, setForm] = useState<SaveHrEmployeeRequest>(emptyForm);
    const [hireDate, setHireDate] = useState(today);
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [terminationReason, setTerminationReason] = useState('');
    const [message, setMessage] = useState('');
    const [errorText, setErrorText] = useState('');
  
    const [globalFilter, setGlobalFilter] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [designationFilter, setDesignationFilter] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
    const [genderFilter, setGenderFilter] = useState('');
    const [hireDateFrom, setHireDateFrom] = useState('');
    const [hireDateTo, setHireDateTo] = useState('');
  
    const employeesQ = useQuery({ queryKey: ['hr-employees'], queryFn: getHrEmployees, enabled: canView });
    const departmentsQ = useQuery({ queryKey: ['hr-departments'], queryFn: getHrDepartments, enabled: canView });
    const designationsQ = useQuery({ queryKey: ['hr-designations'], queryFn: getHrDesignations, enabled: canView });
    const gradesQ = useQuery({ queryKey: ['hr-grades'], queryFn: getHrGrades, enabled: canView });
  
    const allEmployees = employeesQ.data?.items ?? [];
  
    const filteredEmployees = useMemo(() => {
      const term = globalFilter.trim().toLowerCase();
  
      return allEmployees.filter((employee) => {
        if (term && !employeeSearchText(employee).includes(term)) return false;
        if (departmentFilter && employee.departmentId !== departmentFilter) return false;
        if (designationFilter && employee.designationId !== designationFilter) return false;
        if (gradeFilter && employee.gradeId !== gradeFilter) return false;
        if (statusFilter && String(employee.status) !== statusFilter) return false;
        if (employmentTypeFilter && String(employee.employmentType) !== employmentTypeFilter) return false;
        if (genderFilter && String(employee.gender) !== genderFilter) return false;
  
        const hire = toDateInputValue(employee.hireDateUtc);
        if (hireDateFrom && hire < hireDateFrom) return false;
        if (hireDateTo && hire > hireDateTo) return false;
  
        return true;
      });
    }, [
      allEmployees,
      globalFilter,
      departmentFilter,
      designationFilter,
      gradeFilter,
      statusFilter,
      employmentTypeFilter,
      genderFilter,
      hireDateFrom,
      hireDateTo,
    ]);
  
    function payload(): SaveHrEmployeeRequest {
      return {
        ...form,
        hireDateUtc: dateInputToUtc(hireDate),
        dateOfBirthUtc: dateOfBirth ? dateInputToUtc(dateOfBirth) : null,
      };
    }
  
    const createMut = useMutation({
      mutationFn: () => createHrEmployee(payload()),
      onSuccess: () => {
        setMessage('Employee created.');
        setErrorText('');
        setForm(emptyForm);
        setHireDate(today);
        setDateOfBirth('');
        queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
        queryClient.invalidateQueries({ queryKey: ['hr-dashboard-summary'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to create employee.')),
    });
  
    const updateMut = useMutation({
      mutationFn: () => updateHrEmployee(selectedId, payload()),
      onSuccess: () => {
        setMessage('Employee updated.');
        setErrorText('');
        queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
        queryClient.invalidateQueries({ queryKey: ['hr-dashboard-summary'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to update employee.')),
    });
  
    const terminateMut = useMutation({
      mutationFn: () => terminateHrEmployee(selectedId, terminationReason, new Date().toISOString()),
      onSuccess: () => {
        setMessage('Employee terminated.');
        setErrorText('');
        setTerminationReason('');
        queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
        queryClient.invalidateQueries({ queryKey: ['hr-dashboard-summary'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to terminate employee.')),
    });
  
    const importMut = useMutation({
      mutationFn: importHrEmployees,
      onSuccess: (response) => {
        setMessage(response.message || `Imported ${response.count || 0} employee(s).`);
        setErrorText('');
        queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
        queryClient.invalidateQueries({ queryKey: ['hr-dashboard-summary'] });
      },
      onError: (error) => setErrorText(getHrReadableError(error, 'Unable to import employees.')),
    });
  
    function selectEmployee(item: HrEmployeeDto) {
      setSelectedId(item.id);
      setForm(toForm(item));
      setHireDate(toDateInputValue(item.hireDateUtc));
      setDateOfBirth(toDateInputValue(item.dateOfBirthUtc));
      setMessage('');
      setErrorText('');
    }
  
    function downloadTemplate() {
      downloadCsv('hr-employee-import-template.csv', [hrEmployeeTemplateHeader, ...hrEmployeeTemplateRows]);
    }
  
    function exportRegister() {
      const rows = [
        [
          'Employee Number',
          'Full Name',
          'Email',
          'Phone',
          'Department',
          'Designation',
          'Grade',
          'Gender',
          'Employment Type',
          'Status',
          'Hire Date',
          'Bank Name',
          'Bank Account',
          'Pension Number',
          'Tax ID',
        ],
        ...filteredEmployees.map((employee) => [
          employee.employeeNumber,
          employee.fullName,
          employee.email || '',
          employee.phoneNumber || '',
          employee.departmentName || '',
          employee.designationName || '',
          employee.gradeName || '',
          employee.genderName || '',
          employee.employmentTypeName || '',
          employee.statusName || '',
          toDateInputValue(employee.hireDateUtc),
          employee.bankName || '',
          employee.bankAccountNumber || '',
          employee.pensionNumber || '',
          employee.taxIdentificationNumber || '',
        ]),
      ];
  
      downloadCsv('hr-employee-register.csv', rows);
    }
  
    async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      event.target.value = '';
  
      if (!file) return;
  
      try {
        const text = await file.text();
        const rows = parseCsv(text);
        const items = mapHrEmployeeRows(rows);
  
        if (items.length === 0) {
          setErrorText('Import file does not contain employee rows.');
          return;
        }
  
        importMut.mutate({ items });
      } catch (error) {
        setErrorText(getHrReadableError(error, 'Unable to read import file.'));
      }
    }
  
    function clearFilters() {
      setGlobalFilter('');
      setDepartmentFilter('');
      setDesignationFilter('');
      setGradeFilter('');
      setStatusFilter('');
      setEmploymentTypeFilter('');
      setGenderFilter('');
      setHireDateFrom('');
      setHireDateTo('');
    }
  
    if (!canView) return <div className="panel error-panel">You do not have access to HR employees.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel no-print">
          <h2>Employees</h2>
          <div className="muted">
            Central HR employee master data. Use filters, import template, register export, and print view for professional employee administration.
          </div>
          {message ? <div className="success-panel">{message}</div> : null}
          {errorText ? <div className="error-panel">{errorText}</div> : null}
  
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="button secondary" type="button" onClick={downloadTemplate}>
              Download Import Template
            </button>
            {canCreate ? (
              <label className="button secondary" style={{ cursor: 'pointer' }}>
                Import Employees
                <input type="file" accept=".csv,text/csv" onChange={handleImportFile} style={{ display: 'none' }} />
              </label>
            ) : null}
            <button className="button secondary" type="button" onClick={exportRegister}>
              Export Filtered Register
            </button>
            <button className="button secondary" type="button" onClick={() => printEmployeeRegister(filteredEmployees)}>
              Print Register
            </button>
          </div>
        </section>
  
        <section className="panel no-print">
          <h3>{selectedId ? 'Edit Employee' : 'Create Employee'}</h3>
          <div className="form-grid four">
            <div className="form-row"><label>Employee Number</label><input className="input" value={form.employeeNumber} disabled={!!selectedId} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></div>
            <div className="form-row"><label>First Name</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div className="form-row"><label>Middle Name</label><input className="input" value={form.middleName || ''} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></div>
            <div className="form-row"><label>Last Name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div className="form-row"><label>Email</label><input className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="form-row"><label>Phone</label><input className="input" value={form.phoneNumber || ''} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} /></div>
            <div className="form-row"><label>Hire Date</label><input className="input" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} /></div>
            <div className="form-row"><label>Date of Birth</label><input className="input" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} /></div>
            <div className="form-row"><label>Department</label><select className="input" value={form.departmentId || ''} onChange={(e) => setForm({ ...form, departmentId: e.target.value || null })}><option value="">None</option>{(departmentsQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
            <div className="form-row"><label>Designation</label><select className="input" value={form.designationId || ''} onChange={(e) => setForm({ ...form, designationId: e.target.value || null })}><option value="">None</option>{(designationsQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
            <div className="form-row"><label>Grade</label><select className="input" value={form.gradeId || ''} onChange={(e) => setForm({ ...form, gradeId: e.target.value || null })}><option value="">None</option>{(gradesQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
            <div className="form-row"><label>Status</label><select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}><option value={1}>Draft</option><option value={2}>Active</option><option value={3}>Suspended</option><option value={4}>On Leave</option><option value={6}>Resigned</option><option value={7}>Retired</option></select></div>
            <div className="form-row"><label>Employment Type</label><select className="input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: Number(e.target.value) })}><option value={1}>Permanent</option><option value={2}>Contract</option><option value={3}>Temporary</option><option value={4}>Intern</option><option value={5}>Consultant</option></select></div>
            <div className="form-row"><label>Gender</label><select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: Number(e.target.value) })}><option value={0}>Not specified</option><option value={1}>Male</option><option value={2}>Female</option><option value={3}>Other</option></select></div>
            <div className="form-row"><label>Bank Name</label><input className="input" value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
            <div className="form-row"><label>Bank Account</label><input className="input" value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} /></div>
            <div className="form-row"><label>Pension Number</label><input className="input" value={form.pensionNumber || ''} onChange={(e) => setForm({ ...form, pensionNumber: e.target.value })} /></div>
            <div className="form-row"><label>Tax ID</label><input className="input" value={form.taxIdentificationNumber || ''} onChange={(e) => setForm({ ...form, taxIdentificationNumber: e.target.value })} /></div>
          </div>
          <div className="form-row"><label>Notes</label><textarea className="input" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
  
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!selectedId && canCreate ? <button className="button primary" onClick={() => createMut.mutate()}>Create Employee</button> : null}
            {selectedId && canUpdate ? <button className="button primary" onClick={() => updateMut.mutate()}>Update Employee</button> : null}
            {selectedId && canTerminate ? (
              <>
                <input className="input" style={{ maxWidth: 320 }} placeholder="Termination reason" value={terminationReason} onChange={(e) => setTerminationReason(e.target.value)} />
                <button className="button danger" disabled={!terminationReason.trim()} onClick={() => terminateMut.mutate()}>Terminate</button>
              </>
            ) : null}
            <button className="button" onClick={() => { setSelectedId(''); setForm(emptyForm); setHireDate(today); setDateOfBirth(''); }}>Clear</button>
          </div>
        </section>
  
        <section className="panel no-print">
          <h3>Employee Filters</h3>
          <div className="form-grid four">
            <div className="form-row"><label>Search All Columns</label><input className="input" placeholder="Name, number, email, department, bank, tax..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} /></div>
            <div className="form-row"><label>Department</label><select className="input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}><option value="">All</option>{(departmentsQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
            <div className="form-row"><label>Designation</label><select className="input" value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)}><option value="">All</option>{(designationsQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
            <div className="form-row"><label>Grade</label><select className="input" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}><option value="">All</option>{(gradesQ.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.code} - {x.name}</option>)}</select></div>
            <div className="form-row"><label>Status</label><select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All</option><option value="1">Draft</option><option value="2">Active</option><option value="3">Suspended</option><option value="4">On Leave</option><option value="5">Terminated</option><option value="6">Resigned</option><option value="7">Retired</option></select></div>
            <div className="form-row"><label>Employment Type</label><select className="input" value={employmentTypeFilter} onChange={(e) => setEmploymentTypeFilter(e.target.value)}><option value="">All</option><option value="1">Permanent</option><option value="2">Contract</option><option value="3">Temporary</option><option value="4">Intern</option><option value="5">Consultant</option></select></div>
            <div className="form-row"><label>Gender</label><select className="input" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}><option value="">All</option><option value="0">Not specified</option><option value="1">Male</option><option value="2">Female</option><option value="3">Other</option></select></div>
            <div className="form-row"><label>Hire Date From</label><input className="input" type="date" value={hireDateFrom} onChange={(e) => setHireDateFrom(e.target.value)} /></div>
            <div className="form-row"><label>Hire Date To</label><input className="input" type="date" value={hireDateTo} onChange={(e) => setHireDateTo(e.target.value)} /></div>
          </div>
          <button className="button secondary" type="button" onClick={clearFilters}>Clear Filters</button>
        </section>
  
        <section className="panel employee-register-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3>Employee Register</h3>
              <div className="muted">Showing {filteredEmployees.length.toLocaleString()} of {allEmployees.length.toLocaleString()} employee(s).</div>
            </div>
            <div className="muted print-only">Printed: {new Date().toLocaleString()}</div>
          </div>
  
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Grade</th>
                  <th>Employment</th>
                  <th>Status</th>
                  <th>Hire Date</th>
                  <th className="no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan={11} className="muted">No employees match the current filters.</td></tr>
                ) : (
                  filteredEmployees.map((employee) => (
                    <tr key={employee.id}>
                      <td>{employee.employeeNumber}</td>
                      <td>{employee.fullName}</td>
                      <td>{employee.email || '—'}</td>
                      <td>{employee.phoneNumber || '—'}</td>
                      <td>{employee.departmentName || '—'}</td>
                      <td>{employee.designationName || '—'}</td>
                      <td>{employee.gradeName || '—'}</td>
                      <td>{employee.employmentTypeName}</td>
                      <td>{employeeStatusLabel(employee.status)}</td>
                      <td>{toDateInputValue(employee.hireDateUtc)}</td>
                      <td className="no-print"><button className="button secondary" onClick={() => selectEmployee(employee)}>Open</button></td>
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
  