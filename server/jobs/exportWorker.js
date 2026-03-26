import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import prisma from '../lib/prisma.js';
import { getAuthClient, extractImageElements } from '../services/googleSlides.js';
import { exportSlidesFromPdf, fetchSlideImage, fetchImageAsset } from '../services/imageExport.js';
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

    // Try PDF export for high-res slides, fall back to thumbnail API
    let pdfSlideBuffers = null;
    try {
      console.log(`[ExportWorker] Attempting PDF export for high-res slides...`);
      pdfSlideBuffers = await exportSlidesFromPdf(authClient, presentationId, pages.length);
      console.log(`[ExportWorker] PDF export succeeded: ${pdfSlideBuffers.length} pages`);
    } catch (err) {
      console.warn(`[ExportWorker] PDF export failed, falling back to thumbnails:`, err.message);
    }

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`[ExportWorker] Processing slide ${i + 1}/${pages.length}`);

      // Use PDF page if available, otherwise fall back to thumbnail
      let imageBuffer;
      if (pdfSlideBuffers && pdfSlideBuffers[i]) {
        imageBuffer = pdfSlideBuffers[i];
      } else {
        imageBuffer = await fetchSlideImage(authClient, presentationId, page.objectId);
      }

      const imageUrl = await saveSlideImage(deckId, i, imageBuffer);

      // Upsert slide record — store image data in DB for persistence
      const slide = await prisma.slide.upsert({
        where: { deckId_index: { deckId, index: i } },
        update: { imageUrl, imageData: imageBuffer },
        create: { deckId, index: i, imageUrl, imageData: imageBuffer },
      });

      // Extract image elements and check for GIFs
      const imageElements = extractImageElements(page.elements || [], pageWidth, pageHeight);
      let overlayIndex = 0;

      for (const img of imageElements) {
        const urls = [img.contentUrl, img.sourceUrl].filter(Boolean);

        for (const url of urls) {
          const result = await fetchImageAsset(url, accessToken);
          if (result?.isGif) {
            const gifUrl = await saveOverlayGif(deckId, i, overlayIndex, result.buffer);

            await prisma.slideOverlay.create({
              data: {
                slideId: slide.id,
                imageUrl: gifUrl,
                imageData: result.buffer,
                x: img.x,
                y: img.y,
                width: img.width,
                height: img.height,
                zIndex: overlayIndex,
                cropTop: img.cropTop,
                cropBottom: img.cropBottom,
                cropLeft: img.cropLeft,
                cropRight: img.cropRight,
              },
            });

            console.log(`[ExportWorker] Found GIF overlay on slide ${i + 1} at (${img.x.toFixed(1)}%, ${img.y.toFixed(1)}%)`);
            overlayIndex++;
            break;
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
