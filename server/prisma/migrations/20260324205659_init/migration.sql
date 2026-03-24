-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slideCount" INTEGER NOT NULL DEFAULT 0,
    "exportedAt" TIMESTAMP(3),
    "exportStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slide" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Slide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ViewSession" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "viewerIp" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "totalSeconds" INTEGER,

    CONSTRAINT "ViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlideEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "slideIndex" INTEGER NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "exitedAt" TIMESTAMP(3),
    "durationMs" INTEGER,

    CONSTRAINT "SlideEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Slide_deckId_index_key" ON "Slide"("deckId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_slug_key" ON "ShareLink"("slug");

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Slide" ADD CONSTRAINT "Slide_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ViewSession" ADD CONSTRAINT "ViewSession_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlideEvent" ADD CONSTRAINT "SlideEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ViewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
