/**
 * Validate required environment variables at startup.
 * Exits the process with an error if any are missing.
 */
const REQUIRED = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'TOKEN_ENCRYPTION_KEY',
];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Validate TOKEN_ENCRYPTION_KEY format
if (process.env.TOKEN_ENCRYPTION_KEY.length !== 64) {
  console.error('FATAL: TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  process.exit(1);
}
