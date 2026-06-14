import { useMemo, useState } from 'react';
import {
  approveSalesInvoice,
  getSalesInvoices,
  getTenantReadableError,
  rejectSalesInvoice,
  type SalesInvoiceDto,
} from '../../lib/api';
import {
  canApproveSalesInvoices,
  canViewAccountsReceivable,
} from '../../lib/auth';
import {
  approveBillingInvoice,
  canApproveBillingInvoices,
  canRejectBillingInvoices,
  canViewBilling,
  formatBillingAmount,
  getBillingInvoices,
  getBillingReadableError,
  rejectBillingInvoice,
  useMutation,
  useQuery,
  useQueryClient,
  type BillingInvoiceDto,
} from './BillingShared';

type ApprovalSource = 'billing' | 'ar';

type ApprovalQueueItem = {
  key: string;
  id: string;
  source: ApprovalSource;
  sourceLabel: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDateUtc?: string | null;
  submittedOnUtc?: string | null;
  totalAmount: number;
  statusLabel: string;
};

type ApprovalActionRequest = {
  action: 'approve' | 'reject';
  item: ApprovalQueueItem;
  reason?: string;
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

export function BillingApprovalQueuePage() {
  const queryClient = useQueryClient();

  const canViewBillingQueue = canViewBilling();
  const canViewArQueue = canViewAccountsReceivable();

  const canApproveBilling = canApproveBillingInvoices();
  const canRejectBilling = canRejectBillingInvoices();
  const canApproveAr = canApproveSalesInvoices();

  const canView = canViewBillingQueue || canViewArQueue;

  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const billingInvoicesQ = useQuery({
    queryKey: ['billing-invoices', 'submitted'],
    queryFn: () => getBillingInvoices(1),
    enabled: canViewBillingQueue,
  });

  const arInvoicesQ = useQuery({
    queryKey: ['ar-sales-invoices', 'submitted'],
    queryFn: getSalesInvoices,
    enabled: canViewArQueue,
  });

  const queueItems = useMemo<ApprovalQueueItem[]>(() => {
    const billingItems = canViewBillingQueue
      ? ((billingInvoicesQ.data?.items ?? []) as BillingInvoiceDto[])
          .filter((invoice) => invoice.status === 1)
          .map(
            (invoice): ApprovalQueueItem => ({
              key: `billing-${invoice.id}`,
              id: invoice.id,
              source: 'billing',
              sourceLabel: 'Billing & Invoicing',
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              invoiceDateUtc: invoice.invoiceDateUtc,
              submittedOnUtc: null,
              totalAmount: Number(invoice.totalAmount || 0),
              statusLabel: 'Submitted for Approval',
            }),
          )
      : [];

    const arItems = canViewArQueue
      ? ((arInvoicesQ.data?.items ?? []) as SalesInvoiceDto[])
          .filter((invoice) => invoice.status === 2)
          .map(
            (invoice): ApprovalQueueItem => ({
              key: `ar-${invoice.id}`,
              id: invoice.id,
              source: 'ar',
              sourceLabel: 'Accounts Receivable',
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              invoiceDateUtc: invoice.invoiceDateUtc,
              submittedOnUtc: invoice.submittedOnUtc ?? null,
              totalAmount: Number(
                invoice.netReceivableAmount || invoice.totalAmount || 0,
              ),
              statusLabel: 'Submitted for Approval',
            }),
          )
      : [];

    return [...billingItems, ...arItems].sort((left, right) => {
      const leftTime = new Date(
        left.submittedOnUtc || left.invoiceDateUtc || 0,
      ).getTime();
      const rightTime = new Date(
        right.submittedOnUtc || right.invoiceDateUtc || 0,
      ).getTime();

      return rightTime - leftTime;
    });
  }, [
    arInvoicesQ.data?.items,
    billingInvoicesQ.data?.items,
    canViewArQueue,
    canViewBillingQueue,
  ]);

  const actionMut = useMutation({
    mutationFn: async ({
      action,
      item,
      reason,
    }: ApprovalActionRequest) => {
      if (item.source === 'billing') {
        if (action === 'approve') {
          return approveBillingInvoice(item.id);
        }

        return rejectBillingInvoice(item.id, reason || '');
      }

      if (action === 'approve') {
        return approveSalesInvoice(item.id);
      }

      return rejectSalesInvoice(item.id, {
        reason: reason || '',
      });
    },
    onMutate: () => {
      setMessage('');
      setErrorText('');
    },
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['billing-invoices'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['ar-sales-invoices'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['approval-inbox'],
        }),
      ]);

      setMessage(
        variables.action === 'approve'
          ? `${variables.item.invoiceNumber} approved successfully.`
          : `${variables.item.invoiceNumber} rejected successfully.`,
      );
      setErrorText('');
      setSelectedItemKey('');
      setRejectReason('');
    },
    onError: (error, variables) => {
      const fallback =
        variables.item.source === 'billing'
          ? getBillingReadableError(
              error,
              'Unable to complete Billing invoice approval action.',
            )
          : getTenantReadableError(
              error,
              'Unable to complete AR sales-invoice approval action.',
            );

      setMessage('');
      setErrorText(fallback);
    },
  });

  function canApproveItem(item: ApprovalQueueItem): boolean {
    return item.source === 'billing'
      ? canApproveBilling
      : canApproveAr;
  }

  function canRejectItem(item: ApprovalQueueItem): boolean {
    return item.source === 'billing'
      ? canRejectBilling
      : canApproveAr;
  }

  function approveItem(item: ApprovalQueueItem) {
    if (!canApproveItem(item)) {
      setErrorText(
        `You do not have permission to approve ${item.sourceLabel} invoices.`,
      );
      setMessage('');
      return;
    }

    actionMut.mutate({
      action: 'approve',
      item,
    });
  }

  function beginReject(item: ApprovalQueueItem) {
    if (!canRejectItem(item)) {
      setErrorText(
        `You do not have permission to reject ${item.sourceLabel} invoices.`,
      );
      setMessage('');
      return;
    }

    setSelectedItemKey(item.key);
    setRejectReason('');
    setMessage('');
    setErrorText('');
  }

  function confirmReject(item: ApprovalQueueItem) {
    const reason = rejectReason.trim();

    if (!reason) {
      setErrorText('A rejection reason is required.');
      setMessage('');
      return;
    }

    actionMut.mutate({
      action: 'reject',
      item,
      reason,
    });
  }

  if (!canView) {
    return (
      <div className="panel error-panel">
        You do not have access to the Billing Approval Queue.
      </div>
    );
  }

  const isLoading =
    (canViewBillingQueue && billingInvoicesQ.isLoading) ||
    (canViewArQueue && arInvoicesQ.isLoading);

  if (isLoading) {
    return <div className="panel">Loading invoice approval queue...</div>;
  }

  const billingLoadFailed =
    canViewBillingQueue && billingInvoicesQ.isError;
  const arLoadFailed = canViewArQueue && arInvoicesQ.isError;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Invoice Approval Queue</h2>
            <div className="muted">
              Consolidated checker queue for submitted Billing invoices and
              submitted Accounts Receivable sales invoices.
            </div>
          </div>

          <div className="muted">
            {queueItems.length} awaiting approval
          </div>
        </div>

        <div aria-live="polite">
          {message ? (
            <div className="success-panel">{message}</div>
          ) : null}

          {errorText ? (
            <div className="error-panel">{errorText}</div>
          ) : null}
        </div>

        {billingLoadFailed ? (
          <div className="error-panel" style={{ marginTop: 12 }}>
            Billing invoices could not be loaded. Accounts Receivable invoices
            remain available below.
          </div>
        ) : null}

        {arLoadFailed ? (
          <div className="error-panel" style={{ marginTop: 12 }}>
            Accounts Receivable sales invoices could not be loaded. Billing
            invoices remain available below.
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Invoice Date</th>
                <th>Submitted On</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 300 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {queueItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No submitted invoices are currently awaiting approval.
                  </td>
                </tr>
              ) : (
                queueItems.map((item) => {
                  const rejecting = selectedItemKey === item.key;

                  return (
                    <tr key={item.key}>
                      <td>{item.sourceLabel}</td>
                      <td>{item.invoiceNumber}</td>
                      <td>{item.customerName || '—'}</td>
                      <td>{formatDate(item.invoiceDateUtc)}</td>
                      <td>{formatDateTime(item.submittedOnUtc)}</td>
                      <td>{item.statusLabel}</td>
                      <td style={{ textAlign: 'right' }}>
                        {formatBillingAmount(item.totalAmount)}
                      </td>
                      <td>
                        {rejecting ? (
                          <div>
                            <div className="form-row">
                              <label>Rejection Reason</label>
                              <input
                                className="input"
                                value={rejectReason}
                                autoFocus
                                onChange={(event) =>
                                  setRejectReason(event.target.value)
                                }
                                placeholder="Enter the reason for rejection"
                              />
                            </div>

                            <div className="inline-actions">
                              <button
                                className="button danger"
                                type="button"
                                disabled={actionMut.isPending}
                                onClick={() => confirmReject(item)}
                              >
                                {actionMut.isPending
                                  ? 'Rejecting...'
                                  : 'Confirm Reject'}
                              </button>

                              <button
                                className="button secondary"
                                type="button"
                                disabled={actionMut.isPending}
                                onClick={() => {
                                  setSelectedItemKey('');
                                  setRejectReason('');
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="inline-actions">
                            {canApproveItem(item) ? (
                              <button
                                className="button primary"
                                type="button"
                                disabled={actionMut.isPending}
                                onClick={() => approveItem(item)}
                              >
                                {actionMut.isPending
                                  ? 'Processing...'
                                  : 'Approve'}
                              </button>
                            ) : null}

                            {canRejectItem(item) ? (
                              <button
                                className="button danger"
                                type="button"
                                disabled={actionMut.isPending}
                                onClick={() => beginReject(item)}
                              >
                                Reject
                              </button>
                            ) : null}

                            {!canApproveItem(item) &&
                            !canRejectItem(item) ? (
                              <span className="muted">
                                View only
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
