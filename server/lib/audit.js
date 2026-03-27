import prisma from './prisma.js';

/**
 * Log an auditable action. Fire-and-forget — audit failures
 * should never block the main request.
 */
export function logAudit(userId, action, targetId, metadata = null) {
  prisma.auditLog.create({
    data: { userId, action, targetId, metadata },
  }).catch((err) => {
    console.error('[Audit] Failed to log:', err.message);
  });
}
