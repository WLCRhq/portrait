/*
  Warnings:

  - You are about to drop the column `imageData` on the `Slide` table. All the data in the column will be lost.
  - You are about to drop the column `imageData` on the `SlideOverlay` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Slide" DROP COLUMN "imageData";

-- AlterTable
ALTER TABLE "SlideOverlay" DROP COLUMN "imageData";
