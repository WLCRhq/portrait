import { Router } from 'express';
import { nanoid } from 'nanoid';
import prisma from '../lib/prisma.js';

const router = Router();

// POST /api/decks/:deckId/links — Create a new share link
router.post('/:deckId/links', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const { label, expiresAt } = req.body;
  const slug = nanoid(8);

  const link = await prisma.shareLink.create({
    data: {
      deckId: deck.id,
      slug,
      label: label || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  res.status(201).json({
    ...link,
    viewerUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/view/${slug}`,
  });
});

// GET /api/decks/:deckId/links — List all links for a deck
router.get('/:deckId/links', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const links = await prisma.shareLink.findMany({
    where: { deckId: deck.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { sessions: true } },
    },
  });

  res.json(links);
});

// PATCH /api/decks/:deckId/links/:linkId — Update a link
router.patch('/:deckId/links/:linkId', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const { active, label, expiresAt } = req.body;

  const link = await prisma.shareLink.update({
    where: { id: req.params.linkId, deckId: deck.id },
    data: {
      ...(active !== undefined && { active }),
      ...(label !== undefined && { label }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
  });

  res.json(link);
});

// DELETE /api/decks/:deckId/links/:linkId — Delete a link
router.delete('/:deckId/links/:linkId', async (req, res) => {
  const deck = await prisma.deck.findFirst({
    where: { id: req.params.deckId, userId: req.session.userId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  await prisma.shareLink.delete({
    where: { id: req.params.linkId, deckId: deck.id },
  });

  res.json({ message: 'Link deleted' });
});

export default router;
