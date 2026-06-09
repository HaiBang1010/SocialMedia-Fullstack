-- CreateEnum
CREATE TYPE "StoryItemType" AS ENUM ('TEXT', 'EMOJI', 'MENTION', 'STICKER', 'TAG');

-- CreateTable
CREATE TABLE "StoryItem" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "type" "StoryItemType" NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "scale" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,

    CONSTRAINT "StoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryItem_storyId_idx" ON "StoryItem"("storyId");

-- AddForeignKey
ALTER TABLE "StoryItem" ADD CONSTRAINT "StoryItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
