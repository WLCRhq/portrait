-- CreateTable
CREATE TABLE "SlideOverlay" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "zIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SlideOverlay_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SlideOverlay" ADD CONSTRAINT "SlideOverlay_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
