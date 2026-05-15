import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveExpenseAdvanceRequest,
  getExpenseAdvanceRequests,
  getTenantReadableError,
  rejectExpenseAdvanceRequest,
} from './eamShared';
import {
  canApproveExpenseAdvances,
  canViewExpenseAdvances,
  eamStatusLabel,
  formatAmount,
  formatDateTime,
} from './eamShared';

export function AdvanceApprovalQueuePage() {
  const qc = useQueryClient();
  const canView = canViewExpenseAdvances();
  const canApprove = canApproveExpenseAdvances();

  const [rejectReason, setRejectReason] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const requestsQ = useQuery({
    queryKey: ['eam-requests'],
    queryFn: getExpenseAdvanceRequests,
    enabled: canView,
  });

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ['eam-dashboard'] });
    await qc.invalidateQueries({ queryKey: ['eam-requests'] });
    await qc.invalidateQueries({ queryKey: ['eam-rejected-requests'] });
  }

  const approveMut = useMutation({
    mutationFn: approveExpenseAdvanceRequest,
    onSuccess: async () => {
      await refresh();
      setInfoText('Advance request approved successfully.');
      setErrorText('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to approve advance request.'));
      setInfoText('');
    },
  });

  const rejectMut = useMutation({
    mutationFn: (requestId: string) =>
      rejectExpenseAdvanceRequest(requestId, { reason: rejectReason.trim() }),
    onSuccess: async () => {
      await refresh();
      setInfoText('Advance request rejected successfully.');
      setErrorText('');
      setRejectReason('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'Unable to reject advance request.'));
      setInfoText('');
    },
  });

  const queue = useMemo(
    () => (requestsQ.data?.items ?? []).filter((x) => x.status === 2),
    [requestsQ.data?.items]
  );

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to the advance approval queue.
      </div>
    );
  }

  if (requestsQ.isLoading) {
    return <div className="panel">Loading advance approval queue...</div>;
  }

  if (requestsQ.isError || !requestsQ.data) {
    return <div className="panel error-panel">Unable to load advance approval queue.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Advance Approval Queue</h2>
          <span className="muted">{queue.length} pending item(s)</span>
        </div>

        <div className="muted">
          Approve or reject submitted requests while preserving segregation-of-duties and
          auditability.
        </div>

        {infoText ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">{infoText}</div>
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginTop: 16 }}>
            {errorText}
          </div>
        ) : null}

        <div className="form-row" style={{ marginTop: 16 }}>
          <label>Reusable reject reason</label>
          <input
            className="input"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason required for rejection"
          />
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Purpose</th>
                <th>Submitted By</th>
                <th>Submitted On</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 200 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted">
                    No submitted advance requests are awaiting approval.
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id}>
                    <td>{item.requestNumber}</td>
                    <td>{item.purpose}</td>
                    <td>{item.submittedBy || '—'}</td>
                    <td>{formatDateTime(item.submittedOnUtc)}</td>
                    <td>{eamStatusLabel(item.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatAmount(item.requestedAmount)}
                    </td>
                    <td>
                      {canApprove ? (
                        <>
                          <button
                            className="button small"
                            onClick={() => approveMut.mutate(item.id)}
                          >
                            Approve
                          </button>{' '}
                          <button
                            className="button small"
                            onClick={() => {
                              if (!rejectReason.trim()) {
                                setErrorText('Rejection reason is required.');
                                return;
                              }

                              rejectMut.mutate(item.id);
                            }}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="muted">Read only</span>
                      )}
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

