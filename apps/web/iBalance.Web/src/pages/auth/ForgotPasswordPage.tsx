import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/layout/AuthShell';
import { forgotPassword } from '../../lib/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!email.trim()) {
      setMessage('Please enter your email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await forgotPassword(email.trim());
      setMessage(result.message);
    } catch (error: any) {
      setMessage(error?.message || 'We could not process your password reset request at this time.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <div className="detail-stack">
        <div>
          <div className="eyebrow">Password assistance</div>
          <h2 style={{ margin: 0 }}>Forgot password</h2>
          <div className="section-subtitle">
            Enter your email address and we will send password reset instructions if your account is available.
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

          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <Link to="/login" className="button">
              Back to Sign In
            </Link>
            <button className="button primary" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send Instructions'}
            </button>
          </div>
        </div>
      </div>
    </AuthShell>
  );
}