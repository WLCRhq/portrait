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

  const filename = `slide-${slideIndex}-overlay-${overlayIndex}.gif`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, gifBuffer);

  return `/uploads/${deckId}/overlays/${filename}`;
}
