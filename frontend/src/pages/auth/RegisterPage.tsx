import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  registerStudent,
  resendVerificationCode,
  saveAuthToken,
  verifyEmail,
} from '../../api/auth.api';
import './auth.css';

interface ApiError extends Error {
  status?: number;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationStep, setVerificationStep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await registerStudent({ name, email, password });
      setEmail(email.trim().toLowerCase());
      setVerificationStep(true);
      setMessage(result.message);
    } catch (reason) {
      const apiError = reason as ApiError;
      setError(apiError.message);
      if (apiError.status === 503 && apiError.message.startsWith('Your account was created')) {
        setEmail(email.trim().toLowerCase());
        setVerificationStep(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await verifyEmail({ email, otp });
      saveAuthToken(result.token);
      navigate('/', { replace: true });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await resendVerificationCode(email);
      setMessage(result.message);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="register-title">
        <p className="auth-brand">QueueLess Campus</p>
        <h1 id="register-title">{verificationStep ? 'Verify your email' : 'Create your account'}</h1>
        <p className="auth-description">
          {verificationStep
            ? `Enter the six-digit code sent to ${email}.`
            : 'Register with an email domain approved for your university.'}
        </p>

        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-message" role="alert">{error}</p>}

        {verificationStep ? (
          <form className="auth-form" onSubmit={handleVerify}>
            <label className="auth-field">
              Verification code
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={(event) => setOtp(event.target.value)}
              />
            </label>
            <button className="auth-button" disabled={busy} type="submit">
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button className="auth-link-button" disabled={busy} onClick={handleResend} type="button">
              Resend verification code
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegister}>
            <label className="auth-field">
              Full name
              <input
                autoComplete="name"
                maxLength={60}
                minLength={2}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="auth-field">
              College email
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="auth-field">
              Password
              <input
                autoComplete="new-password"
                type="password"
                minLength={8}
                maxLength={72}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <span className="auth-description">Use 8–72 characters.</span>
            </label>
            <button className="auth-button" disabled={busy} type="submit">
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          Already registered? <Link to="/login">Log in</Link>
        </p>
        <Link className="auth-back" to="/">Back to home</Link>
      </section>
    </main>
  );
}
