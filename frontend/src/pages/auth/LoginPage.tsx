/**
 * LoginPage.tsx — Phase 1 placeholder
 * Real auth form and JWT handling are implemented in Phase 2.
 */

import { Link } from 'react-router-dom';

export default function LoginPage() {
  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Login</h1>
      <p style={{ color: '#666' }}>
        Authentication is coming in Phase 2. For now this is a placeholder.
      </p>
      <Link to="/">← Back to Home</Link>
    </main>
  );
}
