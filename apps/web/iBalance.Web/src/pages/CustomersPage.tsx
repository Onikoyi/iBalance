import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createCustomer,
  getCustomers,
  getTenantReadableError,
  type CreateCustomerRequest,
} from '../lib/api';
import { canManageCustomers, canViewAccountsReceivable } from '../lib/auth';

type CustomerFormState = {
  customerCode: string;
  customerName: string;
  email: string;
  phoneNumber: string;
  billingAddress: string;
  isActive: boolean;
};

const emptyForm: CustomerFormState = {
  customerCode: '',
  customerName: '',
  email: '',
  phoneNumber: '',
  billingAddress: '',
  isActive: true,
};

function formatUtcDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function CustomersPage() {
  const qc = useQueryClient();
  const canView = canViewAccountsReceivable();
  const canManage = canManageCustomers();

  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const customersQ = useQuery({
    queryKey: ['ar-customers'],
    queryFn: getCustomers,
    enabled: canView,
  });

  const filteredCustomers = useMemo(() => {
    const items = customersQ.data?.items || [];
    const searchText = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !searchText ||
        item.customerCode.toLowerCase().includes(searchText) ||
        item.customerName.toLowerCase().includes(searchText) ||
        (item.email || '').toLowerCase().includes(searchText) ||
        (item.phoneNumber || '').toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [customersQ.data?.items, search, statusFilter]);

  const createMut = useMutation({
    mutationFn: (payload: CreateCustomerRequest) => createCustomer(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['ar-customers'] });
      setMessage('Customer created successfully.');
      setForm(emptyForm);
    },
    onError: (error) => {
      setMessage(getTenantReadableError(error, 'Unable to create customer.'));
    },
  });

  function submit() {
    setMessage('');

    if (!canManage) {
      setMessage('You currently have read-only access on this page.');
      return;
    }

    if (!form.customerCode.trim()) {
      setMessage('Customer code is required.');
      return;
    }

    if (!form.customerName.trim()) {
      setMessage('Customer name is required.');
      return;
    }

    createMut.mutate({
      customerCode: form.customerCode.trim(),
      customerName: form.customerName.trim(),
      email: form.email.trim() || null,
      phoneNumber: form.phoneNumber.trim() || null,
      billingAddress: form.billingAddress.trim() || null,
      isActive: form.isActive,
    });
  }

  if (!canView) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Customers</h2>
            <span className="muted">Access restricted</span>
          </div>
          <div className="muted">
            You do not have permission to view customer records.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>Customers</h2>
          <span className="muted">Accounts receivable customer register</span>
        </div>

        {message ? (
          <div className="kv" style={{ marginBottom: 16 }}>
            <div className="muted">{message}</div>
          </div>
        ) : null}

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="muted">
            {(customersQ.data?.count || 0).toLocaleString()} customer(s)
          </div>
          {!canManage ? (
            <div className="muted">Read-only access</div>
          ) : null}
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Search</label>
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code, name, email, phone"
            />
          </div>

          <div className="form-row">
            <label>Status Filter</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            >
              <option value="all">All Customers</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Create Customer</h2>
          <span className="muted">Register a customer for receivables and invoicing</span>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Customer Code</label>
            <input
              className="input"
              value={form.customerCode}
              onChange={(e) => setForm((s) => ({ ...s, customerCode: e.target.value }))}
              placeholder="Enter customer code"
            />
          </div>

          <div className="form-row">
            <label>Customer Name</label>
            <input
              className="input"
              value={form.customerName}
              onChange={(e) => setForm((s) => ({ ...s, customerName: e.target.value }))}
              placeholder="Enter customer name"
            />
          </div>

          <div className="form-row">
            <label>Email</label>
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              placeholder="Enter email address"
            />
          </div>

          <div className="form-row">
            <label>Phone Number</label>
            <input
              className="input"
              value={form.phoneNumber}
              onChange={(e) => setForm((s) => ({ ...s, phoneNumber: e.target.value }))}
              placeholder="Enter phone number"
            />
          </div>

          <div className="form-row" style={{ gridColumn: '1 / -1' }}>
            <label>Billing Address</label>
            <textarea
              className="input"
              value={form.billingAddress}
              onChange={(e) => setForm((s) => ({ ...s, billingAddress: e.target.value }))}
              placeholder="Enter billing address"
              rows={4}
            />
          </div>

          <div className="form-row">
            <label>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
              />
              {' '}Customer is active
            </label>
          </div>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="button" onClick={() => setForm(emptyForm)}>
            Reset Form
          </button>

          <button
            className="button primary"
            onClick={submit}
            disabled={createMut.isPending || !canManage}
          >
            {createMut.isPending ? 'Saving…' : 'Create Customer'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Customer Directory</h2>
          <span className="muted">Customer contact and activation status</span>
        </div>

        <div className="detail-stack">
          {customersQ.isLoading ? (
            <div className="muted">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="muted">No customers found for the current filter.</div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className="kv" style={{ marginBottom: 12 }}>
                <div className="kv-row">
                  <span>Customer Code</span>
                  <span>{customer.customerCode}</span>
                </div>
                <div className="kv-row">
                  <span>Customer Name</span>
                  <span>{customer.customerName}</span>
                </div>
                <div className="kv-row">
                  <span>Email</span>
                  <span>{customer.email || '—'}</span>
                </div>
                <div className="kv-row">
                  <span>Phone Number</span>
                  <span>{customer.phoneNumber || '—'}</span>
                </div>
                <div className="kv-row">
                  <span>Billing Address</span>
                  <span>{customer.billingAddress || '—'}</span>
                </div>
                <div className="kv-row">
                  <span>Status</span>
                  <span>{customer.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="kv-row">
                  <span>Created</span>
                  <span>{formatUtcDate(customer.createdOnUtc)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}