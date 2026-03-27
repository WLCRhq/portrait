import prisma from '../lib/prisma.js';

const RETENTION_DAYS = 90;
const AUDIT_RETENTION_DAYS = 365;

/**
 * Delete viewing sessions, slide events, and old audit logs.
 */
export async function runDataRetention() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const auditCutoff = new Date();
  auditCutoff.setDate(auditCutoff.getDate() - AUDIT_RETENTION_DAYS);

  try {
    const events = await prisma.slideEvent.deleteMany({
      where: { session: { startedAt: { lt: cutoff } } },
    });

    const sessions = await prisma.viewSession.deleteMany({
      where: { startedAt: { lt: cutoff } },
    });

    const auditLogs = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: auditCutoff } },
    });

    if (events.count > 0 || sessions.count > 0 || auditLogs.count > 0) {
      console.log(`[DataRetention] Cleaned up ${sessions.count} sessions, ${events.count} events (>${RETENTION_DAYS}d), ${auditLogs.count} audit logs (>${AUDIT_RETENTION_DAYS}d)`);
    }
  } catch (err) {
    console.error('[DataRetention] Cleanup failed:', err.message);
  }
}
