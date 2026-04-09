import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { PasswordInput } from '../../components/common/PasswordInput';
import { loginDemo } from '../../lib/auth';

export function LoginPage() {
  const nav = useNavigate();
  const location = useLocation() as any;

  const [email, setEmail] = useState('demo@tenant.com');
  const [password, setPassword] = useState('Password123!');
  const [errorText, setErrorText] = useState('');

  const redirectTo = useMemo(() => location?.state?.from || '/dashboard', [location?.state?.from]);

  function submit() {
    setErrorText('');

    if (!email.trim()) return setErrorText('Email is required.');
    if (!password.trim()) return setErrorText('Password is required.');

    loginDemo(email);
    nav(redirectTo, { replace: true });
  }

  return (
    <AuthShell>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">Secure access</div>
          <h2 style={{ margin: 0 }}>Sign in</h2>
          <div className="section-subtitle">
            Sign in to access your tenant finance console. (Demo auth for now.)
          </div>
        </div>

        {errorText ? <div className="panel error-panel">{errorText}</div> : null}

        {/* Single-column, not "two" */}
        <div className="form-grid">
          <div className="form-row">
            <label>Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="form-row">
            <label>Password</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />
          </div>

          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <Link to="/forgot-password" className="muted">
              Forgot password?
            </Link>
          </div>

          <div className="inline-actions" style={{ justifyContent: 'flex-end' }}>
            <button className="button primary" onClick={submit}>
              Login
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}