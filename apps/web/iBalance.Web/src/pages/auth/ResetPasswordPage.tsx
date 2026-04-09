import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { PasswordInput } from '../../components/common/PasswordInput';

export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');

  function submit() {
    setMessage('');
    if (!password.trim() || password.length < 8) return setMessage('Password must be at least 8 characters.');
    if (password !== confirm) return setMessage('Passwords do not match.');
    setMessage('Password reset successful. You can now log in.');
  }

  return (
    <AuthShell>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">Password recovery</div>
          <h2 style={{ margin: 0 }}>Reset password</h2>
          <div className="section-subtitle">Choose a new password for your account.</div>
        </div>

        {message ? <div className="panel">{message}</div> : null}

        <div className="form-grid">
          <div className="form-row">
            <label>New password</label>
            <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
          </div>

          <div className="form-row">
            <label>Confirm password</label>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </div>

          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <Link to="/login" className="button">
              Back
            </Link>
            <button className="button primary" onClick={submit}>
              Reset password
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}