import prisma from '../lib/prisma.js';

/**
 * Middleware that checks if the current user owns the deck.
 * Returns 403 if they don't. Reads deckId from req.params.deckId.
 */
export async function requireDeckOwner(req, res, next) {
  const deck = await prisma.deck.findUnique({
    where: { id: req.params.deckId },
    select: { userId: true },
  });

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  if (deck.userId !== req.session.userId) {
    return res.status(403).json({ error: 'Only the deck owner can perform this action' });
  }

  next();
}
