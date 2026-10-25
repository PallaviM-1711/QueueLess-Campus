/**
 * HomePage.tsx — Phase 1 placeholder
 * Will be replaced with the real canteen listing page in Phase 3.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearAuthToken,
  getCurrentUser,
  type AuthUser,
} from '../api/auth.api';
import { getHealth, type HealthResponse } from '../api/health.api';

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: Error) => setError(err.message));

    if (localStorage.getItem('qlc_token')) {
      getCurrentUser()
        .then(setUser)
        .catch((reason: Error & { status?: number }) => {
          if (reason.status === 401) {
            clearAuthToken();
          } else {
            setAuthError(reason.message);
          }
        });
    }
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>🍽️ QueueLess Campus</h1>
      <p>Smart Canteen Pre-Ordering &amp; Queue Management System</p>

      <nav aria-label="Account" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        {user ? (
          <>
            <span>Signed in as {user.name}</span>
            <button
              onClick={() => {
                clearAuthToken();
                setUser(null);
              }}
              type="button"
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
      {authError && <p role="alert">Could not load your account: {authError}</p>}

      <section style={{ marginTop: '2rem', padding: '1rem', background: '#f4f4f4', borderRadius: 8 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Backend Status</h2>
        {error && <p style={{ color: 'red' }}>⚠️ {error}</p>}
        {!health && !error && <p>Checking…</p>}
        {health && (
          <pre style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
