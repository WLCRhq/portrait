/**
 * One-time migration script: encrypt existing plaintext OAuth tokens.
 * Run after deploying token encryption and setting TOKEN_ENCRYPTION_KEY.
 *
 * Usage: node scripts/encrypt-tokens.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encrypt, isEncrypted } from '../lib/crypto.js';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    const needsAccessToken = user.accessToken && !isEncrypted(user.accessToken);
    const needsRefreshToken = user.refreshToken && !isEncrypted(user.refreshToken);

    if (!needsAccessToken && !needsRefreshToken) {
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(needsAccessToken && { accessToken: encrypt(user.accessToken) }),
        ...(needsRefreshToken && { refreshToken: encrypt(user.refreshToken) }),
      },
    });

    migrated++;
    console.log(`Encrypted tokens for user ${user.email}`);
  }

  console.log(`Done. Migrated: ${migrated}, Skipped (already encrypted): ${skipped}`);
}

main()
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
