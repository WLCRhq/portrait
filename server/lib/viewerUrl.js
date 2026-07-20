export function viewerUrl(slug) {
  return `${process.env.CLIENT_URL || 'http://localhost:5173'}/${slug}`;
}
