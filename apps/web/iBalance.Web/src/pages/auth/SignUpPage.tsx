import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { PasswordInput } from '../../components/common/PasswordInput';
import { register } from '../../lib/auth';
import { getTenantKey } from '../../lib/api';

export function SignUpPage() {
  const nav = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [tenantKey] = useState(getTenantKey());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setErrorText('');

    if (!tenantKey.trim()) {
      setErrorText('Tenant Key is required. Go to Tenant Onboarding and save it first.');
      return;
    }

    if (!firstName.trim()) {
      setErrorText('First name is required.');
      return;
    }

    if (!lastName.trim()) {
      setErrorText('Last name is required.');
      return;
    }

    if (!email.trim()) {
      setErrorText('Email is required.');
      return;
    }

    if (!password.trim() || password.length < 8) {
      setErrorText('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorText('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);

      await register({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });

      nav('/dashboard', { replace: true });
    } catch (error: any) {
      setErrorText(error?.message || 'Sign-up failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell wide>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">New tenant access</div>
          <h2 style={{ margin: 0 }}>Create your account</h2>
          <div className="section-subtitle">
            Register a tenant administrator account for the currently selected tenant key.
          </div>
        </div>

        {errorText ? <div className="panel error-panel">{errorText}</div> : null}

        <div className="panel" style={{ padding: 16 }}>
          <div className="muted">
            Active Tenant Key: <strong>{tenantKey || 'Not set'}</strong>
          </div>
        </div>

        <div className="form-grid two">
          <div className="form-row">
            <label>First Name</label>
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Last Name</label>
            <input
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <div className="form-row" style={{ gridColumn: '1 / -1' }}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
          </div>

          <div className="form-row">
            <label>Confirm Password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
          <div className="inline-actions">
            <Link to="/onboarding" className="button">
              Tenant Onboarding
            </Link>
            <Link to="/pricing" className="button">
              Pricing
            </Link>
          </div>

          <div className="inline-actions">
            <Link to="/login" className="button">
              Login instead
            </Link>
            <button className="button primary" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}