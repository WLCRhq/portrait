import { randomBytes } from 'crypto';

/**
 * Generate a CSRF token and store it in the session.
 */
export function generateCsrf(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

/**
 * Middleware: validate CSRF token on state-changing requests.
 * Skips GET, HEAD, OPTIONS.
 */
export function validateCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'];
  if (!token || token !== req.session?.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}
