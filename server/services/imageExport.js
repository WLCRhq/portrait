import { google } from 'googleapis';
import { pdf } from 'pdf-to-img';
import { getSlideThumbnailUrl } from './googleSlides.js';

/**
 * Extract the structured error reason from a Drive API error
 * (e.g. 'exportSizeLimitExceeded'). Handles arraybuffer responses.
 */
export function driveErrorReason(err) {
  try {
    let data = err?.response?.data;
    if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
      data = JSON.parse(Buffer.from(data).toString());
    }
    return data?.error?.errors?.[0]?.reason || err?.errors?.[0]?.reason || null;
  } catch {
    return null;
  }
}

/**
 * Download a presentation as PDF. Tries files.export first; that endpoint
 * caps exports at 10MB (403 exportSizeLimitExceeded), so large decks fall
 * back to the exportLinks URL from files.get, which has no such cap.
 */
export async function exportPresentationPdf(authClient, presentationId) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  try {
    const res = await drive.files.export({
      fileId: presentationId,
      mimeType: 'application/pdf',
    }, {
      responseType: 'arraybuffer',
    });
    return Buffer.from(res.data);
  } catch (err) {
    const reason = driveErrorReason(err);
    console.warn(`[ImageExport] files.export failed (${reason || err.message}) — trying exportLinks`);

    const meta = await drive.files.get({ fileId: presentationId, fields: 'exportLinks', supportsAllDrives: true });
    const url = meta.data.exportLinks?.['application/pdf'];
    if (!url) throw err;

    const { token } = await authClient.getAccessToken();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`exportLinks fetch failed: ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

/**
 * Export a presentation as PDF via Google Drive API, then convert
 * each page to a high-resolution PNG.
 * Returns an array of Buffers (one per slide).
 */
export async function exportSlidesFromPdf(authClient, presentationId, slideCount) {
  const pdfBuffer = await exportPresentationPdf(authClient, presentationId);
  console.log(`[ImageExport] PDF downloaded: ${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  // Convert each PDF page to a high-res PNG
  const pages = [];
  const pdfPages = await pdf(pdfBuffer, { scale: 4.0 }); // 4x scale for ~3200px width (crisp on retina)

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
