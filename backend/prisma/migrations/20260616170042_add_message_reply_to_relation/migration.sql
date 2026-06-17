-- Phase Polish — reply-to-message FK self-relation on Message.
-- replyToId already existed as a scalar column since Phase 5.1 (all rows NULL), so this is
-- purely additive: an index + a self-referencing FK (onDelete SET NULL).
--
-- NOTE: `prisma migrate dev` also emitted spurious DROP INDEX / ALTER COLUMN DROP DEFAULT
-- statements against Post.searchVector / User.searchVector (the Phase 7 GENERATED tsvector
-- columns, declared as Unsupported("tsvector") which doesn't fully silence drift detection).
-- Those were removed by hand — drift artifacts, not part of this change, and the DROP DEFAULT
-- form fails on a GENERATED column (42601). Applied via `migrate deploy` to skip the shadow-DB
-- re-diff. The same hand-edit is needed for any future migration while the tsvector columns exist.

-- CreateIndex
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
