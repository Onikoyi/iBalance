import { getCompanyLogoDataUrl, getTenantKey, getTenantLogoDataUrl } from '../lib/api';
import {
  formatAmount,
  getEmployeePayrollHistory,
  getPayrollEmployees,
  getPayrollRunDetail,
  getPayrollRuns,
  getPayrollStatutoryReport,
  payrollStatusLabel,
  useMemo,
  useQuery,
  useState,
  type PayrollEmployeeDto,
  type PayrollRunSummaryDto,
  type PayrollStatutoryReportRowDto,
  canViewFinance,
} from './PayrollShared';

export function PayrollReportsPage() {
  const canView = canViewFinance();
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedEmployeeHistoryId, setSelectedEmployeeHistoryId] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [bankFilter, setBankFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [deductionCodeFilter, setDeductionCodeFilter] = useState('all');

  const runsQ = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: getPayrollRuns,
    enabled: canView,
  });

  const employeesQ = useQuery({
    queryKey: ['payroll-employees'],
    queryFn: getPayrollEmployees,
    enabled: canView,
  });

  const statutoryQ = useQuery({
    queryKey: ['payroll-statutory-report', selectedRunId],
    queryFn: () => getPayrollStatutoryReport(selectedRunId),
    enabled: canView && selectedRunId.length > 0,
  });

  const runDetailQ = useQuery({
    queryKey: ['payroll-run-detail', selectedRunId],
    queryFn: () => getPayrollRunDetail(selectedRunId),
    enabled: canView && selectedRunId.length > 0,
  });

  const employeeHistoryQ = useQuery({
    queryKey: ['employee-payroll-history', selectedEmployeeHistoryId],
    queryFn: () => getEmployeePayrollHistory(selectedEmployeeHistoryId),
    enabled: canView && selectedEmployeeHistoryId.length > 0,
  });

  const runs = (((runsQ.data as any)?.items ?? []) as PayrollRunSummaryDto[]);
  const employees = (((employeesQ.data as any)?.items ?? []) as PayrollEmployeeDto[]);
  const tenantKey = getTenantKey();
  const tenantLogo = getCompanyLogoDataUrl() || getTenantLogoDataUrl();

  const bankOptions = useMemo(() => {
    const items = ((runDetailQ.data?.items ?? []) as any[])
      .map((row) => (row.bankName || '').trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));
  }, [runDetailQ.data]);

  const departmentOptions = useMemo(() => {
    const items = ((runDetailQ.data?.items ?? []) as any[])
      .map((row) => (row.department || '').trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set(items)).sort((a, b) => a.localeCompare(b));
  }, [runDetailQ.data]);

  const statutoryItems = useMemo(() => {
    const items = (statutoryQ.data?.items ?? []) as PayrollStatutoryReportRowDto[];
    const term = reportSearch.trim().toLowerCase();

    return items.filter((row) => {
      const matchesSearch =
        !term ||
        [
          row.employeeNumber,
          row.employeeName,
          row.taxIdentificationNumber,
          row.pensionNumber,
          row.department,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesDepartment =
        departmentFilter === 'all' ||
        (row.department || '').trim().toLowerCase() === departmentFilter.toLowerCase();

      return matchesSearch && matchesDepartment;
    });
  }, [statutoryQ.data, reportSearch, departmentFilter]);

  const runDetailItems = useMemo(() => {
    const items = (runDetailQ.data?.items ?? []) as any[];
    const term = reportSearch.trim().toLowerCase();

    return items.filter((row) => {
      const matchesSearch =
        !term ||
        [
          row.employeeNumber,
          row.employeeName,
          row.department,
          row.jobTitle,
          row.bankName,
          row.bankAccountNumber,
          row.taxIdentificationNumber,
          row.pensionNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesBank =
        bankFilter === 'all' ||
        (row.bankName || '').trim().toLowerCase() === bankFilter.toLowerCase();

      const matchesDepartment =
        departmentFilter === 'all' ||
        (row.department || '').trim().toLowerCase() === departmentFilter.toLowerCase();

      return matchesSearch && matchesBank && matchesDepartment;
    });
  }, [runDetailQ.data, reportSearch, bankFilter, departmentFilter]);

  const bankScheduleItems = useMemo(() => {
    return runDetailItems
      .filter((row) => row.netPay > 0)
      .map((row) => ({
        employeeId: row.employeeId,
        employeeNumber: row.employeeNumber,
        employeeName: row.employeeName,
        department: row.department,
        bankName: row.bankName || '—',
        bankAccountNumber: row.bankAccountNumber || '—',
        amount: row.netPay,
      }));
  }, [runDetailItems]);

  const payeTotal = useMemo(() => {
    return runDetailItems.reduce((sum, row) => {
      const items = (row.items ?? []) as any[];
      return sum + items.filter((item) => String(item.code || '').toUpperCase().includes('PAYE')).reduce((inner, item) => inner + Number(item.amount || 0), 0);
    }, 0);
  }, [runDetailItems]);

  const pensionTotal = useMemo(() => {
    return runDetailItems.reduce((sum, row) => {
      const items = (row.items ?? []) as any[];
      return sum + items.filter((item) => String(item.code || '').toUpperCase().includes('PENSION')).reduce((inner, item) => inner + Number(item.amount || 0), 0);
    }, 0);
  }, [runDetailItems]);

  const payeScheduleItems = useMemo(() => {
    return runDetailItems
      .map((row) => {
        const items = (row.items ?? []) as any[];
        const amount = items
          .filter((item) => String(item.code || '').toUpperCase().includes('PAYE'))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return {
          employeeId: row.employeeId,
          employeeNumber: row.employeeNumber,
          employeeName: row.employeeName,
          department: row.department,
          taxIdentificationNumber: row.taxIdentificationNumber,
          grossPay: row.grossPay,
          payeAmount: amount,
        };
      })
      .filter((row) => row.payeAmount > 0);
  }, [runDetailItems]);

  const pensionScheduleItems = useMemo(() => {
    return runDetailItems
      .map((row) => {
        const items = (row.items ?? []) as any[];
        const amount = items
          .filter((item) => String(item.code || '').toUpperCase().includes('PENSION'))
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return {
          employeeId: row.employeeId,
          employeeNumber: row.employeeNumber,
          employeeName: row.employeeName,
          department: row.department,
          pensionNumber: row.pensionNumber,
          grossPay: row.grossPay,
          pensionAmount: amount,
        };
      })
      .filter((row) => row.pensionAmount > 0);
  }, [runDetailItems]);

  const thirdPartyDeductionOptions = useMemo(() => {
    const skipCodes = new Set(['PAYE', 'PENSION', 'BASIC']);
    const options = new Map<string, string>();

    runDetailItems.forEach((row) => {
      const items = (row.items ?? []) as any[];
      items
        .filter((item) => Number(item.elementKind) === 2)
        .forEach((item) => {
          const code = String(item.code || '').trim().toUpperCase();
          const description = String(item.description || '').trim();
          if (!code || skipCodes.has(code) || code.includes('PAYE') || code.includes('PENSION')) return;
          options.set(code, description || code);
        });
    });

    return Array.from(options.entries())
      .map(([code, description]) => ({ code, description }))
      .sort((a, b) => a.description.localeCompare(b.description));
  }, [runDetailItems]);

  const thirdPartyDeductionScheduleItems = useMemo(() => {
    if (deductionCodeFilter === 'all') return [];

    return runDetailItems
      .map((row) => {
        const items = (row.items ?? []) as any[];
        const amount = items
          .filter((item) => String(item.code || '').trim().toUpperCase() === deductionCodeFilter)
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);

        return {
          employeeId: row.employeeId,
          employeeNumber: row.employeeNumber,
          employeeName: row.employeeName,
          department: row.department,
          deductionBodyCode: deductionCodeFilter,
          deductionBodyName:
            thirdPartyDeductionOptions.find((option) => option.code === deductionCodeFilter)?.description || deductionCodeFilter,
          amount,
        };
      })
      .filter((row) => row.amount > 0);
  }, [runDetailItems, deductionCodeFilter, thirdPartyDeductionOptions]);

  function getReportBrandHeader(reportTitle: string, reportSubtitle?: string) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e5e7eb;">
        <div style="display:flex;align-items:center;gap:14px;">
          ${tenantLogo ? `<img src="${tenantLogo}" alt="Tenant logo" style="width:56px;height:56px;object-fit:contain;border:1px solid #d1d5db;border-radius:12px;padding:6px;background:#fff;" />` : ''}
          <div>
            <div style="font-size:24px;font-weight:800;color:#111827;">${tenantKey || 'Tenant'}</div>
            <div style="font-size:18px;font-weight:700;color:#111827;">${reportTitle}</div>
            ${reportSubtitle ? `<div style="font-size:12px;color:#6b7280;">${reportSubtitle}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function printSection(title: string, html: string) {
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin-bottom: 6px; }
            .muted { color: #6b7280; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
            .num { text-align: right; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 16px 0 20px; }
            .kpi { border: 1px solid #d1d5db; border-radius: 12px; padding: 12px; }
            .kpi span { display:block; color:#6b7280; font-size: 12px; margin-bottom: 4px; }
            .kpi strong { font-size: 18px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function printRunSummary() {
    if (!selectedRunId || !runDetailQ.data) return;

    const html = `
      ${getReportBrandHeader('Payroll Run Summary Report', `${runDetailQ.data.payrollRun?.payrollPeriod || ''} • ${payrollStatusLabel(runDetailQ.data.payrollRun?.status)}`)}
      <div class="kpi-grid">
        <div class="kpi"><span>Employees</span><strong>${runDetailQ.data.payrollRun?.employeeCount || 0}</strong></div>
        <div class="kpi"><span>Total Gross Pay</span><strong>${formatAmount(runDetailQ.data.payrollRun?.totalGrossPay)}</strong></div>
        <div class="kpi"><span>Total Deductions</span><strong>${formatAmount(runDetailQ.data.payrollRun?.totalDeductions)}</strong></div>
        <div class="kpi"><span>Total Net Pay</span><strong>${formatAmount(runDetailQ.data.payrollRun?.totalNetPay)}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee No.</th>
            <th>Employee</th>
            <th>Department</th>
            <th class="num">Gross</th>
            <th class="num">Deductions</th>
            <th class="num">Net Pay</th>
          </tr>
        </thead>
        <tbody>
          ${runDetailItems.map((row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td>${row.employeeName}</td>
              <td>${row.department || '—'}</td>
              <td class="num">${formatAmount(row.grossPay)}</td>
              <td class="num">${formatAmount(row.totalDeductions)}</td>
              <td class="num">${formatAmount(row.netPay)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printSection('Payroll Run Summary', html);
  }

  function printBankSchedule() {
    if (!selectedRunId) return;

    const html = `
      ${getReportBrandHeader('Bank Payment Schedule', `${runDetailQ.data?.payrollRun?.payrollPeriod || ''}${bankFilter !== 'all' ? ' • Bank: ' + bankFilter : ''}`)}
      <div class="kpi-grid">
        <div class="kpi"><span>Employees</span><strong>${bankScheduleItems.length}</strong></div>
        <div class="kpi"><span>Total Amount</span><strong>${formatAmount(bankScheduleItems.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
        <div class="kpi"><span>Selected Run</span><strong>${runDetailQ.data?.payrollRun?.payrollPeriod || '—'}</strong></div>
        <div class="kpi"><span>Bank Filter</span><strong>${bankFilter !== 'all' ? bankFilter : 'All Banks'}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee No.</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Bank</th>
            <th>Account Number</th>
            <th class="num">Net Pay</th>
          </tr>
        </thead>
        <tbody>
          ${bankScheduleItems.map((row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td>${row.employeeName}</td>
              <td>${row.department || '—'}</td>
              <td>${row.bankName}</td>
              <td>${row.bankAccountNumber}</td>
              <td class="num">${formatAmount(row.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printSection('Bank Payment Schedule', html);
  }

  function printStatutorySchedule() {
    if (!selectedRunId) return;

    const html = `
      ${getReportBrandHeader('Statutory Compliance Report', `${runDetailQ.data?.payrollRun?.payrollPeriod || ''}`)}
      <div class="kpi-grid">
        <div class="kpi"><span>Total Gross Pay</span><strong>${formatAmount(statutoryQ.data?.totalGrossPay)}</strong></div>
        <div class="kpi"><span>Total Deductions</span><strong>${formatAmount(statutoryQ.data?.totalStatutoryDeductions)}</strong></div>
        <div class="kpi"><span>PAYE Estimate</span><strong>${formatAmount(payeTotal)}</strong></div>
        <div class="kpi"><span>Pension Estimate</span><strong>${formatAmount(pensionTotal)}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee No.</th>
            <th>Employee</th>
            <th>Tax ID</th>
            <th>Pension No.</th>
            <th class="num">Gross</th>
            <th class="num">Deduction</th>
            <th class="num">Net Pay</th>
          </tr>
        </thead>
        <tbody>
          ${statutoryItems.map((row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td>${row.employeeName}</td>
              <td>${row.taxIdentificationNumber || '—'}</td>
              <td>${row.pensionNumber || '—'}</td>
              <td class="num">${formatAmount(row.grossPay)}</td>
              <td class="num">${formatAmount(row.statutoryDeductionAmount)}</td>
              <td class="num">${formatAmount(row.netPay)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printSection('Statutory Compliance Report', html);
  }

  function printPayeSchedule() {
    if (!selectedRunId) return;

    const html = `
      ${getReportBrandHeader('PAYE Schedule', `${runDetailQ.data?.payrollRun?.payrollPeriod || ''}`)}
      <div class="kpi-grid">
        <div class="kpi"><span>Employees</span><strong>${payeScheduleItems.length}</strong></div>
        <div class="kpi"><span>Total PAYE</span><strong>${formatAmount(payeScheduleItems.reduce((sum, row) => sum + row.payeAmount, 0))}</strong></div>
        <div class="kpi"><span>Selected Run</span><strong>${runDetailQ.data?.payrollRun?.payrollPeriod || '—'}</strong></div>
        <div class="kpi"><span>Department Filter</span><strong>${departmentFilter !== 'all' ? departmentFilter : 'All Departments'}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee No.</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Tax ID</th>
            <th class="num">Gross Pay</th>
            <th class="num">PAYE Amount</th>
          </tr>
        </thead>
        <tbody>
          ${payeScheduleItems.map((row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td>${row.employeeName}</td>
              <td>${row.department || '—'}</td>
              <td>${row.taxIdentificationNumber || '—'}</td>
              <td class="num">${formatAmount(row.grossPay)}</td>
              <td class="num">${formatAmount(row.payeAmount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printSection('PAYE Schedule', html);
  }

  function printPensionSchedule() {
    if (!selectedRunId) return;

    const html = `
      ${getReportBrandHeader('Pension Schedule', `${runDetailQ.data?.payrollRun?.payrollPeriod || ''}`)}
      <div class="kpi-grid">
        <div class="kpi"><span>Employees</span><strong>${pensionScheduleItems.length}</strong></div>
        <div class="kpi"><span>Total Pension</span><strong>${formatAmount(pensionScheduleItems.reduce((sum, row) => sum + row.pensionAmount, 0))}</strong></div>
        <div class="kpi"><span>Selected Run</span><strong>${runDetailQ.data?.payrollRun?.payrollPeriod || '—'}</strong></div>
        <div class="kpi"><span>Department Filter</span><strong>${departmentFilter !== 'all' ? departmentFilter : 'All Departments'}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee No.</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Pension No.</th>
            <th class="num">Gross Pay</th>
            <th class="num">Pension Amount</th>
          </tr>
        </thead>
        <tbody>
          ${pensionScheduleItems.map((row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td>${row.employeeName}</td>
              <td>${row.department || '—'}</td>
              <td>${row.pensionNumber || '—'}</td>
              <td class="num">${formatAmount(row.grossPay)}</td>
              <td class="num">${formatAmount(row.pensionAmount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printSection('Pension Schedule', html);
  }

  function printThirdPartyDeductionSchedule() {
    if (!selectedRunId || deductionCodeFilter === 'all') return;

    const deductionName =
      thirdPartyDeductionOptions.find((option) => option.code === deductionCodeFilter)?.description || deductionCodeFilter;

    const html = `
      ${getReportBrandHeader('Third-Party Deduction Schedule', `${runDetailQ.data?.payrollRun?.payrollPeriod || ''} • ${deductionName}`)}
      <div class="kpi-grid">
        <div class="kpi"><span>Employees</span><strong>${thirdPartyDeductionScheduleItems.length}</strong></div>
        <div class="kpi"><span>Total Deduction</span><strong>${formatAmount(thirdPartyDeductionScheduleItems.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
        <div class="kpi"><span>Deduction Body</span><strong>${deductionName}</strong></div>
        <div class="kpi"><span>Department Filter</span><strong>${departmentFilter !== 'all' ? departmentFilter : 'All Departments'}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Employee No.</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Deduction Body</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${thirdPartyDeductionScheduleItems.map((row) => `
            <tr>
              <td>${row.employeeNumber}</td>
              <td>${row.employeeName}</td>
              <td>${row.department || '—'}</td>
              <td>${row.deductionBodyName}</td>
              <td class="num">${formatAmount(row.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    printSection('Third-Party Deduction Schedule', html);
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Payroll Reports.</div>;
  if (runsQ.isLoading || employeesQ.isLoading) return <div className="panel">Loading payroll reports...</div>;
  if (runsQ.isError || employeesQ.isError) return <div className="panel error-panel">Unable to load payroll reports.</div>;

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {tenantLogo ? (
              <img
                src={tenantLogo}
                alt="Tenant logo"
                style={{ width: 60, height: 60, objectFit: 'contain', border: '1px solid #d1d5db', borderRadius: 12, padding: 6, background: '#fff' }}
              />
            ) : null}
            <div>
              <h2 style={{ marginBottom: 4 }}>{tenantKey || 'Tenant'} - Payroll Reports & Statutory Compliance</h2>
              <div className="muted">Professional payroll reporting for statutory schedules, bank payment schedule, payroll register, and employee payroll history.</div>
            </div>
          </div>
          <div className="inline-actions">
            <button className="button secondary" type="button" onClick={printRunSummary} disabled={!selectedRunId || !runDetailQ.data}>
              Print Run Summary
            </button>
            <button className="button secondary" type="button" onClick={printBankSchedule} disabled={!selectedRunId || bankScheduleItems.length === 0}>
              Print Bank Schedule
            </button>
            <button className="button secondary" type="button" onClick={printStatutorySchedule} disabled={!selectedRunId || statutoryItems.length === 0}>
              Print Statutory Report
            </button>
            <button className="button secondary" type="button" onClick={printPayeSchedule} disabled={!selectedRunId || payeScheduleItems.length === 0}>
              Print PAYE Schedule
            </button>
            <button className="button secondary" type="button" onClick={printPensionSchedule} disabled={!selectedRunId || pensionScheduleItems.length === 0}>
              Print Pension Schedule
            </button>
            <button className="button secondary" type="button" onClick={printThirdPartyDeductionSchedule} disabled={!selectedRunId || deductionCodeFilter === 'all' || thirdPartyDeductionScheduleItems.length === 0}>
              Print Deduction Schedule
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
                setBankFilter('all');
                setDepartmentFilter('all');
                setReportSearch('');
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
            <label>Employee History</label>
            <select className="input" value={selectedEmployeeHistoryId} onChange={(e) => setSelectedEmployeeHistoryId(e.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employeeNumber} - {employee.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Report Search</label>
            <input
              className="input"
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Search employee, tax ID, pension no., bank, department..."
            />
          </div>

          <div className="form-row">
            <label>Bank Filter</label>
            <select className="input" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
              <option value="all">All banks</option>
              {bankOptions.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Department Filter</label>
            <select className="input" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="all">All departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Deduction Body Filter</label>
            <select className="input" value={deductionCodeFilter} onChange={(e) => setDeductionCodeFilter(e.target.value)}>
              <option value="all">Select deduction body</option>
              {thirdPartyDeductionOptions.map((option) => (
                <option key={option.code} value={option.code}>{option.description}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {selectedRunId && runDetailQ.data ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Payroll Run Dashboard</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Employees</span><strong>{runDetailQ.data.payrollRun?.employeeCount || 0}</strong></div>
            <div className="kpi-card"><span>Total Gross Pay</span><strong>{formatAmount(runDetailQ.data.payrollRun?.totalGrossPay)}</strong></div>
            <div className="kpi-card"><span>Total Deductions</span><strong>{formatAmount(runDetailQ.data.payrollRun?.totalDeductions)}</strong></div>
            <div className="kpi-card"><span>Total Net Pay</span><strong>{formatAmount(runDetailQ.data.payrollRun?.totalNetPay)}</strong></div>
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Statutory Compliance Report</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Total Gross Pay</span><strong>{formatAmount(statutoryQ.data?.totalGrossPay)}</strong></div>
            <div className="kpi-card"><span>Total Deductions</span><strong>{formatAmount(statutoryQ.data?.totalStatutoryDeductions)}</strong></div>
            <div className="kpi-card"><span>PAYE Estimate</span><strong>{formatAmount(payeTotal)}</strong></div>
            <div className="kpi-card"><span>Pension Estimate</span><strong>{formatAmount(pensionTotal)}</strong></div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Employee</th>
                  <th>Tax ID</th>
                  <th>Pension No.</th>
                  <th>Department</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Deduction</th>
                  <th style={{ textAlign: 'right' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {statutoryItems.length === 0 ? (
                  <tr><td colSpan={8} className="muted">No statutory rows found for the current filter.</td></tr>
                ) : (
                  statutoryItems.map((row: PayrollStatutoryReportRowDto) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeNumber}</td>
                      <td>{row.employeeName}</td>
                      <td>{row.taxIdentificationNumber || '—'}</td>
                      <td>{row.pensionNumber || '—'}</td>
                      <td>{row.department || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.statutoryDeductionAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.netPay)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} PAYE Schedule</h3>
          <div className="muted" style={{ marginBottom: 12 }}>Employee-by-employee PAYE deduction schedule for the selected payroll run.</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Tax ID</th>
                  <th style={{ textAlign: 'right' }}>Gross Pay</th>
                  <th style={{ textAlign: 'right' }}>PAYE Amount</th>
                </tr>
              </thead>
              <tbody>
                {payeScheduleItems.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No PAYE rows found for the current filter.</td></tr>
                ) : (
                  payeScheduleItems.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeNumber}</td>
                      <td>{row.employeeName}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.taxIdentificationNumber || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatAmount(row.payeAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Pension Schedule</h3>
          <div className="muted" style={{ marginBottom: 12 }}>Employee-by-employee pension deduction schedule for the selected payroll run.</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Pension No.</th>
                  <th style={{ textAlign: 'right' }}>Gross Pay</th>
                  <th style={{ textAlign: 'right' }}>Pension Amount</th>
                </tr>
              </thead>
              <tbody>
                {pensionScheduleItems.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No pension rows found for the current filter.</td></tr>
                ) : (
                  pensionScheduleItems.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeNumber}</td>
                      <td>{row.employeeName}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.pensionNumber || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatAmount(row.pensionAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Third-Party Deduction Schedules</h3>
          <div className="muted" style={{ marginBottom: 12 }}>
            Generate and print schedules for cooperative, loan, union, and other special deduction bodies for the selected payroll run.
          </div>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Deduction Body</span><strong>{deductionCodeFilter !== 'all' ? (thirdPartyDeductionOptions.find((option) => option.code === deductionCodeFilter)?.description || deductionCodeFilter) : 'Not Selected'}</strong></div>
            <div className="kpi-card"><span>Employees</span><strong>{thirdPartyDeductionScheduleItems.length}</strong></div>
            <div className="kpi-card"><span>Total Amount</span><strong>{formatAmount(thirdPartyDeductionScheduleItems.reduce((sum, row) => sum + row.amount, 0))}</strong></div>
            <div className="kpi-card"><span>Run Period</span><strong>{runDetailQ.data?.payrollRun?.payrollPeriod || '—'}</strong></div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Deduction Body</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {deductionCodeFilter === 'all' ? (
                  <tr><td colSpan={5} className="muted">Select a deduction body above to generate its schedule.</td></tr>
                ) : thirdPartyDeductionScheduleItems.length === 0 ? (
                  <tr><td colSpan={5} className="muted">No rows found for the selected deduction body and current filters.</td></tr>
                ) : (
                  thirdPartyDeductionScheduleItems.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeNumber}</td>
                      <td>{row.employeeName}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.deductionBodyName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatAmount(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Bank Payment Schedule</h3>
          <div className="muted" style={{ marginBottom: 12 }}>
            Professional transfer schedule showing employee bank destination and net pay distribution{bankFilter !== 'all' ? ` for ${bankFilter}` : ''}.
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Bank</th>
                  <th>Account Number</th>
                  <th style={{ textAlign: 'right' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {bankScheduleItems.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No bank payment rows found for the current selection.</td></tr>
                ) : (
                  bankScheduleItems.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeNumber}</td>
                      <td>{row.employeeName}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.bankName}</td>
                      <td>{row.bankAccountNumber}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatAmount(row.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedRunId ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Payroll Register</h3>
          <div className="muted" style={{ marginBottom: 12 }}>Detailed payroll run register showing each employee’s gross pay, deductions, and net pay.</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee No.</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Job Title</th>
                  <th>Tax ID</th>
                  <th>Pension No.</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {runDetailItems.length === 0 ? (
                  <tr><td colSpan={9} className="muted">No payroll register rows found for the current filter.</td></tr>
                ) : (
                  runDetailItems.map((row: any) => (
                    <tr key={row.payrollRunLineId}>
                      <td>{row.employeeNumber}</td>
                      <td>{row.employeeName}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.jobTitle || '—'}</td>
                      <td>{row.taxIdentificationNumber || '—'}</td>
                      <td>{row.pensionNumber || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(row.totalDeductions)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatAmount(row.netPay)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedEmployeeHistoryId && employeeHistoryQ.data ? (
        <section className="panel">
          <h3>{tenantKey || 'Tenant'} Employee Payroll History</h3>
          <div className="kpi-grid">
            <div className="kpi-card"><span>Employee</span><strong>{employeeHistoryQ.data.employee.employeeNumber}</strong></div>
            <div className="kpi-card"><span>Total Gross Pay</span><strong>{formatAmount(employeeHistoryQ.data.totalGrossPay)}</strong></div>
            <div className="kpi-card"><span>Total Deductions</span><strong>{formatAmount(employeeHistoryQ.data.totalDeductions)}</strong></div>
            <div className="kpi-card"><span>Total Net Pay</span><strong>{formatAmount(employeeHistoryQ.data.totalNetPay)}</strong></div>
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="kv-row"><span>Employee</span><span>{employeeHistoryQ.data.employee.employeeNumber} - {employeeHistoryQ.data.employee.employeeName}</span></div>
            <div className="kv-row"><span>Department</span><span>{employeeHistoryQ.data.employee.department || '—'}</span></div>
            <div className="kv-row"><span>Job Title</span><span>{employeeHistoryQ.data.employee.jobTitle || '—'}</span></div>
            <div className="kv-row"><span>Bank</span><span>{[employeeHistoryQ.data.employee.bankName, employeeHistoryQ.data.employee.bankAccountNumber].filter(Boolean).join(' - ') || '—'}</span></div>
            <div className="kv-row"><span>Tax ID</span><span>{employeeHistoryQ.data.employee.taxIdentificationNumber || '—'}</span></div>
            <div className="kv-row"><span>Pension No.</span><span>{employeeHistoryQ.data.employee.pensionNumber || '—'}</span></div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Deductions</th>
                  <th style={{ textAlign: 'right' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {employeeHistoryQ.data.items.map((row: any) => (
                  <tr key={row.payrollRunLineId}>
                    <td>{row.payrollPeriod}</td>
                    <td>{payrollStatusLabel(row.status)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(row.grossPay)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(row.totalDeductions)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatAmount(row.netPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
