import 'dotenv/config';
import './lib/env.js'; // Validate required env vars — exits if missing
import express from 'express';
import session from 'express-session';
import ConnectPgSimple from 'connect-pg-simple';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import deckRoutes from './routes/decks.js';
import linkRoutes from './routes/links.js';
import analyticsRoutes from './routes/analytics.js';
import viewerRoutes from './routes/viewer.js';
import { requireAuth } from './middleware/auth.js';
import { validateCsrf } from './middleware/csrf.js';
import { runDataRetention } from './jobs/dataRetention.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

// Trust proxy for accurate IP detection behind reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const clientUrl = process.env.CLIENT_URL;
if (process.env.NODE_ENV === 'production' && !clientUrl) {
  console.error('FATAL: CLIENT_URL is required in production');
  process.exit(1);
}
app.use(cors({
  origin: clientUrl || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

// Session setup
const PgSession = ConnectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 2 * 24 * 60 * 60 * 1000, // 2 days
  },
}));

// Serve uploaded slide images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

import { authLimiter, apiLimiter } from './middleware/rateLimiter.js';

// Routes — public (no auth)
app.use('/auth', authLimiter, authRoutes);
app.use('/api/view', viewerRoutes);

// Routes — protected (require auth + CSRF + rate limiting)
app.use('/api/decks', requireAuth, apiLimiter, validateCsrf, deckRoutes);
app.use('/api/analytics', requireAuth, apiLimiter, analyticsRoutes);

// Link routes are nested under decks but defined separately for clarity
app.use('/api/decks', requireAuth, apiLimiter, validateCsrf, linkRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, serve the built React client
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // All non-API routes fall through to the React app
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Portrait server running on http://localhost:${PORT}`);

  // Run data retention daily (clean up PII older than 90 days)
  runDataRetention();
  setInterval(runDataRetention, 24 * 60 * 60 * 1000);
});

export default app;
