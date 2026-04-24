import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getFixedAssetRegister, type FixedAssetRegisterResponse, type FixedAssetRegisterItemDto } from '../lib/api';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function statusLabel(value: number) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Capitalized';
    case 3: return 'Active';
    case 4: return 'Fully Depreciated';
    case 5: return 'Disposed';
    case 6: return 'Impaired';
    default: return 'Unknown';
  }
}

export function FixedAssetRegisterPrintPage() {
  const [searchParams] = useSearchParams();

  const fixedAssetClassId = searchParams.get('fixedAssetClassId') || undefined;
  const status = searchParams.get('status') ? Number(searchParams.get('status')) : undefined;

  const reportQ = useQuery({
    queryKey: ['fixed-asset-register-print', fixedAssetClassId, status],
    queryFn: () => getFixedAssetRegister(status, fixedAssetClassId),
  });

  const summary = useMemo(() => {
    const data = reportQ.data as FixedAssetRegisterResponse | undefined;
    const items = data?.items ?? [];
    return {
      count: items.length,
      totalCost: items.reduce((sum: number, item: FixedAssetRegisterItemDto) => sum + Number(item.acquisitionCost ?? 0), 0),
      totalAccumulatedDepreciation: items.reduce(
        (sum: number, item: FixedAssetRegisterItemDto) => sum + Number(item.accumulatedDepreciationAmount ?? 0),
        0
      ),
      totalNetBookValue: items.reduce((sum: number, item: FixedAssetRegisterItemDto) => sum + Number(item.netBookValue ?? 0), 0),
    };
  }, [reportQ.data]);

  if (reportQ.isLoading) {
    return <div className="panel">Loading fixed asset register report...</div>;
  }

  if (reportQ.error || !reportQ.data) {
    return <div className="panel error-panel">Unable to load fixed asset register report.</div>;
  }

  const report = reportQ.data;

  return (
    <div className="page-grid print-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h1>Fixed Asset Register</h1>
            <div className="muted">Detailed fixed asset report</div>
          </div>
          <button className="button" onClick={() => window.print()}>Print</button>
        </div>

        <div className="kv" style={{ marginTop: 16 }}>
          <div className="kv-row"><span>Total Assets</span><span>{summary.count}</span></div>
          <div className="kv-row"><span>Total Cost</span><span>{formatAmount(summary.totalCost)}</span></div>
          <div className="kv-row"><span>Total Accumulated Depreciation</span><span>{formatAmount(summary.totalAccumulatedDepreciation)}</span></div>
          <div className="kv-row"><span>Total Net Book Value</span><span>{formatAmount(summary.totalNetBookValue)}</span></div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Assets</h2>
          <span className="muted">{report.count} item(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset No.</th>
                <th>Asset Name</th>
                <th>Class</th>
                <th>Acquisition Date</th>
                <th>Capitalization Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>Accum. Depn.</th>
                <th style={{ textAlign: 'right' }}>NBV</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((item: FixedAssetRegisterItemDto) => (
                <tr key={item.id}>
                  <td>{item.assetNumber}</td>
                  <td>{item.assetName}</td>
                  <td>{item.fixedAssetClassName}</td>
                  <td>{formatDate(item.acquisitionDateUtc)}</td>
                  <td>{formatDate(item.capitalizationDateUtc)}</td>
                  <td>{statusLabel(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.acquisitionCost)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.accumulatedDepreciationAmount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatAmount(item.netBookValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default FixedAssetRegisterPrintPage;
