import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { getDeckAnalytics } from '../services/analytics.js';

const router = Router();

// GET /api/analytics/:deckId — Full analytics for a deck
router.get('/:deckId', async (req, res) => {
  // Verify deck exists (visible to all authenticated users)
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
