import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmSubscriptionApplicationPayment,
  getSubscriptionApplications,
  getTenantReadableError,
  rejectSubscriptionApplication,
  type TenantSubscriptionApplicationDto,
} from '../../lib/api';

function applicationStatusLabel(value?: number) {
  switch (value) {
    case 1: return 'Pending Payment';
    case 2: return 'Payment Confirmed';
    case 3: return 'Rejected';
    case 4: return 'Activated';
    default: return 'Unavailable';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

function formatMoney(amount?: number | null, currencyCode?: string | null) {
  if (amount === null || amount === undefined) return 'Not available';

  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currencyCode || 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AdminSubscriptionApplicationsPage() {
  const qc = useQueryClient();

  const [selectedApplicationId, setSelectedApplicationId] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [infoText, setInfoText] = useState('');
  const [errorText, setErrorText] = useState('');

  const applicationsQ = useQuery({
    queryKey: ['subscription-applications'],
    queryFn: getSubscriptionApplications,
  });

  const summary = useMemo(() => {
    const items = applicationsQ.data?.items ?? [];
    return {
      total: items.length,
      pending: items.filter((x) => x.status === 1).length,
      confirmed: items.filter((x) => x.status === 2).length,
      rejected: items.filter((x) => x.status === 3).length,
      activated: items.filter((x) => x.status === 4).length,
    };
  }, [applicationsQ.data?.items]);

  const refreshAll = async () => {
    await qc.invalidateQueries({ queryKey: ['subscription-applications'] });
    await qc.invalidateQueries({ queryKey: ['platform-admin-tenants'] });
  };

  const confirmMut = useMutation({
    mutationFn: (applicationId: string) =>
      confirmSubscriptionApplicationPayment(applicationId, paymentNote.trim() || undefined),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('Payment confirmed successfully. The subscription application has been processed.');
      setErrorText('');
      setSelectedApplicationId('');
      setPaymentNote('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not confirm the payment at this time.'));
      setInfoText('');
    },
  });

  const rejectMut = useMutation({
    mutationFn: (applicationId: string) =>
      rejectSubscriptionApplication(applicationId, rejectionReason.trim()),
    onSuccess: async () => {
      await refreshAll();
      setInfoText('Subscription application rejected successfully.');
      setErrorText('');
      setSelectedApplicationId('');
      setRejectionReason('');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not reject the application at this time.'));
      setInfoText('');
    },
  });

  async function confirmPayment(applicationId: string) {
    setInfoText('');
    setErrorText('');
    setSelectedApplicationId(applicationId);
    await confirmMut.mutateAsync(applicationId);
  }

  async function rejectApplication(applicationId: string) {
    setInfoText('');
    setErrorText('');

    if (!rejectionReason.trim()) {
      setErrorText('Please enter a rejection reason before rejecting the application.');
      return;
    }

    setSelectedApplicationId(applicationId);
    await rejectMut.mutateAsync(applicationId);
  }

  if (applicationsQ.isLoading) {
    return <div className="panel">Loading subscription applications...</div>;
  }

  if (applicationsQ.isError || !applicationsQ.data) {
    return <div className="panel error-panel">We could not load subscription applications at this time.</div>;
  }

  const items = applicationsQ.data.items;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Subscription applications</h2>
            <div className="muted">Review onboarding requests, confirm manual payments, and activate tenants.</div>
          </div>

          <div className="inline-actions">
            <Link to="/admin" className="button">Back to Admin Dashboard</Link>
          </div>
        </div>

        {infoText ? (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="muted">{infoText}</div>
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginBottom: 16 }}>
            {errorText}
          </div>
        ) : null}

        <div className="kv">
          <div className="kv-row">
            <span>Total Applications</span>
            <span>{summary.total}</span>
          </div>
          <div className="kv-row">
            <span>Pending Payment</span>
            <span>{summary.pending}</span>
          </div>
          <div className="kv-row">
            <span>Payment Confirmed</span>
            <span>{summary.confirmed}</span>
          </div>
          <div className="kv-row">
            <span>Rejected</span>
            <span>{summary.rejected}</span>
          </div>
          <div className="kv-row">
            <span>Activated</span>
            <span>{summary.activated}</span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Action notes</h2>
          <span className="muted">Use these when confirming payment or rejecting an application.</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Payment Confirmation Note</label>
            <textarea
              className="input"
              rows={4}
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="Optional note about the payment confirmation"
            />
          </div>

          <div className="form-row">
            <label>Rejection Reason</label>
            <textarea
              className="input"
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejecting the application"
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Application register</h2>
          <span className="muted">{applicationsQ.data.count} application record(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Tenant Key</th>
                <th>Admin Contact</th>
                <th>Package</th>
                <th>Amount</th>
                <th>Payment Ref</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 220 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: TenantSubscriptionApplicationDto) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <strong>{item.companyName}</strong>
                      {item.activatedTenantId ? (
                        <span className="muted">Activated Tenant: {item.activatedTenantId}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{item.desiredTenantKey}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>{item.adminFirstName} {item.adminLastName}</span>
                      <span className="muted">{item.adminEmail}</span>
                    </div>
                  </td>
                  <td>{item.packageNameSnapshot}</td>
                  <td>{formatMoney(item.amountSnapshot, item.currencyCodeSnapshot)}</td>
                  <td>{item.paymentReference}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>{applicationStatusLabel(item.status)}</span>
                      {item.paymentConfirmationNote ? (
                        <span className="muted">Note: {item.paymentConfirmationNote}</span>
                      ) : null}
                      {item.rejectionReason ? (
                        <span className="muted">Reason: {item.rejectionReason}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatDateTime(item.createdOnUtc)}</td>
                  <td>
                    <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
                      {item.status === 1 ? (
                        <>
                          <button
                            className="button primary"
                            onClick={() => confirmPayment(item.id)}
                            disabled={confirmMut.isPending}
                          >
                            {confirmMut.isPending && selectedApplicationId === item.id ? 'Confirming…' : 'Confirm Payment'}
                          </button>

                          <button
                            className="button danger"
                            onClick={() => rejectApplication(item.id)}
                            disabled={rejectMut.isPending}
                          >
                            {rejectMut.isPending && selectedApplicationId === item.id ? 'Rejecting…' : 'Reject'}
                          </button>
                        </>
                      ) : (
                        <span className="muted">No action required</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}