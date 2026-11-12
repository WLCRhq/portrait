/**
 * Anonymize an IP address by zeroing the last octet (IPv4)
 * or the last 80 bits (IPv6).
 */
export function anonymizeIp(ip) {
  if (!ip) return ip;

  // IPv4: zero last octet
  if (ip.includes('.') && !ip.includes(':')) {
    const parts = ip.split('.');
    parts[3] = '0';
    return parts.join('.');
  }

  // IPv4-mapped IPv6 (::ffff:192.168.1.42)
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    const v4 = ip.slice(7);
    const parts = v4.split('.');
    parts[3] = '0';
    return `::ffff:${parts.join('.')}`;
  }

  // Full IPv6: zero last 5 groups (80 bits)
  const groups = ip.split(':');
  if (groups.length >= 5) {
    for (let i = Math.max(3, groups.length - 5); i < groups.length; i++) {
      groups[i] = '0';
    }
    return groups.join(':');
  }

  return ip;
}

// IPs whose views are never recorded in analytics (e.g. our own office).
// Override with a comma-separated ANALYTICS_EXCLUDED_IPS env var.
const DEFAULT_EXCLUDED_IPS = '50.190.41.54';

function normalizeIp(ip) {
  const trimmed = String(ip || '').trim().toLowerCase();
  return trimmed.startsWith('::ffff:') && trimmed.includes('.') ? trimmed.slice(7) : trimmed;
}

/**
 * True if views from this (raw, un-anonymized) IP should not be tracked.
 */
export function isAnalyticsExcluded(ip) {
  const list = (process.env.ANALYTICS_EXCLUDED_IPS ?? DEFAULT_EXCLUDED_IPS)
    .split(',')
    .map(normalizeIp)
    .filter(Boolean);
  return list.includes(normalizeIp(ip));
}
