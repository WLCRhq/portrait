import { Router } from 'express';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import prisma from '../lib/prisma.js';
import { requireProposalOwner } from '../middleware/requireOwner.js';
import { validate } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

// --- Zod schemas ---

const createProposalSchema = z.object({
  title: z.string().min(1).max(255),
  client: z.string().max(255).optional(),
  deckId: z.string().optional(),
});

const updateProposalSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  client: z.string().max(255).nullable().optional(),
  deckId: z.string().nullable().optional(),
  sowMeta: z.object({
    sowDate: z.string().optional(),
    version: z.string().optional(),
    preparedBy: z.string().optional(),
    expiresDate: z.string().optional(),
  }).optional(),
  sowData: z.record(z.object({
    included: z.boolean(),
    rows: z.array(z.object({
      name: z.string(),
      unit: z.string(),
      qty: z.string(),
      rate: z.string(),
      freq: z.string(),
      passThrough: z.boolean(),
      notes: z.string(),
    })),
  })).optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
});

const updateSlidesSchema = z.array(z.object({
  type: z.enum(['deck_slide', 'sow_section', 'sow_totals']),
  sourceSlideIndex: z.number().int().min(0).optional(),
  sowCategoryId: z.string().optional(),
  content: z.any().optional(),
}));

const createLinkSchema = z.object({
  label: z.string().max(255).optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().datetime()).optional(),
});

const updateLinkSchema = z.object({
  active: z.boolean().optional(),
  label: z.string().max(255).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullable().optional(),
});

// --- Proposal CRUD ---

// POST /api/proposals — Create a new proposal
router.post('/', validate(createProposalSchema), async (req, res) => {
  try {
    const { title, client, deckId } = req.body;

    // Verify deck exists if provided
    if (deckId) {
      const deck = await prisma.deck.findUnique({ where: { id: deckId } });
      if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
      }
    }

    const proposal = await prisma.proposal.create({
      data: {
        userId: req.session.userId,
        title,
        client: client || null,
        deckId: deckId || null,
      },
    });

    logAudit(req.session.userId, 'proposal.create', proposal.id, { title });
    res.status(201).json(proposal);
  } catch (err) {
    console.error('Proposal create error:', err);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// GET /api/proposals — List all proposals for current user
router.get('/', async (req, res) => {
  const proposals = await prisma.proposal.findMany({
    where: { userId: req.session.userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      deck: { select: { id: true, title: true, slideCount: true, bgColor: true } },
      _count: { select: { slides: true, links: true } },
    },
  });
  res.json(proposals);
});

// GET /api/proposals/:proposalId — Get single proposal with slides
router.get('/:proposalId', async (req, res) => {
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.proposalId },
    include: {
      deck: {
        select: { id: true, title: true, slideCount: true, bgColor: true, exportedAt: true, exportStatus: true },
        include: { slides: { orderBy: { index: 'asc' }, select: { id: true, index: true, imageUrl: true } } },
      },
      slides: { orderBy: { index: 'asc' } },
      links: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { sessions: true } } } },
    },
  });

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  res.json(proposal);
});

// PATCH /api/proposals/:proposalId — Update proposal metadata/SOW data
router.patch('/:proposalId', requireProposalOwner, validate(updateProposalSchema), async (req, res) => {
  try {
    const { title, client, deckId, sowMeta, sowData, status } = req.body;

    // Verify deck exists if changing it
    if (deckId) {
      const deck = await prisma.deck.findUnique({ where: { id: deckId } });
      if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
      }
    }

    const proposal = await prisma.proposal.update({
      where: { id: req.params.proposalId },
      data: {
        ...(title !== undefined && { title }),
        ...(client !== undefined && { client }),
        ...(deckId !== undefined && { deckId }),
        ...(sowMeta !== undefined && { sowMeta }),
        ...(sowData !== undefined && { sowData }),
        ...(status !== undefined && { status }),
      },
    });

    logAudit(req.session.userId, 'proposal.update', proposal.id, req.body);
    res.json(proposal);
  } catch (err) {
    console.error('Proposal update error:', err);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// DELETE /api/proposals/:proposalId — Delete proposal
router.delete('/:proposalId', requireProposalOwner, async (req, res) => {
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.proposalId },
  });

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  await prisma.proposal.delete({ where: { id: proposal.id } });

  logAudit(req.session.userId, 'proposal.delete', proposal.id, { title: proposal.title });
  res.json({ message: 'Proposal deleted' });
});

// PUT /api/proposals/:proposalId/slides — Replace full slide ordering
router.put('/:proposalId/slides', requireProposalOwner, validate(updateSlidesSchema), async (req, res) => {
  try {
    const slides = req.body;

    await prisma.$transaction(async (tx) => {
      // Delete existing slides
      await tx.proposalSlide.deleteMany({ where: { proposalId: req.params.proposalId } });

      // Create new slides in order
      await tx.proposalSlide.createMany({
        data: slides.map((slide, index) => ({
          proposalId: req.params.proposalId,
          index,
          type: slide.type,
          sourceSlideIndex: slide.sourceSlideIndex ?? null,
          sowCategoryId: slide.sowCategoryId ?? null,
          content: slide.content ?? null,
        })),
      });
    });

    const updated = await prisma.proposalSlide.findMany({
      where: { proposalId: req.params.proposalId },
      orderBy: { index: 'asc' },
    });

    logAudit(req.session.userId, 'proposal.slides.update', req.params.proposalId, { slideCount: slides.length });
    res.json(updated);
  } catch (err) {
    console.error('Proposal slides update error:', err);
    res.status(500).json({ error: 'Failed to update slides' });
  }
});

// --- Proposal ShareLinks ---

// POST /api/proposals/:proposalId/links — Create share link for proposal
router.post('/:proposalId/links', requireProposalOwner, validate(createLinkSchema), async (req, res) => {
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.proposalId },
  });

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  const { label, expiresAt } = req.body;
  const slug = nanoid(16);

  const link = await prisma.shareLink.create({
    data: {
      proposalId: proposal.id,
      slug,
      label: label || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  logAudit(req.session.userId, 'link.create', link.id, { slug, proposalId: proposal.id });
  res.status(201).json({
    ...link,
    viewerUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/view/${slug}`,
  });
});

// GET /api/proposals/:proposalId/links — List links for a proposal
router.get('/:proposalId/links', async (req, res) => {
  const links = await prisma.shareLink.findMany({
    where: { proposalId: req.params.proposalId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { sessions: true } } },
  });
  res.json(links);
});

// PATCH /api/proposals/:proposalId/links/:linkId — Update a proposal link
router.patch('/:proposalId/links/:linkId', requireProposalOwner, validate(updateLinkSchema), async (req, res) => {
  const { active, label, expiresAt } = req.body;

  const link = await prisma.shareLink.update({
    where: { id: req.params.linkId, proposalId: req.params.proposalId },
    data: {
      ...(active !== undefined && { active }),
      ...(label !== undefined && { label }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
    },
  });

  logAudit(req.session.userId, 'link.update', req.params.linkId, req.body);
  res.json(link);
});

// DELETE /api/proposals/:proposalId/links/:linkId — Delete a proposal link
router.delete('/:proposalId/links/:linkId', requireProposalOwner, async (req, res) => {
  await prisma.shareLink.delete({
    where: { id: req.params.linkId, proposalId: req.params.proposalId },
  });

  logAudit(req.session.userId, 'link.delete', req.params.linkId, { proposalId: req.params.proposalId });
  res.json({ message: 'Link deleted' });
});

export default router;
