import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { validate } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

// GET /api/admin/users — list all users
router.get('/users', async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      _count: { select: { decks: true, proposals: true } },
    },
  });
  res.json(users);
});

// PATCH /api/admin/users/:userId — change a user's role
router.patch('/users/:userId', validate(updateRoleSchema), async (req, res) => {
  const { userId } = req.params;

  // Prevent admin from demoting themselves
  if (userId === req.session.userId && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: req.body.role },
    select: { id: true, email: true, name: true, role: true },
  });

  logAudit(req.session.userId, 'admin.role.update', userId, { role: req.body.role });
  res.json(user);
});

export default router;
