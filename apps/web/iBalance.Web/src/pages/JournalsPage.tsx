import { useQuery } from '@tanstack/react-query';
import { getJournalEntries } from '../lib/api';

function statusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Posted';
    case 3: return 'Voided';
    case 4: return 'Reversed';
    default: return 'Unknown';
  }
}

function typeLabel(value: number) {
  switch (value) {
    case 1: return 'Normal';
    case 2: return 'Opening Balance';
    case 3: return 'Reversal';
    default: return 'Unknown';
  }
}

export function JournalsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['journal-entries'],
    queryFn: getJournalEntries,
  });

  if (isLoading) {
    return <div className="panel">Loading journal entries...</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load journal entries.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Journal Entries</h2>
        <span>{data.count} journal(s)</span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Date</th>
              <th>Description</th>
              <th>Status</th>
              <th>Type</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Lines</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.reference}</td>
                <td>{new Date(item.entryDateUtc).toLocaleString()}</td>
                <td>{item.description}</td>
                <td>{statusLabel(item.status)}</td>
                <td>{typeLabel(item.type)}</td>
                <td>{item.totalDebit.toFixed(2)}</td>
                <td>{item.totalCredit.toFixed(2)}</td>
                <td>{item.lineCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}