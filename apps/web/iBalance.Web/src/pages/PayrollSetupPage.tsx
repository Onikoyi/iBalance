import {
  createPayrollPayElement,
  createPayrollPayGroup,
  createPayrollSalaryStructure,
  deletePayrollPayElement,
  deletePayrollPayGroup,
  deletePayrollSalaryStructure,
  formatAmount,
  dateInputToUtc,
  getAccounts,
  getPayrollEmployees,
  getPayrollPayElements,
  getPayrollPayGroups,
  getPayrollSalaryStructures,
  getPayrollPolicySetting,
  upsertPayrollPolicySetting,
  getTenantReadableError,
  toDateInputValue,
  updatePayrollPayElement,
  updatePayrollPayGroup,
  updatePayrollSalaryStructure,
  useMemo,
  useMutation,
  useQuery,
  useQueryClient,
  useState,
  createPayrollPayGroupElement,
  updatePayrollPayGroupElement,
  deletePayrollPayGroupElement,
  getPayrollPayGroupElements,
  createPayrollSalaryStructureOverride,
  updatePayrollSalaryStructureOverride,
  deletePayrollSalaryStructureOverride,
  getPayrollSalaryStructureOverrides,
  type PayrollSalaryStructureOverrideDto,
  type CreatePayrollSalaryStructureOverrideRequest,
  type UpdatePayrollSalaryStructureOverrideRequest,
  type PayrollPayGroupElementDto,
  type CreatePayrollPayGroupElementRequest,
  type UpdatePayrollPayGroupElementRequest,
  type PayrollEmployeeDto,
  type PayrollPayElementDto,
  type PayrollPayGroupDto,
  type PayrollSalaryStructureDto,
  type UpdatePayrollPayElementRequest,
  type UpdatePayrollPayGroupRequest,
  type UpdatePayrollSalaryStructureRequest,
  type PayrollPolicySettingDto,
  type UpdatePayrollPolicySettingRequest,
  canManageFinanceSetup,
  canViewFinance,
} from './PayrollShared';

export function PayrollSetupPage() {
  const queryClient = useQueryClient();
  const canView = canViewFinance();
  const canManage = canManageFinanceSetup();

  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [payrollPolicyForm, setPayrollPolicyForm] = useState<UpdatePayrollPolicySettingRequest>({
    enforceMinimumTakeHome: false,
    minimumTakeHomeRuleType: 'fixed_amount',
    minimumTakeHomeAmount: 0,
    minimumTakeHomePercent: 0,
    currencyCode: 'NGN',
  });

  const [payGroupForm, setPayGroupForm] = useState({ code: '', name: '', description: '', isActive: true });
  const [payElementForm, setPayElementForm] = useState({
    code: '',
    name: '',
    elementKind: 1,
    calculationMode: 1,
    defaultAmount: 0,
    defaultRate: 0,
    ledgerAccountId: '',
    isTaxable: true,
    isActive: true,
    description: '',
  });
  const [salaryForm, setSalaryForm] = useState({
    employeeIds: [] as string[],
    payGroupId: '',
    basicSalary: 0,
    currencyCode: 'NGN',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    isActive: true,
    notes: '',
  });
  const [salaryEmployeeSearch, setSalaryEmployeeSearch] = useState('');
  const [salaryStructureSearch, setSalaryStructureSearch] = useState('');

  const [showEditPayGroup, setShowEditPayGroup] = useState(false);
  const [editingPayGroupId, setEditingPayGroupId] = useState('');
  const [editPayGroupForm, setEditPayGroupForm] = useState<UpdatePayrollPayGroupRequest>({
    name: '',
    description: '',
    isActive: true,
  });

  const [showEditPayElement, setShowEditPayElement] = useState(false);
  const [editingPayElementId, setEditingPayElementId] = useState('');
  const [editingPayElementCode, setEditingPayElementCode] = useState('');
  const [editPayElementForm, setEditPayElementForm] = useState<UpdatePayrollPayElementRequest>({
    name: '',
    elementKind: 1,
    calculationMode: 1,
    defaultAmount: 0,
    defaultRate: 0,
    ledgerAccountId: '',
    isTaxable: true,
    isActive: true,
    description: '',
  });

  const [showEditSalaryStructure, setShowEditSalaryStructure] = useState(false);
  const [editingSalaryStructureId, setEditingSalaryStructureId] = useState('');
  const [editSalaryStructureForm, setEditSalaryStructureForm] = useState<UpdatePayrollSalaryStructureRequest>({
    employeeId: '',
    payGroupId: '',
    basicSalary: 0,
    currencyCode: 'NGN',
    effectiveFromUtc: dateInputToUtc(new Date().toISOString().slice(0, 10)),
    isActive: true,
    notes: '',
  });

  const [selectedCompositionPayGroupId, setSelectedCompositionPayGroupId] = useState('');
  const [payGroupElementForm, setPayGroupElementForm] = useState<CreatePayrollPayGroupElementRequest>({
    payGroupId: '',
    payElementId: '',
    sequence: 1,
    amountOverride: null,
    rateOverride: null,
    isMandatory: true,
    isActive: true,
    effectiveFromUtc: null,
    effectiveToUtc: null,
    notes: '',
  });
  const [showEditPayGroupElement, setShowEditPayGroupElement] = useState(false);
  const [editingPayGroupElementId, setEditingPayGroupElementId] = useState('');
  const [editPayGroupElementForm, setEditPayGroupElementForm] = useState<UpdatePayrollPayGroupElementRequest>({
    sequence: 1,
    amountOverride: null,
    rateOverride: null,
    isMandatory: true,
    isActive: true,
    effectiveFromUtc: null,
    effectiveToUtc: null,
    notes: '',
  });

  const [selectedOverrideSalaryStructureId, setSelectedOverrideSalaryStructureId] = useState('');
  const [salaryOverrideForm, setSalaryOverrideForm] = useState<CreatePayrollSalaryStructureOverrideRequest>({
    payrollSalaryStructureId: '',
    payElementId: '',
    amountOverride: null,
    rateOverride: null,
    isExcluded: false,
    isActive: true,
    effectiveFromUtc: null,
    effectiveToUtc: null,
    notes: '',
  });
  const [showEditSalaryOverride, setShowEditSalaryOverride] = useState(false);
  const [editingSalaryOverrideId, setEditingSalaryOverrideId] = useState('');
  const [editSalaryOverrideForm, setEditSalaryOverrideForm] = useState<UpdatePayrollSalaryStructureOverrideRequest>({
    amountOverride: null,
    rateOverride: null,
    isExcluded: false,
    isActive: true,
    effectiveFromUtc: null,
    effectiveToUtc: null,
    notes: '',
  });

  const employeesQ = useQuery({ queryKey: ['payroll-employees'], queryFn: getPayrollEmployees, enabled: canView });
  const payGroupsQ = useQuery({ queryKey: ['payroll-pay-groups'], queryFn: getPayrollPayGroups, enabled: canView });
  const payElementsQ = useQuery({ queryKey: ['payroll-pay-elements'], queryFn: getPayrollPayElements, enabled: canView });
  const salaryQ = useQuery({ queryKey: ['payroll-salary-structures'], queryFn: getPayrollSalaryStructures, enabled: canView });
  const accountsQ = useQuery({ queryKey: ['ledger-accounts'], queryFn: getAccounts, enabled: canView });
  const payGroupElementsQ = useQuery({
    queryKey: ['payroll-pay-group-elements', selectedCompositionPayGroupId],
    queryFn: () => getPayrollPayGroupElements(selectedCompositionPayGroupId),
    enabled: canView && selectedCompositionPayGroupId.length > 0,
  });
  const salaryOverridesQ = useQuery({
    queryKey: ['payroll-salary-structure-overrides', selectedOverrideSalaryStructureId],
    queryFn: () => getPayrollSalaryStructureOverrides(selectedOverrideSalaryStructureId),
    enabled: canView && selectedOverrideSalaryStructureId.length > 0,
  });

  const payrollPolicyQ = useQuery({
    queryKey: ['payroll-policy'],
    queryFn: getPayrollPolicySetting,
    enabled: canView,
    staleTime: 30000,
  });

  const postingAccounts = useMemo(
    () => ((accountsQ.data as any)?.items ?? []).filter((x: any) => x.isActive && x.isPostingAllowed && !x.isHeader),
    [accountsQ.data]
  );

  const filteredSalaryEmployees = useMemo(() => {
    const term = salaryEmployeeSearch.trim().toLowerCase();
    const items = ((employeesQ.data?.items ?? []) as PayrollEmployeeDto[]);
    if (!term) return items;
    return items.filter((employee) =>
      [employee.employeeNumber, employee.displayName, employee.department, employee.jobTitle]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [employeesQ.data, salaryEmployeeSearch]);

  const filteredSalaryStructures = useMemo(() => {
    const term = salaryStructureSearch.trim().toLowerCase();
    const items = ((salaryQ.data?.items ?? []) as PayrollSalaryStructureDto[]);
    if (!term) return items;
    return items.filter((structure) =>
      [structure.employeeNumber, structure.employeeName, structure.payGroupCode, structure.payGroupName, structure.currencyCode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [salaryQ.data, salaryStructureSearch]);

  function toggleSalaryEmployee(employeeId: string) {
    setSalaryForm((current) => ({
      ...current,
      employeeIds: current.employeeIds.includes(employeeId)
        ? current.employeeIds.filter((id) => id !== employeeId)
        : [...current.employeeIds, employeeId],
    }));
  }

  function selectAllFilteredSalaryEmployees() {
    const filteredIds = filteredSalaryEmployees.map((employee) => employee.id);
    setSalaryForm((current) => ({
      ...current,
      employeeIds: Array.from(new Set([...current.employeeIds, ...filteredIds])),
    }));
  }

  function clearSalaryEmployeeSelection() {
    setSalaryForm((current) => ({ ...current, employeeIds: [] }));
  }

  async function createSalaryStructuresForSelectedEmployees() {
    clearFeedback();

    if (salaryForm.employeeIds.length === 0) {
      setErrorText('Select at least one employee.');
      return;
    }

    if (!salaryForm.payGroupId) {
      setErrorText('Pay group is required.');
      return;
    }

    if (salaryForm.basicSalary < 0) {
      setErrorText('Basic salary cannot be negative.');
      return;
    }

    const payloadBase = {
      payGroupId: salaryForm.payGroupId,
      basicSalary: salaryForm.basicSalary,
      currencyCode: salaryForm.currencyCode,
      effectiveFromUtc: dateInputToUtc(salaryForm.effectiveFrom),
      isActive: salaryForm.isActive,
      notes: salaryForm.notes || null,
    };

    const results = await Promise.allSettled(
      salaryForm.employeeIds.map((employeeId) =>
        createSalaryMut.mutateAsync({
          employeeId,
          ...payloadBase,
        })
      )
    );

    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      setMessage(
        failureCount > 0
          ? `Created ${successCount} salary structure(s). ${failureCount} failed.`
          : `Created ${successCount} salary structure(s) successfully.`
      );
      setSalaryForm({
        employeeIds: [],
        payGroupId: '',
        basicSalary: 0,
        currencyCode: 'NGN',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isActive: true,
        notes: '',
      });
      setSalaryEmployeeSearch('');
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    }

    if (failureCount > 0) {
      const firstRejected = results.find((result) => result.status === 'rejected');
      const reason =
        firstRejected && firstRejected.status === 'rejected'
          ? getTenantReadableError(firstRejected.reason, 'Some salary structures could not be created.')
          : 'Some salary structures could not be created.';
      setErrorText(reason);
    } else {
      setErrorText('');
    }
  }

  function clearFeedback() {
    setMessage('');
    setErrorText('');
  }

  if (
    payrollPolicyQ.data &&
    payrollPolicyForm.currencyCode === 'NGN' &&
    payrollPolicyForm.minimumTakeHomeAmount === 0 &&
    payrollPolicyForm.minimumTakeHomePercent === 0 &&
    payrollPolicyForm.minimumTakeHomeRuleType === 'fixed_amount' &&
    payrollPolicyForm.enforceMinimumTakeHome === false
  ) {
    const currentPolicy = payrollPolicyQ.data as PayrollPolicySettingDto;
    if (
      currentPolicy.enforceMinimumTakeHome !== payrollPolicyForm.enforceMinimumTakeHome ||
      Number(currentPolicy.minimumTakeHomeAmount || 0) !== payrollPolicyForm.minimumTakeHomeAmount ||
      (currentPolicy.currencyCode || 'NGN') !== payrollPolicyForm.currencyCode
    ) {
      setPayrollPolicyForm({
        enforceMinimumTakeHome: currentPolicy.enforceMinimumTakeHome,
        minimumTakeHomeRuleType: (currentPolicy.minimumTakeHomeRuleType || 'fixed_amount') as 'fixed_amount' | 'gross_percentage',
        minimumTakeHomeAmount: Number(currentPolicy.minimumTakeHomeAmount || 0),
        minimumTakeHomePercent: Number(currentPolicy.minimumTakeHomePercent || 0),
        currencyCode: currentPolicy.currencyCode || 'NGN',
      });
    }
  }

  function invalidateSetupQueries() {
    queryClient.invalidateQueries({ queryKey: ['payroll-pay-groups'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    if (selectedCompositionPayGroupId) {
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-group-elements', selectedCompositionPayGroupId] });
    }
    if (selectedOverrideSalaryStructureId) {
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structure-overrides', selectedOverrideSalaryStructureId] });
    }
  }

  const createPayGroupElementMut = useMutation({
    mutationFn: createPayrollPayGroupElement,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group composition item created.');
      setErrorText('');
      setPayGroupElementForm({
        payGroupId: selectedCompositionPayGroupId,
        payElementId: '',
        sequence: ((payGroupElementsQ.data?.items?.length ?? 0) + 1),
        amountOverride: null,
        rateOverride: null,
        isMandatory: true,
        isActive: true,
        effectiveFromUtc: null,
        effectiveToUtc: null,
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-group-elements', selectedCompositionPayGroupId] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to create pay group composition item.')),
  });

  const updatePayGroupElementMut = useMutation({
    mutationFn: ({ payGroupElementId, payload }: { payGroupElementId: string; payload: UpdatePayrollPayGroupElementRequest }) =>
      updatePayrollPayGroupElement(payGroupElementId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group composition item updated.');
      setErrorText('');
      setShowEditPayGroupElement(false);
      setEditingPayGroupElementId('');
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-group-elements', selectedCompositionPayGroupId] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to update pay group composition item.')),
  });

  const deletePayGroupElementMut = useMutation({
    mutationFn: deletePayrollPayGroupElement,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group composition item deleted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-group-elements', selectedCompositionPayGroupId] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to delete pay group composition item.')),
  });

  const createSalaryOverrideMut = useMutation({
    mutationFn: createPayrollSalaryStructureOverride,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure override created.');
      setErrorText('');
      setSalaryOverrideForm({
        payrollSalaryStructureId: selectedOverrideSalaryStructureId,
        payElementId: '',
        amountOverride: null,
        rateOverride: null,
        isExcluded: false,
        isActive: true,
        effectiveFromUtc: null,
        effectiveToUtc: null,
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structure-overrides', selectedOverrideSalaryStructureId] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to create salary structure override.')),
  });

  const updateSalaryOverrideMut = useMutation({
    mutationFn: ({ salaryStructureOverrideId, payload }: { salaryStructureOverrideId: string; payload: UpdatePayrollSalaryStructureOverrideRequest }) =>
      updatePayrollSalaryStructureOverride(salaryStructureOverrideId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure override updated.');
      setErrorText('');
      setShowEditSalaryOverride(false);
      setEditingSalaryOverrideId('');
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structure-overrides', selectedOverrideSalaryStructureId] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to update salary structure override.')),
  });

  const deleteSalaryOverrideMut = useMutation({
    mutationFn: deletePayrollSalaryStructureOverride,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure override deleted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structure-overrides', selectedOverrideSalaryStructureId] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to delete salary structure override.')),
  });

  const savePayrollPolicyMut = useMutation({
    mutationFn: upsertPayrollPolicySetting,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Payroll policy saved.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-policy'] });
    },
    onError: (error) => setErrorText(getTenantReadableError(error, 'Unable to save payroll policy.')),
  });

  const createPayGroupMut = useMutation({
    mutationFn: createPayrollPayGroup,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group created.');
      setErrorText('');
      setPayGroupForm({ code: '', name: '', description: '', isActive: true });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-groups'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create pay group.'));
    },
  });

  const updatePayGroupMut = useMutation({
    mutationFn: ({ payGroupId, payload }: { payGroupId: string; payload: UpdatePayrollPayGroupRequest }) =>
      updatePayrollPayGroup(payGroupId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group updated.');
      setErrorText('');
      setShowEditPayGroup(false);
      setEditingPayGroupId('');
      setEditPayGroupForm({ name: '', description: '', isActive: true });
      invalidateSetupQueries();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update pay group.'));
    },
  });

  const deletePayGroupMut = useMutation({
    mutationFn: deletePayrollPayGroup,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay group deleted.');
      setErrorText('');
      invalidateSetupQueries();
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete pay group.'));
    },
  });

  const createPayElementMut = useMutation({
    mutationFn: createPayrollPayElement,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay element created.');
      setErrorText('');
      setPayElementForm({
        code: '',
        name: '',
        elementKind: 1,
        calculationMode: 1,
        defaultAmount: 0,
        defaultRate: 0,
        ledgerAccountId: '',
        isTaxable: true,
        isActive: true,
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create pay element.'));
    },
  });

  const updatePayElementMut = useMutation({
    mutationFn: ({ payElementId, payload }: { payElementId: string; payload: UpdatePayrollPayElementRequest }) =>
      updatePayrollPayElement(payElementId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay element updated.');
      setErrorText('');
      setShowEditPayElement(false);
      setEditingPayElementId('');
      setEditingPayElementCode('');
      setEditPayElementForm({
        name: '',
        elementKind: 1,
        calculationMode: 1,
        defaultAmount: 0,
        defaultRate: 0,
        ledgerAccountId: '',
        isTaxable: true,
        isActive: true,
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update pay element.'));
    },
  });

  const deletePayElementMut = useMutation({
    mutationFn: deletePayrollPayElement,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Pay element deleted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-pay-elements'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete pay element.'));
    },
  });

  const createSalaryMut = useMutation({
    mutationFn: createPayrollSalaryStructure,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure created.');
      setErrorText('');
      setSalaryForm({
        employeeIds: [],
        payGroupId: '',
        basicSalary: 0,
        currencyCode: 'NGN',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        isActive: true,
        notes: '',
      });
      setSalaryEmployeeSearch('');
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to create salary structure.'));
    },
  });

  const updateSalaryMut = useMutation({
    mutationFn: ({ salaryStructureId, payload }: { salaryStructureId: string; payload: UpdatePayrollSalaryStructureRequest }) =>
      updatePayrollSalaryStructure(salaryStructureId, payload),
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure updated.');
      setErrorText('');
      setShowEditSalaryStructure(false);
      setEditingSalaryStructureId('');
      setEditSalaryStructureForm({
        employeeId: '',
        payGroupId: '',
        basicSalary: 0,
        currencyCode: 'NGN',
        effectiveFromUtc: dateInputToUtc(new Date().toISOString().slice(0, 10)),
        isActive: true,
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to update salary structure.'));
    },
  });

  const deleteSalaryMut = useMutation({
    mutationFn: deletePayrollSalaryStructure,
    onSuccess: (response: any) => {
      setMessage(response?.message || response?.Message || 'Salary structure deleted.');
      setErrorText('');
      queryClient.invalidateQueries({ queryKey: ['payroll-salary-structures'] });
    },
    onError: (error) => {
      setMessage('');
      setErrorText(getTenantReadableError(error, 'Unable to delete salary structure.'));
    },
  });

  function beginEditPayGroup(group: PayrollPayGroupDto) {
    clearFeedback();
    setEditingPayGroupId(group.id);
    setEditPayGroupForm({
      name: group.name,
      description: group.description || '',
      isActive: group.isActive,
    });
    setShowEditPayGroup(true);
  }

  async function submitEditPayGroup() {
    clearFeedback();

    if (!editingPayGroupId) {
      setErrorText('Pay group selection is required.');
      return;
    }

    if (!editPayGroupForm.name.trim()) {
      setErrorText('Pay group name is required.');
      return;
    }

    await updatePayGroupMut.mutateAsync({
      payGroupId: editingPayGroupId,
      payload: {
        name: editPayGroupForm.name.trim(),
        description: editPayGroupForm.description?.trim() || null,
        isActive: editPayGroupForm.isActive,
      },
    });
  }

  async function removePayGroup(group: PayrollPayGroupDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete pay group "${group.code} - ${group.name}"? This will only succeed if it is not used in any salary structure.`
    );

    if (!confirmed) return;

    await deletePayGroupMut.mutateAsync(group.id);
  }

  function beginEditPayGroupElement(item: PayrollPayGroupElementDto) {
    clearFeedback();
    setEditingPayGroupElementId(item.id);
    setEditPayGroupElementForm({
      sequence: item.sequence,
      amountOverride: item.amountOverride ?? null,
      rateOverride: item.rateOverride ?? null,
      isMandatory: item.isMandatory,
      isActive: item.isActive,
      effectiveFromUtc: item.effectiveFromUtc ?? null,
      effectiveToUtc: item.effectiveToUtc ?? null,
      notes: item.notes || '',
    });
    setShowEditPayGroupElement(true);
  }

  async function submitEditPayGroupElement() {
    clearFeedback();

    if (!editingPayGroupElementId) {
      setErrorText('Pay group composition selection is required.');
      return;
    }

    await updatePayGroupElementMut.mutateAsync({
      payGroupElementId: editingPayGroupElementId,
      payload: {
        ...editPayGroupElementForm,
        notes: editPayGroupElementForm.notes?.trim() || null,
      },
    });
  }

  async function removePayGroupElement(item: PayrollPayGroupElementDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Remove "${item.payElementCode} - ${item.payElementName}" from "${item.payGroupCode} - ${item.payGroupName}"?`
    );

    if (!confirmed) return;

    await deletePayGroupElementMut.mutateAsync(item.id);
  }

  function beginEditSalaryOverride(item: PayrollSalaryStructureOverrideDto) {
    clearFeedback();
    setEditingSalaryOverrideId(item.id);
    setEditSalaryOverrideForm({
      amountOverride: item.amountOverride ?? null,
      rateOverride: item.rateOverride ?? null,
      isExcluded: item.isExcluded,
      isActive: item.isActive,
      effectiveFromUtc: item.effectiveFromUtc ?? null,
      effectiveToUtc: item.effectiveToUtc ?? null,
      notes: item.notes || '',
    });
    setShowEditSalaryOverride(true);
  }

  async function submitEditSalaryOverride() {
    clearFeedback();

    if (!editingSalaryOverrideId) {
      setErrorText('Salary structure override selection is required.');
      return;
    }

    await updateSalaryOverrideMut.mutateAsync({
      salaryStructureOverrideId: editingSalaryOverrideId,
      payload: {
        ...editSalaryOverrideForm,
        notes: editSalaryOverrideForm.notes?.trim() || null,
      },
    });
  }

  async function removeSalaryOverride(item: PayrollSalaryStructureOverrideDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete override for "${item.payElementCode} - ${item.payElementName}"?`
    );

    if (!confirmed) return;

    await deleteSalaryOverrideMut.mutateAsync(item.id);
  }

  function beginEditPayElement(element: PayrollPayElementDto) {
    clearFeedback();
    setEditingPayElementId(element.id);
    setEditingPayElementCode(element.code);
    setEditPayElementForm({
      name: element.name,
      elementKind: element.elementKind,
      calculationMode: element.calculationMode,
      defaultAmount: Number(element.defaultAmount || 0),
      defaultRate: Number(element.defaultRate || 0),
      ledgerAccountId: element.ledgerAccountId,
      isTaxable: element.isTaxable,
      isActive: element.isActive,
      description: element.description || '',
    });
    setShowEditPayElement(true);
  }

  async function submitEditPayElement() {
    clearFeedback();

    if (!editingPayElementId) {
      setErrorText('Pay element selection is required.');
      return;
    }

    if (!editPayElementForm.name.trim()) {
      setErrorText('Pay element name is required.');
      return;
    }

    if (!editPayElementForm.ledgerAccountId) {
      setErrorText('Ledger account is required for pay element posting setup.');
      return;
    }

    await updatePayElementMut.mutateAsync({
      payElementId: editingPayElementId,
      payload: {
        ...editPayElementForm,
        name: editPayElementForm.name.trim(),
        description: editPayElementForm.description?.trim() || null,
      },
    });
  }

  async function removePayElement(element: PayrollPayElementDto) {
    clearFeedback();

    const confirmed = window.confirm(`Delete pay element "${element.code} - ${element.name}"?`);

    if (!confirmed) return;

    await deletePayElementMut.mutateAsync(element.id);
  }

  function beginEditSalaryStructure(structure: PayrollSalaryStructureDto) {
    clearFeedback();
    setEditingSalaryStructureId(structure.id);
    setEditSalaryStructureForm({
      employeeId: structure.employeeId,
      payGroupId: structure.payGroupId,
      basicSalary: Number(structure.basicSalary || 0),
      currencyCode: structure.currencyCode || 'NGN',
      effectiveFromUtc: structure.effectiveFromUtc,
      isActive: structure.isActive,
      notes: structure.notes || '',
    });
    setShowEditSalaryStructure(true);
  }

  async function submitEditSalaryStructure() {
    clearFeedback();

    if (!editingSalaryStructureId) {
      setErrorText('Salary structure selection is required.');
      return;
    }

    if (!editSalaryStructureForm.employeeId || !editSalaryStructureForm.payGroupId) {
      setErrorText('Employee and pay group are required.');
      return;
    }

    if (editSalaryStructureForm.basicSalary < 0) {
      setErrorText('Basic salary cannot be negative.');
      return;
    }

    await updateSalaryMut.mutateAsync({
      salaryStructureId: editingSalaryStructureId,
      payload: {
        ...editSalaryStructureForm,
        currencyCode: (editSalaryStructureForm.currencyCode || 'NGN').trim() || 'NGN',
        notes: editSalaryStructureForm.notes?.trim() || null,
      },
    });
  }

  async function removeSalaryStructure(structure: PayrollSalaryStructureDto) {
    clearFeedback();

    const confirmed = window.confirm(
      `Delete salary structure for "${structure.employeeNumber} - ${structure.employeeName}"?`
    );

    if (!confirmed) return;

    await deleteSalaryMut.mutateAsync(structure.id);
  }

  if (!canView) return <div className="panel error-panel">You do not have access to Payroll Setup.</div>;
  if (employeesQ.isLoading || payGroupsQ.isLoading || payElementsQ.isLoading || salaryQ.isLoading || accountsQ.isLoading) {
    return <div className="panel">Loading Payroll setup...</div>;
  }
  if (employeesQ.isError || payGroupsQ.isError || payElementsQ.isError || salaryQ.isError || accountsQ.isError) {
    return <div className="panel error-panel">Unable to load Payroll setup.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Payroll Setup</h2>
        <div className="muted">Configure pay groups, pay elements, salary structures, pay-group composition, salary overrides, and GL mapping.</div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Payroll Policy & Regulatory Controls</h3>
          <div className="muted">Set the minimum take-home rule below which additional employee deductions will be skipped during payroll run generation. Percentage-based enforcement uses Gross Pay, which is the correct regulatory basis here.</div>
          <div className="form-grid three">
            <div className="form-row">
              <label>Enforce Minimum Take-Home</label>
              <select className="input" value={payrollPolicyForm.enforceMinimumTakeHome ? 'yes' : 'no'} onChange={(e) => setPayrollPolicyForm({ ...payrollPolicyForm, enforceMinimumTakeHome: e.target.value === 'yes' })}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div className="form-row">
              <label>Rule Type</label>
              <select className="input" value={payrollPolicyForm.minimumTakeHomeRuleType} onChange={(e) => setPayrollPolicyForm({ ...payrollPolicyForm, minimumTakeHomeRuleType: e.target.value as 'fixed_amount' | 'gross_percentage' })}>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="gross_percentage">Percentage of Gross Pay</option>
              </select>
            </div>
            <div className="form-row">
              <label>{payrollPolicyForm.minimumTakeHomeRuleType === 'gross_percentage' ? 'Minimum Gross % Take-Home' : 'Minimum Take-Home Amount'}</label>
              <input
                className="input"
                type="number"
                value={payrollPolicyForm.minimumTakeHomeRuleType === 'gross_percentage' ? payrollPolicyForm.minimumTakeHomePercent : payrollPolicyForm.minimumTakeHomeAmount}
                onChange={(e) =>
                  setPayrollPolicyForm({
                    ...payrollPolicyForm,
                    minimumTakeHomeAmount: payrollPolicyForm.minimumTakeHomeRuleType === 'fixed_amount' ? Number(e.target.value) : payrollPolicyForm.minimumTakeHomeAmount,
                    minimumTakeHomePercent: payrollPolicyForm.minimumTakeHomeRuleType === 'gross_percentage' ? Number(e.target.value) : payrollPolicyForm.minimumTakeHomePercent,
                  })
                }
              />
            </div>
            <div className="form-row">
              <label>Currency</label>
              <input className="input" value={payrollPolicyForm.currencyCode} onChange={(e) => setPayrollPolicyForm({ ...payrollPolicyForm, currencyCode: e.target.value })} />
            </div>
          </div>
          <div className="inline-actions">
            <button
              className="button primary"
              type="button"
              onClick={() =>
                savePayrollPolicyMut.mutate({
                  ...payrollPolicyForm,
                  minimumTakeHomeAmount: payrollPolicyForm.minimumTakeHomeRuleType === 'fixed_amount' ? payrollPolicyForm.minimumTakeHomeAmount : 0,
                  minimumTakeHomePercent: payrollPolicyForm.minimumTakeHomeRuleType === 'gross_percentage' ? payrollPolicyForm.minimumTakeHomePercent : 0,
                  currencyCode: payrollPolicyForm.currencyCode.trim() || 'NGN',
                })
              }
              disabled={savePayrollPolicyMut.isPending}
            >
              {savePayrollPolicyMut.isPending ? 'Saving…' : 'Save Payroll Policy'}
            </button>
            {payrollPolicyQ.data ? (
              <span className="muted">
                Current policy: {(payrollPolicyQ.data as PayrollPolicySettingDto).enforceMinimumTakeHome
                  ? ((payrollPolicyQ.data as PayrollPolicySettingDto).minimumTakeHomeRuleType === 'gross_percentage'
                      ? `Minimum ${formatAmount((payrollPolicyQ.data as PayrollPolicySettingDto).minimumTakeHomePercent)}% of Gross Pay`
                      : `Minimum ${(payrollPolicyQ.data as PayrollPolicySettingDto).currencyCode} ${formatAmount((payrollPolicyQ.data as PayrollPolicySettingDto).minimumTakeHomeAmount)}`)
                  : 'Not enforced'}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="panel">
          <h3>Pay Groups</h3>
          <div className="form-grid three">
            <div className="form-row"><label>Code</label><input className="input" value={payGroupForm.code} onChange={(e) => setPayGroupForm({ ...payGroupForm, code: e.target.value })} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={payGroupForm.name} onChange={(e) => setPayGroupForm({ ...payGroupForm, name: e.target.value })} /></div>
            <div className="form-row"><label>Description</label><input className="input" value={payGroupForm.description} onChange={(e) => setPayGroupForm({ ...payGroupForm, description: e.target.value })} /></div>
          </div>
          <button className="button" type="button" onClick={() => createPayGroupMut.mutate({ ...payGroupForm, description: payGroupForm.description || null })} disabled={createPayGroupMut.isPending}>
            {createPayGroupMut.isPending ? 'Creating…' : 'Create Pay Group'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Pay Groups</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 220 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(payGroupsQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={canManage ? 5 : 4} className="muted">No pay groups found.</td></tr>
              ) : (
                (payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => (
                  <tr key={group.id}>
                    <td>{group.code}</td>
                    <td>{group.name}</td>
                    <td>{group.description || '—'}</td>
                    <td>{group.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginEditPayGroup(group)} disabled={updatePayGroupMut.isPending || deletePayGroupMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removePayGroup(group)} disabled={updatePayGroupMut.isPending || deletePayGroupMut.isPending}>Delete</button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Pay Elements</h3>
          <div className="muted">Element Kind: 1 = Earning, 2 = Employee Deduction, 3 = Employer Cost. Calculation Mode: 1 = Fixed Amount, 2 = Percentage.</div>
          <div className="form-grid three">
            <div className="form-row"><label>Code</label><input className="input" value={payElementForm.code} onChange={(e) => setPayElementForm({ ...payElementForm, code: e.target.value })} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={payElementForm.name} onChange={(e) => setPayElementForm({ ...payElementForm, name: e.target.value })} /></div>
            <div className="form-row"><label>Kind</label><input className="input" type="number" value={payElementForm.elementKind} onChange={(e) => setPayElementForm({ ...payElementForm, elementKind: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Mode</label><input className="input" type="number" value={payElementForm.calculationMode} onChange={(e) => setPayElementForm({ ...payElementForm, calculationMode: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Default Amount</label><input className="input" type="number" value={payElementForm.defaultAmount} onChange={(e) => setPayElementForm({ ...payElementForm, defaultAmount: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Default Rate</label><input className="input" type="number" value={payElementForm.defaultRate} onChange={(e) => setPayElementForm({ ...payElementForm, defaultRate: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Ledger Account</label><select className="input" value={payElementForm.ledgerAccountId} onChange={(e) => setPayElementForm({ ...payElementForm, ledgerAccountId: e.target.value })}><option value="">Select account</option>{postingAccounts.map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
            <div className="form-row"><label>Description</label><input className="input" value={payElementForm.description} onChange={(e) => setPayElementForm({ ...payElementForm, description: e.target.value })} /></div>
          </div>
          <button className="button" type="button" onClick={() => createPayElementMut.mutate({ ...payElementForm, description: payElementForm.description || null })} disabled={createPayElementMut.isPending}>
            {createPayElementMut.isPending ? 'Creating…' : 'Create Pay Element'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Pay Elements</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Kind</th>
                <th>Mode</th>
                <th>Default Amount</th>
                <th>Default Rate</th>
                <th>Ledger</th>
                <th>Taxable</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 220 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {(payElementsQ.data?.items ?? []).length === 0 ? (
                <tr><td colSpan={canManage ? 10 : 9} className="muted">No pay elements found.</td></tr>
              ) : (
                (payElementsQ.data?.items ?? []).map((element: PayrollPayElementDto) => (
                  <tr key={element.id}>
                    <td>{element.code}</td>
                    <td>{element.name}</td>
                    <td>{element.elementKind}</td>
                    <td>{element.calculationMode}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(element.defaultAmount)}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(element.defaultRate)}</td>
                    <td>{element.ledgerAccountCode} - {element.ledgerAccountName}</td>
                    <td>{element.isTaxable ? 'Yes' : 'No'}</td>
                    <td>{element.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginEditPayElement(element)} disabled={updatePayElementMut.isPending || deletePayElementMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removePayElement(element)} disabled={updatePayElementMut.isPending || deletePayElementMut.isPending}>Delete</button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>Pay Group Composition</h3>
            <div className="muted">Attach pay elements to a selected pay group and define sequence, overrides, and effective dates.</div>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Select Pay Group</label>
            <select
              className="input"
              value={selectedCompositionPayGroupId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedCompositionPayGroupId(value);
                setPayGroupElementForm({ ...payGroupElementForm, payGroupId: value, sequence: 1 });
              }}
            >
              <option value="">Select pay group</option>
              {(payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => (
                <option key={group.id} value={group.id}>{group.code} - {group.name}</option>
              ))}
            </select>
          </div>
        </div>

        {canManage && selectedCompositionPayGroupId ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <h4>Add Pay Element to Pay Group</h4>
            <div className="form-grid three">
              <div className="form-row">
                <label>Pay Element</label>
                <select className="input" value={payGroupElementForm.payElementId} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, payElementId: e.target.value })}>
                  <option value="">Select pay element</option>
                  {(payElementsQ.data?.items ?? []).map((element: PayrollPayElementDto) => (
                    <option key={element.id} value={element.id}>{element.code} - {element.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row"><label>Sequence</label><input className="input" type="number" value={payGroupElementForm.sequence} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, sequence: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Mandatory</label><select className="input" value={payGroupElementForm.isMandatory ? 'yes' : 'no'} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, isMandatory: e.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select></div>
              <div className="form-row"><label>Amount Override</label><input className="input" type="number" value={payGroupElementForm.amountOverride ?? ''} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, amountOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Rate Override</label><input className="input" type="number" value={payGroupElementForm.rateOverride ?? ''} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, rateOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Status</label><select className="input" value={payGroupElementForm.isActive ? 'active' : 'inactive'} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Effective From</label><input className="input" type="date" value={toDateInputValue(payGroupElementForm.effectiveFromUtc)} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, effectiveFromUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
              <div className="form-row"><label>Effective To</label><input className="input" type="date" value={toDateInputValue(payGroupElementForm.effectiveToUtc)} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, effectiveToUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
            </div>
            <div className="form-row"><label>Notes</label><input className="input" value={payGroupElementForm.notes || ''} onChange={(e) => setPayGroupElementForm({ ...payGroupElementForm, notes: e.target.value })} /></div>
            <button className="button primary" type="button" onClick={() => createPayGroupElementMut.mutate({ ...payGroupElementForm, payGroupId: selectedCompositionPayGroupId, notes: payGroupElementForm.notes?.trim() || null })}>
              Add to Pay Group
            </button>
          </div>
        ) : null}

        {selectedCompositionPayGroupId ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Element</th>
                  <th>Kind</th>
                  <th>Mode</th>
                  <th>Default</th>
                  <th>Override</th>
                  <th>Mandatory</th>
                  <th>Status</th>
                  <th>Effective</th>
                  {canManage ? <th style={{ width: 180 }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {(payGroupElementsQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={canManage ? 10 : 9} className="muted">No pay elements attached to this pay group yet.</td></tr>
                ) : (
                  (payGroupElementsQ.data?.items ?? []).map((item: PayrollPayGroupElementDto) => (
                    <tr key={item.id}>
                      <td>{item.sequence}</td>
                      <td>{item.payElementCode} - {item.payElementName}</td>
                      <td>{item.elementKind}</td>
                      <td>{item.calculationMode}</td>
                      <td>{item.calculationMode === 1 ? formatAmount(item.defaultAmount) : `${item.defaultRate}%`}</td>
                      <td>{item.amountOverride != null ? formatAmount(item.amountOverride) : item.rateOverride != null ? `${item.rateOverride}%` : '—'}</td>
                      <td>{item.isMandatory ? 'Yes' : 'No'}</td>
                      <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                      <td>{[toDateInputValue(item.effectiveFromUtc), toDateInputValue(item.effectiveToUtc)].filter(Boolean).join(' → ') || 'Open'}</td>
                      {canManage ? (
                        <td>
                          <div className="inline-actions">
                            <button className="button" type="button" onClick={() => beginEditPayGroupElement(item)}>Edit</button>
                            <button className="button" type="button" onClick={() => removePayGroupElement(item)}>Delete</button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>Select a pay group to manage its composition.</div>
        )}
      </section>

      {canManage ? (
        <section className="panel">
          <h3>Salary Structure</h3>
          <div className="muted">Pick one or many employees, then apply the same pay group and salary setup to all selected employees at once.</div>
          <div className="form-grid three">
            <div className="form-row">
              <label>Employee Search</label>
              <input
                className="input"
                value={salaryEmployeeSearch}
                onChange={(e) => setSalaryEmployeeSearch(e.target.value)}
                placeholder="Search by employee no., name, department, or job title"
              />
            </div>
            <div className="form-row"><label>Pay Group</label><select className="input" value={salaryForm.payGroupId} onChange={(e) => setSalaryForm({ ...salaryForm, payGroupId: e.target.value })}><option value="">Select pay group</option>{(payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => <option key={group.id} value={group.id}>{group.code} - {group.name}</option>)}</select></div>
            <div className="form-row"><label>Basic Salary</label><input className="input" type="number" value={salaryForm.basicSalary} onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: Number(e.target.value) })} /></div>
            <div className="form-row"><label>Currency</label><input className="input" value={salaryForm.currencyCode} onChange={(e) => setSalaryForm({ ...salaryForm, currencyCode: e.target.value })} /></div>
            <div className="form-row"><label>Effective From</label><input className="input" type="date" value={salaryForm.effectiveFrom} onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })} /></div>
            <div className="form-row"><label>Selected Employees</label><div className="input" style={{ minHeight: 42, display: 'flex', alignItems: 'center' }}>{salaryForm.employeeIds.length} selected</div></div>
          </div>
          <div className="form-row">
            <label>Employee Multi-select</label>
            <div className="inline-actions" style={{ marginBottom: 8 }}>
              <button className="button" type="button" onClick={selectAllFilteredSalaryEmployees}>Select All Filtered</button>
              <button className="button" type="button" onClick={clearSalaryEmployeeSelection}>Clear Selection</button>
            </div>
            <div className="panel" style={{ maxHeight: 260, overflowY: 'auto', padding: 12 }}>
              {filteredSalaryEmployees.length === 0 ? (
                <div className="muted">No employees match your search.</div>
              ) : (
                filteredSalaryEmployees.map((employee: PayrollEmployeeDto) => (
                  <label key={employee.id} className="checkbox-row" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
                    <input
                      type="checkbox"
                      checked={salaryForm.employeeIds.includes(employee.id)}
                      onChange={() => toggleSalaryEmployee(employee.id)}
                    />
                    <span>
                      <strong>{employee.employeeNumber} - {employee.displayName}</strong>
                      <br />
                      <span className="muted">{employee.department || '—'} / {employee.jobTitle || '—'}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="form-row"><label>Notes</label><textarea className="input" value={salaryForm.notes} onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })} /></div>
          <button className="button" type="button" onClick={createSalaryStructuresForSelectedEmployees} disabled={createSalaryMut.isPending}>
            {createSalaryMut.isPending ? 'Creating…' : 'Create Salary Structure(s)'}
          </button>
        </section>
      ) : null}

      <section className="panel">
        <h3>Salary Structures</h3>
        <div className="form-row" style={{ marginBottom: 12 }}>
          <label>Search Salary Structures</label>
          <input
            className="input"
            value={salaryStructureSearch}
            onChange={(e) => setSalaryStructureSearch(e.target.value)}
            placeholder="Search by employee, pay group, or currency"
          />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Pay Group</th>
                <th>Basic Salary</th>
                <th>Currency</th>
                <th>Effective From</th>
                <th>Status</th>
                {canManage ? <th style={{ width: 220 }}>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredSalaryStructures.length === 0 ? (
                <tr><td colSpan={canManage ? 7 : 6} className="muted">No salary structures found.</td></tr>
              ) : (
                filteredSalaryStructures.map((structure: PayrollSalaryStructureDto) => (
                  <tr key={structure.id}>
                    <td>{structure.employeeNumber} - {structure.employeeName}</td>
                    <td>{structure.payGroupCode} - {structure.payGroupName}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(structure.basicSalary)}</td>
                    <td>{structure.currencyCode}</td>
                    <td>{toDateInputValue(structure.effectiveFromUtc)}</td>
                    <td>{structure.isActive ? 'Active' : 'Inactive'}</td>
                    {canManage ? (
                      <td>
                        <div className="inline-actions">
                          <button className="button" type="button" onClick={() => beginEditSalaryStructure(structure)} disabled={updateSalaryMut.isPending || deleteSalaryMut.isPending}>Edit</button>
                          <button className="button" type="button" onClick={() => removeSalaryStructure(structure)} disabled={updateSalaryMut.isPending || deleteSalaryMut.isPending}>Delete</button>
                          <button
                            className="button"
                            type="button"
                            onClick={() => {
                              setSelectedOverrideSalaryStructureId(structure.id);
                              setSalaryOverrideForm({ ...salaryOverrideForm, payrollSalaryStructureId: structure.id });
                            }}
                            disabled={updateSalaryMut.isPending || deleteSalaryMut.isPending}
                          >
                            Overrides
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h3>Salary Structure Overrides</h3>
            <div className="muted">Set employee-specific pay element overrides or exclusions on a selected salary structure.</div>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Select Salary Structure</label>
            <select
              className="input"
              value={selectedOverrideSalaryStructureId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedOverrideSalaryStructureId(value);
                setSalaryOverrideForm({ ...salaryOverrideForm, payrollSalaryStructureId: value });
              }}
            >
              <option value="">Select salary structure</option>
              {filteredSalaryStructures.map((structure: PayrollSalaryStructureDto) => (
                <option key={structure.id} value={structure.id}>
                  {structure.employeeNumber} - {structure.employeeName} / {structure.payGroupCode} - {structure.payGroupName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canManage && selectedOverrideSalaryStructureId ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <h4>Add Salary Structure Override</h4>
            <div className="form-grid three">
              <div className="form-row">
                <label>Pay Element</label>
                <select className="input" value={salaryOverrideForm.payElementId} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, payElementId: e.target.value })}>
                  <option value="">Select pay element</option>
                  {(payElementsQ.data?.items ?? []).map((element: PayrollPayElementDto) => (
                    <option key={element.id} value={element.id}>{element.code} - {element.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row"><label>Amount Override</label><input className="input" type="number" value={salaryOverrideForm.amountOverride ?? ''} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, amountOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Rate Override</label><input className="input" type="number" value={salaryOverrideForm.rateOverride ?? ''} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, rateOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Excluded</label><select className="input" value={salaryOverrideForm.isExcluded ? 'yes' : 'no'} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, isExcluded: e.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></select></div>
              <div className="form-row"><label>Status</label><select className="input" value={salaryOverrideForm.isActive ? 'active' : 'inactive'} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Effective From</label><input className="input" type="date" value={toDateInputValue(salaryOverrideForm.effectiveFromUtc)} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, effectiveFromUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
              <div className="form-row"><label>Effective To</label><input className="input" type="date" value={toDateInputValue(salaryOverrideForm.effectiveToUtc)} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, effectiveToUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
            </div>
            <div className="form-row"><label>Notes</label><input className="input" value={salaryOverrideForm.notes || ''} onChange={(e) => setSalaryOverrideForm({ ...salaryOverrideForm, notes: e.target.value })} /></div>
            <button
              className="button primary"
              type="button"
              onClick={() =>
                createSalaryOverrideMut.mutate({
                  ...salaryOverrideForm,
                  payrollSalaryStructureId: selectedOverrideSalaryStructureId,
                  notes: salaryOverrideForm.notes?.trim() || null,
                })
              }
            >
              Add Override
            </button>
          </div>
        ) : null}

        {selectedOverrideSalaryStructureId ? (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Element</th>
                  <th>Default</th>
                  <th>Override</th>
                  <th>Excluded</th>
                  <th>Status</th>
                  <th>Effective</th>
                  {canManage ? <th style={{ width: 180 }}>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {(salaryOverridesQ.data?.items ?? []).length === 0 ? (
                  <tr><td colSpan={canManage ? 7 : 6} className="muted">No salary structure overrides found.</td></tr>
                ) : (
                  (salaryOverridesQ.data?.items ?? []).map((item: PayrollSalaryStructureOverrideDto) => (
                    <tr key={item.id}>
                      <td>{item.payElementCode} - {item.payElementName}</td>
                      <td>{item.calculationMode === 1 ? formatAmount(item.defaultAmount) : `${item.defaultRate}%`}</td>
                      <td>{item.amountOverride != null ? formatAmount(item.amountOverride) : item.rateOverride != null ? `${item.rateOverride}%` : '—'}</td>
                      <td>{item.isExcluded ? 'Yes' : 'No'}</td>
                      <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                      <td>{[toDateInputValue(item.effectiveFromUtc), toDateInputValue(item.effectiveToUtc)].filter(Boolean).join(' → ') || 'Open'}</td>
                      {canManage ? (
                        <td>
                          <div className="inline-actions">
                            <button className="button" type="button" onClick={() => beginEditSalaryOverride(item)}>Edit</button>
                            <button className="button" type="button" onClick={() => removeSalaryOverride(item)}>Delete</button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted" style={{ marginTop: 12 }}>Select a salary structure to manage employee-specific overrides.</div>
        )}
      </section>

      {showEditPayGroup ? (
        <div className="modal-backdrop" onMouseDown={() => !updatePayGroupMut.isPending && setShowEditPayGroup(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pay Group</h2>
              <button className="button ghost" onClick={() => !updatePayGroupMut.isPending && setShowEditPayGroup(false)} aria-label="Close">✕</button>
            </div>
            {errorText ? <div className="error-panel">{errorText}</div> : null}
            <div className="form-grid two">
              <div className="form-row"><label>Name</label><input className="input" value={editPayGroupForm.name} onChange={(e) => setEditPayGroupForm({ ...editPayGroupForm, name: e.target.value })} /></div>
              <div className="form-row"><label>Status</label><select className="input" value={editPayGroupForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditPayGroupForm({ ...editPayGroupForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="form-row"><label>Description</label><input className="input" value={editPayGroupForm.description || ''} onChange={(e) => setEditPayGroupForm({ ...editPayGroupForm, description: e.target.value })} /></div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditPayGroup(false)} disabled={updatePayGroupMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditPayGroup} disabled={updatePayGroupMut.isPending}>{updatePayGroupMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditPayElement ? (
        <div className="modal-backdrop" onMouseDown={() => !updatePayElementMut.isPending && setShowEditPayElement(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Pay Element</h2>
              <button className="button ghost" onClick={() => !updatePayElementMut.isPending && setShowEditPayElement(false)} aria-label="Close">✕</button>
            </div>
            {errorText ? <div className="error-panel">{errorText}</div> : null}
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="muted">Code: {editingPayElementCode}</div>
            </div>
            <div className="form-grid three">
              <div className="form-row"><label>Name</label><input className="input" value={editPayElementForm.name} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, name: e.target.value })} /></div>
              <div className="form-row"><label>Kind</label><input className="input" type="number" value={editPayElementForm.elementKind} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, elementKind: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Mode</label><input className="input" type="number" value={editPayElementForm.calculationMode} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, calculationMode: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Default Amount</label><input className="input" type="number" value={editPayElementForm.defaultAmount} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, defaultAmount: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Default Rate</label><input className="input" type="number" value={editPayElementForm.defaultRate} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, defaultRate: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Ledger Account</label><select className="input" value={editPayElementForm.ledgerAccountId} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, ledgerAccountId: e.target.value })}><option value="">Select account</option>{postingAccounts.map((account: any) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}</select></div>
              <div className="form-row"><label>Taxable</label><select className="input" value={editPayElementForm.isTaxable ? 'yes' : 'no'} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, isTaxable: e.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select></div>
              <div className="form-row"><label>Status</label><select className="input" value={editPayElementForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Description</label><input className="input" value={editPayElementForm.description || ''} onChange={(e) => setEditPayElementForm({ ...editPayElementForm, description: e.target.value })} /></div>
            </div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditPayElement(false)} disabled={updatePayElementMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditPayElement} disabled={updatePayElementMut.isPending}>{updatePayElementMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showEditPayGroupElement ? (
        <div className="modal-backdrop" onMouseDown={() => !updatePayGroupElementMut.isPending && setShowEditPayGroupElement(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Edit Pay Group Composition Item</h2><button className="button ghost" onClick={() => !updatePayGroupElementMut.isPending && setShowEditPayGroupElement(false)} aria-label="Close">✕</button></div>
            <div className="form-grid three">
              <div className="form-row"><label>Sequence</label><input className="input" type="number" value={editPayGroupElementForm.sequence} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, sequence: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Amount Override</label><input className="input" type="number" value={editPayGroupElementForm.amountOverride ?? ''} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, amountOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Rate Override</label><input className="input" type="number" value={editPayGroupElementForm.rateOverride ?? ''} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, rateOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Mandatory</label><select className="input" value={editPayGroupElementForm.isMandatory ? 'yes' : 'no'} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, isMandatory: e.target.value === 'yes' })}><option value="yes">Yes</option><option value="no">No</option></select></div>
              <div className="form-row"><label>Status</label><select className="input" value={editPayGroupElementForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Effective From</label><input className="input" type="date" value={toDateInputValue(editPayGroupElementForm.effectiveFromUtc)} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, effectiveFromUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
              <div className="form-row"><label>Effective To</label><input className="input" type="date" value={toDateInputValue(editPayGroupElementForm.effectiveToUtc)} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, effectiveToUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
            </div>
            <div className="form-row"><label>Notes</label><input className="input" value={editPayGroupElementForm.notes || ''} onChange={(e) => setEditPayGroupElementForm({ ...editPayGroupElementForm, notes: e.target.value })} /></div>
            <div className="modal-footer"><button className="button" type="button" onClick={() => setShowEditPayGroupElement(false)}>Cancel</button><button className="button primary" type="button" onClick={submitEditPayGroupElement}>Save Changes</button></div>
          </div>
        </div>
      ) : null}

      {showEditSalaryOverride ? (
        <div className="modal-backdrop" onMouseDown={() => !updateSalaryOverrideMut.isPending && setShowEditSalaryOverride(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Edit Salary Structure Override</h2><button className="button ghost" onClick={() => !updateSalaryOverrideMut.isPending && setShowEditSalaryOverride(false)} aria-label="Close">✕</button></div>
            <div className="form-grid three">
              <div className="form-row"><label>Amount Override</label><input className="input" type="number" value={editSalaryOverrideForm.amountOverride ?? ''} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, amountOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Rate Override</label><input className="input" type="number" value={editSalaryOverrideForm.rateOverride ?? ''} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, rateOverride: e.target.value === '' ? null : Number(e.target.value) })} /></div>
              <div className="form-row"><label>Excluded</label><select className="input" value={editSalaryOverrideForm.isExcluded ? 'yes' : 'no'} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, isExcluded: e.target.value === 'yes' })}><option value="no">No</option><option value="yes">Yes</option></select></div>
              <div className="form-row"><label>Status</label><select className="input" value={editSalaryOverrideForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              <div className="form-row"><label>Effective From</label><input className="input" type="date" value={toDateInputValue(editSalaryOverrideForm.effectiveFromUtc)} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, effectiveFromUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
              <div className="form-row"><label>Effective To</label><input className="input" type="date" value={toDateInputValue(editSalaryOverrideForm.effectiveToUtc)} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, effectiveToUtc: e.target.value ? dateInputToUtc(e.target.value) : null })} /></div>
            </div>
            <div className="form-row"><label>Notes</label><input className="input" value={editSalaryOverrideForm.notes || ''} onChange={(e) => setEditSalaryOverrideForm({ ...editSalaryOverrideForm, notes: e.target.value })} /></div>
            <div className="modal-footer"><button className="button" type="button" onClick={() => setShowEditSalaryOverride(false)}>Cancel</button><button className="button primary" type="button" onClick={submitEditSalaryOverride}>Save Changes</button></div>
          </div>
        </div>
      ) : null}

      {showEditSalaryStructure ? (
        <div className="modal-backdrop" onMouseDown={() => !updateSalaryMut.isPending && setShowEditSalaryStructure(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Salary Structure</h2>
              <button className="button ghost" onClick={() => !updateSalaryMut.isPending && setShowEditSalaryStructure(false)} aria-label="Close">✕</button>
            </div>
            {errorText ? <div className="error-panel">{errorText}</div> : null}
            <div className="form-grid two">
              <div className="form-row"><label>Employee</label><select className="input" value={editSalaryStructureForm.employeeId} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, employeeId: e.target.value })}><option value="">Select employee</option>{(employeesQ.data?.items ?? []).map((employee: PayrollEmployeeDto) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} - {employee.displayName}</option>)}</select></div>
              <div className="form-row"><label>Pay Group</label><select className="input" value={editSalaryStructureForm.payGroupId} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, payGroupId: e.target.value })}><option value="">Select pay group</option>{(payGroupsQ.data?.items ?? []).map((group: PayrollPayGroupDto) => <option key={group.id} value={group.id}>{group.code} - {group.name}</option>)}</select></div>
              <div className="form-row"><label>Basic Salary</label><input className="input" type="number" value={editSalaryStructureForm.basicSalary} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, basicSalary: Number(e.target.value) })} /></div>
              <div className="form-row"><label>Currency</label><input className="input" value={editSalaryStructureForm.currencyCode} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, currencyCode: e.target.value })} /></div>
              <div className="form-row"><label>Effective From</label><input className="input" type="date" value={toDateInputValue(editSalaryStructureForm.effectiveFromUtc)} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, effectiveFromUtc: dateInputToUtc(e.target.value) })} /></div>
              <div className="form-row"><label>Status</label><select className="input" value={editSalaryStructureForm.isActive ? 'active' : 'inactive'} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, isActive: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="form-row"><label>Notes</label><textarea className="input" value={editSalaryStructureForm.notes || ''} onChange={(e) => setEditSalaryStructureForm({ ...editSalaryStructureForm, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={() => setShowEditSalaryStructure(false)} disabled={updateSalaryMut.isPending}>Cancel</button>
              <button className="button primary" type="button" onClick={submitEditSalaryStructure} disabled={updateSalaryMut.isPending}>{updateSalaryMut.isPending ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
