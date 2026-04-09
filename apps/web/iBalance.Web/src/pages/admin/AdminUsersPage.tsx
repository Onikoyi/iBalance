export function AdminUsersPage() {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>User Management</h2>
            <span className="muted">UI ready — backend wiring pending</span>
          </div>
  
          <div className="detail-stack">
            <div className="muted">
              Next step: when we add Identity backend, this page will manage users, roles, and permissions for each tenant.
            </div>
  
            <div className="kv">
              <div className="kv-row"><span>Status</span><span>Not yet connected to backend</span></div>
              <div className="kv-row"><span>Planned</span><span>Create users • Assign roles • Reset passwords</span></div>
            </div>
          </div>
        </section>
      </div>
    );
  }