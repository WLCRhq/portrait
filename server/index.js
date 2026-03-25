import 'dotenv/config';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3002;

// Trust proxy for accurate IP detection behind reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

// Session setup
const PgSession = ConnectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// Serve uploaded slide images
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes — public (no auth)
app.use('/auth', authRoutes);
app.use('/api/view', viewerRoutes);

// Routes — protected (require auth)
app.use('/api/decks', requireAuth, deckRoutes);
app.use('/api/analytics', requireAuth, analyticsRoutes);

// Link routes are nested under decks but defined separately for clarity
app.use('/api/decks', requireAuth, linkRoutes);

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
});

export default app;
