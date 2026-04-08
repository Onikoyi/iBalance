import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeFiscalPeriod,
  createFiscalPeriod,
  getFiscalPeriods,
  openFiscalPeriod,
  type FiscalPeriodDto,
} from '../lib/api';

function statusLabel(value: number) {
  return value === 1 ? 'Open' : 'Closed';
}

type FormState = {
  name: string;
  startDate: string;
  endDate: string;
  isOpen: boolean;
};

const emptyForm: FormState = {
  name: '',
  startDate: '',
  endDate: '',
  isOpen: true,
};

export function FiscalPeriodsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data, isLoading, error } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: getFiscalPeriods,
  });

  const createMut = useMutation({
    mutationFn: createFiscalPeriod,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fiscal-periods'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowCreate(false);
      setForm(emptyForm);
      setErrorText('');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.response?.data?.Message || e?.message || 'Failed to create fiscal period.';
      setErrorText(String(msg));
    },
  });

  const openMut = useMutation({
    mutationFn: openFiscalPeriod,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fiscal-periods'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const closeMut = useMutation({
    mutationFn: closeFiscalPeriod,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fiscal-periods'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const sorted = useMemo(() => {
    const items = data?.items ?? [];
    return [...items].sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }, [data?.items]);

  function openModal() {
    setErrorText('');
    setForm(emptyForm);
    setShowCreate(true);
  }

  function closeModal() {
    if (!createMut.isPending) setShowCreate(false);
  }

  async function submit() {
    setErrorText('');
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setErrorText('Name, Start Date, and End Date are required.');
      return;
    }

    if (form.endDate < form.startDate) {
      setErrorText('End Date cannot be earlier than Start Date.');
      return;
    }

    await createMut.mutateAsync({
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      isOpen: form.isOpen,
    });
  }

  if (isLoading) {
    return <div className="panel">Loading fiscal periods.</div>;
  }

  if (error || !data) {
    return <div className="panel error-panel">Unable to load fiscal periods.</div>;
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Fiscal Periods</h2>
          <div className="muted">{data.count} period(s)</div>
        </div>

        <button className="button primary" onClick={openModal}>New Fiscal Period</button>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th style={{ width: 260 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item: FiscalPeriodDto) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.startDate}</td>
                <td>{item.endDate}</td>
                <td>{statusLabel(item.status)}</td>
                <td>
                  <div className="table-actions">
                    {item.status !== 1 ? (
                      <button className="button" onClick={() => openMut.mutate(item.id)} disabled={openMut.isPending}>
                        Open
                      </button>
                    ) : (
                      <button className="button" onClick={() => closeMut.mutate(item.id)} disabled={closeMut.isPending}>
                        Close
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Fiscal Period</h2>
              <button className="button ghost" onClick={closeModal} aria-label="Close">✕</button>
            </div>

            {errorText ? <div className="error-panel">{errorText}</div> : null}

            <div className="form-grid two">
              <div className="form-row">
                <label>Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="e.g. FY 2026 - Q2" />
              </div>

              <div className="form-row">
                <label>Start Date</label>
                <input type="date" className="input" value={form.startDate} onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>End Date</label>
                <input type="date" className="input" value={form.endDate} onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))} />
              </div>

              <div className="form-row">
                <label>Status on create</label>
                <select className="select" value={form.isOpen ? 'open' : 'closed'} onChange={(e) => setForm((s) => ({ ...s, isOpen: e.target.value === 'open' }))}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="button" onClick={closeModal} disabled={createMut.isPending}>Cancel</button>
              <button className="button primary" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? 'Creating…' : 'Create Period'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}