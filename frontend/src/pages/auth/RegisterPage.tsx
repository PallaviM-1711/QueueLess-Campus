/**
 * RegisterPage.tsx — Phase 1 placeholder
 * Real registration form with college email validation is implemented in Phase 2.
 */

import { Link } from 'react-router-dom';

export default function RegisterPage() {
  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Register</h1>
      <p style={{ color: '#666' }}>
        Student registration is coming in Phase 2. For now this is a placeholder.
      </p>
      <Link to="/">← Back to Home</Link>
    </main>
  );
}
