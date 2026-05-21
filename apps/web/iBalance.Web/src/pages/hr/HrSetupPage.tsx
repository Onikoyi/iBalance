import {
    canManageHrDepartments,
    canManageHrDesignations,
    canManageHrGrades,
    canViewHumanResources,
    createHrDepartment,
    createHrDesignation,
    createHrGrade,
    getHrDepartments,
    getHrDesignations,
    getHrGrades,
    getHrReadableError,
    useMutation,
    useQuery,
    useQueryClient,
    useState,
    type HrSetupItemDto,
    type SaveHrSetupItemRequest,
  } from './HrShared';
  
  const emptyForm: SaveHrSetupItemRequest = {
    code: '',
    name: '',
    description: '',
    isActive: true,
  };
  
  type SetupSectionProps = {
    title: string;
    canManage: boolean;
    items: HrSetupItemDto[];
    form: SaveHrSetupItemRequest;
    setForm: (form: SaveHrSetupItemRequest) => void;
    createAction: () => void;
  };
  
  function SetupSection({ title, canManage, items, form, setForm, createAction }: SetupSectionProps) {
    return (
      <section className="panel">
        <h3>{title}</h3>
        {canManage ? (
          <div className="form-grid four">
            <div className="form-row">
              <label>Code</label>
              <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Active</label>
              <select className="input" value={form.isActive ? 'yes' : 'no'} onChange={(e) => setForm({ ...form, isActive: e.target.value === 'yes' })}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <button className="button primary" type="button" onClick={createAction}>Create {title.slice(0, -1)}</button>
          </div>
        ) : null}
  
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="muted">No records found.</td></tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.description || '—'}</td>
                    <td>{item.isActive ? 'Yes' : 'No'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  
  export function HrSetupPage() {
    const queryClient = useQueryClient();
    const canView = canViewHumanResources();
    const canDepartments = canManageHrDepartments();
    const canDesignations = canManageHrDesignations();
    const canGrades = canManageHrGrades();
  
    const [message, setMessage] = useState('');
    const [errorText, setErrorText] = useState('');
    const [departmentForm, setDepartmentForm] = useState<SaveHrSetupItemRequest>(emptyForm);
    const [designationForm, setDesignationForm] = useState<SaveHrSetupItemRequest>(emptyForm);
    const [gradeForm, setGradeForm] = useState<SaveHrSetupItemRequest>(emptyForm);
  
    const departmentsQ = useQuery({ queryKey: ['hr-departments'], queryFn: getHrDepartments, enabled: canView });
    const designationsQ = useQuery({ queryKey: ['hr-designations'], queryFn: getHrDesignations, enabled: canView });
    const gradesQ = useQuery({ queryKey: ['hr-grades'], queryFn: getHrGrades, enabled: canView });
  
    function onError(error: unknown, fallback: string) {
      setMessage('');
      setErrorText(getHrReadableError(error, fallback));
    }
  
    const createDepartmentMut = useMutation({
      mutationFn: createHrDepartment,
      onSuccess: () => {
        setMessage('Department created.');
        setErrorText('');
        setDepartmentForm(emptyForm);
        queryClient.invalidateQueries({ queryKey: ['hr-departments'] });
      },
      onError: (error) => onError(error, 'Unable to create department.'),
    });
  
    const createDesignationMut = useMutation({
      mutationFn: createHrDesignation,
      onSuccess: () => {
        setMessage('Designation created.');
        setErrorText('');
        setDesignationForm(emptyForm);
        queryClient.invalidateQueries({ queryKey: ['hr-designations'] });
      },
      onError: (error) => onError(error, 'Unable to create designation.'),
    });
  
    const createGradeMut = useMutation({
      mutationFn: createHrGrade,
      onSuccess: () => {
        setMessage('Grade created.');
        setErrorText('');
        setGradeForm(emptyForm);
        queryClient.invalidateQueries({ queryKey: ['hr-grades'] });
      },
      onError: (error) => onError(error, 'Unable to create grade.'),
    });
  
    if (!canView) return <div className="panel error-panel">You do not have access to HR setup.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>HR Setup</h2>
          <div className="muted">Maintain departments, designations, and grades used by employee records and Payroll alignment.</div>
          {message ? <div className="success-panel">{message}</div> : null}
          {errorText ? <div className="error-panel">{errorText}</div> : null}
        </section>
  
        <SetupSection
          title="Departments"
          canManage={canDepartments}
          items={departmentsQ.data?.items ?? []}
          form={departmentForm}
          setForm={setDepartmentForm}
          createAction={() => createDepartmentMut.mutate(departmentForm)}
        />
  
        <SetupSection
          title="Designations"
          canManage={canDesignations}
          items={designationsQ.data?.items ?? []}
          form={designationForm}
          setForm={setDesignationForm}
          createAction={() => createDesignationMut.mutate(designationForm)}
        />
  
        <SetupSection
          title="Grades"
          canManage={canGrades}
          items={gradesQ.data?.items ?? []}
          form={gradeForm}
          setForm={setGradeForm}
          createAction={() => createGradeMut.mutate(gradeForm)}
        />
      </div>
    );
  }
  