import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createVendor,
  getTenantReadableError,
  getVendors,
  type CreateVendorRequest,
} from '../lib/api';
import {
  canCreatePurchaseInvoices,
  canCreateVendorPayments,
  canViewAccountsPayable,
} from '../lib/auth';

const emptyForm: CreateVendorRequest = {
  vendorCode: '',
  vendorName: '',
  email: '',
  phoneNumber: '',
  billingAddress: '',
  isActive: true,
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

export function VendorsPage() {
  const qc = useQueryClient();
  const canView = canViewAccountsPayable();
  const canManage = canCreatePurchaseInvoices() || canCreateVendorPayments();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateVendorRequest>(emptyForm);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const vendorsQ = useQuery({
    queryKey: ['ap-vendors'],
    queryFn: getVendors,
    enabled: canView,
  });

  const createMut = useMutation({
    mutationFn: createVendor,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ap-vendors'] });
      setShowCreate(false);
      setForm(emptyForm);
      setErrorText('');
      setInfoText('Vendor created successfully.');
    },
    onError: (e) => {
      setErrorText(getTenantReadableError(e, 'We could not create the vendor at this time.'));
      setInfoText('');
    },
  });

  const summary = useMemo(() => {
    const items = vendorsQ.data?.items ?? [];
    return {
      total: items.length,
      active: items.filter((x) => x.isActive).length,
      inactive: items.filter((x) => !x.isActive).length,
    };
  }, [vendorsQ.data?.items]);

  function update<K extends keyof CreateVendorRequest>(key: K, value: CreateVendorRequest[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function openModal() {
    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
      setInfoText('');
      return;
    }

    setForm(emptyForm);
    setErrorText('');
    setInfoText('');
    setShowCreate(true);
  }

  function closeModal() {
    if (!createMut.isPending) {
      setShowCreate(false);
      setErrorText('');
    }
  }

  async function submit() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You currently have read-only access on this page.');
      return;
    }

    if (!form.vendorCode.trim()) {
      setErrorText('Vendor code is required.');
      return;
    }

    if (!form.vendorName.trim()) {
      setErrorText('Vendor name is required.');
      return;
    }

    await createMut.mutateAsync({
      vendorCode: form.vendorCode.trim(),
      vendorName: form.vendorName.trim(),
      email: form.email?.trim() || null,
      phoneNumber: form.phoneNumber?.trim() || null,
      billingAddress: form.billingAddress?.trim() || null,
      isActive: form.isActive,
    });
  }

  if (!canView) {
    return <div className="panel error-panel">You do not have access to view vendors.</div>;
  }

  if (vendorsQ.isLoading) {
    return <div className="panel">Loading vendors...</div>;
  }

  if (vendorsQ.isError || !vendorsQ.data) {
    return <div className="panel error-panel">We could not load vendors at this time.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Vendors</h2>
            <div className="muted">Manage supplier master records for Accounts Payable processing.</div>
          </div>

          {canManage ? (
            <div className="inline-actions">
              <button className="button primary" onClick={openModal}>New Vendor</button>
            </div>
          ) : null}
        </div>

        <div className="kv">
          <div className="kv-row">
            <span>Total Vendors</span>
            <span>{summary.total}</span>
          </div>
          <div className="kv-row">
            <span>Active Vendors</span>
            <span>{summary.active}</span>
          </div>
          <div className="kv-row">
            <span>Inactive Vendors</span>
            <span>{summary.inactive}</span>
          </div>
        </div>

        {!canManage ? (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="muted">You currently have read-only access to vendor records.</div>
          </div>
        ) : null}

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
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Vendor Listing</h2>
          <span className="muted">{vendorsQ.data.count} vendor(s)</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor Code</th>
                <th>Vendor Name</th>
                <th>Email</th>
                <th>Phone Number</th>
                <th>Billing Address</th>
                <th>Status</th>
                <th>Created On</th>
                <th style={{ width: 160 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {vendorsQ.data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">
                    No vendors have been created yet.
                  </td>
                </tr>
              ) : (
                vendorsQ.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.vendorCode}</td>
                    <td>{item.vendorName}</td>
                    <td>{item.email || '—'}</td>
                    <td>{item.phoneNumber || '—'}</td>
                    <td>{item.billingAddress || '—'}</td>
                    <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                    <td>{formatDateTime(item.createdOnUtc)}</td>
                    <td>
                      <Link
                        to={`/vendors/${item.id}/statement`}
                        className="button"
                      >
                        View Statement
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Vendor</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Vendor Code</label>
                <input
                  className="input"
                  value={form.vendorCode}
                  onChange={(e) => update('vendorCode', e.target.value)}
                  placeholder="Enter vendor code"
                />
              </div>

              <div className="form-row">
                <label>Vendor Name</label>
                <input
                  className="input"
                  value={form.vendorName}
                  onChange={(e) => update('vendorName', e.target.value)}
                  placeholder="Enter vendor name"
                />
              </div>

              <div className="form-row">
                <label>Email</label>
                <input
                  className="input"
                  value={form.email || ''}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="Enter email"
                />
              </div>

              <div className="form-row">
                <label>Phone Number</label>
                <input
                  className="input"
                  value={form.phoneNumber || ''}
                  onChange={(e) => update('phoneNumber', e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="form-row" style={{ gridColumn: '1 / -1' }}>
                <label>Billing Address</label>
                <textarea
                  className="textarea"
                  value={form.billingAddress || ''}
                  onChange={(e) => update('billingAddress', e.target.value)}
                  placeholder="Enter billing address"
                />
              </div>

              <div className="form-row">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => update('isActive', e.target.checked)}
                  />
                  Active Vendor
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={createMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Vendor'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}