import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { getAuthClient, getPresentationMetadata } from '../services/googleSlides.js';
import { deleteDeckImages, getSlideImagePath } from '../services/storage.js';
import { exportQueue } from '../jobs/exportWorker.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// Extract presentation ID from a Google Slides URL or plain ID
function extractPresentationId(input) {
  const match = input.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

// POST /api/decks — Import a new deck
router.post('/', async (req, res) => {
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
      },
    });

    // Queue export job
    await exportQueue.add('export-slides', {
      deckId: deck.id,
      userId: req.session.userId,
      presentationId,
      pages: metadata.pages,
      pageWidth: metadata.pageWidth,
      pageHeight: metadata.pageHeight,
    });

    res.status(201).json(deck);
  } catch (err) {
    console.error('Deck import error:', err);
    res.status(500).json({ error: 'Failed to import presentation' });
  }
});

// GET /api/decks — List all user's decks
router.get('/', async (req, res) => {
  const decks = await prisma.deck.findMany({
    where: { userId: req.session.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { links: true } },
    },
  });
  res.json(decks);
});

// GET /api/decks/:deckId — Get single deck with slides
router.get('/:deckId', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
    include: {
      slides: { orderBy: { index: 'asc' } },
      links: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  res.json(deck);
});

// DELETE /api/decks/:deckId — Delete deck and associated data
router.delete('/:deckId', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  // Delete images from disk
  await deleteDeckImages(deck.id);

  // Cascade delete handles DB records
  await prisma.deck.delete({ where: { id: deck.id } });

  res.json({ message: 'Deck deleted' });
});

// POST /api/decks/:deckId/reexport — Re-export slides from Google (keeps links intact)
router.post('/:deckId/reexport', async (req, res) => {
  try {
    const deck = await prisma.deck.findFirst({
      where: { id: req.params.deckId, userId: req.session.userId },
    });

    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const authClient = await getAuthClient(req.session.userId);
    const metadata = await getPresentationMetadata(authClient, deck.googleId);

    // Clear old slides, overlays, and images from disk
    await prisma.slideOverlay.deleteMany({
      where: { slide: { deckId: deck.id } },
    });
    await prisma.slide.deleteMany({ where: { deckId: deck.id } });
    await deleteDeckImages(deck.id);

    // Update deck metadata and set status to processing
    await prisma.deck.update({
      where: { id: deck.id },
      data: {
        title: metadata.title,
        slideCount: metadata.slideCount,
        exportStatus: 'processing',
        exportedAt: null,
      },
    });

    // Queue fresh export
    await exportQueue.add('export-slides', {
      deckId: deck.id,
      userId: req.session.userId,
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
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const imagePath = getSlideImagePath(deck.id, parseInt(req.params.index));

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'Slide image not found' });
  }

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.resolve(imagePath));
});

export default router;
