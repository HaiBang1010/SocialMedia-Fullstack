# Backlog

> Issue, tech debt, ideas — chưa làm nhưng không quên.
> Quy ước: [scope] mô tả ngắn — lý do/context

## Phase 2 — Scope notes (BE + FE 2.4/2.5 đã xong)

- [ ] [scope] Phase 2 chỉ đăng 1 ẢNH ĐƠN. Carousel multi-image đẩy về Phase 3.

## P1 — Sắp tới (làm trong phase hiện tại nếu có thời gian)

(empty)

## Phase Polish Round 1 — residual / follow-up (defer)

> 4 item đã ship (Toast / Safari voice / Reply-to / httpOnly cookie — xem PROGRESS 2026-06-17 + entries `[x]` bên dưới). 6 mục dưới là phần defer/follow-up tách ra.

- [P2] [frontend/messaging] **Cross-browser voice playback transcode** (Plan C residual) — Safari `<audio>` KHÔNG decode được `audio/webm`/Opus ⇒ voice note do Chrome user quay không play trên Safari (`play().catch` nuốt lỗi, bars đứng). Plan C chỉ fix *recording* trên Safari. Fix đầy đủ = server-side transcode về codec universal (vd AAC/mp4) khi nhận voice, hoặc lưu cả 2 format.
- [P3] [backend/media] **mp3 voice support** (YAGNI) — `MediaRecorder` không bao giờ emit mp3 + không có existing mp3 usage. Chỉ thêm nếu sau này import file âm thanh ngoài.
- [P3] [frontend/messaging] **Reply + sticker/voice/emoji-standalone** (Plan B scope E1) — reply-to hiện CHỈ wire ở text+media send path. Sticker/GIF/voice/emoji-standalone gửi qua handler riêng (KHÔNG mang `replyToId`). Wire reply cho các path đó nếu cần (BE đã accept `replyToId` orthogonal).
- [P2] [backend/auth] **Refresh-token rotation + reuse detection** (Plan D) — hiện non-rotating (1 refresh token 7d, `/auth/refresh` không cấp mới). Nâng: rotate mỗi refresh + detect reuse (token cũ dùng lại → revoke family) cho security cao hơn. Cần lưu token family/jti (DB hoặc Redis).
- [P3] [backend/auth] **Login dùng `publicUserSelect`** — `auth.service.login` trả full user (trừ passwordHash) ⇒ body có thêm `lastSeenAt`/`updatedAt` so với register (dùng `publicUserSelect`). Không leak passwordHash nhưng inconsistency (phát hiện lúc Plan D). Đồng bộ `login` dùng `publicUserSelect` như register.
- [P2] [backend/auth] **CSRF token** — cookie auth (Polish R1) hiện mitigate CSRF bằng `sameSite:'lax'` + cookie path-scope `/auth` + refresh idempotent. Nếu sau cần state-changing endpoint dựa cookie hoặc cross-site thật (`sameSite:'none'`) → thêm CSRF token (double-submit / synchronizer).

## Phase Polish Round 2 — residual / follow-up (defer)

> Avatar upload + suggested follows + mixed feed đã ship (PROGRESS 2026-06-18).

- [P2] [backend/media] **Avatar orphan MinIO cleanup** — replace avatar / reset-to-DiceBear bỏ object cũ trên MinIO (gom với orphan-sweep debt Posts/Stories/Messages sẵn có).
- [P3] [backend/feed] **Stranger ranking beyond pool cap** — mixed feed rank in-memory trên pool `STRANGER_POOL_CAP=100`; sâu hơn 100 stranger thì hết (nextCursor null). Nâng = materialized engagement score / keyset ranking nếu cần scale.
- [P3] [backend/feed] **FoF global-popularity tiebreak** — FoF strangers rank theo mutual-count desc; chưa tiebreak theo global follower-count (suggested cũng vậy).
- [P3] [frontend/feed] **Mixed-feed reclassification on follow** — follow stranger in-feed chỉ patch `isFollowingAuthor` (ẩn nút), post giữ nguyên vị trí session này; reclassify sang followed-stream ở next natural load (KHÔNG invalidate feed để giữ scroll — chủ đích).
- [P3] [frontend/discovery] **`/explore` page + "See all"** — RightRail/suggested chưa có trang explore riêng; "See all" link defer.

## Phase 5.5 — Defer (đóng Phase 5; tách khỏi scope create+recall)

- [x] [backend+frontend/messaging] **Reply-to message** — ✅ **DONE Polish R1**: FK self-relation (migration `add_message_reply_to_relation`) + quote bubble + scroll/jump (older-page fetch cap 10) + desktop hover `↩` / mobile long-press action sheet. Residual: chỉ text+media path (xem Polish R1 residual).
- [ ] [backend+frontend/messaging] **Group management** — add/remove/kick members, leave group, rename/đổi avatar group, admin transfer. 5.5 chỉ tạo group; quản lý sau (cần endpoints + Participant mutation + UI settings).
- [ ] [backend/messages] **Orphan S3 cleanup cron** — recall xóa S3 best-effort (soft-fail); thêm sweep cron quét object mồ côi (khớp debt Posts/Stories "orphan check Phase polish"). Cũng gom: recall giữ lại `MessageMedia` rows (chỉ xóa S3) → hard-delete rows.
- [ ] [frontend/messaging] **GroupCreateModal pagination** — hiện load toàn bộ recent+mutual không cursor (pool nhỏ chấp nhận). Cursor/virtualize khi user có nhiều follow.

## P2 — Sau (làm trong phase tiếp theo)

- [ ] [backend/lib/jwt] Tách error types: TokenExpired vs WrongTokenType vs InvalidSignature. Hiện gộp chung message → khó debug khi user báo lỗi.
- [ ] [backend/middleware/error] Thêm pino logger thay console.log.
- [ ] [backend/modules/users] userPublicSchema (Zod) duplicate với publicUserSelect (Prisma). Sửa field phải đồng bộ 2 chỗ. Cân nhắc generate Zod từ Prisma (prisma-zod-generator) khi schema lớn hơn.
- [x] [frontend/auth] Token lưu localStorage → XSS đọc được — ✅ **DONE Polish R1**: refresh token → httpOnly cookie, access token in-memory (bỏ persist), `authStatus` boot-gate. Residual: refresh rotation + CSRF (xem Polish R1 residual).
- [P2] [backend/follows] Follow approval flow cho private accounts. 
  Hiện tại: ai follow cũng instant approve (không có Follow.status enum). 
  Phase polish: thêm enum PENDING/ACCEPTED + endpoints accept/reject + 
  Notification tích hợp. Đây là feature IG thật có.
- [P2] [frontend/feed] "Reload sau idle ~5 phút" — quyết định cách 
  (TanStack staleTime + refetchOnFocus / idle detection + banner / polling) 
  khi tới Phase 2.4. IG-like behavior.

## P3 — Sau nữa (nice-to-have, có thể không làm)

"switch sang openapi-typescript khi >15 endpoints"

- [P3] [frontend/feed] useFeed nhận custom limit khi cần (vd discover feed).
  Hiện tại no-arg, dùng backend default 20.

- [P3] [frontend/story-viewer] Archive viewer auto-advance qua page boundary
      (Checkpoint 4.4): hết loaded set → `fetchNextPage()` + index++ (spinner ngắn
      tới khi page kế load). Chấp nhận; nâng = prefetch-on-near-end nếu cần mượt.
- [P3] [backend/stories] viewCount = `_count.views` aggregate mỗi story kể cả trong
      feed (Checkpoint 4.4) — feed luôn trả `null` (non-owner, no leak) nhưng vẫn chạy
      aggregate per row. Tối ưu (skip aggregate khi không phải owner) nếu feed phình.

- [ ] [backend/media] Image transform (thumbnail, resize) — Phase 2 chỉ lưu original; thumbnail server-side hoặc on-the-fly cân nhắc Phase polish.
- [ ] [backend/feed] Feed cải tiến — Phase 2 dùng follow+random simple. Personalized ranking, recency weight, engagement signals → Phase polish.
- [ ] [backend/storage] Automate MinIO setup — viết script bash hoặc 
      docker-compose init container chạy `mc alias set` + `mc mb` + 
      `mc anonymous set download` tự động khi `docker compose up`. 
      Hiện tại bucket + policy phải tạo tay sau mỗi lần `down -v`.
- [ ] [backend/storage] Creds MinIO hardcode `minio`/`minio12345` trong 
      docker-compose.yml (dev only). Phase polish: chuyển sang env var 
      (`${MINIO_ROOT_USER}`...) + secret thật cho prod, không commit creds.
- [P3] [backend/media] Orphan S3 cleanup khi multi-image upload partial fail
      (Checkpoint 3.1). 1 trong N PUT fail → ảnh đã upload thành object không
      reference trong DB; retry hiện re-upload TOÀN BỘ → thêm orphan. Solution:
      (a) memo uploaded `MediaInput[]` theo image id để retry skip file đã xong,
      hoặc (b) periodic cleanup job xóa objects không reference trong DB.
- [P3] [frontend/composer] Pointer-drag reorder cho `ImageStrip` (Checkpoint
      3.1). Hiện dùng nút ◀▶ swap neighbour (ít code, no dep) — nâng lên kéo-thả
      như IG khi có thời gian.


## Phase 4.3b — Stories overlays (defer)

- [P3] [frontend/story-overlay] Multi-touch scale/rotate overlays — pinch-zoom + 2-finger
      rotate cho StoryItem (4.3a chỉ drag; field `scale`/`rotation` đã có DB, default 1/0).
- [P3] [frontend/story-overlay] MENTION/STICKER/TAG overlay types — enum `StoryItemType` đã
      khai đủ 5 value (DB) + Zod gate 2 (TEXT/EMOJI); chỉ cần thêm discriminated case Zod +
      render component (MENTION → link profile, TAG, STICKER picker). KHÔNG enum migration.

## Phase 5+ — defer (cần messaging / socket)

- [P3] [stories] Story reactions (heart/tym) — wire với messaging (reaction → DM owner).
- [P3] [stories] Reply input ở story viewer (bottom chrome `h-20` hiện placeholder) — wire DM.
- [P3] [stories] WebSocket realtime view count update (Checkpoint 4.4) — hiện owner
      refetch/reopen mới thấy count tăng; realtime cần socket (Phase 5).

## Phase polish — Stories

- [P3] [frontend/story-viewer] Mute state lift → store (persist across stories + reset về
      default mỗi lần mở). Hiện `muted` là component state: KHÔNG persist khi đổi story,
      KHÔNG reset khi reopen (session trước fallback→muted thì reopen giữ muted).
- [P3] [frontend/story-viewer] Bottom sheet UI cho ViewersListModal trên mobile — hiện
      Radix Dialog centered `max-w-md`; IG dùng bottom sheet kéo lên.
[Phase polish]:
- Auto-retry failed message on reconnect (Option C queue pattern)
- Distinguish network vs validation errors for retry button visibility
- Multi-message retry batch (currently per-message only)
- Seen behavior toggle (IG default vs hide-on-reply) settings
- [x] [frontend/app-wide] Toast notification system — ✅ **DONE Polish R1**: **sonner** (`App.tsx`
      mount + `lib/toast.ts` `notifyError`/`notifySuccess`). MessageInput/useReactToMessage/Tier-2
      mutations → toast; auth **hybrid** (inline 401+field, toast network/500). Anti-spam: mutation/
      user-action only (KHÔNG query onError). StoryComposer/PostComposer GIỮ retry-screen (không toast).

[Phase 5.3]:
- Typing in conversation list view ("typing..." subtitle indicator)
- Unread badge count

[Phase 5.4a — media messages, defer]:
- [P2] [backend/messages] Orphan S3 media cleanup: upload xong nhưng POST message fail / user bỏ
      composer → object mồ côi (khớp debt Posts/Stories "orphan check để Phase polish"). MessageMedia
      đã lưu `objectKey`/`thumbnailObjectKey` ⇒ recall (5.5) xóa được; orphan-sweep cron = Phase polish.
- [P3] [frontend/messaging] Drag-drop file vào thread + paste ảnh từ clipboard (nice-to-have).
- [P3] [frontend/messaging] Reorder media trước khi gửi (kéo sắp xếp preview strip).
- [P3] [frontend/messaging] Edit caption sau khi gửi (cần 5.5 message edit).
- [P3] [frontend/messaging] Pinch-zoom ảnh trong MediaLightbox (mobile); hiện chỉ swipe + arrows.
- [P3] [frontend/messaging] Thumbnail ceiling 512px — nếu single-image trông mềm trên màn lớn,
      nâng ceiling hoặc dùng `url` gốc cho single-image grid cell.

[Phase 5.4b — voice messages, defer]:
- [x] [frontend/messaging] Safari/iOS voice (`audio/mp4`) — ✅ **DONE Polish R1**: dynamic-MIME
      recorder (`pickSupportedVoiceMime` webm→mp4) + presign enum +`audio/mp4` + `EXT_BY_MIME` m4a +
      `MAX_VOICE_BYTES` 5→10MB. Residual: cross-browser playback transcode (xem Polish R1 residual).
- [P3] [frontend/messaging] Pause/resume recording + real waveform (decode audio buffer) +
      trim/preview-before-send (hiện tap stop = auto-send ngay, KHÔNG nghe lại trước khi gửi).

## Phase 6 — Calls (defer; Phase 6 code = LiveKit Cloud, Call-as-Message)

- [P2] [backend/calls] **LiveKit webhook lifecycle** — Phase 6 defer webhook (Decision 2): missed/ended
      dựa FE 30s timeout + LiveKit `emptyTimeout` 600s. Thêm `POST /calls/webhooks` (verify signature
      qua `WebhookReceiver`, raw-body middleware TRƯỚC express.json, unauthenticated) handle
      `room_finished`/`participant_left` → mark ended chính xác (eventual-consistency). Cần ngrok dev
      hoặc deploy URL. Fix luôn orphan Call row (initiator connect-fail → endedAt null treo) + residual
      T2: GROUP all-close đồng thời + LiveKit count lag → tới 15s stale-lock; pagehide miss hoàn toàn
      → ghost lingers (banner "Call in progress" hiện) tới start call lần sau. Webhook = exact end-detection.
- [P3] [frontend/calls] **Custom LiveKit tiles** — Phase 6 dùng prebuilt `GridLayout` + `@livekit/
      components-styles` (lệch theme Beng, Decision 7). Build tile riêng bằng `useTracks`/`useParticipants`
      để khớp design. Kèm: FocusLayout active-speaker (hiện GridLayout), device picker (mic/cam settings).
- [P3] [frontend/calls] **Screen sharing** (LiveKit hỗ trợ `Track.Source.ScreenShare`) + **background blur**
      (LiveKit processors) — defer Phase 6.
- [P3] [calls] **Call token refresh** cho call > 1h (hiện TTL 1h fixed) + **multi-tab call state sync**
      (callStore per-tab; mở call ở 2 tab cùng user chưa đồng bộ).
- [P3] [calls] **Reaction trên CALL message** + reply-to CALL — hiện reaction enabled (generic) nhưng
      chưa thiết kế UX riêng; recall CALL bị chặn (400, events không retractable).
- [P3] [calls] **Free-tier quota monitor** — LiveKit dashboard 5000 participant-min/mo + 100 concurrent;
      thêm cảnh báo/graceful error khi gần limit trước khi production.

## Phase 7 — Notifications / Search / Avatar (defer)

- [ ] [backend+frontend/notifications] **MENTION notifications** — deferred (D4). Needs a backend
      @-mention parser (FE has `parseMentions.tsx`; port the regex to `createComment`/post caption)
      + a 4th NotificationType. Flood-risk + parser cost kept it out of Phase 7.
- [ ] [backend/notifications] **STORY_VIEW notifications** — deferred (D6). Ephemeral + high-volume
      (N viewers per story) → would flood; revisit with grouping ("X and 5 others viewed").
- [ ] [backend/notifications] **Reply notifies post-author only**, not the parent-comment author.
      The 3 stored types model post-author notifications cleanly; a "reply to your comment" notif
      needs a dedicated type/ref. Add when comment threads get more first-class.
- [ ] [frontend/notifications] **Notification grouping** ("X and 5 others liked your post") — Phase 7
      stores one row per (actor,type,ref) with 1h dedupe; no aggregation across actors yet.
- [ ] [frontend/notifications] **Post thumbnail on LIKE/COMMENT rows** — currently link-only (deep-
      links to `/posts/:id`). Embedding a thumbnail needs a post relation on Notification (kept
      scalar per D3) or a batch fetch. Nice-to-have.
- [ ] [frontend/nav] **Mobile Notifications entry** — BottomNav (5 items) has no Notifications tab;
      it's Sidebar (desktop) only. Add a top-bar bell or a 6th mobile entry so mobile users reach
      `/notifications` without typing the URL.
- [ ] [frontend/notifications] **Notification settings** (mute, sound off, per-type toggles) +
      Service-Worker push (background) — deferred from Phase 7 scope (Phase polish).
- [ ] [backend/search] **Search ranking/pagination tuning** — `limit`+`offset` (rank breaks cursor),
      capped at 20/200. Prefix `to_tsquery` (`token:*`) matches lexeme prefixes only, not arbitrary
      substrings; consider `pg_trgm` for true fuzzy/substring + typo tolerance if needed.
- [ ] [backend/messages] **Denormalized unread counter** — per-conversation unread is a per-page
      `$queryRaw`; `unread-total` scans all the viewer's messages. Fine at Beng scale; if it gets hot,
      add a maintained counter (increment on send, reset on read) instead of computing each time.

## DONE

- 2026-06-10 [frontend/story-viewer] Bar↔video desync khi reopen video (progress bar chạy
  nhưng video đứng) — Checkpoint 4.4 follow-up. Fix: thêm `isOpen` vào deps effect video
  play/pause (viewer không unmount khi close → `currentStory.id` persist → deps không đổi →
  effect không re-fire → `<video>` remount mới không được gọi `play()`). Bao phủ luôn
  tech-debt "bar↔video drift" ghi nhận ở 4.2.
- 2026-06-09 [frontend/story-viewer] Profile-entry-point cho viewer (single-user mode) —
  Checkpoint 4.4. Avatar profile có ring coral khi `hasActiveStory` → mở viewer
  single-user mode. Cross-user OFF. Delete reachable (archive + single-user). 4.2 đã
  làm phần data-source fallback; 4.4 hoàn tất UI entry point.
- 2026-06-06 [frontend/profile] Followers/following count placeholder `0` →
  count THẬT — Checkpoint 2.5. Backend `GET /users/:username` trả ProfileUser
  (postsCount/followersCount/followingCount + isFollowing). postsCount mirror grid.
- 2026-06-06 [frontend/profile] Public profile route `/users/:username` —
  Checkpoint 2.5. `UserProfilePage` (merge từ ProfilePage), `/profile` redirect.
  Follow button (optimistic + invalidate onSettled).
- 2026-06-06 [frontend/post] Author name/avatar clickable → `/users/:username` —
  Checkpoint 2.5. Wire `<Link>` ở PostCard/PostDetailView/CommentItem.
- 2026-06-03 [frontend/feed] Infinite scroll feed (useInfiniteQuery +
  IntersectionObserver, không phân trang button) — Checkpoint 2.4b. Hand-roll
  `useInfiniteScroll` (no dep). Dùng chung FeedPage + CommentList.