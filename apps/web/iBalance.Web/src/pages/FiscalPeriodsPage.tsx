import { useQuery } from '@tanstack/react-query';
import { getFiscalPeriods } from '../lib/api';

function statusLabel(value: number) {
  return value === 1 ? 'Open' : 'Closed';
}

export function FiscalPeriodsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: getFiscalPeriods,
  });

  if (isLoading) {
    return <div className="panel">Loading fiscal periods...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load fiscal periods.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Fiscal Periods</h2>
        <span>{data.count} period(s)</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.startDate}</td>
                <td>{item.endDate}</td>
                <td>{statusLabel(item.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}