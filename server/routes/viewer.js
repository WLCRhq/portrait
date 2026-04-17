import { Router } from 'express';
import { z } from 'zod';
import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import prisma from '../lib/prisma.js';
import { viewerLimiter } from '../middleware/rateLimiter.js';
import { getSlideImagePath } from '../services/storage.js';
import { anonymizeIp } from '../lib/privacy.js';
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

const clientInfoSchema = z.object({
  sessionId: z.string().min(1),
  screenRes: z.string().max(20).optional(),
  timezone: z.string().max(100).optional(),
});

const router = Router();

// Apply rate limiting to all viewer endpoints
router.use(viewerLimiter);

// Fire-and-forget ISP lookup via ip-api.com; updates session after response
function lookupIsp(ip, sessionId) {
  if (!ip || ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('::1') || ip.startsWith('192.168.') || ip.startsWith('10.')) return;
  fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=org`)
    .then(r => r.json())
    .then(data => {
      if (data?.org) {
        prisma.viewSession.update({ where: { id: sessionId }, data: { isp: data.org } }).catch(() => {});
      }
    })
    .catch(() => {});
}

// Helper: validate slug and check link is active/not expired
async function resolveLink(slug) {
  const link = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      deck: {
        select: { id: true, title: true, slideCount: true, exportStatus: true, bgColor: true, exportedAt: true },
      },
      proposal: {
        include: {
          slides: { orderBy: { index: 'asc' } },
          deck: {
            select: { id: true, title: true, slideCount: true, exportStatus: true, bgColor: true, exportedAt: true },
          },
        },
      },
    },
  });

  if (!link) return { error: 'Link not found', status: 404 };
  if (!link.active) return { error: 'This link has been deactivated', status: 403 };
  if (link.expiresAt && new Date() > link.expiresAt) {
    return { error: 'This link has expired', status: 410 };
  }

  // Determine if this is a deck link or proposal link
  if (link.proposalId && link.proposal) {
    // Proposal link — check that the linked deck (if any) is exported
    if (link.proposal.deck && link.proposal.deck.exportStatus !== 'done') {
      return { error: 'Presentation is still being processed', status: 202 };
    }
    return { link, type: 'proposal' };
  }

  // Deck link (original behavior)
  if (!link.deck) return { error: 'Link not found', status: 404 };
  if (link.deck.exportStatus !== 'done') {
    return { error: 'Presentation is still being processed', status: 202 };
  }
  return { link, type: 'deck' };
}

// GET /api/view/:slug/meta — Get presentation metadata and create session
router.get('/:slug/meta', async (req, res) => {
  const result = await resolveLink(req.params.slug);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { link, type } = result;

  // Capture viewer IP
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket.remoteAddress || 'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';
  const referrer = req.headers['referer'] || req.headers['referrer'] || null;

  // GeoIP lookup
  const geo = geoip.lookup(ip);

  // Parse user agent
  const ua = new UAParser(userAgent);
  const browserInfo = ua.getBrowser();
  const osInfo = ua.getOS();
  const deviceInfo = ua.getDevice();

  // Create viewing session
  const session = await prisma.viewSession.create({
    data: {
      linkId: link.id,
      viewerIp: anonymizeIp(ip),
      userAgent,
      country: geo?.country || null,
      region: geo?.region || null,
      city: geo?.city || null,
      timezone: geo?.timezone || null,
      browser: browserInfo.name ? `${browserInfo.name} ${browserInfo.version || ''}`.trim() : null,
      os: osInfo.name ? `${osInfo.name} ${osInfo.version || ''}`.trim() : null,
      device: deviceInfo.type || 'desktop',
      referrer,
    },
  });

  // Async ISP lookup (non-blocking — updates session when it resolves)
  lookupIsp(ip, session.id);

  if (type === 'proposal') {
    const proposal = link.proposal;
    const deck = proposal.deck;

    res.json({
      sessionId: session.id,
      type: 'proposal',
      proposalId: proposal.id,
      title: proposal.title,
      client: proposal.client,
      slideCount: proposal.slides.length,
      bgColor: deck?.bgColor || '#1e293b',
      exportedAt: deck?.exportedAt || null,
      deckId: deck?.id || null,
      slides: proposal.slides.map(s => ({
        index: s.index,
        type: s.type,
        sowCategoryId: s.sowCategoryId,
        content: s.content,
        sourceSlideIndex: s.sourceSlideIndex,
      })),
    });
  } else {
    // Original deck response (backward compatible)
    res.json({
      sessionId: session.id,
      type: 'deck',
      deckId: link.deck.id,
      title: link.deck.title,
      slideCount: link.deck.slideCount,
      bgColor: link.deck.bgColor,
      exportedAt: link.deck.exportedAt,
    });
  }
});

// POST /api/view/:slug/event — Record a slide viewing event
router.post('/:slug/event', async (req, res) => {
  const parsed = slideEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      ...(process.env.NODE_ENV !== 'production' && { details: parsed.error.flatten() }),
    });
  }

  const { sessionId, slideIndex, enteredAt, exitedAt } = parsed.data;

  // Verify session belongs to this link
  const session = await prisma.viewSession.findFirst({
    where: { id: sessionId, link: { slug: req.params.slug } },
  });
  if (!session) {
    return res.status(403).json({ error: 'Invalid session' });
  }

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

  // Verify session belongs to this link
  const session = await prisma.viewSession.findFirst({
    where: { id: sessionId, link: { slug: req.params.slug } },
  });

  if (!session) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  const endedAt = new Date();
  const totalSeconds = Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000);

  await prisma.viewSession.update({
    where: { id: sessionId },
    data: { endedAt, totalSeconds },
  });

  res.json({ ok: true });
});

// POST /api/view/:slug/clientinfo — Update session with client-side info (screen, timezone)
router.post('/:slug/clientinfo', async (req, res) => {
  const parsed = clientInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { sessionId, screenRes, timezone } = parsed.data;

  const session = await prisma.viewSession.findFirst({
    where: { id: sessionId, link: { slug: req.params.slug } },
  });
  if (!session) {
    return res.status(403).json({ error: 'Invalid session' });
  }

  await prisma.viewSession.update({
    where: { id: sessionId },
    data: {
      ...(screenRes && { screenRes }),
      ...(timezone && !session.timezone && { timezone }),
    },
  });

  res.json({ ok: true });
});

// GET /api/view/:slug/slide/:index/overlays — Get GIF overlays for a slide
router.get('/:slug/slide/:index/overlays', async (req, res) => {
  const result = await resolveLink(req.params.slug);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { link, type } = result;
  const slideIndex = parseInt(req.params.index);

  if (isNaN(slideIndex) || slideIndex < 0) {
    return res.status(400).json({ error: 'Invalid slide index' });
  }

  // For proposals, resolve the source deck slide for overlays
  let deckId, deckSlideIndex;
  if (type === 'proposal') {
    const proposalSlide = link.proposal.slides.find(s => s.index === slideIndex);
    if (!proposalSlide || proposalSlide.type !== 'deck_slide' || !link.proposal.deck) {
      return res.json([]);
    }
    deckId = link.proposal.deck.id;
    deckSlideIndex = proposalSlide.sourceSlideIndex;
  } else {
    deckId = link.deck.id;
    deckSlideIndex = slideIndex;
  }

  const slide = await prisma.slide.findUnique({
    where: { deckId_index: { deckId, index: deckSlideIndex } },
    include: { overlays: { orderBy: { zIndex: 'asc' } } },
  });

  res.json(slide?.overlays || []);
});

// GET /api/view/:slug/slide/:index — Serve slide image from disk
router.get('/:slug/slide/:index', async (req, res) => {
  const result = await resolveLink(req.params.slug);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  const { link, type } = result;
  const slideIndex = parseInt(req.params.index);

  if (isNaN(slideIndex) || slideIndex < 0) {
    return res.status(400).json({ error: 'Invalid slide index' });
  }

  // For proposals, resolve the source deck slide image
  let deckId, deckSlideIndex;
  if (type === 'proposal') {
    const proposalSlide = link.proposal.slides.find(s => s.index === slideIndex);
    if (!proposalSlide || proposalSlide.type !== 'deck_slide' || !link.proposal.deck) {
      return res.status(404).json({ error: 'No image for this slide type' });
    }
    deckId = link.proposal.deck.id;
    deckSlideIndex = proposalSlide.sourceSlideIndex;
  } else {
    deckId = link.deck.id;
    deckSlideIndex = slideIndex;
  }

  const imagePath = getSlideImagePath(deckId, deckSlideIndex);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Slide image not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(imagePath));
});

export default router;
