-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- Grant admin role to the platform owner
UPDATE "User" SET role = 'admin' WHERE email = 'adam@wlcr.io';
