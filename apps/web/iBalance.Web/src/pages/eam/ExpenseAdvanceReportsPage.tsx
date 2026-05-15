import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getExpenseAdvanceRequests } from './eamShared';
import {
  canViewExpenseAdvanceReports,
  formatAmount,
} from './eamShared';

export function ExpenseAdvanceReportsPage() {
  const canView = canViewExpenseAdvanceReports();

  const requestsQ = useQuery({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
    enabled: canView,
  });

  const byDepartment = useMemo(() => {
    const map = new Map<
      string,
      { count: number; amount: number; outstanding: number }
    >();

    for (const item of requestsQ.data?.items ?? []) {
      const key = item.department || 'Unspecified';
      const current = map.get(key) || {
        count: 0,
        amount: 0,
        outstanding: 0,
      };

      current.count += 1;
      current.amount += Number(item.requestedAmount || 0);
      current.outstanding += Number(item.outstandingAmount || 0);

      map.set(key, current);
    }

    return Array.from(map.entries())
      .map(([department, values]) => ({
        department,
        ...values,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [requestsQ.data?.items]);

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to Expense & Advance reports.
      </div>
    );
  }

  if (requestsQ.isLoading) {
    return <div className="panel">Loading Expense & Advance reports...</div>;
  }

  if (requestsQ.isError || !requestsQ.data) {
    return (
      <div className="panel error-panel">
        Unable to load Expense & Advance reports.
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Expense & Advance Reports</h2>
        <div className="muted">
          Operational report view for outstanding, overdue, department concentration,
          and request value exposure.
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th style={{ textAlign: 'right' }}>Requests</th>
                <th style={{ textAlign: 'right' }}>Requested</th>
                <th style={{ textAlign: 'right' }}>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {byDepartment.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No reporting rows available.
                  </td>
                </tr>
              ) : (
                byDepartment.map((row) => (
                  <tr key={row.department}>
                    <td>{row.department}</td>
                    <td style={{ textAlign: 'right' }}>{row.count}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(row.amount)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(row.outstanding)}
                    </td>
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

