/**
 * One-shot script: re-export all done/error decks at current quality settings.
 * Run from server/: node scripts/reexport-all.js
 */
import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { getAuthClient, getPresentationMetadata } from '../services/googleSlides.js';
import { exportSlidesFromPdf, fetchSlideImage } from '../services/imageExport.js';
import { saveSlideImage, deleteDeckImages } from '../services/storage.js';
import { extractBgColorFromPng } from '../services/colorExtract.js';

const decks = await prisma.deck.findMany({
  where: { exportStatus: { in: ['done', 'error'] } },
  select: { id: true, googleId: true, userId: true, title: true },
});

console.log(`Found ${decks.length} deck(s) to re-export.\n`);

for (const deck of decks) {
  console.log(`▶ ${deck.title} (${deck.id})`);
  try {
    const authClient = await getAuthClient(deck.userId);
    const metadata = await getPresentationMetadata(authClient, deck.googleId);

    // Clear old data
    await prisma.slideOverlay.deleteMany({ where: { slide: { deckId: deck.id } } });
    await prisma.slide.deleteMany({ where: { deckId: deck.id } });
    await deleteDeckImages(deck.id);
    await prisma.deck.update({ where: { id: deck.id }, data: { exportStatus: 'processing', exportedAt: null } });

    // Export slides
    let pdfBuffers = null;
    try {
      pdfBuffers = await exportSlidesFromPdf(authClient, deck.googleId, metadata.pages.length);
      console.log(`  PDF export OK: ${pdfBuffers.length} pages`);
    } catch (err) {
      console.warn(`  PDF export failed, using thumbnails: ${err.message}`);
    }

    let firstBuffer = null;
    for (let i = 0; i < metadata.pages.length; i++) {
      const buf = pdfBuffers?.[i] ?? await fetchSlideImage(authClient, deck.googleId, metadata.pages[i].objectId);
      const url = await saveSlideImage(deck.id, i, buf);
      await prisma.slide.upsert({
        where: { deckId_index: { deckId: deck.id, index: i } },
        update: { imageUrl: url },
        create: { deckId: deck.id, index: i, imageUrl: url },
      });
      if (i === 0) firstBuffer = buf;
      process.stdout.write(`  slide ${i + 1}/${metadata.pages.length}\r`);
    }

    const bgColor = firstBuffer ? extractBgColorFromPng(firstBuffer) : null;
    await prisma.deck.update({
      where: { id: deck.id },
      data: { exportStatus: 'done', exportedAt: new Date(), slideCount: metadata.pages.length, bgColor },
    });

    // Verify output resolution
    const { default: fs } = await import('fs');
    const { getSlideImagePath } = await import('../services/storage.js');
    const imgPath = getSlideImagePath(deck.id, 0);
    const header = Buffer.alloc(24);
    const fh = fs.openSync(imgPath, 'r');
    fs.readSync(fh, header, 0, 24, 0);
    fs.closeSync(fh);
    const w = header.readUInt32BE(16);
    const h = header.readUInt32BE(20);

    console.log(`\n  ✓ Done — slide 0 is ${w}x${h}`);
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    await prisma.deck.update({ where: { id: deck.id }, data: { exportStatus: 'error' } }).catch(() => {});
  }
}

await prisma.$disconnect();
console.log('\nAll done.');
