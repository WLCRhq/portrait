import prisma from '../lib/prisma.js';

export async function requireAdmin(req, res, next) {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { role: true },
  });
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Middleware that checks if the current user owns the deck.
 * Returns 403 if they don't. Reads deckId from req.params.deckId.
 */
export async function requireDeckOwner(req, res, next) {
  const [deck, user] = await Promise.all([
    prisma.deck.findUnique({ where: { id: req.params.deckId }, select: { userId: true } }),
    prisma.user.findUnique({ where: { id: req.session.userId }, select: { role: true } }),
  ]);

  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }

  if (user?.role === 'admin' || deck.userId === req.session.userId) {
    return next();
  }

  return res.status(403).json({ error: 'Only the deck owner can perform this action' });
}

/**
 * Middleware that checks if the current user owns the proposal.
 * Reads proposalId from req.params.proposalId.
 */
export async function requireProposalOwner(req, res, next) {
  const [proposal, user] = await Promise.all([
    prisma.proposal.findUnique({ where: { id: req.params.proposalId }, select: { userId: true } }),
    prisma.user.findUnique({ where: { id: req.session.userId }, select: { role: true } }),
  ]);

  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  if (user?.role === 'admin' || proposal.userId === req.session.userId) {
    return next();
  }

  return res.status(403).json({ error: 'Only the proposal owner can perform this action' });
}
