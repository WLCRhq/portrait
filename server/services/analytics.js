import prisma from '../lib/prisma.js';

/**
 * Compute analytics summary from sessions and a given slide count.
 */
function computeSummary(sessions, slideCount) {
  const totalViews = sessions.length;
  const uniqueIps = new Set(sessions.map((s) => s.viewerIp));
  const uniqueViewers = uniqueIps.size;

  const completedSessions = sessions.filter((s) => s.totalSeconds != null);
  const avgTotalTimeSec = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + s.totalSeconds, 0) / completedSessions.length)
    : 0;

  const slideTimeTotals = {};
  const slideCounts = {};

  for (const session of sessions) {
    for (const event of session.events) {
      if (event.durationMs != null) {
        slideTimeTotals[event.slideIndex] = (slideTimeTotals[event.slideIndex] || 0) + event.durationMs;
        slideCounts[event.slideIndex] = (slideCounts[event.slideIndex] || 0) + 1;
      }
    }
  }

  const avgTimePerSlide = [];
  for (let i = 0; i < slideCount; i++) {
    const total = slideTimeTotals[i] || 0;
    const count = slideCounts[i] || 0;
    avgTimePerSlide.push(count > 0 ? Math.round(total / count / 1000) : 0);
  }

  const slideViewCounts = {};
  for (const session of sessions) {
    const viewedSlides = new Set(session.events.map((e) => e.slideIndex));
    for (const idx of viewedSlides) {
      slideViewCounts[idx] = (slideViewCounts[idx] || 0) + 1;
    }
  }

  let mostViewedSlide = 0;
  let maxViews = 0;
  for (const [idx, count] of Object.entries(slideViewCounts)) {
    if (count > maxViews) {
      maxViews = count;
      mostViewedSlide = parseInt(idx);
    }
  }

  const dropOffFunnel = [];
  for (let i = 0; i < slideCount; i++) {
    dropOffFunnel.push(slideViewCounts[i] || 0);
  }

  return { totalViews, uniqueViewers, avgTotalTimeSec, avgTimePerSlide, mostViewedSlide, dropOffFunnel };
}

function formatSessions(sessions) {
  return sessions.map((s) => ({
    id: s.id,
    viewerIp: s.viewerIp,
    userAgent: s.userAgent,
    country: s.country,
    region: s.region,
    city: s.city,
    timezone: s.timezone,
    isp: s.isp,
    browser: s.browser,
    os: s.os,
    device: s.device,
    screenRes: s.screenRes,
    referrer: s.referrer,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    totalSeconds: s.totalSeconds,
    slideEvents: s.events.map((e) => ({
      slideIndex: e.slideIndex,
      durationMs: e.durationMs,
    })),
  }));
}

/**
 * Get full analytics for a deck: summary + all sessions with events.
 */
export async function getDeckAnalytics(deckId) {
  const deck = await prisma.deck.findUnique({
    where: { id: deckId },
    select: { title: true, slideCount: true, exportedAt: true },
  });

  if (!deck) return null;

  const sessions = await prisma.viewSession.findMany({
    where: { link: { deckId } },
    take: 500,
    include: { events: { orderBy: { slideIndex: 'asc' } } },
    orderBy: { startedAt: 'desc' },
  });

  return {
    deck,
    summary: computeSummary(sessions, deck.slideCount),
    sessions: formatSessions(sessions),
  };
}

/**
 * Get full analytics for a proposal: summary + all sessions with events.
 */
export async function getProposalAnalytics(proposalId) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      slides: {
        select: { index: true, type: true, sowCategoryId: true },
        orderBy: { index: 'asc' },
      },
    },
  });

  if (!proposal) return null;

  const slideCount = proposal.slides?.length || 0;

  const sessions = await prisma.viewSession.findMany({
    where: { link: { proposalId } },
    take: 500,
    include: { events: { orderBy: { slideIndex: 'asc' } } },
    orderBy: { startedAt: 'desc' },
  });

  return {
    proposal: { title: proposal.title, client: proposal.client, slideCount },
    slideLabels: (proposal.slides || []).map(s => ({
      index: s.index,
      type: s.type,
      sowCategoryId: s.sowCategoryId,
    })),
    summary: computeSummary(sessions, slideCount),
    sessions: formatSessions(sessions),
  };
}
