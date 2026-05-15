import { useMemo } from 'react';
import {
  canViewExpenseAdvances,
  eamStatusLabel,
  formatAmount,
  formatDateTime,
  getExpenseAdvanceRequests,
  type ExpenseAdvanceRequestDto,
  type ExpenseAdvanceRequestListResponse,
  useQuery,
} from './eamShared';

export function TravelAdvancesPage() {
  const canView = canViewExpenseAdvances();

  const requestsQ = useQuery<ExpenseAdvanceRequestListResponse>({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
    enabled: canView,
  });

  const items = useMemo<ExpenseAdvanceRequestDto[]>(
    () => (requestsQ.data?.items ?? []).filter((x: ExpenseAdvanceRequestDto) => x.advanceTypeId === '11111111-1111-1111-1111-111111111111'),
    [requestsQ.data?.items]
  );

  if (!canView) return <div className="panel error-panel">You do not have access to this page.</div>;
  if (requestsQ.isLoading) return <div className="panel">Loading...</div>;
  if (requestsQ.isError || !requestsQ.data) return <div className="panel error-panel">Unable to load records.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading"><h2>Travel Advances</h2><span className="muted">{items.length} item(s)</span></div>
        <div className="muted">Track travel advances through approval, disbursement, and retirement.</div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead><tr><th>Reference</th><th>Purpose</th><th>Status</th><th>Expected Retirement</th><th style={{ textAlign: 'right' }}>Requested</th><th style={{ textAlign: 'right' }}>Outstanding</th></tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={6} className="muted">No records found.</td></tr> :
                items.map((item: ExpenseAdvanceRequestDto) => (
                  <tr key={item.id}>
                    <td>{item.requestNumber}</td>
                    <td>{item.purpose}</td>
                    <td>{eamStatusLabel(item.status)}</td>
                    <td>{formatDateTime(item.expectedRetirementDateUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.requestedAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.outstandingAmount)}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
