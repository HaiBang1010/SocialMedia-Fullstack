-- CreateTable
CREATE TABLE "MessageMedia" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "thumbnailObjectKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,

    CONSTRAINT "MessageMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageMedia_messageId_order_key" ON "MessageMedia"("messageId", "order");

-- AddForeignKey
ALTER TABLE "MessageMedia" ADD CONSTRAINT "MessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
