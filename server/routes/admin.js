import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';
import { getAuthClient, getPresentationMetadata } from '../services/googleSlides.js';
import { deleteDeckImages } from '../services/storage.js';
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
