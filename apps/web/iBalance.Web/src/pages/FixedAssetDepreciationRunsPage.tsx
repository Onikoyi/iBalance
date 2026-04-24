import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getFixedAssetDepreciationRuns,
  runFixedAssetDepreciation,
  previewFixedAssetDepreciation,
  getTenantReadableError,
  type FixedAssetDepreciationRunDto,
  type FixedAssetDepreciationPreviewResponse,
} from '../lib/api';

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

export function FixedAssetDepreciationRunsPage() {
  const qc = useQueryClient();
  const [periodStartUtc, setPeriodStartUtc] = useState('');
  const [periodEndUtc, setPeriodEndUtc] = useState('');
  const [runDateUtc, setRunDateUtc] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [preview, setPreview] = useState<FixedAssetDepreciationPreviewResponse | null>(null);

  const runsQ = useQuery({
    queryKey: ['fixed-asset-depreciation-runs'],
    queryFn: getFixedAssetDepreciationRuns,
  });

  const previewMut = useMutation({
    mutationFn: previewFixedAssetDepreciation,
    onSuccess: (data) => {
      setPreview(data);
      setErrorText('');
      setInfoText('Depreciation preview loaded successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to preview depreciation.'));
      setInfoText('');
    },
  });

  const runMut = useMutation({
    mutationFn: runFixedAssetDepreciation,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fixed-asset-depreciation-runs'] });
      await qc.invalidateQueries({ queryKey: ['fixed-assets'] });
      setErrorText('');
      setInfoText('Depreciation run posted successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to post depreciation run.'));
      setInfoText('');
    },
  });

  const totals = useMemo(
    () => ({
      count: preview?.items?.length ?? 0,
      amount: preview?.items?.reduce((sum, item) => sum + Number(item.depreciationAmount ?? 0), 0) ?? 0,
    }),
    [preview]
  );

  const submitPreview = async () => {
    if (!periodStartUtc || !periodEndUtc) {
      setErrorText('Please select depreciation period start and end dates.');
      setInfoText('');
      return;
    }

    await previewMut.mutateAsync({ periodStartUtc, periodEndUtc });
  };

  const submitRun = async () => {
    if (!periodStartUtc || !periodEndUtc || !runDateUtc) {
      setErrorText('Please select depreciation period start date, end date, and run date.');
      setInfoText('');
      return;
    }

    await runMut.mutateAsync({ periodStartUtc, periodEndUtc, runDateUtc });
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Fixed Asset Depreciation</h2>
          <span className="muted">Preview and post depreciation runs</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Period Start</label>
            <input className="input" type="date" value={periodStartUtc} onChange={(e) => setPeriodStartUtc(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Period End</label>
            <input className="input" type="date" value={periodEndUtc} onChange={(e) => setPeriodEndUtc(e.target.value)} />
          </div>
          <div className="form-row">
            <label>Run Date</label>
            <input className="input" type="date" value={runDateUtc} onChange={(e) => setRunDateUtc(e.target.value)} />
          </div>
        </div>

        <div className="hero-actions" style={{ marginTop: 16 }}>
          <button className="button" onClick={submitPreview} disabled={previewMut.isPending}>Preview</button>
          <button className="button primary" onClick={submitRun} disabled={runMut.isPending}>Post Run</button>
        </div>

        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Preview</h2>
          <span className="muted">{totals.count} asset(s) / {formatAmount(totals.amount)}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset No.</th>
                <th>Asset Name</th>
                <th style={{ textAlign: 'right' }}>Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {(preview?.items ?? []).length === 0 ? (
                <tr><td colSpan={3} className="muted">No preview items yet.</td></tr>
              ) : (
                (preview?.items ?? []).map((item) => (
                  <tr key={item.fixedAssetId}>
                    <td>{item.assetNumber}</td>
                    <td>{item.assetName}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item.depreciationAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Posted Depreciation Runs</h2>
          <span className="muted">{runsQ.data?.count ?? 0} run(s)</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Period Start</th>
                <th>Period End</th>
                <th>Run Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Assets</th>
              </tr>
            </thead>
            <tbody>
              {(runsQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={6} className="muted">No posted runs found.</td></tr>
              ) : (
                (runsQ.data?.items ?? []).map((run: FixedAssetDepreciationRunDto) => (
                  <tr key={run.id}>
                    <td>{run.description}</td>
                    <td>{formatDate(run.periodStartUtc)}</td>
                    <td>{formatDate(run.periodEndUtc)}</td>
                    <td>{formatDate(run.runDateUtc)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(run.totalDepreciationAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{run.lineCount}</td>
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

export default FixedAssetDepreciationRunsPage;
