/**
 * NotFoundPage.tsx — 404 placeholder
 */

import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '4rem' }}>
      <h1>404 — Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Go Home</Link>
    </main>
  );
}
