import prisma from '../lib/prisma.js';

const RETENTION_DAYS = 90;

/**
 * Delete viewing sessions and slide events older than the retention period.
 */
export async function runDataRetention() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  try {
    // Delete old events first (FK constraint)
    const events = await prisma.slideEvent.deleteMany({
      where: { session: { startedAt: { lt: cutoff } } },
    });

    const sessions = await prisma.viewSession.deleteMany({
      where: { startedAt: { lt: cutoff } },
    });

    if (events.count > 0 || sessions.count > 0) {
      console.log(`[DataRetention] Cleaned up ${sessions.count} sessions and ${events.count} events older than ${RETENTION_DAYS} days`);
    }
  } catch (err) {
    console.error('[DataRetention] Cleanup failed:', err.message);
  }
}
