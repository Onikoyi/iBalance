import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { PasswordInput } from '../../components/common/PasswordInput';
import { resetPassword } from '../../lib/auth';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const emailFromQuery = searchParams.get('email') || '';
    const tokenFromQuery = searchParams.get('token') || '';

    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }

    if (tokenFromQuery) {
      setToken(tokenFromQuery);
    }
  }, [searchParams]);

  async function submit() {
    setMessage('');

    if (!email.trim()) {
      setMessage('Please enter your email address.');
      return;
    }

    if (!token.trim()) {
      setMessage('Your reset link is incomplete or invalid. Please request a new password reset email.');
      return;
    }

    if (!password.trim() || password.length < 8) {
      setMessage('Your new password must be at least 8 characters long.');
      return;
    }

    if (password !== confirm) {
      setMessage('The passwords entered do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await resetPassword(email.trim(), token.trim(), password);
      setMessage(result.message);
    } catch (error: any) {
      setMessage(error?.message || 'We could not reset your password at this time.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">Password assistance</div>
          <h2 style={{ margin: 0 }}>Reset password</h2>
          <div className="section-subtitle">
            Set a new password to regain access to your account.
          </div>
        </div>

        {message ? <div className="panel">{message}</div> : null}

        <div className="form-grid">
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
            <label>Reset Link</label>
            <input
              className="input"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Reset token will be filled automatically from your email link"
            />
          </div>

          <div className="form-row">
            <label>New Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="Enter your new password"
            />
          </div>

          <div className="form-row">
            <label>Confirm Password</label>
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
            />
          </div>

          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <Link to="/login" className="button">
              Back to Sign In
            </Link>
            <button className="button primary" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}