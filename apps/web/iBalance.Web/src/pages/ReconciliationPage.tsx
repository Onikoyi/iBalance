import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelBankReconciliation,
  completeBankReconciliation,
  createApiPlaceholderBankStatementImport,
  createBankReconciliation,
  createBankReconciliationMatch,
  getAccounts,
  getBankReconciliationDetail,
  getBankReconciliations,
  getBankStatementImportDetail,
  getBankStatementImports,
  getCashbook,
  getCashbookSummary,
  getTenantReadableError,
  removeBankReconciliationMatch,
  setBankReconciliationLineReconciledState,
  uploadBankStatementImport,
  type LedgerAccountDto,
  type UploadBankStatementImportLineRequest,
} from '../lib/api';
import { canViewTreasury, hasPermission } from '../lib/auth';

function toUtcStart(date: string) {
  return date ? new Date(`${date}T00:00:00`).toISOString() : undefined;
}

function toUtcEnd(date: string) {
  return date ? new Date(`${date}T23:59:59`).toISOString() : undefined;
}

function dateInputToUtc(date: string) {
  return date ? new Date(`${date}T00:00:00.000Z`).toISOString() : '';
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function buildBankStatementTemplateCsv() {
  const headers = [
    'transactionDateUtc',
    'valueDateUtc',
    'reference',
    'description',
    'debitAmount',
    'creditAmount',
    'balance',
    'externalReference',
  ];

  const sampleRows = [
    [
      new Date().toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
      'BNK-REF-001',
      'Sample customer lodgement',
      '0',
      '150000',
      '150000',
      'EXT-001',
    ],
    [
      new Date().toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
      'BNK-REF-002',
      'Sample bank charge',
      '2500',
      '0',
      '147500',
      'EXT-002',
    ],
  ];

  return [headers, ...sampleRows]
    .map((row) => row.map((cell) => csvEscape(cell)).join(','))
    .join('\n');
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeCsvHeader(value: string) {
  return value.trim().toLowerCase().replaceAll(' ', '').replaceAll('_', '');
}

function toDateInputFromCsv(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}

function parseCsvMoney(value: string) {
  const cleaned = value.replaceAll(',', '').trim();

  if (!cleaned) {
    return '';
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

function parseBankStatementCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('The selected CSV does not contain statement rows.');
  }

  const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);

  function indexOfAny(names: string[]) {
    return headers.findIndex((header) => names.includes(header));
  }

  const transactionDateIndex = indexOfAny(['transactiondateutc', 'transactiondate', 'date', 'postingdate']);
  const referenceIndex = indexOfAny(['reference', 'ref', 'transactionreference', 'narrationreference']);
  const descriptionIndex = indexOfAny(['description', 'narration', 'details', 'particulars', 'memo']);
  const debitIndex = indexOfAny(['debitamount', 'debit', 'withdrawal', 'withdrawals', 'moneyout', 'outflow']);
  const creditIndex = indexOfAny(['creditamount', 'credit', 'deposit', 'deposits', 'moneyin', 'inflow']);
  const balanceIndex = indexOfAny(['balance', 'runningbalance', 'closingbalance']);
  const externalReferenceIndex = indexOfAny(['externalreference', 'externalref', 'bankreference']);

  if (transactionDateIndex < 0) {
    throw new Error('CSV must include a transaction date column.');
  }

  if (referenceIndex < 0 && descriptionIndex < 0) {
    throw new Error('CSV must include either a reference column or a description/narration column.');
  }

  if (debitIndex < 0 && creditIndex < 0) {
    throw new Error('CSV must include debit/credit amount columns.');
  }

  const parsedLines = lines.slice(1).map((line, rowIndex): StatementLineFormState => {
    const cells = splitCsvLine(line);

    const transactionDateUtc = toDateInputFromCsv(cells[transactionDateIndex] || '');
    const reference = referenceIndex >= 0 ? cells[referenceIndex] || '' : '';
    const description = descriptionIndex >= 0 ? cells[descriptionIndex] || '' : reference;
    const debitAmount = debitIndex >= 0 ? parseCsvMoney(cells[debitIndex] || '') : '';
    const creditAmount = creditIndex >= 0 ? parseCsvMoney(cells[creditIndex] || '') : '';
    const balance = balanceIndex >= 0 ? parseCsvMoney(cells[balanceIndex] || '') : '';
    const externalReference = externalReferenceIndex >= 0 ? cells[externalReferenceIndex] || '' : '';

    if (!transactionDateUtc) {
      throw new Error(`CSV row ${rowIndex + 2} has an invalid transaction date.`);
    }

    if (!reference && !description) {
      throw new Error(`CSV row ${rowIndex + 2} must have a reference or description.`);
    }

    if (!debitAmount && !creditAmount) {
      throw new Error(`CSV row ${rowIndex + 2} must have either a debit amount or a credit amount.`);
    }

    if (Number(debitAmount || 0) > 0 && Number(creditAmount || 0) > 0) {
      throw new Error(`CSV row ${rowIndex + 2} cannot have both debit and credit amounts.`);
    }

    return {
      transactionDateUtc,
      reference: reference || externalReference || `ROW-${rowIndex + 1}`,
      description: description || reference || externalReference || `Statement row ${rowIndex + 1}`,
      debitAmount,
      creditAmount,
      balance,
    };
  });

  return parsedLines;
}


function downloadBankStatementTemplate() {
  const blob = new Blob([buildBankStatementTemplateCsv()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ibalance-bank-statement-import-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatAmount(value?: number | null) {
  return new Intl.NumberFormat('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function accountLabel(account?: LedgerAccountDto | null) {
  if (!account) return '—';
  return `${account.code} - ${account.name}`;
}

function reconciliationStatusLabel(value?: number | null) {
  switch (value) {
    case 1: return 'Draft';
    case 2: return 'Completed';
    case 3: return 'Cancelled';
    default: return 'Unknown';
  }
}

function absoluteAmount(value?: number | null) {
  return Math.abs(Number(value || 0));
}

function isZeroAmount(value?: number | null) {
  return absoluteAmount(value) < 0.01;
}

type ReconciliationExceptionRow = {
  id: string;
  date: string;
  reference: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  source: 'Cashbook' | 'Bank Statement';
  classification: string;
};

type ReconciliationFormState = {
  ledgerAccountId: string;
  statementFromUtc: string;
  statementToUtc: string;
  statementClosingBalance: string;
  notes: string;
};

type StatementImportFormState = {
  ledgerAccountId: string;
  statementFromUtc: string;
  statementToUtc: string;
  sourceReference: string;
  fileName: string;
  notes: string;
};

type StatementLineFormState = {
  transactionDateUtc: string;
  reference: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  balance: string;
};

const emptyReconciliationForm: ReconciliationFormState = {
  ledgerAccountId: '',
  statementFromUtc: '',
  statementToUtc: '',
  statementClosingBalance: '',
  notes: '',
};

const emptyStatementImportForm: StatementImportFormState = {
  ledgerAccountId: '',
  statementFromUtc: '',
  statementToUtc: '',
  sourceReference: '',
  fileName: '',
  notes: '',
};

const emptyStatementLine: StatementLineFormState = {
  transactionDateUtc: '',
  reference: '',
  description: '',
  debitAmount: '',
  creditAmount: '',
  balance: '',
};

function printSection(sectionId: string) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const iframe = document.createElement('iframe');
  iframe.title = 'Reconciliation Print Frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument || frameWindow?.document;

  if (!frameWindow || !frameDocument) {
    document.body.removeChild(iframe);
    return;
  }

  frameDocument.open();
  frameDocument.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>iBalance Reconciliation</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; color:#111827; }
    h2 { margin-bottom: 4px; }
    .muted { color:#6b7280; font-size:12px; }
    .kv { display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; margin:12px 0; }
    .kv-row { border:1px solid #d1d5db; border-radius:8px; padding:8px; display:grid; gap:4px; }
    .kv-row span:first-child { color:#6b7280; font-size:11px; text-transform:uppercase; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th, td { border:1px solid #d1d5db; padding:6px; text-align:left; vertical-align:top; }
    th { background:#f3f4f6; }
    .right { text-align:right; }
    .no-print, button, a { display:none !important; }
  </style>
</head>
<body>${section.innerHTML}</body>
</html>`);
  frameDocument.close();

  iframe.onload = () => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.parentNode?.removeChild(iframe), 500);
  };
}

export function ReconciliationPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canView = canViewTreasury();
  const canManage = hasPermission('treasury.manage') || hasPermission('treasury.reconciliation.manage');

  const [activeTab, setActiveTab] = useState<'cashbook' | 'reconciliations' | 'statements' | 'matching'>('reconciliations');
  const [fromDate, setFromDate] = useState(todayInputValue().slice(0, 8) + '01');
  const [toDate, setToDate] = useState(todayInputValue());
  const [ledgerAccountId, setLedgerAccountId] = useState('');
  const [selectedReconciliationId, setSelectedReconciliationId] = useState('');
  const [selectedStatementImportId, setSelectedStatementImportId] = useState('');
  const [selectedReconciliationLineId, setSelectedReconciliationLineId] = useState('');
  const [selectedStatementLineId, setSelectedStatementLineId] = useState('');
  const [matchNotes, setMatchNotes] = useState('');
  const [form, setForm] = useState<ReconciliationFormState>(emptyReconciliationForm);
  const [importForm, setImportForm] = useState<StatementImportFormState>(emptyStatementImportForm);
  const [statementLines, setStatementLines] = useState<StatementLineFormState[]>([{ ...emptyStatementLine }]);
  const [selectedCsvFileName, setSelectedCsvFileName] = useState('');
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');

  const fromUtc = useMemo(() => toUtcStart(fromDate), [fromDate]);
  const toUtc = useMemo(() => toUtcEnd(toDate), [toDate]);

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: getAccounts,
    enabled: canView,
  });

  const treasuryAccounts = useMemo(() => {
    return (accountsQ.data?.items ?? []).filter((account: LedgerAccountDto) =>
      account.isActive && account.isPostingAllowed && !account.isHeader && account.isCashOrBankAccount
    );
  }, [accountsQ.data?.items]);

  const cashbookSummaryQ = useQuery({
    queryKey: ['cashbook-summary', fromUtc, toUtc],
    queryFn: () => getCashbookSummary(fromUtc, toUtc),
    enabled: canView,
  });

  const cashbookQ = useQuery({
    queryKey: ['cashbook', ledgerAccountId, fromUtc, toUtc],
    queryFn: () => getCashbook(ledgerAccountId || undefined, fromUtc, toUtc),
    enabled: canView,
  });

  const reconciliationsQ = useQuery({
    queryKey: ['bank-reconciliations', ledgerAccountId],
    queryFn: () => getBankReconciliations(ledgerAccountId || undefined),
    enabled: canView,
  });

  const reconciliationDetailQ = useQuery({
    queryKey: ['bank-reconciliation-detail', selectedReconciliationId],
    queryFn: () => getBankReconciliationDetail(selectedReconciliationId),
    enabled: canView && !!selectedReconciliationId,
  });

  const statementImportsQ = useQuery({
    queryKey: ['bank-statement-imports', ledgerAccountId],
    queryFn: () => getBankStatementImports(ledgerAccountId || undefined),
    enabled: canView,
  });

  const statementImportDetailQ = useQuery({
    queryKey: ['bank-statement-import-detail', selectedStatementImportId],
    queryFn: () => getBankStatementImportDetail(selectedStatementImportId),
    enabled: canView && !!selectedStatementImportId,
  });

  async function refreshReconciliation() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['cashbook-summary'] }),
      qc.invalidateQueries({ queryKey: ['cashbook'] }),
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] }),
      qc.invalidateQueries({ queryKey: ['bank-reconciliation-detail'] }),
      qc.invalidateQueries({ queryKey: ['bank-statement-imports'] }),
      qc.invalidateQueries({ queryKey: ['bank-statement-import-detail'] }),
    ]);
  }

  const createReconciliationMut = useMutation({
    mutationFn: createBankReconciliation,
    onSuccess: async () => {
      await refreshReconciliation();
      setForm(emptyReconciliationForm);
      setErrorText('');
      setInfoText('Bank reconciliation created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create bank reconciliation.'));
      setInfoText('');
    },
  });

  const completeReconciliationMut = useMutation({
    mutationFn: completeBankReconciliation,
    onSuccess: async () => {
      await refreshReconciliation();
      setErrorText('');
      setInfoText('Bank reconciliation completed successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to complete bank reconciliation.'));
      setInfoText('');
    },
  });

  const cancelReconciliationMut = useMutation({
    mutationFn: cancelBankReconciliation,
    onSuccess: async () => {
      await refreshReconciliation();
      setErrorText('');
      setInfoText('Bank reconciliation cancelled successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to cancel bank reconciliation.'));
      setInfoText('');
    },
  });

  const uploadStatementMut = useMutation({
    mutationFn: uploadBankStatementImport,
    onSuccess: async () => {
      await refreshReconciliation();
      setImportForm(emptyStatementImportForm);
      setStatementLines([{ ...emptyStatementLine }]);
      setSelectedCsvFileName('');
      setErrorText('');
      setInfoText('Bank statement import uploaded successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to upload bank statement import.'));
      setInfoText('');
    },
  });

  const createApiImportMut = useMutation({
    mutationFn: createApiPlaceholderBankStatementImport,
    onSuccess: async () => {
      await refreshReconciliation();
      setImportForm(emptyStatementImportForm);
      setErrorText('');
      setInfoText('API placeholder bank statement import created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create API placeholder import.'));
      setInfoText('');
    },
  });

  const createMatchMut = useMutation({
    mutationFn: (payload: { bankReconciliationId: string; bankReconciliationLineId: string; bankStatementImportLineId: string; notes?: string | null }) =>
      createBankReconciliationMatch(payload.bankReconciliationId, {
        bankReconciliationLineId: payload.bankReconciliationLineId,
        bankStatementImportLineId: payload.bankStatementImportLineId,
        notes: payload.notes ?? null,
      }),
    onSuccess: async () => {
      await refreshReconciliation();
      setSelectedReconciliationLineId('');
      setSelectedStatementLineId('');
      setMatchNotes('');
      setErrorText('');
      setInfoText('Bank reconciliation match created successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create bank reconciliation match.'));
      setInfoText('');
    },
  });

  const removeMatchMut = useMutation({
    mutationFn: (payload: { bankReconciliationId: string; bankReconciliationMatchId: string }) =>
      removeBankReconciliationMatch(payload.bankReconciliationId, payload.bankReconciliationMatchId),
    onSuccess: async () => {
      await refreshReconciliation();
      setErrorText('');
      setInfoText('Bank reconciliation match removed successfully.');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to remove bank reconciliation match.'));
      setInfoText('');
    },
  });

  const reconcileLineMut = useMutation({
    mutationFn: ({ bankReconciliationId, lineId, isReconciled }: { bankReconciliationId: string; lineId: string; isReconciled: boolean }) =>
      setBankReconciliationLineReconciledState(bankReconciliationId, lineId, { isReconciled, notes: null }),
    onSuccess: async () => {
      await refreshReconciliation();
      setErrorText('');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update reconciliation line.'));
      setInfoText('');
    },
  });

  function submitCreateReconciliation() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to manage reconciliation setup.');
      return;
    }

    if (!form.ledgerAccountId || !form.statementFromUtc || !form.statementToUtc) {
      setErrorText('Ledger account, statement from date, and statement to date are required.');
      return;
    }

    createReconciliationMut.mutate({
      ledgerAccountId: form.ledgerAccountId,
      statementFromUtc: dateInputToUtc(form.statementFromUtc),
      statementToUtc: dateInputToUtc(form.statementToUtc),
      statementClosingBalance: Number(form.statementClosingBalance || 0),
      notes: form.notes.trim() || null,
    });
  }

  function submitStatementUpload() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to upload bank statements.');
      return;
    }

    if (!importForm.ledgerAccountId || !importForm.statementFromUtc || !importForm.statementToUtc) {
      setErrorText('Ledger account, statement from date, and statement to date are required.');
      return;
    }

    const lines: UploadBankStatementImportLineRequest[] = statementLines
      .filter((line) => line.transactionDateUtc && line.reference.trim())
      .map((line) => ({
        transactionDateUtc: dateInputToUtc(line.transactionDateUtc),
        reference: line.reference.trim(),
        description: line.description.trim() || line.reference.trim(),
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
        balance: line.balance ? Number(line.balance) : null,
        externalReference: line.reference.trim(),
      }));

    if (lines.length === 0) {
      setErrorText('At least one valid statement line is required.');
      return;
    }

    if (lines.some((line) => Number(line.debitAmount || 0) === 0 && Number(line.creditAmount || 0) === 0)) {
      setErrorText('Every statement line must have either a debit amount or a credit amount.');
      return;
    }

    if (lines.some((line) => Number(line.debitAmount || 0) > 0 && Number(line.creditAmount || 0) > 0)) {
      setErrorText('A statement line cannot have both debit and credit amounts.');
      return;
    }

    uploadStatementMut.mutate({
      ledgerAccountId: importForm.ledgerAccountId,
      statementFromUtc: dateInputToUtc(importForm.statementFromUtc),
      statementToUtc: dateInputToUtc(importForm.statementToUtc),
      sourceReference: importForm.sourceReference.trim() || null,
      fileName: importForm.fileName.trim() || null,
      notes: importForm.notes.trim() || null,
      lines,
    });
  }

  function submitApiPlaceholder() {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to create API placeholder imports.');
      return;
    }

    if (!importForm.ledgerAccountId || !importForm.statementFromUtc || !importForm.statementToUtc || !importForm.sourceReference.trim()) {
      setErrorText('Ledger account, statement dates, and source reference are required.');
      return;
    }

    createApiImportMut.mutate({
      ledgerAccountId: importForm.ledgerAccountId,
      statementFromUtc: dateInputToUtc(importForm.statementFromUtc),
      statementToUtc: dateInputToUtc(importForm.statementToUtc),
      sourceReference: importForm.sourceReference.trim(),
      notes: importForm.notes.trim() || null,
    });
  }

  function handleStatementFileSelected(file: File | null) {
    setErrorText('');
    setInfoText('');

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorText('Please select a CSV bank statement file.');
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const parsedLines = parseBankStatementCsv(text);

        setStatementLines(parsedLines);
        setSelectedCsvFileName(file.name);
        setImportForm((state) => ({
          ...state,
          fileName: file.name,
          sourceReference: state.sourceReference || file.name.replace(/\.csv$/i, ''),
        }));
        setInfoText(`${parsedLines.length} bank statement line(s) loaded from ${file.name}. Review the lines, then click Upload Statement Lines.`);
      } catch (error) {
        setErrorText(error instanceof Error ? error.message : 'Unable to parse the selected CSV file.');
        setInfoText('');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setErrorText('Unable to read the selected CSV file.');
      setInfoText('');
    };

    reader.readAsText(file);
  }

  function submitMatch() {
    setErrorText('');
    setInfoText('');

    if (!selectedReconciliationId) {
      setErrorText('Select a reconciliation before creating a match.');
      return;
    }

    if (!selectedReconciliationLineId || !selectedStatementLineId) {
      setErrorText('Select both a cashbook reconciliation line and a bank statement line.');
      return;
    }

    createMatchMut.mutate({
      bankReconciliationId: selectedReconciliationId,
      bankReconciliationLineId: selectedReconciliationLineId,
      bankStatementImportLineId: selectedStatementLineId,
      notes: matchNotes.trim() || null,
    });
  }

  function updateStatementLine(index: number, key: keyof StatementLineFormState, value: string) {
    setStatementLines((state) => {
      const next = [...state];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function removeStatementLine(index: number) {
    setStatementLines((state) => {
      if (state.length === 1) {
        return state;
      }

      return state.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  const selectedAccount = treasuryAccounts.find((account) => account.id === ledgerAccountId) ?? null;
  const reconciliationItems = reconciliationsQ.data?.items ?? [];
  const statementImportItems = statementImportsQ.data?.items ?? [];
  const reconciliationLines = reconciliationDetailQ.data?.items ?? [];
  const statementLinesDetail = statementImportDetailQ.data?.items ?? [];

  const selectedReconciliation = reconciliationItems.find((item: any) => item.id === selectedReconciliationId) ?? reconciliationDetailQ.data?.reconciliation ?? null;

  const cashbookUnmatchedLines = useMemo(() => {
    return reconciliationLines
      .filter((line: any) => !line.match)
      .map((line: any): ReconciliationExceptionRow => ({
        id: line.id,
        date: line.movementDateUtc,
        reference: line.reference,
        description: line.description,
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
        source: 'Cashbook',
        classification: Number(line.debitAmount || 0) > 0 ? 'Outstanding lodgement / receipt not on bank statement' : 'Unpresented payment / withdrawal not on bank statement',
      }));
  }, [reconciliationLines]);

  const bankStatementUnmatchedLines = useMemo(() => {
    return statementLinesDetail
      .filter((line: any) => !line.match)
      .map((line: any): ReconciliationExceptionRow => ({
        id: line.id,
        date: line.transactionDateUtc,
        reference: line.reference,
        description: line.description,
        debitAmount: Number(line.debitAmount || 0),
        creditAmount: Number(line.creditAmount || 0),
        source: 'Bank Statement',
        classification: Number(line.debitAmount || 0) > 0 ? 'Bank statement debit not posted in cashbook' : 'Bank statement credit not posted in cashbook',
      }));
  }, [statementLinesDetail]);

  const reconciliationControlSummary = useMemo(() => {
    const cashbookOnlyDebit = cashbookUnmatchedLines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0);
    const cashbookOnlyCredit = cashbookUnmatchedLines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0);
    const bankOnlyDebit = bankStatementUnmatchedLines.reduce((sum, line) => sum + Number(line.debitAmount || 0), 0);
    const bankOnlyCredit = bankStatementUnmatchedLines.reduce((sum, line) => sum + Number(line.creditAmount || 0), 0);
    const bookClosingBalance = Number(selectedReconciliation?.bookClosingBalance || 0);
    const statementClosingBalance = Number(selectedReconciliation?.statementClosingBalance || 0);
    const reportedDifference = Number(selectedReconciliation?.differenceAmount || 0);

    return {
      bookClosingBalance,
      statementClosingBalance,
      reportedDifference,
      matchedCashbookLines: reconciliationLines.filter((line: any) => !!line.match).length,
      unmatchedCashbookLines: cashbookUnmatchedLines.length,
      unmatchedBankStatementLines: bankStatementUnmatchedLines.length,
      cashbookOnlyDebit,
      cashbookOnlyCredit,
      bankOnlyDebit,
      bankOnlyCredit,
      isBalanced: isZeroAmount(reportedDifference),
      hasExceptions: cashbookUnmatchedLines.length > 0 || bankStatementUnmatchedLines.length > 0,
      canComplete: !!selectedReconciliationId && isZeroAmount(reportedDifference) && cashbookUnmatchedLines.length === 0 && bankStatementUnmatchedLines.length === 0,
    };
  }, [selectedReconciliation, reconciliationLines, cashbookUnmatchedLines, bankStatementUnmatchedLines, selectedReconciliationId]);

  function guardedCompleteReconciliation(bankReconciliationId: string) {
    setErrorText('');
    setInfoText('');

    if (!canManage) {
      setErrorText('You do not have permission to complete bank reconciliations.');
      return;
    }

    if (!bankReconciliationId) {
      setErrorText('Select a bank reconciliation before completing.');
      return;
    }

    if (!isZeroAmount(reconciliationControlSummary.reportedDifference)) {
      setErrorText('This reconciliation cannot be completed because the book closing balance and statement closing balance do not agree.');
      return;
    }

    if (reconciliationControlSummary.hasExceptions) {
      setErrorText('This reconciliation still has unmatched cashbook or bank statement lines. Match or clear all exceptions before completion.');
      return;
    }

    completeReconciliationMut.mutate(bankReconciliationId);
  }


  if (!canView) {
    return <div className="panel error-panel">You do not have access to view reconciliation.</div>;
  }

  if (accountsQ.isLoading) {
    return <div className="panel">Loading reconciliation module...</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Reconciliation</h2>
            <div className="muted">
              Standalone reconciliation workspace for treasury cashbook, bank statements, call-over matching, and bank reconciliation completion.
            </div>
          </div>
        </div>

        <div className="form-grid three">
          <div className="form-row">
            <label>From Date</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>To Date</label>
            <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>

          <div className="form-row">
            <label>Treasury / Bank Ledger Account</label>
            <select className="select" value={ledgerAccountId} onChange={(e) => setLedgerAccountId(e.target.value)}>
              <option value="">All Treasury Accounts</option>
              {treasuryAccounts.map((account) => (
                <option key={account.id} value={account.id}>{accountLabel(account)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 16 }}>
          <button className="button" onClick={() => setActiveTab('cashbook')}>Cashbook</button>
          <button className="button" onClick={() => setActiveTab('reconciliations')}>Bank Reconciliations</button>
          <button className="button" onClick={() => setActiveTab('statements')}>Statement Imports</button>
          <button className="button" onClick={() => setActiveTab('matching')}>Call-over Matching</button>
        </div>

        {infoText ? <div className="panel" style={{ marginTop: 16 }}><div className="muted">{infoText}</div></div> : null}
        {errorText ? <div className="panel error-panel" style={{ marginTop: 16 }}>{errorText}</div> : null}
      </section>

      {activeTab === 'cashbook' ? (
        <section id="print-reconciliation-cashbook" className="panel">
          <div className="section-heading">
            <div>
              <h2>Cashbook / Treasury Position</h2>
              <div className="muted">{selectedAccount ? accountLabel(selectedAccount) : 'All treasury accounts'} · {fromDate} to {toDate}</div>
            </div>
            <button className="button" onClick={() => printSection('print-reconciliation-cashbook')}>Print Cashbook</button>
          </div>

          <div className="kv">
            <div className="kv-row"><span>Accounts</span><span>{cashbookSummaryQ.data?.count ?? 0}</span></div>
            <div className="kv-row"><span>Opening Debit</span><span>{formatAmount(cashbookSummaryQ.data?.totalOpeningBalanceDebit)}</span></div>
            <div className="kv-row"><span>Opening Credit</span><span>{formatAmount(cashbookSummaryQ.data?.totalOpeningBalanceCredit)}</span></div>
            <div className="kv-row"><span>Period Debit</span><span>{formatAmount(cashbookSummaryQ.data?.totalPeriodDebit)}</span></div>
            <div className="kv-row"><span>Period Credit</span><span>{formatAmount(cashbookSummaryQ.data?.totalPeriodCredit)}</span></div>
            <div className="kv-row"><span>Closing Debit</span><span>{formatAmount(cashbookSummaryQ.data?.totalClosingBalanceDebit)}</span></div>
            <div className="kv-row"><span>Closing Credit</span><span>{formatAmount(cashbookSummaryQ.data?.totalClosingBalanceCredit)}</span></div>
            <div className="kv-row"><span>Cashbook Lines</span><span>{cashbookQ.data?.count ?? 0}</span></div>
          </div>

          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Debit</th>
                  <th style={{ textAlign: 'right' }}>Credit</th>
                  <th style={{ textAlign: 'right' }}>Running Debit</th>
                  <th style={{ textAlign: 'right' }}>Running Credit</th>
                </tr>
              </thead>
              <tbody>
                {(cashbookQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="muted">No cashbook lines found.</td></tr>
                ) : (
                  (cashbookQ.data?.items ?? []).map((line: any) => (
                    <tr key={line.id}>
                      <td>{formatDateTime(line.movementDateUtc)}</td>
                      <td>{line.reference}</td>
                      <td>{line.description}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.runningBalanceDebit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(line.runningBalanceCredit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === 'reconciliations' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Bank Reconciliations</h2>
              <div className="muted">Create, review, complete, or cancel bank reconciliations.</div>
            </div>
          </div>

          {canManage ? (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="section-heading"><h2>Create Reconciliation</h2></div>
              <div className="form-grid two">
                <div className="form-row">
                  <label>Bank Ledger Account</label>
                  <select className="select" value={form.ledgerAccountId} onChange={(e) => setForm((s) => ({ ...s, ledgerAccountId: e.target.value }))}>
                    <option value="">— Select Bank Account —</option>
                    {treasuryAccounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
                  </select>
                </div>
                <div className="form-row"><label>Statement Closing Balance</label><input className="input" type="number" value={form.statementClosingBalance} onChange={(e) => setForm((s) => ({ ...s, statementClosingBalance: e.target.value }))} /></div>
                <div className="form-row"><label>Statement From</label><input className="input" type="date" value={form.statementFromUtc} onChange={(e) => setForm((s) => ({ ...s, statementFromUtc: e.target.value }))} /></div>
                <div className="form-row"><label>Statement To</label><input className="input" type="date" value={form.statementToUtc} onChange={(e) => setForm((s) => ({ ...s, statementToUtc: e.target.value }))} /></div>
                <div className="form-row"><label>Notes</label><input className="input" value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button className="button primary" onClick={submitCreateReconciliation} disabled={createReconciliationMut.isPending}>Create Reconciliation</button>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Statement Period</th>
                  <th style={{ textAlign: 'right' }}>Statement Closing</th>
                  <th style={{ textAlign: 'right' }}>Book Closing</th>
                  <th style={{ textAlign: 'right' }}>Difference</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationItems.length === 0 ? (
                  <tr><td colSpan={7} className="muted">No reconciliations found.</td></tr>
                ) : (
                  reconciliationItems.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.ledgerAccountCode} - {item.ledgerAccountName}</td>
                      <td>{formatDateTime(item.statementFromUtc)} to {formatDateTime(item.statementToUtc)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.statementClosingBalance)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.bookClosingBalance)}</td>
                      <td style={{ textAlign: 'right' }}>{formatAmount(item.differenceAmount)}</td>
                      <td>{reconciliationStatusLabel(item.status)}</td>
                      <td>
                        <div className="inline-actions">
                          <button className="button" onClick={() => setSelectedReconciliationId(item.id)}>View</button>
                          {canManage ? <button className="button" onClick={() => guardedCompleteReconciliation(item.id)}>Complete</button> : null}
                          {canManage ? <button className="button" onClick={() => cancelReconciliationMut.mutate(item.id)}>Cancel</button> : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {reconciliationDetailQ.data ? (
            <div id="print-reconciliation-detail" className="panel" style={{ marginTop: 16 }}>
              <div className="section-heading">
                <div>
                  <h2>Reconciliation Detail</h2>
                  <div className="muted">{reconciliationDetailQ.data.reconciliation.ledgerAccountCode} - {reconciliationDetailQ.data.reconciliation.ledgerAccountName}</div>
                </div>
                <button className="button" onClick={() => printSection('print-reconciliation-detail')}>Print Detail</button>
              </div>

              <div className="kv">
                <div className="kv-row"><span>Total Lines</span><span>{reconciliationDetailQ.data.count}</span></div>
                <div className="kv-row"><span>Reconciled</span><span>{reconciliationDetailQ.data.reconciledCount}</span></div>
                <div className="kv-row"><span>Unreconciled</span><span>{reconciliationDetailQ.data.unreconciledCount}</span></div>
                <div className="kv-row"><span>Matches</span><span>{reconciliationDetailQ.data.matchCount}</span></div>
                <div className="kv-row"><span>Book Closing</span><span>{formatAmount(reconciliationControlSummary.bookClosingBalance)}</span></div>
                <div className="kv-row"><span>Statement Closing</span><span>{formatAmount(reconciliationControlSummary.statementClosingBalance)}</span></div>
                <div className="kv-row"><span>Difference</span><span>{formatAmount(reconciliationControlSummary.reportedDifference)}</span></div>
                <div className="kv-row"><span>Control Status</span><span>{reconciliationControlSummary.canComplete ? 'Ready to Complete' : 'Open Exceptions'}</span></div>
              </div>

              <div className={reconciliationControlSummary.canComplete ? 'panel' : 'panel error-panel'} style={{ marginBottom: 16 }}>
                {reconciliationControlSummary.canComplete
                  ? 'This reconciliation is balanced and has no unmatched cashbook or bank statement exceptions.'
                  : 'This reconciliation is not ready for completion. Clear the difference and resolve all unmatched cashbook / bank statement exceptions.'}
              </div>

              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Exception Source</th>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th>Classification</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cashbookUnmatchedLines, ...bankStatementUnmatchedLines].length === 0 ? (
                      <tr><td colSpan={7} className="muted">No unmatched exceptions.</td></tr>
                    ) : (
                      [...cashbookUnmatchedLines, ...bankStatementUnmatchedLines].map((line) => (
                        <tr key={`${line.source}-${line.id}`}>
                          <td>{line.source}</td>
                          <td>{formatDateTime(line.date)}</td>
                          <td>{line.reference}</td>
                          <td>{line.description}</td>
                          <td>{line.classification}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th>Matched</th>
                      <th>Reconciled</th>
                      <th>Control Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationLines.map((line: any) => (
                      <tr key={line.id}>
                        <td>{formatDateTime(line.movementDateUtc)}</td>
                        <td>{line.reference}</td>
                        <td>{line.description}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
                        <td>{line.match ? 'Yes' : 'No'}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!line.isReconciled}
                            disabled={!line.match}
                            onChange={(e) => reconcileLineMut.mutate({ bankReconciliationId: selectedReconciliationId, lineId: line.id, isReconciled: e.target.checked })}
                          />
                        </td>
                        <td>{line.match ? 'Matched to bank statement' : 'Match required before reconciliation'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {canManage ? (
                <div className="modal-footer">
                  <button
                    className="button primary"
                    onClick={() => guardedCompleteReconciliation(selectedReconciliationId)}
                    disabled={!reconciliationControlSummary.canComplete || completeReconciliationMut.isPending}
                  >
                    Complete Reconciliation
                  </button>
                  <button className="button" onClick={() => cancelReconciliationMut.mutate(selectedReconciliationId)} disabled={!selectedReconciliationId || cancelReconciliationMut.isPending}>
                    Cancel Reconciliation
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'statements' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Bank Statement Imports</h2>
              <div className="muted">Create API placeholders or upload statement lines for reconciliation matching.</div>
            </div>
          </div>

          {canManage ? (
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="section-heading">
                <div>
                  <h2>Create / Upload Statement Import</h2>
                  <div className="muted">Use the CSV template to prepare statement rows before entering or importing them.</div>
                </div>
                <div className="inline-actions">
                  <button className="button" type="button" onClick={downloadBankStatementTemplate}>
                    Download Upload Template
                  </button>
                  <button className="button primary" type="button" onClick={() => fileInputRef.current?.click()}>
                    Pick CSV Statement File
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    style={{ display: 'none' }}
                    onChange={(e) => handleStatementFileSelected(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              {selectedCsvFileName ? (
                <div className="panel" style={{ marginBottom: 16 }}>
                  <strong>Selected CSV:</strong> {selectedCsvFileName}
                  <div className="muted">The parsed lines are populated below. Review them before upload.</div>
                </div>
              ) : null}

              <div className="form-grid two">
                <div className="form-row">
                  <label>Bank Ledger Account</label>
                  <select className="select" value={importForm.ledgerAccountId} onChange={(e) => setImportForm((s) => ({ ...s, ledgerAccountId: e.target.value }))}>
                    <option value="">— Select Bank Account —</option>
                    {treasuryAccounts.map((account) => <option key={account.id} value={account.id}>{accountLabel(account)}</option>)}
                  </select>
                </div>
                <div className="form-row"><label>Source Reference</label><input className="input" value={importForm.sourceReference} onChange={(e) => setImportForm((s) => ({ ...s, sourceReference: e.target.value }))} /></div>
                <div className="form-row"><label>Statement From</label><input className="input" type="date" value={importForm.statementFromUtc} onChange={(e) => setImportForm((s) => ({ ...s, statementFromUtc: e.target.value }))} /></div>
                <div className="form-row"><label>Statement To</label><input className="input" type="date" value={importForm.statementToUtc} onChange={(e) => setImportForm((s) => ({ ...s, statementToUtc: e.target.value }))} /></div>
                <div className="form-row"><label>File Name</label><input className="input" value={importForm.fileName} onChange={(e) => setImportForm((s) => ({ ...s, fileName: e.target.value }))} /></div>
                <div className="form-row"><label>Notes</label><input className="input" value={importForm.notes} onChange={(e) => setImportForm((s) => ({ ...s, notes: e.target.value }))} /></div>
              </div>

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLines.map((line, index) => (
                      <tr key={index}>
                        <td><input className="input" type="date" value={line.transactionDateUtc} onChange={(e) => updateStatementLine(index, 'transactionDateUtc', e.target.value)} /></td>
                        <td><input className="input" value={line.reference} onChange={(e) => updateStatementLine(index, 'reference', e.target.value)} /></td>
                        <td><input className="input" value={line.description} onChange={(e) => updateStatementLine(index, 'description', e.target.value)} /></td>
                        <td><input className="input" type="number" value={line.debitAmount} onChange={(e) => updateStatementLine(index, 'debitAmount', e.target.value)} /></td>
                        <td><input className="input" type="number" value={line.creditAmount} onChange={(e) => updateStatementLine(index, 'creditAmount', e.target.value)} /></td>
                        <td><input className="input" type="number" value={line.balance} onChange={(e) => updateStatementLine(index, 'balance', e.target.value)} /></td>
                        <td>
                          <button className="button" type="button" onClick={() => removeStatementLine(index)} disabled={statementLines.length === 1}>
                            Remove Line
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer">
                <button className="button" type="button" onClick={() => fileInputRef.current?.click()}>Pick CSV Statement File</button>
                <button className="button" type="button" onClick={downloadBankStatementTemplate}>Download Upload Template</button>
                <button className="button" type="button" onClick={() => setStatementLines((state) => [...state, { ...emptyStatementLine }])}>Add Manual Line</button>
                <button className="button" onClick={submitApiPlaceholder} disabled={createApiImportMut.isPending}>Create API Placeholder</button>
                <button className="button primary" onClick={submitStatementUpload} disabled={uploadStatementMut.isPending}>Upload Statement Lines</button>
              </div>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Statement Period</th>
                  <th>Source</th>
                  <th>File</th>
                  <th>Imported</th>
                  <th style={{ textAlign: 'right' }}>Lines</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {statementImportItems.length === 0 ? (
                  <tr><td colSpan={7} className="muted">No statement imports found.</td></tr>
                ) : (
                  statementImportItems.map((item: any) => (
                    <tr key={item.id}>
                      <td>{item.ledgerAccountCode} - {item.ledgerAccountName}</td>
                      <td>{formatDateTime(item.statementFromUtc)} to {formatDateTime(item.statementToUtc)}</td>
                      <td>{item.sourceReference}</td>
                      <td>{item.fileName || '—'}</td>
                      <td>{formatDateTime(item.importedOnUtc)}</td>
                      <td style={{ textAlign: 'right' }}>{item.lineCount}</td>
                      <td><button className="button" onClick={() => setSelectedStatementImportId(item.id)}>View</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {statementImportDetailQ.data ? (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="section-heading">
                <div>
                  <h2>Statement Import Detail</h2>
                  <div className="muted">{statementImportDetailQ.data.bankStatementImport.sourceReference}</div>
                </div>
              </div>

              <div className="kv">
                <div className="kv-row"><span>Lines</span><span>{statementImportDetailQ.data.count}</span></div>
                <div className="kv-row"><span>Matched</span><span>{statementImportDetailQ.data.matchCount}</span></div>
                <div className="kv-row"><span>Total Debit</span><span>{formatAmount(statementImportDetailQ.data.totalDebit)}</span></div>
                <div className="kv-row"><span>Total Credit</span><span>{formatAmount(statementImportDetailQ.data.totalCredit)}</span></div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th>Matched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLinesDetail.map((line: any) => (
                      <tr key={line.id}>
                        <td>{formatDateTime(line.transactionDateUtc)}</td>
                        <td>{line.reference}</td>
                        <td>{line.description}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                        <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
                        <td>{line.match ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === 'matching' ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Call-over Matching</h2>
              <div className="muted">Match cashbook reconciliation lines against imported bank statement lines.</div>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="kv">
              <div className="kv-row"><span>Matched Cashbook Lines</span><span>{reconciliationControlSummary.matchedCashbookLines}</span></div>
              <div className="kv-row"><span>Unmatched Cashbook Lines</span><span>{reconciliationControlSummary.unmatchedCashbookLines}</span></div>
              <div className="kv-row"><span>Unmatched Statement Lines</span><span>{reconciliationControlSummary.unmatchedBankStatementLines}</span></div>
              <div className="kv-row"><span>Current Difference</span><span>{formatAmount(reconciliationControlSummary.reportedDifference)}</span></div>
            </div>
            <div className="muted">
              Correct reconciliation requires every cashbook line to be matched or properly cleared, every bank statement line to be matched or posted to GL, and final difference to be zero.
            </div>
          </div>

          <div className="form-grid two">
            <div className="form-row">
              <label>Reconciliation</label>
              <select className="select" value={selectedReconciliationId} onChange={(e) => setSelectedReconciliationId(e.target.value)}>
                <option value="">— Select Reconciliation —</option>
                {reconciliationItems.map((item: any) => (
                  <option key={item.id} value={item.id}>{item.ledgerAccountCode} · {formatDateTime(item.statementFromUtc)} - {formatDateTime(item.statementToUtc)}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <label>Statement Import</label>
              <select className="select" value={selectedStatementImportId} onChange={(e) => setSelectedStatementImportId(e.target.value)}>
                <option value="">— Select Statement Import —</option>
                {statementImportItems.map((item: any) => (
                  <option key={item.id} value={item.id}>{item.ledgerAccountCode} · {item.sourceReference}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid two" style={{ marginTop: 16 }}>
            <div className="panel">
              <div className="section-heading"><h2>Cashbook Lines</h2></div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Date</th>
                      <th>Reference</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th>Matched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationLines.length === 0 ? (
                      <tr><td colSpan={6} className="muted">Select a reconciliation.</td></tr>
                    ) : (
                      reconciliationLines.map((line: any) => (
                        <tr key={line.id}>
                          <td><input type="radio" name="reconciliation-line" checked={selectedReconciliationLineId === line.id} onChange={() => setSelectedReconciliationLineId(line.id)} /></td>
                          <td>{formatDateTime(line.movementDateUtc)}</td>
                          <td>{line.reference}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
                          <td>
                            {line.match ? (
                              <button className="button" onClick={() => removeMatchMut.mutate({ bankReconciliationId: selectedReconciliationId, bankReconciliationMatchId: line.match.id })}>Remove Match</button>
                            ) : 'No'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="section-heading"><h2>Bank Statement Lines</h2></div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Date</th>
                      <th>Reference</th>
                      <th style={{ textAlign: 'right' }}>Debit</th>
                      <th style={{ textAlign: 'right' }}>Credit</th>
                      <th>Matched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementLinesDetail.length === 0 ? (
                      <tr><td colSpan={6} className="muted">Select a statement import.</td></tr>
                    ) : (
                      statementLinesDetail.map((line: any) => (
                        <tr key={line.id}>
                          <td><input type="radio" name="statement-line" checked={selectedStatementLineId === line.id} onChange={() => setSelectedStatementLineId(line.id)} /></td>
                          <td>{formatDateTime(line.transactionDateUtc)}</td>
                          <td>{line.reference}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(line.debitAmount)}</td>
                          <td style={{ textAlign: 'right' }}>{formatAmount(line.creditAmount)}</td>
                          <td>{line.match ? 'Yes' : 'No'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <div className="form-row">
              <label>Match Notes</label>
              <input className="input" value={matchNotes} onChange={(e) => setMatchNotes(e.target.value)} placeholder="Optional matching note" />
            </div>

            <div className="modal-footer">
              <button className="button primary" onClick={submitMatch} disabled={createMatchMut.isPending}>Create Match</button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
