import { useQuery } from '@tanstack/react-query';
import { getAccounts } from '../lib/api';

function categoryLabel(value: number) {
  switch (value) {
    case 1: return 'Asset';
    case 2: return 'Liability';
    case 3: return 'Equity';
    case 4: return 'Income';
    case 5: return 'Expense';
    default: return 'Unknown';
  }
}

function normalBalanceLabel(value: number) {
  return value === 1 ? 'Debit' : 'Credit';
}

export function AccountsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
  });

  if (isLoading) {
    return <div className="panel">Loading chart of accounts...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load chart of accounts.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Chart of Accounts</h2>
        <span>{data.count} account(s)</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Category</th>
              <th>Normal Balance</th>
              <th>Header</th>
              <th>Posting</th>
              <th>Parent</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{categoryLabel(item.category)}</td>
                <td>{normalBalanceLabel(item.normalBalance)}</td>
                <td>{item.isHeader ? 'Yes' : 'No'}</td>
                <td>{item.isPostingAllowed ? 'Allowed' : 'Blocked'}</td>
                <td>{item.parentCode ? `${item.parentCode} - ${item.parentName}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}