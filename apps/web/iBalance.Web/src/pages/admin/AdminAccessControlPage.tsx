import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAccessBranch,
  createAccessCostCenter,
  createAccessDepartment,
  createDepartmentWorkflowPolicy,
  createSecurityPermission,
  createSecurityRole,
  getAccessBranches,
  getAccessCostCenters,
  getAccessDepartments,
  getDepartmentWorkflowPolicies,
  getSecurityPermissions,
  getSecurityRoles,
  getTenantReadableError,
  getUserAccessAssignments,
  seedDefaultAccessControl,
  setSecurityRolePermissions,
  setUserAccessAssignments,
} from '../../lib/api';
import { canManageEnterpriseAccessControl, isPlatformAdmin } from '../../lib/auth';

const emptyRoleForm = { code: '', name: '', description: '', isActive: true };
const emptyPermissionForm = { code: '', module: '', action: '', name: '', description: '', isActive: true };
const emptyScopeForm = { code: '', name: '', description: '', isActive: true };
const emptyPolicyForm = {
  moduleCode: 'finance',
  organizationDepartmentId: '',
  makerCheckerRequired: true,
  enforceSegregationOfDuties: true,
  minimumApproverCount: 1,
  notes: '',
  isActive: true,
};

export function AdminAccessControlPage() {
  const qc = useQueryClient();
  const allowed = canManageEnterpriseAccessControl();
  const platformAdmin = isPlatformAdmin();

  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [permissionForm, setPermissionForm] = useState(emptyPermissionForm);
  const [departmentForm, setDepartmentForm] = useState(emptyScopeForm);
  const [branchForm, setBranchForm] = useState(emptyScopeForm);
  const [costCenterForm, setCostCenterForm] = useState(emptyScopeForm);
  const [policyForm, setPolicyForm] = useState(emptyPolicyForm);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedRolePermissionIds, setSelectedRolePermissionIds] = useState<string[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserRoleIds, setSelectedUserRoleIds] = useState<string[]>([]);
  const [selectedDepartmentScopeIds, setSelectedDepartmentScopeIds] = useState<string[]>([]);
  const [selectedBranchScopeIds, setSelectedBranchScopeIds] = useState<string[]>([]);
  const [selectedCostCenterScopeIds, setSelectedCostCenterScopeIds] = useState<string[]>([]);

  const rolesQ = useQuery({ queryKey: ['security-roles'], queryFn: getSecurityRoles, enabled: allowed });
  const permissionsQ = useQuery({ queryKey: ['security-permissions'], queryFn: getSecurityPermissions, enabled: allowed });
  const departmentsQ = useQuery({ queryKey: ['access-departments'], queryFn: getAccessDepartments, enabled: allowed });
  const branchesQ = useQuery({ queryKey: ['access-branches'], queryFn: getAccessBranches, enabled: allowed });
  const costCentersQ = useQuery({ queryKey: ['access-cost-centers'], queryFn: getAccessCostCenters, enabled: allowed });
  const userAssignmentsQ = useQuery({ queryKey: ['user-access-assignments'], queryFn: getUserAccessAssignments, enabled: allowed });
  const workflowPoliciesQ = useQuery({ queryKey: ['department-workflow-policies'], queryFn: getDepartmentWorkflowPolicies, enabled: allowed });

  const seedDefaultsMut = useMutation({
    mutationFn: seedDefaultAccessControl,
    onSuccess: async (data: any) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['security-roles'] }),
        qc.invalidateQueries({ queryKey: ['security-permissions'] }),
      ]);
      setMessage(data?.message || data?.Message || 'Default access control seeded successfully.');
      setErrorText('');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to seed default access control.'));
      setMessage('');
    },
  });

  const simpleSuccess = async (key: string, text: string, reset?: () => void) => {
    await qc.invalidateQueries({ queryKey: [key] });
    reset?.();
    setMessage(text);
    setErrorText('');
  };

  const createRoleMut = useMutation({
    mutationFn: createSecurityRole,
    onSuccess: async () => simpleSuccess('security-roles', 'Role created successfully.', () => setRoleForm(emptyRoleForm)),
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create role.'));
      setMessage('');
    },
  });

  const createPermissionMut = useMutation({
    mutationFn: createSecurityPermission,
    onSuccess: async () => simpleSuccess('security-permissions', 'Permission created successfully.', () => setPermissionForm(emptyPermissionForm)),
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create permission.'));
      setMessage('');
    },
  });

  const createDepartmentMut = useMutation({
    mutationFn: createAccessDepartment,
    onSuccess: async () => simpleSuccess('access-departments', 'Department created successfully.', () => setDepartmentForm(emptyScopeForm)),
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create department.'));
      setMessage('');
    },
  });

  const createBranchMut = useMutation({
    mutationFn: createAccessBranch,
    onSuccess: async () => simpleSuccess('access-branches', 'Branch created successfully.', () => setBranchForm(emptyScopeForm)),
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create branch.'));
      setMessage('');
    },
  });

  const createCostCenterMut = useMutation({
    mutationFn: createAccessCostCenter,
    onSuccess: async () => simpleSuccess('access-cost-centers', 'Cost center created successfully.', () => setCostCenterForm(emptyScopeForm)),
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create cost center.'));
      setMessage('');
    },
  });

  const setRolePermissionsMut = useMutation({
    mutationFn: () => setSecurityRolePermissions(selectedRoleId, selectedRolePermissionIds),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['security-roles'] });
      setMessage('Role permissions updated successfully.');
      setErrorText('');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update role permissions.'));
      setMessage('');
    },
  });

  const setUserAssignmentsMut = useMutation({
    mutationFn: () =>
      setUserAccessAssignments(selectedUserId, {
        roleIds: selectedUserRoleIds,
        scopes: [
          ...selectedDepartmentScopeIds.map((id) => {
            const item = departmentsQ.data?.items.find((value: any) => value.id === id);
            return { scopeType: 'department', scopeEntityId: id, scopeCode: item?.code || null, scopeName: item?.name || null };
          }),
          ...selectedBranchScopeIds.map((id) => {
            const item = branchesQ.data?.items.find((value: any) => value.id === id);
            return { scopeType: 'branch', scopeEntityId: id, scopeCode: item?.code || null, scopeName: item?.name || null };
          }),
          ...selectedCostCenterScopeIds.map((id) => {
            const item = costCentersQ.data?.items.find((value: any) => value.id === id);
            return { scopeType: 'cost-center', scopeEntityId: id, scopeCode: item?.code || null, scopeName: item?.name || null };
          }),
        ],
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['user-access-assignments'] });
      setMessage('User access assignments updated successfully.');
      setErrorText('');
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update user access assignments.'));
      setMessage('');
    },
  });

  const createPolicyMut = useMutation({
    mutationFn: createDepartmentWorkflowPolicy,
    onSuccess: async () =>
      simpleSuccess('department-workflow-policies', 'Department workflow policy created successfully.', () => setPolicyForm(emptyPolicyForm)),
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create workflow policy.'));
      setMessage('');
    },
  });

  const roles = rolesQ.data?.items ?? [];
  const permissions = permissionsQ.data?.items ?? [];
  const users = userAssignmentsQ.data?.items ?? [];
  const departments = departmentsQ.data?.items ?? [];
  const branches = branchesQ.data?.items ?? [];
  const costCenters = costCentersQ.data?.items ?? [];

  const selectedRole = useMemo(
    () => roles.find((item: any) => item.id === selectedRoleId) || null,
    [roles, selectedRoleId]
  );

  const selectedUser = useMemo(
    () => users.find((item: any) => item.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const selectedRoleIsProtected = Boolean((selectedRole as any)?.isProtected);
  const selectedUserHasProtectedRole = selectedUserRoleIds.some((roleId) => {
    const role = roles.find((item: any) => item.id === roleId);
    return Boolean((role as any)?.isProtected);
  });

  function isRoleProtected(role: any) {
    return Boolean(role?.isProtected);
  }

  function toggleId(ids: string[], id: string) {
    return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
  }

  function startRolePermissionEdit(roleId: string) {
    setSelectedRoleId(roleId);
    const role = roles.find((item: any) => item.id === roleId);
    const currentPermissionIds = ((role as any)?.permissionIds ?? []) as string[];
    setSelectedRolePermissionIds([...currentPermissionIds]);
  }

  function startUserAssignmentEdit(userId: string) {
    setSelectedUserId(userId);
    const user = users.find((item: any) => item.id === userId);
    if (!user) return;

    setSelectedUserRoleIds(user.roles.map((role: any) => role.id));
    setSelectedDepartmentScopeIds(user.scopes.filter((scope: any) => scope.scopeType === 'department').map((scope: any) => scope.scopeEntityId));
    setSelectedBranchScopeIds(user.scopes.filter((scope: any) => scope.scopeType === 'branch').map((scope: any) => scope.scopeEntityId));
    setSelectedCostCenterScopeIds(user.scopes.filter((scope: any) => scope.scopeType === 'cost-center').map((scope: any) => scope.scopeEntityId));
  }

  if (!allowed) {
    return <div className="panel error-panel">You do not have access to enterprise access control setup.</div>;
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Enterprise Access Control</h2>
            <div className="muted">Setup roles, permissions, user scopes, departments, branches, cost centers, and departmental maker/checker policy.</div>
          </div>
          <button className="button primary" type="button" onClick={() => seedDefaultsMut.mutate()} disabled={seedDefaultsMut.isPending}>
            {seedDefaultsMut.isPending ? 'Seeding…' : 'Seed Default Roles / Permissions'}
          </button>
        </div>
        {message ? <div className="success-panel">{message}</div> : null}
        {errorText ? <div className="error-panel">{errorText}</div> : null}
      </section>

      <section className="panel">
        <h3>Create Role</h3>
        <div className="form-grid two">
          <div className="form-row"><label>Code</label><input className="input" value={roleForm.code} onChange={(e) => setRoleForm((s) => ({ ...s, code: e.target.value }))} /></div>
          <div className="form-row"><label>Name</label><input className="input" value={roleForm.name} onChange={(e) => setRoleForm((s) => ({ ...s, name: e.target.value }))} /></div>
          <div className="form-row"><label>Description</label><input className="input" value={roleForm.description} onChange={(e) => setRoleForm((s) => ({ ...s, description: e.target.value }))} /></div>
          <div className="form-row"><label><input type="checkbox" checked={roleForm.isActive} onChange={(e) => setRoleForm((s) => ({ ...s, isActive: e.target.checked }))} /> Active</label></div>
        </div>
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button className="button primary" type="button" onClick={() => createRoleMut.mutate(roleForm)}>Create Role</button>
        </div>
      </section>

      <section className="panel">
        <h3>Create Permission</h3>
        <div className="form-grid two">
          <div className="form-row"><label>Code</label><input className="input" value={permissionForm.code} onChange={(e) => setPermissionForm((s) => ({ ...s, code: e.target.value }))} /></div>
          <div className="form-row"><label>Module</label><input className="input" value={permissionForm.module} onChange={(e) => setPermissionForm((s) => ({ ...s, module: e.target.value }))} /></div>
          <div className="form-row"><label>Action</label><input className="input" value={permissionForm.action} onChange={(e) => setPermissionForm((s) => ({ ...s, action: e.target.value }))} /></div>
          <div className="form-row"><label>Name</label><input className="input" value={permissionForm.name} onChange={(e) => setPermissionForm((s) => ({ ...s, name: e.target.value }))} /></div>
          <div className="form-row"><label>Description</label><input className="input" value={permissionForm.description} onChange={(e) => setPermissionForm((s) => ({ ...s, description: e.target.value }))} /></div>
        </div>
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button className="button primary" type="button" onClick={() => createPermissionMut.mutate(permissionForm)}>Create Permission</button>
        </div>
      </section>

      <section className="panel">
        <h3>Organization Scopes</h3>
        <div className="form-grid three">
          <div>
            <h4>Department</h4>
            <div className="form-row"><label>Code</label><input className="input" value={departmentForm.code} onChange={(e) => setDepartmentForm((s) => ({ ...s, code: e.target.value }))} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={departmentForm.name} onChange={(e) => setDepartmentForm((s) => ({ ...s, name: e.target.value }))} /></div>
            <button className="button primary" type="button" onClick={() => createDepartmentMut.mutate(departmentForm)}>Create Department</button>
          </div>
          <div>
            <h4>Branch</h4>
            <div className="form-row"><label>Code</label><input className="input" value={branchForm.code} onChange={(e) => setBranchForm((s) => ({ ...s, code: e.target.value }))} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={branchForm.name} onChange={(e) => setBranchForm((s) => ({ ...s, name: e.target.value }))} /></div>
            <button className="button primary" type="button" onClick={() => createBranchMut.mutate(branchForm)}>Create Branch</button>
          </div>
          <div>
            <h4>Cost Center</h4>
            <div className="form-row"><label>Code</label><input className="input" value={costCenterForm.code} onChange={(e) => setCostCenterForm((s) => ({ ...s, code: e.target.value }))} /></div>
            <div className="form-row"><label>Name</label><input className="input" value={costCenterForm.name} onChange={(e) => setCostCenterForm((s) => ({ ...s, name: e.target.value }))} /></div>
            <button className="button primary" type="button" onClick={() => createCostCenterMut.mutate(costCenterForm)}>Create Cost Center</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h3>Role Permission Mapping</h3>
        <div className="form-grid two">
          <div className="form-row">
            <label>Role</label>
            <select className="input" value={selectedRoleId} onChange={(e) => startRolePermissionEdit(e.target.value)}>
              <option value="">Select role</option>
              {roles.map((role: any) => (
                <option key={role.id} value={role.id}>
                  {role.name}{isRoleProtected(role) ? ' (System Protected)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="muted">
            {selectedRole
              ? selectedRoleIsProtected
                ? `${selectedRole.name} is system protected and can be viewed but not edited here.`
                : `Viewing and editing permissions for ${selectedRole.name}`
              : 'Select a role to view and edit its mapped permissions.'}
          </div>
        </div>

        {selectedRole ? (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="kv">
              <div className="kv-row"><span>Role</span><span>{(selectedRole as any).name}</span></div>
              <div className="kv-row"><span>Mapped Permissions</span><span>{selectedRolePermissionIds.length}</span></div>
              <div className="kv-row"><span>Status</span><span>{selectedRoleIsProtected ? 'System Protected' : 'Editable'}</span></div>
            </div>
          </div>
        ) : null}

        {selectedRoleIsProtected ? (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="muted">
              Platform Admin is a protected system role. Its mapped permissions are visible here, but they cannot be modified from this screen.
            </div>
          </div>
        ) : null}

        <div style={{ border: '1px solid #d7dbe7', borderRadius: 8, padding: 12, maxHeight: 320, overflowY: 'auto' }}>
          {permissions.map((permission: any) => (
            <label key={permission.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={selectedRolePermissionIds.includes(permission.id)}
                disabled={selectedRoleIsProtected}
                onChange={() => setSelectedRolePermissionIds((current) => toggleId(current, permission.id))}
              />
              <span><strong>{permission.code}</strong> — {permission.name}</span>
            </label>
          ))}
        </div>
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button
            className="button primary"
            type="button"
            onClick={() => setRolePermissionsMut.mutate()}
            disabled={!selectedRoleId || selectedRoleIsProtected}
          >
            Save Role Permissions
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>User Role / Scope Assignment</h3>
        <div className="form-grid two">
          <div className="form-row">
            <label>User</label>
            <select className="input" value={selectedUserId} onChange={(e) => startUserAssignmentEdit(e.target.value)}>
              <option value="">Select user</option>
              {users.map((user: any) => <option key={user.id} value={user.id}>{user.displayName} - {user.email}</option>)}
            </select>
          </div>
          <div className="muted">{selectedUser ? `Editing roles and scopes for ${selectedUser.displayName}` : 'Select a user to assign roles and scopes.'}</div>
        </div>

        {!platformAdmin && selectedUserHasProtectedRole ? (
          <div className="panel" style={{ marginBottom: 12 }}>
            <div className="muted">
              This user includes a protected system role. Only Platform Admin can change protected role assignments.
            </div>
          </div>
        ) : null}

        <div className="form-grid three">
          <div>
            <h4>Roles</h4>
            {roles.map((role: any) => {
              const protectedRole = isRoleProtected(role);
              const disableRoleToggle = protectedRole && !platformAdmin;

              return (
                <label key={role.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedUserRoleIds.includes(role.id)}
                    disabled={disableRoleToggle}
                    onChange={() => setSelectedUserRoleIds((current) => toggleId(current, role.id))}
                  />
                  <span>{role.name}{protectedRole ? ' (System Protected)' : ''}</span>
                </label>
              );
            })}
          </div>

          <div>
            <h4>Departments</h4>
            {departments.map((item: any) => (
              <label key={item.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={selectedDepartmentScopeIds.includes(item.id)} onChange={() => setSelectedDepartmentScopeIds((current) => toggleId(current, item.id))} />
                <span>{item.name}</span>
              </label>
            ))}
          </div>

          <div>
            <h4>Branches / Cost Centers</h4>
            <div className="muted" style={{ marginBottom: 6 }}>Branches</div>
            {branches.map((item: any) => (
              <label key={item.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={selectedBranchScopeIds.includes(item.id)} onChange={() => setSelectedBranchScopeIds((current) => toggleId(current, item.id))} />
                <span>{item.name}</span>
              </label>
            ))}
            <div className="muted" style={{ margin: '8px 0 6px' }}>Cost Centers</div>
            {costCenters.map((item: any) => (
              <label key={item.id} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 8, marginBottom: 8 }}>
                <input type="checkbox" checked={selectedCostCenterScopeIds.includes(item.id)} onChange={() => setSelectedCostCenterScopeIds((current) => toggleId(current, item.id))} />
                <span>{item.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button
            className="button primary"
            type="button"
            onClick={() => setUserAssignmentsMut.mutate()}
            disabled={!selectedUserId || (!platformAdmin && selectedUserHasProtectedRole)}
          >
            Save User Assignments
          </button>
        </div>
      </section>

      <section className="panel">
        <h3>Departmental Maker / Checker Policy</h3>
        <div className="form-grid two">
          <div className="form-row"><label>Module Code</label><input className="input" value={policyForm.moduleCode} onChange={(e) => setPolicyForm((s) => ({ ...s, moduleCode: e.target.value }))} /></div>
          <div className="form-row">
            <label>Department</label>
            <select className="input" value={policyForm.organizationDepartmentId} onChange={(e) => setPolicyForm((s) => ({ ...s, organizationDepartmentId: e.target.value }))}>
              <option value="">Select department</option>
              {departments.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <div className="form-row"><label><input type="checkbox" checked={policyForm.makerCheckerRequired} onChange={(e) => setPolicyForm((s) => ({ ...s, makerCheckerRequired: e.target.checked }))} /> Maker / Checker Required</label></div>
          <div className="form-row"><label><input type="checkbox" checked={policyForm.enforceSegregationOfDuties} onChange={(e) => setPolicyForm((s) => ({ ...s, enforceSegregationOfDuties: e.target.checked }))} /> Enforce Segregation of Duties</label></div>
          <div className="form-row"><label>Minimum Approver Count</label><input className="input" type="number" min={1} value={policyForm.minimumApproverCount} onChange={(e) => setPolicyForm((s) => ({ ...s, minimumApproverCount: Number(e.target.value || 1) }))} /></div>
          <div className="form-row"><label>Notes</label><input className="input" value={policyForm.notes || ''} onChange={(e) => setPolicyForm((s) => ({ ...s, notes: e.target.value }))} /></div>
        </div>
        <div className="inline-actions" style={{ marginTop: 12 }}>
          <button className="button primary" type="button" onClick={() => createPolicyMut.mutate(policyForm)}>Create Workflow Policy</button>
        </div>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Department</th>
                <th>Maker/Checker</th>
                <th>SOD</th>
                <th style={{ textAlign: 'right' }}>Approvers</th>
              </tr>
            </thead>
            <tbody>
              {(workflowPoliciesQ.data?.items ?? []).map((item: any) => (
                <tr key={item.id}>
                  <td>{item.moduleCode}</td>
                  <td>{item.departmentName}</td>
                  <td>{item.makerCheckerRequired ? 'Yes' : 'No'}</td>
                  <td>{item.enforceSegregationOfDuties ? 'Yes' : 'No'}</td>
                  <td style={{ textAlign: 'right' }}>{item.minimumApproverCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}