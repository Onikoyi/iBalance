import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { PasswordInput } from '../../components/common/PasswordInput';
import { getTenantKey, setTenantKey } from '../../lib/api';
import { login } from '../../lib/auth';

const rememberedEmailKey = 'ibalance.auth.rememberedEmail';

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5071';
}

export function LoginPage() {
  const nav = useNavigate();
  const location = useLocation() as any;

  const [tenantKey, setTenantKeyState] = useState(getTenantKey());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [infoText, setInfoText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingTenant, setIsCheckingTenant] = useState(false);

  const redirectTo = useMemo(() => location?.state?.from || '/dashboard', [location?.state?.from]);

  useEffect(() => {
    const savedEmail = localStorage.getItem(rememberedEmailKey) || '';
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    } else {
      setRememberMe(false);
    }

    const savedTenantKey = getTenantKey();
    if (savedTenantKey) {
      setTenantKeyState(savedTenantKey);
    }
  }, []);

  async function verifyTenant() {
    setErrorText('');
    setInfoText('');

    const normalizedTenantKey = tenantKey.trim().toLowerCase();

    if (!normalizedTenantKey) {
      setErrorText('Please enter your tenant key.');
      return;
    }

    try {
      setIsCheckingTenant(true);

      const response = await fetch(`${getApiBaseUrl()}/diagnostics/tenant`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Key': normalizedTenantKey,
        },
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data?.Message || data?.message || 'Unable to confirm tenant key.');
      }

      if (!data?.resolved) {
        setErrorText('We could not find that tenant key. Please check it and try again.');
        return;
      }

      setTenantKey(normalizedTenantKey);
      setTenantKeyState(normalizedTenantKey);
      setInfoText('Tenant key confirmed.');
    } catch (error: any) {
      setErrorText(error?.message || 'Unable to confirm tenant key.');
    } finally {
      setIsCheckingTenant(false);
    }
  }

  async function submit() {
    setErrorText('');
    setInfoText('');

    const normalizedTenantKey = tenantKey.trim().toLowerCase();

    if (!normalizedTenantKey) {
      setErrorText('Please enter your tenant key.');
      return;
    }

    if (!email.trim()) {
      setErrorText('Please enter your email address.');
      return;
    }

    if (!password.trim()) {
      setErrorText('Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);

      setTenantKey(normalizedTenantKey);
      setTenantKeyState(normalizedTenantKey);

      await login(email.trim(), password, rememberMe);

      if (rememberMe) {
        localStorage.setItem(rememberedEmailKey, email.trim());
      } else {
        localStorage.removeItem(rememberedEmailKey);
      }

      nav(redirectTo, { replace: true });
    } catch (error: any) {
      setErrorText(error?.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">Secure access</div>
          <h2 style={{ margin: 0 }}>Sign in to iBalance</h2>
          <div className="section-subtitle">
            Enter your tenant key, email address, and password to continue.
          </div>
        </div>

        {errorText ? <div className="panel error-panel">{errorText}</div> : null}
        {infoText ? <div className="panel">{infoText}</div> : null}

        <div className="form-grid">
          <div className="form-row">
            <label>Tenant Key</label>
            <input
              className="input"
              value={tenantKey}
              onChange={(e) => setTenantKeyState(e.target.value)}
              placeholder="Enter your tenant key"
              autoComplete="organization"
            />
            <div className="muted" style={{ marginTop: 8 }}>
              Your organization should provide this key.
            </div>
          </div>

          <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="button"
              onClick={verifyTenant}
              disabled={isSubmitting || isCheckingTenant}
            >
              {isCheckingTenant ? 'Checking…' : 'Confirm Tenant Key'}
            </button>
          </div>

          <div className="form-row">
            <label>Email</label>
            <input
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember my email on this device
          </label>

          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <Link to="/forgot-password" className="muted">
              Forgot password?
            </Link>

            <Link to="/onboarding" className="muted">
              Need an account?
            </Link>
          </div>

          <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
            <button
              className="button primary"
              onClick={submit}
              disabled={isSubmitting || isCheckingTenant}
            >
              {isSubmitting ? 'Signing in…' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}