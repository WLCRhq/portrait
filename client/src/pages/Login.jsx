import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
export default function Login() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(() => navigate('/dashboard'))
      .catch(() => setChecking(false));
  }, [navigate]);

  if (checking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="skeleton" style={{ width: 200, height: 40 }} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      gap: 32,
      padding: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <img src="/portrait-logo.png" alt="Portrait" style={{ maxWidth: '66%', height: 'auto' }} />
        <p style={{ fontSize: 18, maxWidth: 500, margin: '16px auto 0' }}>
          Share Google Slides presentations with trackable links and detailed viewer analytics.
        </p>
      </div>

      <a
        href={`${import.meta.env.VITE_API_URL || ''}/auth/google`}
        className="btn btn-primary"
        style={{ fontSize: 16, padding: '12px 32px' }}
      >
        Sign in with Google
      </a>

      <p style={{ fontSize: 13, color: 'var(--text)', maxWidth: 400, textAlign: 'center' }}>
        We'll request read-only access to your Google Slides to export them as images.
        Your presentations are never modified.
      </p>
    </div>
  );
}
