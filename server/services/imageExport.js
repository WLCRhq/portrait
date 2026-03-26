import { google } from 'googleapis';
import { pdf } from 'pdf-to-img';
import { getSlideThumbnailUrl } from './googleSlides.js';

/**
 * Export a presentation as PDF via Google Drive API, then convert
 * each page to a high-resolution PNG.
 * Returns an array of Buffers (one per slide).
 */
export async function exportSlidesFromPdf(authClient, presentationId, slideCount) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // Export the entire presentation as PDF
  const res = await drive.files.export({
    fileId: presentationId,
    mimeType: 'application/pdf',
  }, {
    responseType: 'arraybuffer',
  });

  const pdfBuffer = Buffer.from(res.data);
  console.log(`[ImageExport] PDF downloaded: ${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Convert each PDF page to a high-res PNG
  const pages = [];
  const pdfPages = await pdf(pdfBuffer, { scale: 2.0 }); // 2x scale for ~1920px+ width

  for await (const page of pdfPages) {
    pages.push(Buffer.from(page));
  }

  console.log(`[ImageExport] Converted ${pages.length} pages from PDF`);

  return pages;
}

/**
 * Fallback: Fetch slide image via Thumbnail API (1600px max).
 */
export async function fetchSlideImage(authClient, presentationId, pageObjectId) {
  const thumbnailUrl = await getSlideThumbnailUrl(authClient, presentationId, pageObjectId);

  const response = await fetch(thumbnailUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to fetch slide image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Fetch an image from a URL and determine if it's a GIF.
 * Google Slides image contentUrls require the OAuth token.
 * Returns { buffer, isGif } or null if fetch fails.
 */
export async function fetchImageAsset(url, accessToken) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check content-type header first
    if (contentType.includes('image/gif')) {
      return { buffer, isGif: true };
    }

    // Also check magic bytes: GIF89a or GIF87a
    if (buffer.length >= 6) {
      const header = buffer.subarray(0, 6).toString('ascii');
      if (header === 'GIF89a' || header === 'GIF87a') {
        return { buffer, isGif: true };
      }
    }

    return { buffer, isGif: false };
  } catch (err) {
    console.warn(`Failed to fetch image asset from ${url}:`, err.message);
    return null;
  }
}
