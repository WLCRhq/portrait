import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import prisma from '../lib/prisma.js';
import { requireDeckOwner } from '../middleware/requireOwner.js';
import { validate } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

const createLinkSchema = z.object({
  label: z.string().max(255).optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
});

const updateLinkSchema = z.object({
  active: z.boolean().optional(),
  label: z.string().max(255).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullable().optional(),
});

// POST /api/decks/:deckId/links — Create a new share link
router.post('/:deckId/links', validate(createLinkSchema), async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const { label, expiresAt } = req.body;
  const slug = nanoid(16);

  const link = await prisma.shareLink.create({
    data: {
      deckId: deck.id,
      slug,
      label: label || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  logAudit(req.session.userId, 'link.create', link.id, { slug, deckId: deck.id });
  res.status(201).json({
    ...link,
    viewerUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/view/${slug}`,
  });
});

// GET /api/decks/:deckId/links — List all links for a deck
router.get('/:deckId/links', async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
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

// PATCH /api/decks/:deckId/links/:linkId — Update a link (owner only)
router.patch('/:deckId/links/:linkId', requireDeckOwner, validate(updateLinkSchema), async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
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

  logAudit(req.session.userId, 'link.update', req.params.linkId, req.body);
  res.json(link);
});

// DELETE /api/decks/:deckId/links/:linkId — Delete a link (owner only)
router.delete('/:deckId/links/:linkId', requireDeckOwner, async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  await prisma.shareLink.delete({
    where: { id: req.params.linkId, deckId: deck.id },
  });

  logAudit(req.session.userId, 'link.delete', req.params.linkId, { deckId: deck.id });
  res.json({ message: 'Link deleted' });
});

export default router;
