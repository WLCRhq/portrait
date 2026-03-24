import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma.js';

const router = Router();

function getOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

// Redirect to Google consent screen
router.get('/google', (_req, res) => {
  const client = getOAuth2Client();
  const authorizeUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/presentations.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
  res.redirect(authorizeUrl);
});

// OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const client = getOAuth2Client();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info
    const userInfoRes = await client.request({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });
    const { id: googleId, email, name } = userInfoRes.data;

    // Upsert user
    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        email,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
      },
      create: {
        googleId,
        email,
        name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || '',
      },
    });

    // Set session
    req.session.userId = user.id;

    // Redirect to client app
    res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  res.json(user);
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

export default router;
