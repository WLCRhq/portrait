import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { getDeckAnalytics, getProposalAnalytics } from '../services/analytics.js';

const router = Router();

// GET /api/analytics/proposal/:proposalId — Full analytics for a proposal
// (must be before /:deckId to avoid "proposal" matching as a deckId)
router.get('/proposal/:proposalId', async (req, res) => {
  const proposal = await prisma.proposal.findUnique({
    where: { id: req.params.proposalId },
  });

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  const analytics = await getProposalAnalytics(req.params.proposalId);
  res.json(analytics);
});

// GET /api/analytics/:deckId — Full analytics for a deck
router.get('/:deckId', async (req, res) => {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  const analytics = await getDeckAnalytics(req.params.deckId);
  res.json(analytics);
});

export default router;
