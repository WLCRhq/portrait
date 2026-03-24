import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../lib/prisma.js';
import { getAuthClient, extractImageElements } from '../services/googleSlides.js';
import { fetchSlideImage, fetchImageAsset } from '../services/imageExport.js';
import { saveSlideImage, saveOverlayGif } from '../services/storage.js';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const exportQueue = new Queue('slide-export', {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: { count: 5 },
  },
});

const worker = new Worker('slide-export', async (job) => {
  const { deckId, userId, presentationId, pages, pageWidth, pageHeight } = job.data;

  console.log(`[ExportWorker] Starting export for deck ${deckId} (${pages.length} slides)`);

  try {
    const authClient = await getAuthClient(userId);
    const accessToken = authClient.credentials.access_token;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`[ExportWorker] Exporting slide ${i + 1}/${pages.length}`);

      // Fetch PNG thumbnail
      const imageBuffer = await fetchSlideImage(authClient, presentationId, page.objectId);
      const imageUrl = await saveSlideImage(deckId, i, imageBuffer);

      // Upsert slide record
      const slide = await prisma.slide.upsert({
        where: { deckId_index: { deckId, index: i } },
        update: { imageUrl },
        create: { deckId, index: i, imageUrl },
      });

      // Extract image elements and check for GIFs
      const imageElements = extractImageElements(page.elements || [], pageWidth, pageHeight);
      let overlayIndex = 0;

      for (const img of imageElements) {
        // Try contentUrl first (Google-hosted), then sourceUrl (original)
        const urls = [img.contentUrl, img.sourceUrl].filter(Boolean);

        for (const url of urls) {
          const result = await fetchImageAsset(url, accessToken);
          if (result?.isGif) {
            const gifUrl = await saveOverlayGif(deckId, i, overlayIndex, result.buffer);

            await prisma.slideOverlay.create({
              data: {
                slideId: slide.id,
                imageUrl: gifUrl,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                zIndex: overlayIndex,
              },
            });

            console.log(`[ExportWorker] Found GIF overlay on slide ${i + 1} at (${img.x.toFixed(1)}%, ${img.y.toFixed(1)}%)`);
            overlayIndex++;
            break; // Don't try sourceUrl if contentUrl worked
          }
        }
      }

      await job.updateProgress(Math.round(((i + 1) / pages.length) * 100));
    }

    // Mark deck as done
    await prisma.deck.update({
      where: { id: deckId },
      data: {
        exportStatus: 'done',
        exportedAt: new Date(),
        slideCount: pages.length,
      },
    });

    console.log(`[ExportWorker] Export complete for deck ${deckId}`);
  } catch (err) {
    console.error(`[ExportWorker] Export failed for deck ${deckId}:`, err);

    await prisma.deck.update({
      where: { id: deckId },
      data: { exportStatus: 'error' },
    });

    throw err;
  }
}, {
  connection,
  concurrency: 2,
});

worker.on('failed', (job, err) => {
  console.error(`[ExportWorker] Job ${job?.id} failed:`, err.message);
});

export default worker;
