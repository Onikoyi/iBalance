import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  activateAdminUser,
  createAdminUser,
  deactivateAdminUser,
  getAdminAssignableRoles,
  getAdminUsers,
  getTenantReadableError,
  issueAdminUserPasswordReset,
  updateAdminUser,
  type AdminUserDto,
  type CreateAdminUserRequest,
  type UpdateAdminUserRequest,
} from '../../lib/api';
import {
  canEditUserRole,
  canManageEnterpriseAccessControl,
  canManageUsers,
  getAssignableRoles,
  getCurrentRole,
  isPlatformAdmin,
} from '../../lib/auth';

type Mode = 'create' | 'edit';

type UserFormState = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password: string;
  isActive: boolean;
};

const emptyForm: UserFormState = {
  email: '',
  firstName: '',
  lastName: '',
  role: 'Viewer',
  password: '',
  isActive: true,
};

function formatUtcDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const currentRole = getCurrentRole();
  const platformAdmin = isPlatformAdmin();
  const canManageAccessControl = canManageEnterpriseAccessControl();

  const [mode, setMode] = useState<Mode>('create');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [message, setMessage] = useState('');
  const [errorText, setErrorText] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [resetNotice, setResetNotice] = useState<{
    email: string;
    expiresAtUtc?: string | null;
  } | null>(null);

  const usersQ = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const rolesQ = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: getAdminAssignableRoles,
  });

  const availableRoles = useMemo(() => {
    const serverRoles = rolesQ.data?.items || [];
    const localRoles = getAssignableRoles();
    const roles = serverRoles.length > 0 ? serverRoles : localRoles;
    return roles.filter((role) => canEditUserRole(role as any));
  }, [rolesQ.data?.items]);

  const filteredUsers = useMemo(() => {
    const items = usersQ.data?.items || [];
    const searchText = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !searchText ||
        item.email.toLowerCase().includes(searchText) ||
        item.firstName.toLowerCase().includes(searchText) ||
        item.lastName.toLowerCase().includes(searchText) ||
        item.displayName.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);

      const matchesRole =
        roleFilter === 'all' ||
        item.role === roleFilter;

      if (!platformAdmin && item.role === 'PlatformAdmin') {
        return false;
      }

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [usersQ.data?.items, search, statusFilter, roleFilter, platformAdmin]);

  const createMut = useMutation({
    mutationFn: (payload: CreateAdminUserRequest) => createAdminUser(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User created successfully.');
      setErrorText('');
      setMode('create');
      setSelectedUserId('');
      setResetNotice(null);
      setForm({
        ...emptyForm,
        role: availableRoles[0] || 'Viewer',
      });
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to create user.'));
      setMessage('');
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateAdminUserRequest }) =>
      updateAdminUser(userId, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User updated successfully.');
      setErrorText('');
      setResetNotice(null);
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to update user.'));
      setMessage('');
    },
  });

  const activateMut = useMutation({
    mutationFn: (userId: string) => activateAdminUser(userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User activated successfully.');
      setErrorText('');
      setResetNotice(null);
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to activate user.'));
      setMessage('');
    },
  });

  const deactivateMut = useMutation({
    mutationFn: (userId: string) => deactivateAdminUser(userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-users'] });
      setMessage('User deactivated successfully.');
      setErrorText('');
      setResetNotice(null);
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to deactivate user.'));
      setMessage('');
    },
  });

  const passwordResetMut = useMutation({
    mutationFn: (userId: string) => issueAdminUserPasswordReset(userId),
    onSuccess: (data) => {
      setMessage(data.message || 'Password reset instructions sent successfully.');
      setErrorText('');
      setResetNotice({
        email: data.email,
        expiresAtUtc: data.expiresAtUtc || null,
      });
    },
    onError: (error) => {
      setErrorText(getTenantReadableError(error, 'Unable to send password reset instructions.'));
      setMessage('');
      setResetNotice(null);
    },
  });

  function startCreate() {
    setMode('create');
    setSelectedUserId('');
    setResetNotice(null);
    setMessage('');
    setErrorText('');
    setForm({
      ...emptyForm,
      role: availableRoles[0] || 'Viewer',
    });
  }

  function startEdit(user: AdminUserDto) {
    if (!canEditUserRole(user.role as any)) {
      setErrorText('You do not have permission to edit that user role.');
      setMessage('');
      return;
    }

    setMode('edit');
    setSelectedUserId(user.id);
    setResetNotice(null);
    setMessage('');
    setErrorText('');
    setForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      password: '',
      isActive: user.isActive,
    });
  }

  function submitForm() {
    setMessage('');
    setErrorText('');
    setResetNotice(null);

    if (!canEditUserRole(form.role as any)) {
      setErrorText('You do not have permission to assign the selected role.');
      return;
    }

    if (mode === 'create') {
      createMut.mutate({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        password: form.password,
        isActive: form.isActive,
      });
      return;
    }

    if (!selectedUserId) {
      setErrorText('Select a user to update.');
      return;
    }

    updateMut.mutate({
      userId: selectedUserId,
      payload: {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        isActive: form.isActive,
      },
    });
  }

  if (!canManageUsers()) {
    return (
      <div className="page-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>User Management</h2>
            <span className="muted">Access restricted</span>
          </div>
          <div className="muted">
            You do not have permission to manage tenant users.
          </div>
        </section>
      </div>
    );
  }

  if (usersQ.isLoading || rolesQ.isLoading) {
    return <div className="panel">Loading user management...</div>;
  }

  if (usersQ.isError || rolesQ.isError) {
    return (
      <div className="panel error-panel">
        {getTenantReadableError(usersQ.error || rolesQ.error, 'Unable to load user management at this time.')}
      </div>
    );
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-heading">
          <h2>User Management</h2>
          <span className="muted">Tenant-scoped user administration</span>
        </div>

        {message ? (
          <div className="success-panel" style={{ marginBottom: 16 }}>
            {message}
          </div>
        ) : null}

        {errorText ? (
          <div className="panel error-panel" style={{ marginBottom: 16 }}>
            {errorText}
          </div>
        ) : null}

        {resetNotice ? (
          <div className="kv" style={{ marginBottom: 16 }}>
            <div className="kv-row"><span>Password Reset</span><span>{resetNotice.email}</span></div>
            <div className="kv-row"><span>Delivery</span><span>Instructions sent by email</span></div>
            <div className="kv-row"><span>Expires</span><span>{formatUtcDate(resetNotice.expiresAtUtc)}</span></div>
          </div>
        ) : null}

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="muted">
            User creation and legacy role assignment remain here. Enterprise role-permission mapping, departmental scopes, and maker/checker setup now live in Access Control.
          </div>
          {canManageAccessControl ? (
            <div className="inline-actions" style={{ marginTop: 12 }}>
              <Link to="/admin/access-control" className="button">Open Access Control</Link>
            </div>
          ) : null}
        </div>

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="inline-actions">
            <button className="button primary" onClick={startCreate}>
              New User
            </button>
          </div>

          <div className="muted">
            {(usersQ.data?.count || 0).toLocaleString()} user(s) • Current role: {currentRole || 'Unknown'}
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>Search</label>
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Email, first name, last name, display name" />
          </div>

          <div className="form-row">
            <label>Status Filter</label>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <div className="form-row">
            <label>Role Filter</label>
            <select className="select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Existing Users</label>
            <select className="select" value={selectedUserId} onChange={(e) => {
              const id = e.target.value;
              setSelectedUserId(id);
              const user = (usersQ.data?.items || []).find((x) => x.id === id);
              if (user) {
                startEdit(user);
              } else if (!id) {
                startCreate();
              }
            }}>
              <option value="">— Select User —</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} - {user.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>{mode === 'create' ? 'Create User' : 'Edit User'}</h2>
          <span className="muted">
            {mode === 'create'
              ? 'Create a new tenant user with deliberate role assignment'
              : 'Update user details, role, and active status'}
          </span>
        </div>

        <div className="form-grid two">
          <div className="form-row"><label>Email</label><input className="input" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
          <div className="form-row">
            <label>Role</label>
            <select className="select" value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row"><label>First Name</label><input className="input" value={form.firstName} onChange={(e) => setForm((s) => ({ ...s, firstName: e.target.value }))} /></div>
          <div className="form-row"><label>Last Name</label><input className="input" value={form.lastName} onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))} /></div>

          {mode === 'create' ? (
            <div className="form-row">
              <label>Temporary Password</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
            </div>
          ) : null}

          <div className="form-row">
            <label>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))} />
              {' '}User is active
            </label>
          </div>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <button className="button" onClick={startCreate}>Reset Form</button>
          <button className="button primary" onClick={submitForm} disabled={createMut.isPending || updateMut.isPending}>
            {createMut.isPending || updateMut.isPending ? 'Saving…' : mode === 'create' ? 'Create User' : 'Update User'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>User Directory</h2>
          <span className="muted">Status, role, recovery, and operational visibility</span>
        </div>

        <div className="detail-stack">
          {(filteredUsers || []).length === 0 ? (
            <div className="muted">No users found for the current tenant filter.</div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className="kv" style={{ marginBottom: 12 }}>
                <div className="kv-row"><span>Name</span><span>{user.displayName}</span></div>
                <div className="kv-row"><span>Email</span><span>{user.email}</span></div>
                <div className="kv-row"><span>Role</span><span>{user.role}</span></div>
                <div className="kv-row"><span>Status</span><span>{user.isActive ? 'Active' : 'Inactive'}</span></div>
                <div className="kv-row"><span>Created</span><span>{formatUtcDate(user.createdOnUtc)}</span></div>
                <div className="kv-row"><span>Last Modified</span><span>{formatUtcDate(user.lastModifiedOnUtc)}</span></div>
                <div className="kv-row"><span>Password Reset Expires</span><span>{formatUtcDate(user.passwordResetTokenExpiresOnUtc)}</span></div>

                <div className="inline-actions" style={{ marginTop: 12 }}>
                  {canEditUserRole(user.role as any) ? (<button className="button" onClick={() => startEdit(user)}>Edit</button>) : null}
                  {canEditUserRole(user.role as any) ? (
                    user.isActive ? (
                      <button className="button danger" onClick={() => deactivateMut.mutate(user.id)} disabled={activateMut.isPending || deactivateMut.isPending}>Deactivate</button>
                    ) : (
                      <button className="button" onClick={() => activateMut.mutate(user.id)} disabled={activateMut.isPending || deactivateMut.isPending}>Activate</button>
                    )
                  ) : null}
                  {canEditUserRole(user.role as any) ? (
                    <button className="button" onClick={() => passwordResetMut.mutate(user.id)} disabled={passwordResetMut.isPending}>Send Password Reset</button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
