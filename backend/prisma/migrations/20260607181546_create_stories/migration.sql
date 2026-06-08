-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaObjectKey" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "thumbnailUrl" TEXT,
    "thumbnailObjectKey" TEXT,
    "duration" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryView" (
    "storyId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("storyId","viewerId")
);

-- CreateIndex
CREATE INDEX "Story_authorId_expiresAt_idx" ON "Story"("authorId", "expiresAt");

-- CreateIndex
CREATE INDEX "Story_isArchived_expiresAt_idx" ON "Story"("isArchived", "expiresAt");

-- CreateIndex
CREATE INDEX "StoryView_viewerId_idx" ON "StoryView"("viewerId");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
