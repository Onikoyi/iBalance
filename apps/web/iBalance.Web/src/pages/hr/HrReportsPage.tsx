import {
    canViewHrReports,
    employeeStatusLabel,
    getHrDashboardSummary,
    getHrEmployees,
    getHrLeaveRequests,
    leaveStatusLabel,
    toDateInputValue,
    useQuery,
  } from './HrShared';
  
  export function HrReportsPage() {
    const canView = canViewHrReports();
  
    const summaryQ = useQuery({ queryKey: ['hr-dashboard-summary'], queryFn: getHrDashboardSummary, enabled: canView });
    const employeesQ = useQuery({ queryKey: ['hr-employees'], queryFn: getHrEmployees, enabled: canView });
    const leaveQ = useQuery({ queryKey: ['hr-leave-requests'], queryFn: getHrLeaveRequests, enabled: canView });
  
    if (!canView) return <div className="panel error-panel">You do not have access to HR reports.</div>;
  
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>HR Reports</h2>
          <div className="muted">Operational HR reporting for employee headcount, status distribution, and leave monitoring.</div>
        </section>
  
        <section className="stats-grid">
          <div className="stat-card"><div className="stat-label">Total Employees</div><div className="stat-value">{summaryQ.data?.totalEmployees ?? 0}</div></div>
          <div className="stat-card"><div className="stat-label">Active Employees</div><div className="stat-value">{summaryQ.data?.activeEmployees ?? 0}</div></div>
          <div className="stat-card"><div className="stat-label">Pending Leave</div><div className="stat-value">{summaryQ.data?.pendingLeaveRequests ?? 0}</div></div>
        </section>
  
        <section className="panel">
          <h3>Employee Status Report</h3>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>No.</th><th>Name</th><th>Department</th><th>Designation</th><th>Hire Date</th><th>Status</th></tr></thead><tbody>{(employeesQ.data?.items ?? []).map((x) => <tr key={x.id}><td>{x.employeeNumber}</td><td>{x.fullName}</td><td>{x.departmentName || '—'}</td><td>{x.designationName || '—'}</td><td>{toDateInputValue(x.hireDateUtc)}</td><td>{employeeStatusLabel(x.status)}</td></tr>)}</tbody></table></div>
        </section>
  
        <section className="panel">
          <h3>Leave Status Report</h3>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Status</th></tr></thead><tbody>{(leaveQ.data?.items ?? []).map((x) => <tr key={x.id}><td>{x.employeeNumber} - {x.employeeName}</td><td>{x.leaveType}</td><td>{toDateInputValue(x.startDateUtc)}</td><td>{toDateInputValue(x.endDateUtc)}</td><td>{leaveStatusLabel(x.status)}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    );
  }
  