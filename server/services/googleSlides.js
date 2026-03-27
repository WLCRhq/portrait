import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../lib/prisma.js';
import { decrypt, encrypt } from '../lib/crypto.js';

function createAuthClient(accessToken, refreshToken) {
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return client;
}

/**
 * Refreshes the access token if needed and updates the DB.
 */
export async function getAuthClient(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  // Decrypt tokens from DB
  const accessToken = decrypt(user.accessToken);
  const refreshToken = decrypt(user.refreshToken);
  const client = createAuthClient(accessToken, refreshToken);

  try {
    const { credentials } = await client.refreshAccessToken();
    if (credentials.access_token !== accessToken) {
      // Re-encrypt the new access token before saving
      await prisma.user.update({
        where: { id: userId },
        data: { accessToken: encrypt(credentials.access_token) },
      });
    }
    client.setCredentials(credentials);
  } catch (err) {
    console.warn('Token refresh failed, using existing token:', err.message);
  }

  return client;
}

/**
 * Get presentation metadata: title, slide page IDs, count.
 */
export async function getPresentationMetadata(authClient, presentationId) {
  const slides = google.slides({ version: 'v1', auth: authClient });
  const res = await slides.presentations.get({ presentationId });

  const presentation = res.data;
  const pageWidth = presentation.pageSize?.width?.magnitude || 9144000;
  const pageHeight = presentation.pageSize?.height?.magnitude || 5143500;

  // Extract background color from the first slide
  const bgColor = extractBgColor(presentation.slides?.[0]);

  return {
    title: presentation.title,
    slideCount: presentation.slides?.length || 0,
    pageWidth,
    pageHeight,
    bgColor,
    pages: presentation.slides?.map((slide) => ({
      objectId: slide.objectId,
      elements: slide.pageElements || [],
    })) || [],
  };
}

/**
 * Extract the background color from a slide as a hex string.
 * Falls back to null if no solid background is found.
 */
function extractBgColor(slide) {
  if (!slide) return null;

  const fill =
    slide.slideProperties?.notesPage?.pageProperties?.pageBackgroundFill ||
    slide.pageProperties?.pageBackgroundFill ||
    slide.slideProperties?.pageBackgroundFill;

  if (!fill?.solidFill?.color?.rgbColor) return null;

  const { red = 0, green = 0, blue = 0 } = fill.solidFill.color.rgbColor;
  const r = Math.round(red * 255).toString(16).padStart(2, '0');
  const g = Math.round(green * 255).toString(16).padStart(2, '0');
  const b = Math.round(blue * 255).toString(16).padStart(2, '0');

  return `#${r}${g}${b}`;
}

/**
 * Extract image elements from a slide's page elements.
 * Returns position/size as percentages of the slide dimensions,
 * plus crop properties from Google Slides.
 */
export function extractImageElements(pageElements, pageWidth, pageHeight) {
  const images = [];

  for (const el of pageElements) {
    if (!el.image) continue;

    const contentUrl = el.image.contentUrl || '';
    const sourceUrl = el.image.sourceUrl || '';

    const size = el.size || {};
    const transform = el.transform || {};

    const elWidth = (size.width?.magnitude || 0) * (transform.scaleX || 1);
    const elHeight = (size.height?.magnitude || 0) * (transform.scaleY || 1);
    const elX = transform.translateX || 0;
    const elY = transform.translateY || 0;

    // Extract crop properties (fractions 0.0-1.0 from each edge)
    const crop = el.image.imageProperties?.cropProperties || {};

    images.push({
      contentUrl,
      sourceUrl,
      x: (elX / pageWidth) * 100,
      y: (elY / pageHeight) * 100,
      width: (elWidth / pageWidth) * 100,
      height: (elHeight / pageHeight) * 100,
      cropTop: crop.topOffset || 0,
      cropBottom: crop.bottomOffset || 0,
      cropLeft: crop.leftOffset || 0,
      cropRight: crop.rightOffset || 0,
    });
  }

  return images;
}

/**
 * Get thumbnail URL for a specific slide page (1600px fallback).
 */
export async function getSlideThumbnailUrl(authClient, presentationId, pageObjectId) {
  const slides = google.slides({ version: 'v1', auth: authClient });
  const res = await slides.presentations.pages.getThumbnail({
    presentationId,
    pageObjectId,
    'thumbnailProperties.thumbnailSize': 'LARGE',
  });

  return res.data.contentUrl;
}
