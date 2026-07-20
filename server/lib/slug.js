import { nanoid } from 'nanoid';
import prisma from './prisma.js';

// Top-level client routes and server path prefixes a slug must never shadow
const RESERVED = new Set(['dashboard', 'view', 'auth', 'api', 'uploads', 'assets', 'login']);

export function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

// Derive a URL slug from a title, appending -2, -3, ... until unused
export async function uniqueSlug(title) {
  const base = slugify(title) || nanoid(8);
  let candidate = base;
  for (let n = 2; RESERVED.has(candidate) || await prisma.shareLink.findUnique({ where: { slug: candidate } }); n++) {
    candidate = `${base}-${n}`;
  }
  return candidate;
}
