import {
    canViewHumanResources,
    getHrDashboardSummary,
    useQuery,
  } from './HrShared';
  
  function stat(label: string, value?: number | null) {
    return (
      <div className="stat-card">
        <div className="stat-label">{label}</div>
        <div className="stat-value">{Number(value || 0).toLocaleString()}</div>
      </div>
    );
  }
  
  export function HrDashboardPage() {
    const canView = canViewHumanResources();
  
    const summaryQ = useQuery({
      queryKey: ['hr-dashboard-summary'],
      queryFn: getHrDashboardSummary,
      enabled: canView,
    });
  
    if (!canView) {
      return <div className="panel error-panel">You do not have access to Human Resources Management.</div>;
    }
  
    if (summaryQ.isLoading) {
      return <div className="panel">Loading HR dashboard...</div>;
    }
  
    if (summaryQ.isError) {
      return <div className="panel error-panel">Unable to load HR dashboard.</div>;
    }
  
    const item = summaryQ.data;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>Human Resources Management</h2>
          <div className="muted">
            Employee source-of-truth workspace for personnel records, departments, grades, leave, training, and disciplinary records.
          </div>
        </section>
  
        <section className="stats-grid">
          {stat('Total Employees', item?.totalEmployees)}
          {stat('Active Employees', item?.activeEmployees)}
          {stat('Terminated Employees', item?.terminatedEmployees)}
          {stat('Pending Leave', item?.pendingLeaveRequests)}
          {stat('Approved Leave', item?.approvedLeaveRequests)}
          {stat('Training Records', item?.trainingRecordCount)}
          {stat('Disciplinary Records', item?.disciplinaryRecordCount)}
        </section>
  
        <section className="panel">
          <h3>Payroll Awareness</h3>
          <div className="muted">
            HR employee records include employee number, department, job title/designation, grade, bank account, pension, and tax identifiers so Payroll can be aligned deliberately without disrupting current Payroll processing.
          </div>
        </section>
      </div>
    );
  }
  