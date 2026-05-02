import { getCompanyLogoDataUrl, getTenantKey, getTenantLogoDataUrl } from '../lib/api';
import {
  formatAmount,
  getPayrollPayslips,
  getPayrollRuns,
  payrollStatusLabel,
  useMemo,
  useQuery,
  useState,
  type PayrollPayslipDto,
  type PayrollRunSummaryDto,
  canViewFinance,
} from './PayrollShared';

export function PayrollPayslipsPage() {
  const canView = canViewFinance();
  const [selectedRunId, setSelectedRunId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  const runsQ = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: getPayrollRuns,
    enabled: canView,
  });

  const payslipsQ = useQuery({
    queryKey: ['payroll-payslips', selectedRunId],
    queryFn: () => getPayrollPayslips(selectedRunId),
    enabled: canView && selectedRunId.length > 0,
  });

  const runs = (((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[]);
  const payslips = (payslipsQ.data?.items ?? []) as PayrollPayslipDto[];
  const tenantKey = (payslipsQ.data as any)?.tenantKey || getTenantKey();
  const companyLogo = getCompanyLogoDataUrl() || getTenantLogoDataUrl();

  const filteredPayslips = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    if (!term) return payslips;

    return payslips.filter((payslip) =>
      [
        payslip.employeeNumber,
        payslip.employeeName,
        payslip.department,
        payslip.jobTitle,
        payslip.payslipNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [payslips, employeeSearch]);

  const visiblePayslips = useMemo(() => {
    if (selectedEmployeeIds.length === 0) return filteredPayslips;
    return filteredPayslips.filter((payslip) => selectedEmployeeIds.includes(payslip.employeeId));
  }, [filteredPayslips, selectedEmployeeIds]);

  function toggleEmployee(employeeId: string) {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    );
  }

  function selectAllVisibleEmployees() {
    setSelectedEmployeeIds(Array.from(new Set(filteredPayslips.map((payslip) => payslip.employeeId))));
  }

  function clearEmployeeSelection() {
    setSelectedEmployeeIds([]);
  }

  function escapeHtml(value: string) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function infoCardHtml(label: string, value: string) {
    return `
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:12px 14px;background:#f9fafb;min-width:0;">
        <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${escapeHtml(label)}</div>
        <div style="font-size:14px;font-weight:600;color:#111827;word-break:break-word;">${escapeHtml(value)}</div>
      </div>
    `;
  }

  function getPayslipHtml(payslip: PayrollPayslipDto) {
    const earningRows = payslip.earnings
      .map(
        (item) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;width:70%;word-break:break-word;">${escapeHtml(item.description)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;width:30%;text-align:right;">${escapeHtml(formatAmount(item.amount))}</td>
          </tr>
        `
      )
      .join('');

    const deductionRows =
      payslip.deductions.length === 0
        ? `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280;">No deductions</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#b91c1c;">${escapeHtml(formatAmount(0))}</td>
          </tr>
        `
        : payslip.deductions
            .map(
              (item) => `
                <tr>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#b91c1c;width:70%;word-break:break-word;">${escapeHtml(item.description)}</td>
                  <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;color:#b91c1c;width:30%;font-weight:700;">${escapeHtml(formatAmount(item.amount))}</td>
                </tr>
              `
            )
            .join('');

    return `
      <div style="max-width:900px;margin:0 auto 24px auto;padding:24px;border:1px solid #d1d5db;border-radius:16px;background:#ffffff;box-shadow:0 8px 24px rgba(15,23,42,0.08);page-break-after:always;">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:20px;">
          <div style="display:flex;gap:16px;align-items:center;">
            ${
              companyLogo
                ? `<img src="${companyLogo}" alt="Company logo" style="width:64px;height:64px;object-fit:contain;border-radius:12px;border:1px solid #e5e7eb;padding:6px;background:#fff;" />`
                : ''
            }
            <div>
              <div style="font-size:24px;font-weight:800;color:#111827;">${escapeHtml(tenantKey || 'Client')}</div>
              <div style="font-size:13px;color:#6b7280;">Employee Payslip</div>
              <div style="font-size:13px;color:#6b7280;">${escapeHtml(payslip.payslipNumber)} • ${escapeHtml(payslip.payrollPeriod)}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#6b7280;">Net Pay</div>
            <div style="font-size:28px;font-weight:800;color:#15803d;">${escapeHtml(payslip.currencyCode)} ${escapeHtml(formatAmount(payslip.netPay))}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px;">
          ${infoCardHtml('Employee No.', payslip.employeeNumber)}
          ${infoCardHtml('Employee Name', payslip.employeeName)}
          ${infoCardHtml('Department', payslip.department || '—')}
          ${infoCardHtml('Job Title', payslip.jobTitle || '—')}
          ${infoCardHtml('Bank', [payslip.bankName, payslip.bankAccountNumber].filter(Boolean).join(' - ') || '—')}
          ${infoCardHtml('Tax ID', payslip.taxIdentificationNumber || '—')}
          ${infoCardHtml('Pension No.', payslip.pensionNumber || '—')}
          ${infoCardHtml('Payroll Period', payslip.payrollPeriod)}
          ${infoCardHtml('Payslip No.', payslip.payslipNumber)}
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start;">
          <div style="border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <div style="padding:12px 14px;background:#eff6ff;font-weight:700;color:#1e3a8a;">Earnings</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tbody>${earningRows}</tbody>
            </table>
          </div>

          <div style="border:1px solid #fecaca;border-radius:14px;overflow:hidden;">
            <div style="padding:12px 14px;background:#fef2f2;font-weight:700;color:#b91c1c;">Deductions</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tbody>${deductionRows}</tbody>
            </table>
          </div>
        </div>

        <div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tbody>
              <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;">Gross Pay</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${escapeHtml(formatAmount(payslip.grossPay))}</td>
              </tr>
              <tr>
                <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#b91c1c;">Total Deductions</td>
                <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;color:#b91c1c;">${escapeHtml(formatAmount(payslip.totalDeductions))}</td>
              </tr>
              <tr>
                <td style="padding:14px 14px;font-weight:800;font-size:16px;color:#15803d;">Net Pay</td>
                <td style="padding:14px 14px;text-align:right;font-weight:900;font-size:18px;color:#15803d;">${escapeHtml(formatAmount(payslip.netPay))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function printPayslips(items: PayrollPayslipDto[]) {
    if (items.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=1100,height=900');
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Payslips - ${tenantKey}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: #f3f4f6; margin: 0; padding: 24px; color: #111827; }
            @media print {
              body { background: white; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${items.map((item) => getPayslipHtml(item)).join('')}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function printSinglePayslip(payslip: PayrollPayslipDto) {
    printPayslips([payslip]);
  }

  function printSelectedPayslips() {
    printPayslips(visiblePayslips);
  }

  function sendPayslipByMail(payslip: PayrollPayslipDto) {
    const recipient = payslip.email || '';
    const subject = encodeURIComponent(`Payslip - ${payslip.payrollPeriod} - ${payslip.employeeName}`);
    const body = encodeURIComponent(
      `Hello ${payslip.employeeName},\n\nPlease find your payslip details for ${payslip.payrollPeriod}.\nPayslip Number: ${payslip.payslipNumber}\nNet Pay: ${payslip.currencyCode} ${formatAmount(payslip.netPay)}\n\nRegards,\n${tenantKey || 'Payroll Team'}`
    );
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  }

  function sendSelectedPayslipsByMail() {
    const itemsWithEmail = visiblePayslips.filter((item) => item.email);
    if (itemsWithEmail.length === 0) return;

    const recipients = itemsWithEmail.map((item) => item.email).filter(Boolean).join(';');
    const subject = encodeURIComponent(`Payslips - ${itemsWithEmail[0]?.payrollPeriod || ''}`);
    const employeeLines = itemsWithEmail
      .map((item) => `${item.employeeName} (${item.employeeNumber}) - ${item.currencyCode} ${formatAmount(item.netPay)}`)
      .join('\n');
    const body = encodeURIComponent(
      `Please find the payslip distribution list below:\n\n${employeeLines}\n\nRegards,\n${tenantKey || 'Payroll Team'}`
    );

    window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Payroll Payslips.</div>;
  if (runsQ.isLoading) return <div className="panel">Loading payroll runs...</div>;
  if (runsQ.isError) return <div className="panel error-panel">Unable to load payroll runs.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Payslips</h2>
            <div className="muted">Select a payroll run, pick employee(s), then view, print, or send payslips professionally.</div>
          </div>
          <div className="inline-actions">
            <button className="button secondary" type="button" onClick={printSelectedPayslips} disabled={visiblePayslips.length === 0}>
              Print Selected / Batch
            </button>
            <button className="button secondary" type="button" onClick={sendSelectedPayslipsByMail} disabled={visiblePayslips.filter((item) => item.email).length === 0}>
              Send Selected by Mail
            </button>
          </div>
        </div>

        <div className="form-grid three">
          <div className="form-row">
            <label>Payroll Run</label>
            <select
              className="input"
              value={selectedRunId}
              onChange={(e) => {
                setSelectedRunId(e.target.value);
                setSelectedEmployeeIds([]);
                setEmployeeSearch('');
              }}
            >
              <option value="">Select run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.payrollPeriod} - {payrollStatusLabel(run.status)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Employee Search</label>
            <input
              className="input"
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              placeholder="Search by employee no., name, department, or payslip no."
            />
          </div>

          <div className="form-row">
            <label>Selection</label>
            <div className="inline-actions">
              <button className="button" type="button" onClick={selectAllVisibleEmployees} disabled={filteredPayslips.length === 0}>
                Select All Visible
              </button>
              <button className="button" type="button" onClick={clearEmployeeSelection} disabled={selectedEmployeeIds.length === 0}>
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      </section>

      {selectedRunId ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h3>Payslip Distribution</h3>
              <div className="muted">
                {visiblePayslips.length} payslip(s) visible{selectedEmployeeIds.length > 0 ? ` • ${selectedEmployeeIds.length} employee(s) selected` : ''}.
              </div>
            </div>
          </div>

          {filteredPayslips.length === 0 ? (
            <div className="muted">No payslips match your current search.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>Pick</th>
                    <th>Employee</th>
                    <th>Payslip No.</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'right' }}>Net Pay</th>
                    <th style={{ width: 240 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayslips.map((payslip) => (
                    <tr key={payslip.payrollRunLineId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.includes(payslip.employeeId)}
                          onChange={() => toggleEmployee(payslip.employeeId)}
                        />
                      </td>
                      <td>
                        <strong>{payslip.employeeName}</strong>
                        <div className="muted">{payslip.employeeNumber}</div>
                      </td>
                      <td>{payslip.payslipNumber}</td>
                      <td>{payslip.department || '—'}</td>
                      <td>{payslip.email || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#15803d' }}>
                        {payslip.currencyCode} {formatAmount(payslip.netPay)}
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => toggleEmployee(payslip.employeeId)}>
                            {selectedEmployeeIds.includes(payslip.employeeId) ? 'Hide' : 'View'}
                          </button>
                          <button className="button secondary" type="button" onClick={() => printSinglePayslip(payslip)}>
                            Print
                          </button>
                          <button className="button secondary" type="button" onClick={() => sendPayslipByMail(payslip)} disabled={!payslip.email}>
                            Send Mail
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {selectedRunId && visiblePayslips.length > 0 ? (
        <section className="panel">
          <h3>Selected Payslip Preview</h3>
          <div className="muted" style={{ marginBottom: 12 }}>
            Only selected employees are shown here for review before printing or distribution.
          </div>

          {visiblePayslips.map((payslip) => (
            <div
              key={payslip.payrollRunLineId}
              className="panel"
              style={{
                marginTop: 12,
                border: '1px solid #d1d5db',
                borderRadius: 16,
                padding: 20,
                overflow: 'hidden',
              }}
            >
              <div
                className="section-heading"
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  paddingBottom: 16,
                  marginBottom: 18,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt="Company logo"
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: 'contain',
                        borderRadius: 12,
                        border: '1px solid #e5e7eb',
                        padding: 6,
                        background: '#fff',
                      }}
                    />
                  ) : null}
                  <div>
                    <h3 style={{ marginBottom: 4 }}>{tenantKey || 'Client'}</h3>
                    <div className="muted">Employee Payslip</div>
                    <div className="muted">{payslip.payslipNumber} | {payslip.payrollPeriod}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="muted">Net Pay</div>
                  <div style={{ color: '#15803d', fontWeight: 900, fontSize: 28 }}>
                    {payslip.currencyCode} {formatAmount(payslip.netPay)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <InfoBox label="Employee No." value={payslip.employeeNumber} />
                <InfoBox label="Employee Name" value={payslip.employeeName} />
                <InfoBox label="Department" value={payslip.department || '—'} />
                <InfoBox label="Job Title" value={payslip.jobTitle || '—'} />
                <InfoBox label="Bank" value={[payslip.bankName, payslip.bankAccountNumber].filter(Boolean).join(' - ') || '—'} />
                <InfoBox label="Tax ID" value={payslip.taxIdentificationNumber || '—'} />
                <InfoBox label="Pension No." value={payslip.pensionNumber || '—'} />
                <InfoBox label="Payroll Period" value={payslip.payrollPeriod} />
                <InfoBox label="Payslip No." value={payslip.payslipNumber} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', background: '#eff6ff', color: '#1e3a8a', fontWeight: 700 }}>Earnings</div>
                  <div className="table-wrap">
                    <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <tbody>
                        {payslip.earnings.map((item) => (
                          <tr key={item.code + item.sequence}>
                            <td style={{ width: '70%', wordBreak: 'break-word' }}>{item.description}</td>
                            <td style={{ textAlign: 'right', width: '30%' }}>{formatAmount(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ border: '1px solid #fecaca', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', background: '#fef2f2', color: '#b91c1c', fontWeight: 700 }}>Deductions</div>
                  <div className="table-wrap">
                    <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
                      <tbody>
                        {payslip.deductions.length === 0 ? (
                          <tr>
                            <td className="muted">No deductions</td>
                            <td style={{ textAlign: 'right', color: '#b91c1c' }}>{formatAmount(0)}</td>
                          </tr>
                        ) : (
                          payslip.deductions.map((item) => (
                            <tr key={item.code + item.sequence}>
                              <td style={{ color: '#b91c1c', width: '70%', wordBreak: 'break-word' }}>{item.description}</td>
                              <td style={{ textAlign: 'right', color: '#b91c1c', width: '30%', fontWeight: 700 }}>{formatAmount(item.amount)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' }}>
                <div className="kv-row" style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 700 }}>Gross Pay</span>
                  <span style={{ fontWeight: 700 }}>{formatAmount(payslip.grossPay)}</span>
                </div>
                <div className="kv-row" style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 700, color: '#b91c1c' }}>Total Deductions</span>
                  <span style={{ fontWeight: 800, color: '#b91c1c' }}>{formatAmount(payslip.totalDeductions)}</span>
                </div>
                <div className="kv-row" style={{ padding: '14px 14px' }}>
                  <span style={{ fontWeight: 900, color: '#15803d', fontSize: 18 }}>Net Pay</span>
                  <strong style={{ color: '#15803d', fontSize: 20, fontWeight: 900 }}>{formatAmount(payslip.netPay)}</strong>
                </div>
              </div>

              <div className="inline-actions" style={{ marginTop: 16 }}>
                <button className="button secondary" type="button" onClick={() => printSinglePayslip(payslip)}>
                  Print This Payslip
                </button>
                <button className="button secondary" type="button" onClick={() => sendPayslipByMail(payslip)} disabled={!payslip.email}>
                  Send by Mail
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '12px 14px',
        background: '#f9fafb',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
