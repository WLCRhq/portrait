import { Router } from 'express';
import { z } from 'zod';
import geoip from 'geoip-lite';
import prisma from '../lib/prisma.js';
import { viewerLimiter } from '../middleware/rateLimiter.js';
import { getSlideImagePath } from '../services/storage.js';
import fs from 'fs';
import path from 'path';

const slideEventSchema = z.object({
  sessionId: z.string().min(1),
  slideIndex: z.number().int().min(0),
  enteredAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  exitedAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullable().optional(),
});

const endSessionSchema = z.object({
  sessionId: z.string().min(1),
});

const router = Router();

// Apply rate limiting to all viewer endpoints
router.use(viewerLimiter);

// Helper: validate slug and check link is active/not expired
async function resolveLink(slug) {
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      deck: {
        select: { id: true, title: true, slideCount: true, exportStatus: true, bgColor: true },
      },
    },
  });

  if (!link) return { error: 'Link not found', status: 404 };
  if (!link.active) return { error: 'This link has been deactivated', status: 403 };
  if (link.expiresAt && new Date() > link.expiresAt) {
    return { error: 'This link has expired', status: 410 };
  }
  if (link.deck.exportStatus !== 'done') {
    return { error: 'Presentation is still being processed', status: 202 };
  }

  return { link };
}

// GET /api/view/:slug/meta — Get presentation metadata and create session
router.get('/:slug/meta', async (req, res) => {
  const result = await resolveLink(req.params.slug);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { link } = result;

  // Capture viewer IP
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress || 'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';

  // GeoIP lookup
  const geo = geoip.lookup(ip);

  // Create viewing session
  const session = await prisma.viewSession.create({
    data: {
      linkId: link.id,
      viewerIp: ip,
      userAgent,
      country: geo?.country || null,
      city: geo?.city || null,
    },
  });

  res.json({
    sessionId: session.id,
    deckId: link.deck.id,
    title: link.deck.title,
    slideCount: link.deck.slideCount,
    bgColor: link.deck.bgColor,
  });
});

// POST /api/view/:slug/event — Record a slide viewing event
router.post('/:slug/event', async (req, res) => {
  const parsed = slideEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
  }

  const { sessionId, slideIndex, enteredAt, exitedAt } = parsed.data;

  const entered = new Date(enteredAt);
  const exited = exitedAt ? new Date(exitedAt) : null;
  const durationMs = exited ? exited.getTime() - entered.getTime() : null;

  await prisma.slideEvent.create({
    data: {
      sessionId,
      slideIndex,
      enteredAt: entered,
      exitedAt: exited,
      durationMs,
    },
  });

  res.json({ ok: true });
});

// POST /api/view/:slug/end — End a viewing session
router.post('/:slug/end', async (req, res) => {
  const parsed = endSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { sessionId } = parsed.data;

  const session = await prisma.viewSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const endedAt = new Date();
  const totalSeconds = Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000);

  await prisma.viewSession.update({
    where: { id: sessionId },
    data: { endedAt, totalSeconds },
  });

  res.json({ ok: true });
});

// GET /api/view/:slug/slide/:index/overlays — Get GIF overlays for a slide
router.get('/:slug/slide/:index/overlays', async (req, res) => {
  const result = await resolveLink(req.params.slug);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { link } = result;
  const slideIndex = parseInt(req.params.index);

  const slide = await prisma.slide.findUnique({
    where: { deckId_index: { deckId: link.deck.id, index: slideIndex } },
    include: { overlays: { orderBy: { zIndex: 'asc' } } },
  });

  res.json(slide?.overlays || []);
});

// GET /api/view/:slug/slide/:index — Serve slide image (public, authenticated by slug)
router.get('/:slug/slide/:index', async (req, res) => {
  const result = await resolveLink(req.params.slug);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { link } = result;
  const imagePath = getSlideImagePath(link.deck.id, parseInt(req.params.index));

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Slide image not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.resolve(imagePath));
});

export default router;
