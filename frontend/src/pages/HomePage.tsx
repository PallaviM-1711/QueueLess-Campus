/**
 * HomePage.tsx — Phase 1 placeholder
 * Will be replaced with the real canteen listing page in Phase 3.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getHealth, type HealthResponse } from '../api/health.api';

export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>🍽️ QueueLess Campus</h1>
      <p>Smart Canteen Pre-Ordering &amp; Queue Management System</p>

      <nav style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </nav>

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
