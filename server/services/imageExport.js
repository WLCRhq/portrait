import { getSlideThumbnailUrl } from './googleSlides.js';

/**
 * Fetch the actual PNG image bytes from a Google Slides thumbnail URL.
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
