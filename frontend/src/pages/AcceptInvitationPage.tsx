import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { acceptStaffInvitation } from '../api/auth.api';
import './auth/auth.css';

export default function AcceptInvitationPage() {
  const [token] = useState(() => window.location.hash.slice(1));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`
      );
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await acceptStaffInvitation(token, password));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not accept invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Accept staff invitation</h1>
        {!token && <p className="auth-error" role="alert">Invitation token is missing.</p>}
        {error && <p className="auth-message" role="alert">{error}</p>}
        {message ? (
          <>
            <p role="status">{message}</p>
            <Link to="/login">Go to login</Link>
          </>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label className="auth-field">
              New password
              <input
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="auth-field">
              Confirm password
              <input
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </label>
            <button className="auth-button" disabled={busy || !token} type="submit">
              {busy ? 'Activating…' : 'Set password and activate account'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
