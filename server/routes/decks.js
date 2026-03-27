import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { getAuthClient, getPresentationMetadata } from '../services/googleSlides.js';
import { deleteDeckImages, getSlideImagePath } from '../services/storage.js';
import { exportQueue } from '../jobs/exportWorker.js';
import { requireDeckOwner } from '../middleware/requireOwner.js';
import { validate } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';
import { importLimiter } from '../middleware/rateLimiter.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Extract presentation ID from a Google Slides URL or plain ID
function extractPresentationId(input) {
  const match = input.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

const importSchema = z.object({ presentationId: z.string().min(1).max(500) });

// POST /api/decks — Import a new deck (attributed to the importing user)
router.post('/', importLimiter, validate(importSchema), async (req, res) => {
  try {
    const { presentationId: rawId } = req.body;
    if (!rawId) {
      return res.status(400).json({ error: 'presentationId is required' });
    }

    const presentationId = extractPresentationId(rawId);
    const authClient = await getAuthClient(req.session.userId);
    const metadata = await getPresentationMetadata(authClient, presentationId);

    const deck = await prisma.deck.create({
      data: {
        userId: req.session.userId,
        googleId: presentationId,
        title: metadata.title,
        slideCount: metadata.slideCount,
        exportStatus: 'processing',
        bgColor: metadata.bgColor,
      },
    });

    await exportQueue.add('export-slides', {
      deckId: deck.id,
      userId: req.session.userId,
      presentationId,
      pages: metadata.pages,
      pageWidth: metadata.pageWidth,
      pageHeight: metadata.pageHeight,
    });

    logAudit(req.session.userId, 'deck.import', deck.id, { title: deck.title });
    res.status(201).json(deck);
  } catch (err) {
    console.error('Deck import error:', err);
    res.status(500).json({ error: 'Failed to import presentation' });
  }
});

// GET /api/decks — List ALL decks (visible to any authenticated user)
router.get('/', async (req, res) => {
  const decks = await prisma.deck.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true } },
      _count: { select: { links: true } },
    },
  });
  res.json(decks);
});

// GET /api/decks/:deckId — Get single deck with slides
router.get('/:deckId', async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
    include: {
      slides: { orderBy: { index: 'asc' } },
      links: { orderBy: { createdAt: 'desc' } },
      user: { select: { name: true } },
    },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  res.json(deck);
});

// DELETE /api/decks/:deckId — Delete deck (owner only)
router.delete('/:deckId', requireDeckOwner, async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  await deleteDeckImages(deck.id);
  await prisma.deck.delete({ where: { id: deck.id } });

  logAudit(req.session.userId, 'deck.delete', deck.id, { title: deck.title });
  res.json({ message: 'Deck deleted' });
});

// POST /api/decks/:deckId/reexport — Re-export slides (owner only)
router.post('/:deckId/reexport', importLimiter, requireDeckOwner, async (req, res) => {
  try {
    const deck = await prisma.deck.findUnique({
      where: { id: req.params.deckId },
      include: { user: true },
    });

    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Use the original importer's credentials to access Google Slides
    const authClient = await getAuthClient(deck.userId);
    const metadata = await getPresentationMetadata(authClient, deck.googleId);

    await prisma.slideOverlay.deleteMany({
      where: { slide: { deckId: deck.id } },
    });
    await prisma.slide.deleteMany({ where: { deckId: deck.id } });
    await deleteDeckImages(deck.id);

    await prisma.deck.update({
      where: { id: deck.id },
      data: {
        title: metadata.title,
        slideCount: metadata.slideCount,
        exportStatus: 'processing',
        exportedAt: null,
        bgColor: metadata.bgColor,
      },
    });

    await exportQueue.add('export-slides', {
      deckId: deck.id,
      userId: deck.userId,
      presentationId: deck.googleId,
      pages: metadata.pages,
      pageWidth: metadata.pageWidth,
      pageHeight: metadata.pageHeight,
    });

    res.json({ message: 'Re-export started', slideCount: metadata.slideCount });
  } catch (err) {
    console.error('Deck re-export error:', err);
    res.status(500).json({ error: 'Failed to re-export presentation' });
  }
});

// GET /api/decks/:deckId/slides/:index/image — Serve slide image
router.get('/:deckId/slides/:index/image', async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const imagePath = getSlideImagePath(deck.id, parseInt(req.params.index));

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Slide image not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.resolve(imagePath));
});

export default router;
