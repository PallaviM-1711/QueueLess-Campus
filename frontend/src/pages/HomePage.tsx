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
import { getCanteens, type CanteenSummary } from '../api/menu.api';
import { getHealth, type HealthResponse } from '../api/health.api';

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [canteens, setCanteens] = useState<CanteenSummary[]>([]);
  const [canteenError, setCanteenError] = useState('');

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: Error) => setError(err.message));

    if (localStorage.getItem('qlc_token')) {
      getCurrentUser()
        .then((currentUser) => {
          setUser(currentUser);
          return getCanteens().catch((reason: Error) => {
            setCanteenError(reason.message);
            return [];
          });
        })
        .then(setCanteens)
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
            {user.role === 'super_admin' && <Link to="/admin">University admin</Link>}
            <Link to="/orders">My orders</Link>
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
      {canteenError && <p role="alert">Could not load canteens: {canteenError}</p>}

      {user && (
        <section aria-labelledby="canteens-title" style={{ marginTop: '2rem' }}>
          <h2 id="canteens-title">Your university canteens</h2>
          {canteens.length === 0 ? (
            <p>No active canteens are available yet.</p>
          ) : (
            <ul>
              {canteens.map((canteen) => (
                <li key={canteen._id}>
                  <Link to={`/canteens/${canteen._id}/menu`}>{canteen.name}</Link>
                  {canteen.location && <span> · {canteen.location}</span>}
                  <span> · {canteen.isOpen ? 'Open' : 'Closed'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
