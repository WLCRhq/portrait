import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';
import { getAuthClient, getPresentationMetadata } from '../services/googleSlides.js';
import { deleteDeckImages, getDeckStorageBytes } from '../services/storage.js';
import { exportQueue } from '../jobs/exportWorker.js';

const router = Router();

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { decks: true, proposals: true } },
    },
  });
  res.json(users);
});

// GET /api/admin/deck-storage — per-deck disk usage, largest first
router.get('/deck-storage', async (req, res) => {
  const decks = await prisma.deck.findMany({
    select: {
      id: true,
      title: true,
      slideCount: true,
      exportedAt: true,
      user: { select: { name: true } },
    },
  });

  const withSizes = await Promise.all(decks.map(async deck => ({
    ...deck,
    bytes: await getDeckStorageBytes(deck.id),
  })));

  withSizes.sort((a, b) => b.bytes - a.bytes);
  res.json({
    totalBytes: withSizes.reduce((sum, d) => sum + d.bytes, 0),
    decks: withSizes,
  });
});

// PATCH /api/admin/users/:userId — change a user's role
router.patch('/users/:userId', validate(updateRoleSchema), async (req, res) => {
  const { userId } = req.params;

  // Prevent admin from demoting themselves
  if (userId === req.session.userId && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: req.body.role },
    select: { id: true, email: true, name: true, role: true },
  });

  logAudit(req.session.userId, 'admin.role.update', userId, { role: req.body.role });
  res.json(user);
});

// GET /api/admin/drive-check — Test whether the current user's token can export a PDF
router.get('/drive-check', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { userId: req.session.userId },
    select: { googleId: true, title: true },
  });

  if (!deck) {
    return res.json({ ok: false, reason: 'No decks found to test with' });
  }

  const { getAuthClient } = await import('../services/googleSlides.js');
  const { exportPresentationPdf, driveErrorReason } = await import('../services/imageExport.js');
  const authClient = await getAuthClient(req.session.userId);

  // Report the token's actual granted scopes so failures aren't guesswork
  let scopes = null;
  try {
    const { token } = await authClient.getAccessToken();
    const infoRes = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    const info = await infoRes.json();
    if (info.scope) scopes = info.scope.split(' ').map(s => s.replace('https://www.googleapis.com/auth/', ''));
  } catch {
    // tokeninfo unavailable — scopes stay null
  }

  try {
    // Run the same export path the deck exporter uses (incl. exportLinks fallback)
    const pdfBuffer = await exportPresentationPdf(authClient, deck.googleId);
    res.json({
      ok: true,
      deck: deck.title,
      pdfSizeMb: +(pdfBuffer.length / 1048576).toFixed(1),
      scopes,
    });
  } catch (err) {
    const status = err?.response?.status;
    const reason = driveErrorReason(err);
    const missingScope = scopes && !scopes.includes('drive.readonly');
    res.json({
      ok: false,
      deck: deck.title,
      status,
      reason: reason || err.message,
      scopes,
      hint: missingScope
        ? 'Token lacks drive.readonly scope — log out and log back in, then re-export'
        : 'Token scopes look correct — see reason for the actual Drive error',
    });
  }
});

// POST /api/admin/reexport-all — Re-export every deck at the current quality setting
router.post('/reexport-all', async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: { exportStatus: { in: ['done', 'error'] } },
    select: { id: true, googleId: true, userId: true, title: true },
  });

  let queued = 0;
  const errors = [];

  // Mark all as processing immediately so the UI reflects the change
  await prisma.deck.updateMany({
    where: { id: { in: decks.map(d => d.id) } },
    data: { exportStatus: 'processing', exportedAt: null },
  });

  // Queue each re-export — fire and forget per deck so one failure doesn't block others
  for (const deck of decks) {
    try {
      const authClient = await getAuthClient(deck.userId);
      const metadata = await getPresentationMetadata(authClient, deck.googleId);

      await prisma.slideOverlay.deleteMany({ where: { slide: { deckId: deck.id } } });
      await prisma.slide.deleteMany({ where: { deckId: deck.id } });
      await deleteDeckImages(deck.id);

      await prisma.deck.update({
        where: { id: deck.id },
        data: { title: metadata.title, slideCount: metadata.slideCount },
      });

      await exportQueue.add('export-slides', {
        deckId: deck.id,
        userId: deck.userId,
        presentationId: deck.googleId,
        pages: metadata.pages,
        pageWidth: metadata.pageWidth,
        pageHeight: metadata.pageHeight,
      });

      queued++;
    } catch (err) {
      console.error(`[Admin] Re-export failed for deck ${deck.id}:`, err.message);
      errors.push({ deckId: deck.id, title: deck.title, error: err.message });
      // Mark failed deck back to error so it's visible
      await prisma.deck.update({ where: { id: deck.id }, data: { exportStatus: 'error' } });
    }
  }

  logAudit(req.session.userId, 'admin.reexport-all', 'all', { queued, errors: errors.length });
  res.json({ queued, errors });
});

export default router;
