# Backlog

> Issues, tech debt, ideas — not done yet but not forgotten.
> Convention: [scope] short description — reason/context

## Phase 2 — Scope notes (BE + FE 2.4/2.5 done)

- [ ] [scope] Phase 2 only posts a SINGLE IMAGE. Multi-image carousel pushed to Phase 3.

## P1 — Upcoming (do in the current phase if there's time)

(empty)

## Phase Polish Round 1 — residual / follow-up (defer)

> 4 items shipped (Toast / Safari voice / Reply-to / httpOnly cookie — see PROGRESS 2026-06-17 + the `[x]` entries below). The 6 items below are the defer/follow-up parts split out.

- [P2] [frontend/messaging] **Cross-browser voice playback transcode** (Plan C residual) — Safari `<audio>` cannot decode `audio/webm`/Opus, so a voice note recorded by a Chrome user won't play on Safari (`play().catch` swallows the error, bars freeze). Plan C only fixes *recording* on Safari. The full fix = server-side transcode to a universal codec (e.g. AAC/mp4) when receiving voice, or store both formats.
- [P3] [backend/media] **mp3 voice support** (YAGNI) — `MediaRecorder` never emits mp3 + there is no existing mp3 usage. Only add if external audio files are imported later.
- [P3] [frontend/messaging] **Reply + sticker/voice/emoji-standalone** (Plan B scope E1) — reply-to is currently ONLY wired into the text+media send path. Sticker/GIF/voice/emoji-standalone are sent through separate handlers (they do NOT carry `replyToId`). Wire reply into those paths if needed (the BE already accepts `replyToId` orthogonally).
- [P2] [backend/auth] **Refresh-token rotation + reuse detection** (Plan D) — currently non-rotating (1 refresh token 7d, `/auth/refresh` does not issue a new one). Upgrade: rotate on every refresh + detect reuse (an old token reused → revoke the family) for stronger security. Requires storing token family/jti (DB or Redis).
- [P3] [backend/auth] **Login should use `publicUserSelect`** — `auth.service.login` returns the full user (minus passwordHash), so the body has extra `lastSeenAt`/`updatedAt` compared to register (which uses `publicUserSelect`). No passwordHash leak but an inconsistency (found during Plan D). Align `login` to use `publicUserSelect` like register.
- [P2] [backend/auth] **CSRF token** — cookie auth (Polish R1) currently mitigates CSRF via `sameSite:'lax'` + cookie path-scope `/auth` + idempotent refresh. If a cookie-based state-changing endpoint or true cross-site (`sameSite:'none'`) is needed later → add a CSRF token (double-submit / synchronizer).

## Phase Polish Round 2 — residual / follow-up (defer)

> Avatar upload + suggested follows + mixed feed shipped (PROGRESS 2026-06-18).

- [P2] [backend/media] **Avatar orphan MinIO cleanup** — replacing an avatar / resetting to DiceBear leaves the old object on MinIO (bundle with the existing orphan-sweep debt for Posts/Stories/Messages).
- [P3] [backend/feed] **Stranger ranking beyond pool cap** — mixed feed ranks in-memory over a pool of `STRANGER_POOL_CAP=100`; beyond 100 strangers it runs out (nextCursor null). Upgrade = materialized engagement score / keyset ranking if scale is needed.
- [P3] [backend/feed] **FoF global-popularity tiebreak** — FoF strangers are ranked by mutual-count desc; not yet tie-broken by global follower-count (same applies to suggested).
- [P3] [frontend/feed] **Mixed-feed reclassification on follow** — following a stranger in-feed only patches `isFollowingAuthor` (hides the button), the post keeps its position for this session; reclassify into the followed-stream on the next natural load (do NOT invalidate the feed, to preserve scroll — intentional).
- [P3] [frontend/discovery] **`/explore` page + "See all"** — RightRail/suggested has no dedicated explore page yet; the "See all" link is deferred.

## Phase 5.5 — Defer (closing Phase 5; split out from the create+recall scope)

- [x] [backend+frontend/messaging] **Reply-to message** — ✅ **DONE Polish R1**: FK self-relation (migration `add_message_reply_to_relation`) + quote bubble + scroll/jump (older-page fetch cap 10) + desktop hover `↩` / mobile long-press action sheet. Residual: text+media path only (see Polish R1 residual).
- [ ] [backend+frontend/messaging] **Group management** — add/remove/kick members, leave group, rename/change group avatar, admin transfer. 5.5 only creates groups; management later (needs endpoints + Participant mutation + settings UI).
- [ ] [backend/messages] **Orphan S3 cleanup cron** — recall deletes S3 best-effort (soft-fail); add a sweep cron to scan orphaned objects (matches the Posts/Stories "orphan check Phase polish" debt). Also bundle: recall keeps the `MessageMedia` rows (only deletes S3) → hard-delete the rows.
- [ ] [frontend/messaging] **GroupCreateModal pagination** — currently loads the entire recent+mutual set with no cursor (acceptable for a small pool). Cursor/virtualize once a user has many follows.

## P2 — Later (do in the next phase)

- [ ] [backend/lib/jwt] Split error types: TokenExpired vs WrongTokenType vs InvalidSignature. Currently lumped into one message → hard to debug when a user reports an error.
- [ ] [backend/middleware/error] Add a pino logger instead of console.log.
- [ ] [backend/modules/users] userPublicSchema (Zod) duplicates publicUserSelect (Prisma). Changing a field requires syncing both places. Consider generating Zod from Prisma (prisma-zod-generator) when the schema gets bigger.
- [x] [frontend/auth] Token stored in localStorage → readable by XSS — ✅ **DONE Polish R1**: refresh token → httpOnly cookie, access token in-memory (persist removed), `authStatus` boot-gate. Residual: refresh rotation + CSRF (see Polish R1 residual).
- [P2] [backend/follows] Follow approval flow for private accounts.
  Currently: anyone who follows is instantly approved (no Follow.status enum).
  Phase polish: add a PENDING/ACCEPTED enum + accept/reject endpoints +
  Notification integration. This is a real IG feature.
- [P2] [frontend/feed] "Reload after ~5 min idle" — decide on the approach
  (TanStack staleTime + refetchOnFocus / idle detection + banner / polling)
  when reaching Phase 2.4. IG-like behavior.

## P3 — Even later (nice-to-have, may not get done)

"switch to openapi-typescript when >15 endpoints"

- [P3] [frontend/feed] useFeed accepts a custom limit when needed (e.g. discover feed).
  Currently no-arg, uses backend default 20.

- [P3] [frontend/story-viewer] Archive viewer auto-advance across page boundary
      (Checkpoint 4.4): when the loaded set runs out → `fetchNextPage()` + index++ (short spinner
      until the next page loads). Acceptable; upgrade = prefetch-on-near-end if smoother is needed.
- [P3] [backend/stories] viewCount = `_count.views` aggregate per story even in the
      feed (Checkpoint 4.4) — the feed always returns `null` (non-owner, no leak) but still runs
      the aggregate per row. Optimize (skip the aggregate when not the owner) if the feed grows.

- [ ] [backend/media] Image transform (thumbnail, resize) — Phase 2 only stores the original; consider server-side or on-the-fly thumbnails in Phase polish.
- [ ] [backend/feed] Feed improvements — Phase 2 uses a simple follow+random. Personalized ranking, recency weight, engagement signals → Phase polish.
- [ ] [backend/storage] Automate MinIO setup — write a bash script or a
      docker-compose init container that runs `mc alias set` + `mc mb` +
      `mc anonymous set download` automatically on `docker compose up`.
      Currently the bucket + policy must be created by hand after each `down -v`.
- [ ] [backend/storage] MinIO creds hardcoded `minio`/`minio12345` in
      docker-compose.yml (dev only). Phase polish: move to env vars
      (`${MINIO_ROOT_USER}`...) + real secrets for prod, don't commit creds.
- [P3] [backend/media] Orphan S3 cleanup on partial multi-image upload failure
      (Checkpoint 3.1). If 1 of N PUTs fails → the already-uploaded image becomes an object not
      referenced in the DB; the current retry re-uploads EVERYTHING → adds more orphans. Solution:
      (a) memoize uploaded `MediaInput[]` by image id so retry skips files already done,
      or (b) a periodic cleanup job that deletes objects not referenced in the DB.
- [P3] [frontend/composer] Pointer-drag reorder for `ImageStrip` (Checkpoint
      3.1). Currently uses ◀▶ buttons to swap with a neighbour (less code, no dep) — upgrade to drag-and-drop
      like IG when there's time.


## Phase 4.3b — Stories overlays (defer)

- [P3] [frontend/story-overlay] Multi-touch scale/rotate overlays — pinch-zoom + 2-finger
      rotate for StoryItem (4.3a is drag-only; the `scale`/`rotation` fields already exist in the DB, default 1/0).
- [P3] [frontend/story-overlay] MENTION/STICKER/TAG overlay types — the `StoryItemType` enum already
      declares all 5 values (DB) + the Zod gate covers 2 (TEXT/EMOJI); only need to add the discriminated Zod case +
      a render component (MENTION → profile link, TAG, STICKER picker). No enum migration.

## Phase 5+ — defer (needs messaging / socket)

- [P3] [stories] Story reactions (heart/tym) — wire with messaging (reaction → DM the owner).
- [P3] [stories] Reply input in the story viewer (the bottom chrome `h-20` is currently a placeholder) — wire DM.
- [P3] [stories] WebSocket realtime view count update (Checkpoint 4.4) — the owner currently
      only sees the count increase on refetch/reopen; realtime needs a socket (Phase 5).

## Phase polish — Stories

- [P3] [frontend/story-viewer] Lift mute state → store (persist across stories + reset to
      default each time it's opened). Currently `muted` is component state: it does NOT persist when changing stories,
      and does NOT reset on reopen (if the previous session fell back to muted, reopen keeps muted).
- [P3] [frontend/story-viewer] Bottom sheet UI for ViewersListModal on mobile — currently a
      centered Radix Dialog `max-w-md`; IG uses a slide-up bottom sheet.
[Phase polish]:
- Auto-retry failed message on reconnect (Option C queue pattern)
- Distinguish network vs validation errors for retry button visibility
- Multi-message retry batch (currently per-message only)
- Seen behavior toggle (IG default vs hide-on-reply) settings
- [x] [frontend/app-wide] Toast notification system — ✅ **DONE Polish R1**: **sonner** (`App.tsx`
      mount + `lib/toast.ts` `notifyError`/`notifySuccess`). MessageInput/useReactToMessage/Tier-2
      mutations → toast; auth **hybrid** (inline 401+field, toast network/500). Anti-spam: mutation/
      user-action only (NOT query onError). StoryComposer/PostComposer KEEP the retry screen (no toast).

[Phase 5.3]:
- Typing in conversation list view ("typing..." subtitle indicator)
- Unread badge count

[Phase 5.4a — media messages, defer]:
- [P2] [backend/messages] Orphan S3 media cleanup: upload succeeds but POST message fails / user abandons
      the composer → orphaned object (matches the Posts/Stories "orphan check for Phase polish" debt). MessageMedia
      already stores `objectKey`/`thumbnailObjectKey`, so recall (5.5) can delete it; the orphan-sweep cron = Phase polish.
- [P3] [frontend/messaging] Drag-drop file into thread + paste image from clipboard (nice-to-have).
- [P3] [frontend/messaging] Reorder media before sending (drag to arrange the preview strip).
- [P3] [frontend/messaging] Edit caption after sending (needs 5.5 message edit).
- [P3] [frontend/messaging] Pinch-zoom image in MediaLightbox (mobile); currently only swipe + arrows.
- [P3] [frontend/messaging] Thumbnail ceiling 512px — if a single-image looks soft on a large screen,
      raise the ceiling or use the original `url` for the single-image grid cell.

[Phase 5.4b — voice messages, defer]:
- [x] [frontend/messaging] Safari/iOS voice (`audio/mp4`) — ✅ **DONE Polish R1**: dynamic-MIME
      recorder (`pickSupportedVoiceMime` webm→mp4) + presign enum +`audio/mp4` + `EXT_BY_MIME` m4a +
      `MAX_VOICE_BYTES` 5→10MB. Residual: cross-browser playback transcode (see Polish R1 residual).
- [P3] [frontend/messaging] Pause/resume recording + real waveform (decode audio buffer) +
      trim/preview-before-send (currently tap stop = auto-send immediately, NO playback before sending).

## Phase 6 — Calls (defer; Phase 6 code = LiveKit Cloud, Call-as-Message)

- [P2] [backend/calls] **LiveKit webhook lifecycle** — Phase 6 defers the webhook (Decision 2): missed/ended
      relies on the FE 30s timeout + LiveKit `emptyTimeout` 600s. Add `POST /calls/webhooks` (verify signature
      via `WebhookReceiver`, raw-body middleware BEFORE express.json, unauthenticated) to handle
      `room_finished`/`participant_left` → mark ended precisely (eventual-consistency). Needs ngrok in dev
      or a deploy URL. Also fixes the orphan Call row (initiator connect-fail → endedAt null hanging) + residual
      T2: GROUP all-close simultaneously + LiveKit count lag → up to 15s stale-lock; pagehide misses entirely
      → ghost lingers (the "Call in progress" banner shows) until the next call start. Webhook = exact end-detection.
- [P3] [frontend/calls] **Custom LiveKit tiles** — Phase 6 uses the prebuilt `GridLayout` + `@livekit/
      components-styles` (off from the Beng theme, Decision 7). Build custom tiles with `useTracks`/`useParticipants`
      to match the design. Plus: FocusLayout active-speaker (currently GridLayout), device picker (mic/cam settings).
- [P3] [frontend/calls] **Screen sharing** (LiveKit supports `Track.Source.ScreenShare`) + **background blur**
      (LiveKit processors) — deferred from Phase 6.
- [P3] [calls] **Call token refresh** for calls > 1h (currently TTL 1h fixed) + **multi-tab call state sync**
      (callStore is per-tab; opening a call in 2 tabs of the same user is not yet synced).
- [P3] [calls] **Reaction on a CALL message** + reply-to CALL — reactions are currently enabled (generic) but
      no dedicated UX is designed yet; recall on CALL is blocked (400, events are not retractable).
- [P3] [calls] **Free-tier quota monitor** — LiveKit dashboard 5000 participant-min/mo + 100 concurrent;
      add a warning/graceful error when approaching the limit before production.

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

- 2026-06-10 [frontend/story-viewer] Bar↔video desync when reopening a video (progress bar runs
  but the video freezes) — Checkpoint 4.4 follow-up. Fix: add `isOpen` to the deps of the video
  play/pause effect (the viewer doesn't unmount on close → `currentStory.id` persists → deps don't change →
  the effect doesn't re-fire → the newly remounted `<video>` never gets `play()` called). Also covers the
  tech-debt "bar↔video drift" noted in 4.2.
- 2026-06-09 [frontend/story-viewer] Profile-entry-point for the viewer (single-user mode) —
  Checkpoint 4.4. The profile avatar gets a coral ring when `hasActiveStory` → opens the viewer in
  single-user mode. Cross-user OFF. Delete reachable (archive + single-user). 4.2 did
  the data-source fallback part; 4.4 completes the UI entry point.
- 2026-06-06 [frontend/profile] Followers/following count placeholder `0` →
  REAL count — Checkpoint 2.5. Backend `GET /users/:username` returns ProfileUser
  (postsCount/followersCount/followingCount + isFollowing). postsCount mirrors the grid.
- 2026-06-06 [frontend/profile] Public profile route `/users/:username` —
  Checkpoint 2.5. `UserProfilePage` (merged from ProfilePage), `/profile` redirect.
  Follow button (optimistic + invalidate onSettled).
- 2026-06-06 [frontend/post] Author name/avatar clickable → `/users/:username` —
  Checkpoint 2.5. Wire `<Link>` into PostCard/PostDetailView/CommentItem.
- 2026-06-03 [frontend/feed] Infinite scroll feed (useInfiniteQuery +
  IntersectionObserver, no pagination button) — Checkpoint 2.4b. Hand-rolled
  `useInfiniteScroll` (no dep). Shared between FeedPage + CommentList.
