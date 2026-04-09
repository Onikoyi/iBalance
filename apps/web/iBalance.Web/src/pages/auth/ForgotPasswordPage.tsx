import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  function submit() {
    if (!email.trim()) return setMessage('Please enter your email address.');
    setMessage('If an account exists for that email, a reset link will be sent.');
  }

  return (
    <AuthShell>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">Password recovery</div>
          <h2 style={{ margin: 0 }}>Forgot password</h2>
          <div className="section-subtitle">Enter your email to receive a password reset link.</div>
        </div>

        {message ? <div className="panel">{message}</div> : null}

        <div className="form-grid">
          <div className="form-row">
            <label>Email</label>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <Link to="/login" className="button">
              Back
            </Link>
            <button className="button primary" onClick={submit}>
              Send reset link
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}