import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');

/**
 * Save an image buffer to local storage.
 * Returns the relative URL path.
 */
export async function saveSlideImage(deckId, slideIndex, imageBuffer) {
  const dir = path.join(UPLOADS_DIR, deckId);
  await fs.mkdir(dir, { recursive: true });

  const filename = `slide-${slideIndex}.png`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, imageBuffer);

  return `/uploads/${deckId}/${filename}`;
}

/**
 * Delete all images for a deck.
 */
export async function deleteDeckImages(deckId) {
  const dir = path.join(UPLOADS_DIR, deckId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
}

/**
 * Get absolute path for a slide image.
 */
export function getSlideImagePath(deckId, slideIndex) {
  return path.join(UPLOADS_DIR, deckId, `slide-${slideIndex}.png`);
}

/**
 * Save a GIF overlay for a specific slide.
 * Returns the relative URL path.
 */
export async function saveOverlayGif(deckId, slideIndex, overlayIndex, gifBuffer) {
  const dir = path.join(UPLOADS_DIR, deckId, 'overlays');
  await fs.mkdir(dir, { recursive: true });

  // Patch the GIF to loop infinitely (matches Google Slides behavior)
  const patched = forceGifInfiniteLoop(gifBuffer);

  const filename = `slide-${slideIndex}-overlay-${overlayIndex}.gif`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, patched);

  return `/uploads/${deckId}/overlays/${filename}`;
}

/**
 * Patch a GIF buffer to loop infinitely.
 *
 * GIF loop count lives in the Netscape Application Extension block:
 *   21 FF 0B  "NETSCAPE2.0"  03 01  [loop_count LE uint16]  00
 *
 * If the block exists, set the loop count to 0 (infinite).
 * If it doesn't exist, insert it right after the Global Color Table.
 */
function forceGifInfiniteLoop(buf) {
  const netscape = Buffer.from('NETSCAPE2.0', 'ascii');

  // Search for existing Netscape extension
  for (let i = 0; i < buf.length - 18; i++) {
    if (buf[i] === 0x21 && buf[i + 1] === 0xFF && buf[i + 2] === 0x0B) {
      if (buf.subarray(i + 3, i + 14).equals(netscape)) {
        // Found it — overwrite loop count with 0x00 0x00 (infinite)
        const patched = Buffer.from(buf);
        patched[i + 16] = 0x00;
        patched[i + 17] = 0x00;
        return patched;
      }
    }
  }

  // No Netscape extension found — insert one after the GIF header + GCT
  // GIF header is 6 bytes, Logical Screen Descriptor is 7 bytes
  // If bit 7 of LSD byte 4 (index 10) is set, a GCT follows
  const lsdFlags = buf[10];
  const hasGCT = (lsdFlags & 0x80) !== 0;
  const gctSize = hasGCT ? 3 * (1 << ((lsdFlags & 0x07) + 1)) : 0;
  const insertPos = 13 + gctSize; // after header (6) + LSD (7) + GCT

  const ext = Buffer.from([
    0x21, 0xFF, 0x0B,                                     // Extension introducer
    0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45,     // "NETSCAPE"
    0x32, 0x2E, 0x30,                                     // "2.0"
    0x03, 0x01,                                           // Sub-block
    0x00, 0x00,                                           // Loop count = 0 (infinite)
    0x00,                                                 // Block terminator
  ]);

  return Buffer.concat([
    buf.subarray(0, insertPos),
    ext,
    buf.subarray(insertPos),
  ]);
}
