import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, saveAuthToken } from '../../api/auth.api';
import './auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await login({ email, password });
      saveAuthToken(result.token);
      navigate('/', { replace: true });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="auth-brand">QueueLess Campus</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="auth-description">Log in with your verified college account.</p>
        {error && <p className="auth-message" role="alert">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              type="password"
              minLength={8}
              maxLength={72}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="auth-button" disabled={busy} type="submit">
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-footer">
          New to QueueLess? <Link to="/register">Create an account</Link>
        </p>
        <Link className="auth-back" to="/">Back to home</Link>
      </section>
    </main>
  );
}
