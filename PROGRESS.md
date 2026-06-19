# Progress Log

> Work-session journal. Every time you sit down to code → update the latest entry.
> Purpose: come back a week later and not get lost.
> Read alongside README.md (high-level status) and BACKLOG.md (upcoming work).

---

## 2026-06-18 — Phase Polish Round 2 (avatar + suggested follows + mixed feed) — ✅ COMPLETE

**Done (BE `tsc` 0; FE `tsc -b` + `vite build` 0; service smoke pass; OpenAPI 47→48). No migration** (no schema change). 3 discovery/profile features, plan-first for each one.

- **Avatar upload (custom photo)**: BE was almost ready (Phase 2.5 `updateProfileSchema`/`updateProfile` already accepted `avatarUrl`) — only changed **empty string → regenerate DiceBear** (`generateAvatarUrl(username)`) instead of null. FE: dep `react-easy-crop`; `lib/cropAvatar.ts` (canvas crop → 512×512 JPEG q0.9); `AvatarUploadDialog.tsx` (pick image jpeg/png/webp ≤5MB → react-easy-crop aspect-1 round + zoom → `mediaApi.presign` → `uploadToPresignedUrl` → `PATCH /users/me {avatarUrl}` → toast); `UserProfilePage` edit-view: avatar section "Change photo" + "Reset to default" (inline confirm → `{avatarUrl:''}` backend regen). Reuse `/media/presign` (image, ≤5MB client cap). Orphan MinIO on replace → BACKLOG.
- **Suggested follows**: BE `GET /users/suggested?limit=10` (requireAuth, placed **before `/:username`**) — mixed: **FoF** (`prisma.follow.groupBy` ranked) for users who already follow someone, **popular fallback** (`orderBy: { followers: { _count: 'desc' } }`) for new users, fill with popular when FoF < limit; exclude self + already-followed. FE: `useSuggestedUsers` (1 query limit 10, 5-min stale), `useFollowSuggested` (optimistic remove + invalidate), `SuggestedUserCard` (compact/card), `EmptyFeedSuggestions` (grid), **RightRail refactor** static→real (top 5). OpenAPI 47→48.
- **Feed window 14→90 → MIXED feed**: initially fixed the "feed loses posts" bug (posts >14 days got cut off) → widened `FEED_DAYS` 14→**90**; then rewrote `getFeed` into a **single mixed feed**: followed posts (keyset cursor `f:<id>`) → fill with **ranked stranger PUBLIC posts** (in-memory pool cap 100, **FoF → engagement[likes+comments] → recency**, cursor `s:<offset>`). `isFollowingAuthor` = true (followed) / false (stranger) — **reuse existing field, do NOT change the Post DTO/OpenAPI**. Reuse `postInclude`/`serializePost` (type-parity automatic, no raw SQL).
- **Onboarding gate** (FeedPage): `followingCount===0 && !onboardingDone` (via `useUserProfile(me)`) → `EmptyFeedSuggestions onboarding` (grid + **Done** appears after following ≥1) → Done → invalidate feed+user → mixed feed.
- **Stranger Follow button** (PostCard): `!post.isFollowingAuthor && author.id!==meId` → Follow button next to avatar; `useFollowAuthor` → on success `markAuthorFollowedInCaches` (patch isFollowingAuthor across the feed cache, **no refetch → preserve scroll**) + invalidate user(username)+suggested.

**Smoke**: avatar (set URL / reset→DiceBear, restore), suggested (FoF + popular, excl self/followed, clean shape), mixed feed (T1 new-user 100% strangers; T2 mix followed-first + fill; T5 excl self/followed/PRIVATE; page boundary `f`→`s:` + stranger pagination). **Tech debt → BACKLOG**: avatar orphan MinIO cleanup, `/explore` page, FoF global tiebreak, stranger pool cap, mixed-feed reclassification on next load, follow-approval flow.

---

## 2026-06-17 — Phase Polish Round 1 (4 items from BACKLOG) — ✅ COMPLETE

**Done (BE `tsc` 0; FE `tsc -b` + `vite build` 0 errors **2141 modules**; 1 migration applied; OpenAPI still **47** path keys; backend cookie smoke 5/5 + reply-to service smoke 4/4 pass).** 4 polish items chosen from BACKLOG, done sequentially A→C→B→D (increasing risk). Each item: plan-first → manual review → apply → verify.

- **A — Toast system (sonner)**: `npm i sonner`; `<Toaster position="top-right" theme={theme} richColors closeButton>` mounted in **`App.tsx`** (OUTSIDE both AuthLayout + AppLayout — so login/register network errors show). `lib/toast.ts` helper `notifyError(err, fallback)` (reuse `getApiError`) + `notifySuccess`. Replaced inline errors → toast: MessageInput (mic denied/unsupported, attach-limit, validate, prepare-fail — removed `error` state), useReactToMessage (previously silent), Login/Register (**hybrid**: keep inline 401 + field 400/409, only network/500 → toast), Tier-2 mutation `onError` (useDeletePost/useUpdatePost/useDeleteComment/useDeleteStory/followMutation), success toast for create post/story. **Anti-spam rule**: toast ONLY on mutation/user-action, NOT attached to query `onError`/`refetchInterval`.
- **C — Safari iOS voice (`audio/mp4`)**: `MediaRecorder` on Safari does NOT support webm. `lib/audio.ts` added `VOICE_MIME_CANDIDATES` (`audio/webm;codecs=opus` → `audio/webm` → `audio/mp4`) + `pickSupportedVoiceMime()` + `baseVoiceMime()`; removed const `VOICE_MIME`. `useVoiceRecorder` picks mime dynamically + `VoiceResult.mimeType`; `prepareVoiceAttachment(blob, duration, mimeType)`. BE presign enum +`audio/mp4`, `AUDIO_CONTENT_TYPES` +`audio/mp4`, `EXT_BY_MIME["audio/mp4"]="m4a"`, **`MAX_VOICE_BYTES` 5→10MB** (AAC is heavier than Opus). Chrome/FF still webm (zero regression). Cross-browser PLAYBACK (Safari can't decode Chrome's webm) → BACKLOG transcode.
- **B — Reply-to message FULL**: migration **`add_message_reply_to_relation`** (self-relation `Message.replyTo`/`replies` `onDelete:SetNull` + `@@index([replyToId])`; the `replyToId` column already existed since 5.1 ⇒ additive). ⚠️ migrate dev produced **false drift** on `Post/User.searchVector` (GENERATED tsvector) → hand-strip SQL + `resolve --rolled-back` + `migrate deploy` (do NOT re-diff). `messageInclude.replyTo` **narrow select** (id/contentType/content/deletedAt/sender — NOT recursive) + `serializeMessage.replyTo` (recalled→null, original-recalled→content null); **TYPE-PARITY** `conversationInclude.messages.include.replyTo` identical. `sendMessage` validates **400 InvalidReplyTarget** (missing OR cross-conversation — does not leak existence). FE: quote bubble (click → smooth scroll + `reply-flash` 1.5s; older-page → fetch loop cap 10) + MessageInput "Replying to X" preview + state lifted up to `ConversationDetail`. **Trigger**: desktop hover `↩`/`😊`/`⋯`; mobile long-press → action sheet (Reply/React/Delete) — changed from long-press→direct picker; `MessageBubble` menu state-machine `null|actions|picker` (1 Popover, avoids dual-anchor race) + `MessageActionMenu` + `useRecallFlow` (DRY recall confirm dialog at bubble level). **Scope E1**: reply ONLY on text+media path (sticker/voice/emoji-standalone defer). 5.4c sharedPost still goes through media path.
- **D — httpOnly cookie auth** (highest risk): refresh token → **httpOnly cookie** (`sameSite:'lax'`, `secure` prod-only, `path:'/auth'`, 7d); access token + user **memory-only** (drop Zustand persist entirely). Cookie **set/clear at ROUTE** (NOT service — preserves the "services don't touch res/req" rule); login/register body → `{user, accessToken}`; `/auth/refresh` reads `req.cookies.refreshToken` (401 if missing, **non-rotating** does not set new cookie); `/auth/logout` → `clearCookie` + 204. `cookie-parser` middleware (CORS already `credentials:true` + explicit origin already set). FE: `authStore` added `authStatus: loading|authenticated|unauthenticated` machine + removed `refreshToken`; `useAuthBootstrap` (boot: refresh → me → authenticated; fail → unauthenticated; `didBoot` ref guards against StrictMode double-fire); `ProtectedRoute`/`PublicOnlyRoute` gate authStatus + `<Spinner>` while loading; `apiClient` `withCredentials:true` + `runRefresh()` cookie (single-flight lock already in place → concurrent-401 handled); Sidebar logout async (`authApi.logout()` clear cookie). Browser-verify (reload keeps session / localStorage empty of token / 2-tab / mid-session 401) → user to confirm themselves.

**Tech debt → BACKLOG**: cross-browser voice transcode, mp3 (YAGNI), reply sticker/voice standalone, refresh-token rotation + reuse detection, login uses `publicUserSelect` (login returns full user except passwordHash — inconsistency with register, discovered during D), CSRF token (already mitigated by sameSite=lax + path-scope).

**Migration gotcha (remember)**: every NEW `prisma migrate dev` while `searchVector` (GENERATED tsvector) still exists will emit false drift (`DROP DEFAULT` on a generated column → 42601). Workaround: `--create-only` + hand-strip the 4 searchVector statements + `migrate deploy`.

---

## 2026-06-16 — Phase 7: Notifications + Search + Default Avatar — ✅ COMPLETE (FINAL phase → project 7/7)

**Done (BE `tsc` 0 errors; FE `tsc -b` + `vite build` 0 errors **2139 modules**; 2 migrations applied; OpenAPI **41→47** path keys; service smoke + live HTTP smoke pass; backfilled 67 users idempotent).** Final phase — in-app notifications + unread badges + Postgres full-text search + default avatar. Scope refined: **IN** = notifications (LIKE/COMMENT/FOLLOW) + browser Notification API + sound + unread badges + search + DiceBear avatar; **OUT (defer to Phase polish)** = hide posts, block users, push via Service Worker, notification settings, MENTION/STORY_VIEW notif.

- **Notifications**: migration `add_notifications` (model `Notification` [`recipientId`/`actorId`/`type`/`postId?`/`commentId?`/`readAt?`] + enum `NotificationType{LIKE COMMENT FOLLOW}` [3 values, NO MESSAGE/CALL/MENTION/STORY_VIEW] + 2 back-relations `User.recipient`/`actor`; **`actor` is a real FK** to render avatar+username, `postId`/`commentId` inert scalars holding a forward-declared shape). Module `notifications/` (`createNotification` + **1h dedupe** [`updateMany` atomic bump, NO unique constraint since the key has a time-window] + **self-skip** + `safeNotify` best-effort wrap + list/markRead/markAllRead/getUnreadCount). 4 endpoints. Triggered in `likes`/`comments`/`follows` service: **`create`+catch-P2002** instead of `upsert` (detect a real 0→1 → re-like/re-follow does NOT re-notify; preserves HTTP contract) + `safeNotify`. Socket `emitNotification` → `notification:new` user room.
- **Unread badges**: `GET /conversations` added `unreadCount` per item (per-page `$queryRaw`, `COUNT(*)::int` BigInt-safe, `COALESCE('-infinity')` null-cursor-safe) + `GET /conversations/unread-total` (single aggregate). FE: badge on `ConversationListItem` + Sidebar/BottomNav Messages icon; realtime increment/reset via `conversationCache` (**local decrement, race-free**) + `activeConversationStore` (mute the open chat).
- **Search**: migration `add_search_vectors` (GENERATED tsvector `Post.caption` + `User.username||name` + GIN; schema declares `Unsupported("tsvector")?` to prevent drift; custom-SQL migration `--create-only` + hand-edit — the repo's FIRST raw SQL). Module `search/` `GET /search?q=&type=&limit=&offset=` — **prefix `to_tsquery`** (`token:*` sanitize → injection-safe + search-as-you-type; NOT `websearch_to_tsquery` since it only matches whole-lexeme [discovered during smoke]) + `ts_rank`; visibility filter for posts (PUBLIC/own/FOLLOWERS-if-following in-SQL), users have no privacy filter. FE `SearchPage` debounce 300ms + Users/Posts sections.
- **Default avatar**: `lib/avatar.ts generateAvatarUrl` = DiceBear **`9.x/toon-head`** (toon-head ONLY exists in 9.x — 7.x 404s, verify the version before applying). Set at register + smart backfill script (null OR dicebear URL → re-point; preserve custom upload; idempotent). 67 users backfilled. FE Avatar unchanged (already renders avatarUrl + initials fallback).
- **Sound + browser notif**: `useNotificationSound` (one-shot, preload + autoplay-catch, asset `public/sounds/notification.mp3` optional) + `useBrowserNotifications` (gate `visibilityState!=='visible'` + lazy permission + click → focus+navigate). `message:new` → sound (except the open chat) + browser notif (title=sender.name, body=preview); `notification:new` → **NO sound** (badge + browser notif title="{actor} {action}"). OpenAPI 41→47 (+4 notif, +1 search, +1 unread-total), +2 tags (Notifications, Search).

**Polish round 1 (4 fixes after browser test):**
1. Avatar lorelei → **toon-head 9.x** (7.x toon-head 404; verify version) + smart backfill preserving custom upload.
2. Sound ONLY for messages (removed `playSound` from `notification:new`).
3. Browser notif title: social = "{actor} {action}" (e.g. "Alice liked your post"), message = sender.name + body preview.
4. **Unread badge race (CRITICAL)**: `resetConversationUnread` invalidated total → refetch `/conversations/unread-total` raced with the `message:read` write → sidebar total bounced +1 even while viewing the chat. Fix: **local decrement** (prev from list cache, `total -= prev`; fallback to invalidate when the convo isn't in the list) → race-free. (`incrementConversationUnread` already skipped the active conv from the start — so there was no sound; the real bug was the total invalidate.)

**Tech debt → BACKLOG**: MENTION + STORY_VIEW notif (defer), reply-to-comment-author notif, notification grouping ("X and N others"), post thumbnail on the LIKE/COMMENT row (currently link-only), mobile Notifications nav entry (Sidebar/desktop-only), search ranking/pagination tuning (pg_trgm fuzzy), denormalized unread counter, notification settings + Service-Worker push.

---

## 2026-06-16 — Phase 6: Audio/Video Calls (LiveKit Cloud) — ✅ COMPLETE (browser-verified + follow-up fixes)

**Done (static verify: BE `tsc --noEmit` 0 errors; FE `tsc -b` + `vite build` 0 errors **2125 modules** (+24); migration `add_calls` applied; OpenAPI **37→41** path keys; LiveKit token mint OK (288-char JWT via dynamic ESM import); server boot OK. **Live 2-user + LiveKit dashboard smoke: pending** + need `public/sounds/ringtone.mp3`.)** Audio+Video calls 1-1 + group via **LiveKit Cloud SFU**. 10 decisions FINAL — keystone **Call-as-Message** (reuse 5.4c sharedPost infra: pagination/preview/realtime/optimistic for free).

- **Backend (~9 files + 1 migration)**: migration `add_calls` (model `Call` [id = LiveKit room name, `endedReason CallEndReason?`, `@@index([conversationId,startedAt])`] + enums `CallType`/`CallEndReason` + `MessageContentType +CALL` [ALTER TYPE ADD VALUE, PG16 in-txn] + `Message.callId` FK `SetNull` + back-relations `Conversation.calls`/`User.initiatedCalls`). `config/env` +`LIVEKIT_URL/_API_KEY/_API_SECRET`. `lib/livekit.ts` NEW (dynamic `import('livekit-server-sdk')` — ESM-only SDK + CommonJS build; `generateAccessToken` TTL 1h, `createCallRoom` maxParticipants 50 + emptyTimeout 600, `getRoomParticipantCount`). Module `calls/` (service `createCall`/`getCallAccessToken`/`endCall`/`declineCall` + routes 4 POST + schema + openapi). `messages.service`: `messageInclude.call` + `serializeMessage` call card + `recallMessage` blocks CALL (400). `conversations.service` parity `conversationInclude.messages.include.call`. `messages.schema` +`callResponseSchema` + `messageResponseSchema.call`. `socket/io` 3 emit helpers (`emitCallIncoming/Declined/Ended`). `lib/openapi` wire registerCalls + tag. `server.ts` mount `/calls`.
- **Frontend (~16 files)**: `types/api` (CALL + CallType/CallEndReason/CallInfo + payloads). `api/calls`. `stores/callStore` (Zustand). `features/calls/hooks` (useStartCall/useAcceptCall/useDeclineCall/useEndCall/useRingtone/useIncomingCallListener). `lib/messageCache.patchCallEnded` + `lib/call.ts` (callStatusLabel/duration) + `messagePreview` CALL branch. `components/calls` (CallEntry/CallButtons/IncomingCallDialog/InCallView/CallControls/CallHeader/EndCallConfirmDialog). Integration: MessageBubble CALL branch + conversationType thread + hide RecallMenu; ConversationDetail header CallButtons; AppLayout listener + mounts.

**Technical notes:**
- **livekit-server-sdk v2 is ESM-only + backend is CommonJS** (`tsconfig module: node16`, Node 22.1 < 22.12 ⇒ no require(ESM)): `lib/livekit.ts` uses dynamic `import()` (preserved by tsc node16) via a helper `importLiveKit()` to cache `modPromise`, inheriting the ESM-mode type — annotated with sync `typeof import(...)` (CJS mode) → clashes @bufbuild/protobuf cjs/esm.
- **Call-as-Message** (Decision 1): the CALL message arrives via `message:new` (already in place); `call:incoming/declined/ended` are just thin notifications. LiveKit handles offer/answer/ice ⇒ NOT needed. "Accept" = `POST /calls/:id/token` + connect; the initiator learns via LiveKit `ParticipantConnected` (NO `call:answered`).
- **Group End (Q1)**: DIRECT leave=end; GROUP non-initiator leave (room open) → server `getRoomParticipantCount ≤1` auto-end; initiator `end_for_all` (confirm dialog). **50-cap (Q2)**: `createRoom maxParticipants` (SFU hard) + `getCallAccessToken` listParticipants≥50 → 409.
- **Webhook DEFER**: missed = initiator FE 30s timeout (`MissedTimeout` child inside LiveKitRoom, no remote → end MISSED) + LiveKit emptyTimeout 600s backstop. Concurrent block = DB query.
- **type-parity lesson #5**: `conversationInclude.messages.include.call` MUST match `messageInclude.call`.

**Tech debt arising (proposed for BACKLOG):**
1. [backend/calls] Webhook lifecycle (room_finished → mark ended accurately) — defer; missed/ended currently relies on client + emptyTimeout.
2. [frontend/calls] LiveKit prebuilt GridLayout uses its own CSS (off-theme vs Beng) — custom tiles → polish. Screen share / background blur / FocusLayout active-speaker → defer.
3. [backend/calls] Orphan Call row (endedAt null) if the initiator's connect fails before anyone joins — emptyTimeout cleans the LiveKit room but the DB row dangles; webhook polish fixes it.

### Phase 6 follow-up — Issue 1: 409 CallInProgress ghost-block + harsh UX (browser test)

**Root cause:** there's no reliable end-on-disconnect (webhook deferred + NO `beforeunload`/`pagehide` handler) ⇒ tab close/network drop leaves a `Call.endedAt = null` ghost; the concurrent block key is purely `endedAt: null` ⇒ block forever; `useStartCall` has NO `onError` ⇒ 409 silently. (DB at time of investigation: 0 ghosts — but the structural risk is real.) Fix **A+B+C** (skip D pagehide — scope-discipline; stale-lock + emptyTimeout are enough):
- **A — stale-lock detection** (`calls.service.createCall`): before throwing 409, `getRoomParticipantCount(active.id)`; if **empty (0) AND age > `STALE_CALL_MS`=60s** → `finalizeCall('FAILED')` (reap the ghost) → continue creating a new call (self-healing). Otherwise (has a participant OR empty-but-fresh while connecting) → 409. Threshold 60s > connect+ring(30s) so as NOT to reap a call that is connecting.
- **B — `AppError(statusCode, code, message, data?)`** (+ error handler spreads `data`, backward-compat). 409 thrown with `{ callId, conversationId, type, isGroup }`.
- **C — FE 409 UX**: `useStartCall.onError` (axios `isAxiosError`) detects `CallInProgress` → `callStore.setJoinPrompt(data)`. `JoinCallDialog` (mounted in AppLayout, reuse confirm pattern) "There's already an active call. Join it?" → [Join] `useAcceptCall(joinPrompt)` (getToken+connect) / [Cancel] clear. `useAcceptCall` param changed `CallIncomingPayload` → **`CallJoinInput`** (`Pick<…,'callId'|'conversationId'|'type'|'isGroup'>`) to share between accept + join. Glare (2 people call simultaneously) → both enter the same room. **BE+FE tsc + vite build 0 errors.** Edge-case browser test: pending (user).

### Phase 6 follow-up — 3 critical issues (browser test round 2)

- **Issue 1 (call hangs when peer closes tab)**: root cause = no end-on-disconnect (the 30s MissedTimeout only covers "no one joined yet"). Fix **client last-participant detection** (`InCallView` → `CallLifecycle`, renamed from MissedTimeout): a 2nd effect — when `remoteCount===0 AND hadRemote AND connected` → after `ALONE_GRACE_MS=5s` (debounce reconnect) `endCall('leave')` → DIRECT end / GROUP auto-end (room ≤1). Distinguished from ringing (initiator, no one joined) via the `hadRemote` ref. Both close <5s → ghost → stale-lock reap (Issue-1-prev fix).
- **Issue 2 (initiator "End for all" does NOT work)**: **2 root causes** — (a) **z-index**: `PopoverContent`/`Dialog` portal `<body>` **z-50** < `InCallView` **z-[70]** ⇒ dropdown + confirm render BEHIND the call view → unclickable. Fix: `CallControls` drop Radix Popover + EndCallConfirmDialog → **inline dropdown + inline confirm** inside the InCallView stacking context (z-[75]/z-[80]). Deleted `EndCallConfirmDialog.tsx` (orphan). (b) **end_for_all does NOT force-disconnect LiveKit**: fix `lib/livekit.deleteRoom` NEW + `finalizeCall` calls `deleteRoom(callId)` (force-kick every participant → onDisconnected → reset; central fix for EVERY finalize path — bonus hardening for Issue 1).
- **Issue 3 (non-participant does NOT know a call is active)**: `conversationInclude.calls` (where endedAt null, take 1, +initiator) + `serializeConversation.activeCall` (CallInfo shape, endedAt/endedReason null) + `conversationResponseSchema.activeCall` (reuse callResponseSchema). FE `Conversation.activeCall?` + `ConversationDetail` banner "📞 Call in progress · Join" (gate: activeCall && NO currentCall/incomingCall match) → `useAcceptCall`. Realtime: `useIncomingCallListener.onIncoming` invalidates `conversation(id)` (banner appears after dismissing the ring); onEnded already invalidates conversations() (banner disappears). **BE+FE tsc + vite build 0 errors; OpenAPI 41 paths.** Browser test round 3: pending (user).

### Phase 6 follow-up — T2: both-close-simultaneously → 60s wait + FAILED

**Symptom:** 5-minute call, both (or the whole group) close the tab at the same time (within the 5s window) → no peer remains to trigger the 5s last-participant grace → fall back to the 60s stale-lock → endedReason **FAILED** (wrong, the call ran successfully). **Fix Hybrid (re-enable Decision D + 2 tweaks):**
- **D — pagehide handler** (`InCallView` useEffect, placed BEFORE the early-return): `window.addEventListener('pagehide')` → `fetch('/calls/:id/end', {keepalive:true, headers:{Authorization Bearer accessToken}, body:{action:'leave'}})` fire-and-forget. **`keepalive`** (NOT `sendBeacon` — we need the Authorization header). Token = `useAuthStore.getState().accessToken`, base = `VITE_API_URL`. Reads fresh state at fire time. Listener mounted with AppLayout (InCallView always mounted, no-op when `!currentCall`). ⇒ both-close DIRECT → first request finalizes COMPLETED ~1s, request 2 idempotent.
- **STALE_CALL_MS 60_000 → 15_000**: a ringing call is NOT empty (initiator connected = 1 participant) so the stale-lock only needs > the createCall→connect window (a few seconds); 15s is safe + reaps faster when pagehide misses.
- **endedReason inference** (`inferEndReason(startedAt)` helper, `CONNECTED_MIN_MS=10_000`): leave/end_for_all with NO explicit reason + stale-lock → age ≥10s → **COMPLETED**, <10s → **FAILED**. Explicit MISSED (30s no-answer)/DECLINED bypass it. Applied at: createCall stale-lock (was hardcoded FAILED), endCall 3 finalize calls (`reason ?? inferEndReason(call.startedAt)`).

**BE+FE tsc + vite build 0 errors.** Residual (webhook-deferred): GROUP all-close simultaneously + LiveKit count lag → may take up to 15s (stale-lock) instead of ~1s, COMPLETED; if pagehide misses COMPLETELY + no one starts a new call → ghost lingers (the "Call in progress" banner shows until the stale-lock reaps at the next start / webhook polish). Browser test round 3: pending.

### Phase 6 follow-up — 2 UX fixes (FE-only)

- **CallEntry click call-back → ADDED then REVERTED (round 4)**: initially added an onClick call-back (misread T1 as the IG callback pattern). User clarified: do NOT want clicking CallEntry to start a call → reverted to a **display-only `<div>`** (icon + label, no onClick/cursor/disabled/useStartCall). Call initiation ONLY via the header `CallButtons`. Also removed `conversationType` threading (it only served call-back; MessageThread KEEPS it for seenInfo).
- **Presence dot on message avatars**: the Phase 5.2 infra was already enough (presenceStore + Avatar `online` prop; ConversationListItem + ConversationDetail header already had it). Added `online` to the 2 remaining spots: **MessageThread BurstGroup** (`usePresenceStore(s=>!!s.online[burst.senderId])` — per-user selector ⇒ only that burst re-renders when status changes; self has no avatar so no dot) + **IncomingCallDialog** initiator avatar. Contact-scoped presence covers group members (partners) too. **FE tsc + vite build 0 errors.**

### Phase 6 follow-up — block reactions on CALL (A+B, defense-in-depth)

CALL = display-only event ⇒ NO reactions (mirror recall block). **FE** (`MessageBubble`): `canReact = !temp && !isCall` (1 gate hiding long-press + hover SmilePlus + ReactionChips); RecallMenu gate simplified to `canReact && isOwn` (dropped the redundant `!isCall`). **BE** (`assertCanReact`, shared by react+unreact): select +`contentType`, after the participant-403 → `contentType==='CALL'` → **400 CannotReactToCall**. BE+FE tsc + vite build 0 errors.

**Next:** Live browser-verify round 3 (T2 both-close → COMPLETED ~1s; T-C start+close <10s → FAILED; Issue 1 peer-close → ends ≤5s; Issue 2 End-for-all kick instant + dropdown/confirm clickable; Issue 3 banner + Join; UX: CallEntry **display-only** (no click, no reactions) (click does NOT start a call; initiate only via the header CallButtons) + presence dot in thread/dialog; regression decline/missed/late-join/50-cap) + LiveKit dashboard → drop `ringtone.mp3` → commit → `close-phase` tag **phase-6-complete**. Then Phase 7.

---

## 2026-06-15 — Checkpoint 5.5: Group create UI + Recall message (closing Phase 5)

**Done (code + static verify: BE `tsc` 0 errors; FE `tsc -b` + `vite build` 0 errors 2101 modules; OpenAPI **35→37 path keys** verified via `buildOpenApiDocument`. **No migration**. Live API smoke + browser-verify: done by hand — pending.)** 2 features close Phase 5: **Group create UI** (multi-select modal on `/messages` + user-suggestion endpoint) + **Recall message** (soft-delete tombstone + S3 cleanup + socket realtime). 10 decisions FINAL: scope is only create+recall · tombstone serialize · preview skip-to-previous · name optional+auto-derive · reactions clear · separate "..." button (keep long-press react) · `DELETE /messages/:id`+`message:deleted` · S3 soft-fail · confirm required · `deleteObject` helper DRY. Reply-to + group member management → BACKLOG.

- **Backend (~10 files, 0 migration)**: `users.service.getGroupableUsers` (recent partners `participant.findMany` order `conversation.lastMessageAt desc` + mutual followers Follow self-join 2-lookup ∩, merge recent→mutual dedupe exclude-self, `q` contains, reuse `publicUserSelect`+`source`). `users.schema` (`groupableQuerySchema` q?+limit≤50, `groupableUserSchema`). `GET /users/groupable` **before `/:username`**. `conversations.schema.createGroupSchema.name` → optional. `conversations.service.createGroupConversation` auto-derive `deriveGroupName` "Group with A, B, C (and N others)". `lib/s3.deleteObject` helper NEW. `messages.service`: `listMessages` **DROPS** `deletedAt:null` (tombstone visible); `conversationInclude.messages` **KEEPS** the filter (preview skip-to-previous); `serializeMessage` +`deletedAt` + tombstone branch (clears content/media/reactions/sharedPost); `recallMessage(messageId,userId)` (404/idempotent/403 sender/410 >15min/clear reactions/set deletedAt/best-effort `deleteObject` soft-fail/`emitMessageDeleted`). `messages.schema.messageResponseSchema +deletedAt`. `DELETE /messages/:id` **after `/:id/reactions`**. `socket/io.emitMessageDeleted` (user rooms, mirror emitMessageReaction). OpenAPI register +2 paths (users.openapi + messages.openapi; do NOT touch lib/openapi — module already wired).
- **Frontend (~13 files)**: `types/api` (`GroupableUser` extends PublicUser+source; `Message.deletedAt?`; `CreateGroupInput.name?` optional; `MessageDeletedPayload`). `api/users.getGroupable`; `api/messages.recallMessage`. `queryKeys.groupableUsers(q)`. `useGroupable` (useQuery debounce-driven, enabled when open). `useCreateGroup` (mirror useStartDirectConversation: seed+invalidate+navigate). `GroupCreateModal` NEW (Dialog mirror SharePostModal: name input + selected pills max 9 + search debounce 300ms + sections recent/mutual + checkbox + Create disabled <2). `ConversationList` header `SquarePen` "+" → modal (local state). `messageCache.patchMessageDeleted` (tombstone patch, idempotent guard deletedAt). `useRecallMessage` (optimistic patch + rollback + onSuccess invalidate conversations for preview). `useGlobalSocketEvents` +listener `message:deleted`. `MessageBubble`: tombstone branch FIRST (Trash icon + "Message deleted", keep slot, hide react/seen) + "..." `RecallMenu` when `isOwn && !temp && !deleted`. `RecallMenu` NEW (Popover MoreHorizontal → "Recall" disabled+title if >15min → confirm). `RecallConfirmDialog` NEW (required, destructive).

**Technical notes:**
- **Tombstone serialize in one place**: `serializeMessage` is shared by message-list + lastMessage preview ⇒ editing 1 function applies to both. `listMessages` drops the filter (thread sees the tombstone) BUT `conversationInclude.messages` keeps the filter (preview skip-to-previous) — different where-filters, NOT breaking type-parity (parity is about the include shape).
- **`deletedAt` scalar** ⇒ not in the `include`, so include-level type-parity is unchanged; the only sync point is `serializeMessage`.
- **Recall trigger separate from long-press**: keep long-press/hover for reactions (5.3a), a separate "..." button for recall (Decision 6) — 2 independent Popover instances in the same bubble, no Radix anchor collision.
- **First 410 Gone** in the codebase (recall past the deadline). Client disables the menu >15min (UX) + server 410 (security); small drift → bad request, optimistic rollback.
- **S3 soft-fail** (Decision 8): `deleteObject` throws, `recallMessage` try/catch logs + continues. Orphan-sweep cron → BACKLOG.
- **Preview reconcile**: recalling the last message ⇒ the client list cache still keeps the old preview → `useRecallMessage.onSuccess` + socket handler `invalidateQueries(conversations)` to refetch (server skips recalled).

**Tech debt arising (proposed for BACKLOG):**
1. [backend/messages] Recall keeps the MessageMedia rows (only deletes the S3 object) — a dangling url hidden behind the tombstone; hard-delete rows + orphan-sweep cron → polish.
2. [frontend/messaging] GroupCreateModal loads all recent+mutual without pagination (small pool is acceptable; cursor when the user follows many) → polish.

**Next:** Browser-verify (group create flow + auto-derive name + recall own/expired/cross-session realtime + tombstone render + preview skip-to-previous) + live API smoke (~16 cases per plan) → commit → `close-phase` + tag **phase-5-complete**. Then: Phase 6.

---

## 2026-06-15 — Checkpoint 5.4c: Emoji + Sticker + GIF + Post Share (Phase 5.4 media COMPLETE)

**Done (BE 2 migrations `add_sticker_gif_media_types` + `add_message_shared_post_relation` applied + `prisma generate` + `tsc` 0 errors + smoke 32/32 PASS on live server [incl. Giphy proxy LIVE trending + sticker search → 200] + OpenAPI **33→35 paths**; FE `tsc -b` + `vite build` 0 errors 2095 modules. + 3 follow-up UX bug fixes.)** 1 unified picker with 3 tabs **Emoji | Stickers | GIFs** (Popover + self-coded toggle) in MessageInput + enabling the **Share** button on PostCard (modal to pick 1 conversation). Closes **Phase 5.4** (a/b/c). 8 decisions FINAL: Q-Scope (1 phase, 4 features) · Q-Emoji-Source (reuse emoji-mart from 4.3a) · Q-Emoji-ContentType (EMOJI standalone giant) · Q-Picker (3-tab Popover) · E1 sticker/GIF exclusive · E2 post-share + caption OK · E3 single-select share · E7 sharedPost FK SetNull · E8 preview leak OK.

- **Backend (~10 files + 2 migrations)**: `MediaType` enum **+STICKER +GIF** (migration `add_sticker_gif_media_types`, `ALTER TYPE ADD VALUE`). `MessageMedia.objectKey` → **nullable** + `Message.sharedPost Post? @relation onDelete: SetNull` + `Post.sharedInMessages` (migration `add_message_shared_post_relation`). **No migration** for `MessageContentType` (it already had all 8 values from 5.1) or `sharedPostId` (the scalar existed since 5.1, now wiring the FK). `lib/emoji.ts` NEW (`isEmojiOnly` + `EMOJI_ONLY_MAX=3` via `Intl.Segmenter` grapheme + `\p{Extended_Pictographic}`). `config/env.ts` +`GIPHY_API_KEY`. `messages.schema`: `objectKey` optional + `sharedPostId` + superRefine (sharedPost not combined with media; STICKER/GIF exclusive single + no caption; objectKey required for IMAGE/VIDEO/VOICE) + `sharedPostResponseSchema` (narrow). `messages.service`: `messageInclude.sharedPost` (author + media[0]); `serializeMessage` maps the narrow card; `sendMessage` derives contentType **+POST_SHARE/EMOJI/STICKER/GIF** + **gate `getViewablePost(sharedPostId, senderId)`** (E8 — you can only share what you can see → 404). `conversations.service`: `conversationInclude.messages.sharedPost` (type parity). Module **`giphy/`** NEW (schema/service/routes/openapi) — `GET /giphy/search` + `/giphy/trending` (requireAuth, native Node 20 `fetch` NO new dep, `api_key` server-side, transform `fixed_width`/`fixed_width_still`, errors 429/5xx/timeout → 503). Mount `/giphy` + wire OpenAPI tag.
- **Frontend (~14 files)**: `types/api.ts` (`MediaType +STICKER/GIF`, `SharedPostPreview` [narrow, NOT the full Post], `Message.sharedPost?`, `SendMessageInput.sharedPostId?`, `GiphyItem`, `MessageMediaInput.objectKey?` optional). `lib/emoji.ts` NEW (parity with BE). `api/giphy.ts` NEW (`giphyApi.search/trending`). `mediaUpload.ts`: `PreparedAttachment.file?/fileContentType?` optional + `prepareGiphyAttachment` (**`uploaded` preset ⇒ 0 PUT**, reuse the pipeline like voice). `useSendMessage`: optimistic contentType derive +EMOJI/STICKER/GIF/VOICE (avoid the giant↔normal flicker). `useSharePost.ts` NEW (no in-thread optimistic, vars `{conversationId, postId, content?}`). `UnifiedMediaPicker.tsx` NEW (3-tab Popover + emoji-mart embed + Giphy masonry grid debounce 400ms/trending). `MessageInput` (Smile button + `insertAtCursor` + emoji Case A insert / Case B send giant + giphy send standalone). `MessageBubble` 3 new branches (POST_SHARE→SharedPostCard / EMOJI→giant no-bubble / STICKER+GIF→inline img no-lightbox). `SharedPostCard.tsx` NEW (avatar+caption+firstMedia, click → `/posts/:id`, null→"Post unavailable"). `SharePostModal.tsx` NEW (mirror StoryViewersModal, conversation list + optional caption). `PostActions` enables Share + `onShare`; `PostCard` state + renders modal. `messagePreview` +`📮 Shared a post`/`Sticker`/`GIF`.

**Technical notes:**
- **EMOJI = content-derived, NOT media** (NO `MediaType` EMOJI). Server derives EMOJI when `isEmojiOnly(content)` (1–3 grapheme emoji) ⇒ emoji typed by hand AND via the picker are both giant; 0 migration. FE mirrors the helper so optimistic matches.
- **Sticker/GIF reuse 5.4a 100%** via the `PreparedAttachment.uploaded` preset (like voice but 0 PUT instead of 1) — objectKey null (Giphy host).
- **Type parity (the 5.3a/5.4a lesson again)**: `sharedPost` goes into `messageInclude` ⇒ MUST add `conversationInclude.messages.sharedPost`.
- **Post-share split into `useSharePost`** (NOT extending `useSendMessage` which is bound to conversationId) — share is sent from the feed, the target is chosen dynamically, the thread isn't open ⇒ no in-thread optimistic needed.
- **Share gate = `getViewablePost(postId, senderId)`** (reuse posts.service) — 404 if the sender can't see it (E8: leaking the preview to the recipient is acceptable, the click-through is still gated 404).
- **Giphy native `fetch`** (Node 20) — NO adding axios/got (follows the "ask before adding a dep" rule).

**3 follow-up bug fixes (after implementation):**
1. **A reaction pushes the message but no auto-scroll (Bug 1)** + **missing scroll-to-bottom button (Bug 2)** — `MessageThread`: `atBottomRef` (updated via `onScroll`) + a `useLayoutEffect` branch "content grew taller while at bottom → stick"; floating `ChevronDown` button `absolute bottom-4 right-4` shown when `dist>200`, smooth scroll. Wrapped the scroll container in a `relative` parent. Unread badge deferred to polish.
2. **POST_SHARE "Seen" realtime does NOT show (Bug 3)** — root cause: share is sent OUTSIDE the thread ⇒ A doesn't join the convo room ⇒ misses `read-receipt:update` (emitted convo-room only); `staleTime:30s` serves the old cursor when the thread opens (F5 fixes it because of the reload). 1-line fix: `useSharePost.onSuccess` adds `invalidateQueries(conversation(id))` ⇒ opening the thread refetches fresh participants. Does NOT touch MessageBubble (the indicator is shared across every contentType — correct).
3. **emoji-mart tab only ~70% width** — root cause: `dynamicWidth` measures the wrapper shrink-to-fit; `className="width-full"` is a no-op. Fix: scoped CSS `.emoji-picker-full > *, .emoji-picker-full em-emoji-picker { width:100% }` (index.css) + wrap `<div className="emoji-picker-full w-full">`. **Scoped** so the story `EmojiPickerOverlay` (natural width) does NOT regress.

**Tech debt arising (proposed for BACKLOG):**
1. [frontend/messaging] Share multi-select N conversations (currently single-select) — defer polish.
2. [frontend/messaging] Scroll-to-bottom unread-count badge (count message:new while scrolled up) — defer polish.
3. [backend/giphy] Per-user rate limit (currently only FE debounce + free-tier key) — defer polish.
4. [frontend/messaging] Sticker/GIF picker autoplay perf (the grid renders animated directly) — defer.

**Next:** Browser-verify the rest of 5.4c (emoji insert/giant, sticker/gif send + inline, share modal → SharedPostCard nav, T4 story emoji width does NOT regress) → commit. Phase 5.4 ✅ COMPLETE. Next: **5.5** (recall soft-delete + reply-to + group management UI).

---

## 2026-06-15 — Checkpoint 5.4b: Voice Messages

**Done (BE migration `add_voice_media_type` applied + `prisma generate` + `tsc` 0 errors + voice smoke 14/14 PASS on live server + OpenAPI 33 paths unchanged; FE `tsc -b` + `vite build` 0 errors). Browser-verify NOT yet run.** Tap mic → record (MediaRecorder WebM/Opus) → tap send to stop + auto-send → voice player bubble + 30 decorative waveform bars filling with playback. Optimistic local playback. 5 decisions FINAL: Q1 tap-to-toggle · Q2 MediaRecorder WebM/Opus (no dep) · Q3 HYBRID 30-bar deterministic · Q4 max 300s · Q5 optimistic reuse 5.4a.

- **Backend (~5 files + 1 migration)**: `MediaType` enum **+VOICE** (migration `add_voice_media_type` — PG16 `ALTER TYPE ADD VALUE`, MessageMedia model unchanged: thumbnail/width/height already nullable). Presign (`media.schema`/`s3.ts`): **+`audio/webm`** + `MAX_VOICE_BYTES=5MB` + `EXT_BY_MIME webm`. `messageMediaInputSchema`: `thumbnailUrl`/`thumbnailObjectKey` → **optional**; superRefine: IMAGE/VIDEO **require** thumbnail (preserve the 5.4a contract), VIDEO **+ VOICE** require duration, **VOICE exclusive** (≥1 VOICE → media.length===1). `sendMessage` derives contentType **+ VOICE branch** (`every VOICE → VOICE`). serialize/parity/include reuse 5.4a as-is (voice = 1 media row, thumbnail null).
- **Frontend (~9 files)**: `types/api.ts` (`MediaType +VOICE`, `MessageMediaInput.thumbnailUrl?/thumbnailObjectKey?` optional, `PresignRequest +audio/webm`). `lib/audio.ts` NEW (`VOICE_MAX_DURATION=300`/`VOICE_MIME`/`formatDuration` [reuse MediaCell, remove the inline duplicate]/`generateWaveformBars` FNV+xorshift deterministic 30–90%). `useVoiceRecorder.ts` NEW (getUserMedia + MediaRecorder `audio/webm;codecs=opus`, duration = wall-clock timer, auto-stop 300s, state `idle|requesting|recording|denied|unsupported`, cleanup stops tracks). `mediaUpload.ts` extend (`PreparedAttachment.thumbnailBlob?/width?/height?` optional; `uploadAttachments` no-thumbnail → **1 PUT** + input drops thumbnail/w/h; `prepareVoiceAttachment`). `VoicePlayer.tsx` NEW (`<audio>` + play/pause + 30 bars fill `i/30<progress`, own=primary-foreground / other=primary). `MessageBubble` branch `isVoice` → VoicePlayer. `MessageInput` mic button (morph send↔mic based on `hasContent`) + recording UI (Trash cancel + pulsing red dot + timer + Send-stop). `messagePreview` `🎤 Voice (m:ss)`.

**Technical notes:**
- **Reuse 5.4a 100% for send**: voice = `PreparedAttachment` no-thumbnail (1 PUT) → `setPendingAttachments` → `useSendMessage`; optimistic media (type VOICE, localUrl) + progress + retry-resume run as-is. VoiceRecorder.onComplete builds the att itself + mutate.
- **Duration = wall-clock timer**: MediaRecorder's WebM has no reliable duration metadata (Infinity) ⇒ measure `Date.now()` start→stop, cap 300s.
- **VOICE exclusive + derive**: contentType VOICE only when `every(VOICE)` (single, NO mix); thumbnailUrl/Url optional at input + superRefine enforces per-type ⇒ IMAGE/VIDEO still require thumbnail (regression-safe).
- **Bar contrast on own bubble**: own message bg=primary ⇒ filled bar = `primary-foreground` (NOT invisible primary-on-primary); other = `primary`.
- **MediaType enum migration** (DIFFERENT from StoryItemType): MediaType declared since Phase 2 with only IMAGE/VIDEO ⇒ must `ALTER TYPE ADD VALUE 'VOICE'` (PG16 OK, no transaction snag).

**Tech debt arising (proposed for BACKLOG):**
1. [frontend/messaging] Safari/iOS: MediaRecorder does NOT support `audio/webm` (only `audio/mp4`) ⇒ 5.4b currently errors "not supported". Add `audio/mp4` (presign + recorder pick supported) for Safari — Phase polish.
2. [frontend/messaging] Pause/resume recording + real waveform (decode audio) + trim-before-send: defer.

**Next:** Browser-verify 5.4b (mic permission, record→send, local playback, bar fill, auto-stop, cancel, denied error, preview) — 2 incognito realtime. Then commit. Next: 5.4c (sticker/GIF-picker + post-share) / 5.5 (recall + group UI).

---

## 2026-06-13 — Checkpoint 5.4a: Media Messages (Image + Video)

**Done (BE migration `add_message_media` applied + `prisma generate` + `tsc` 0 errors + media smoke 14/14 PASS on live server + OpenAPI 33 paths unchanged; FE `tsc -b` + `vite build` 0 errors 2086 modules [+9]). Browser-verify NOT yet run.** 1 message carries a text caption AND/OR 1–10 media (images + videos **mixable**); client resizes thumbnail + uploads the original via presign; IG-style grid in the bubble + fullscreen swipe lightbox; optimistic per-item progress + retry-resume. 4 decisions FINAL: D1 IG-adaptive grid · D2 allow-mix (contentType marker) · D3 parallel pool-3 · D4 Rich model.

- **Backend (~5 files + 1 migration)**: model **`MessageMedia`** (Rich: `type MediaType`/`order`/`url`/`objectKey`/`thumbnailUrl?`/`thumbnailObjectKey?`/`width?`/`height?`/`duration?`, `@@unique([messageId,order])`, FK `onDelete: Cascade`; `Message.media`). `messages.schema`: drop `z.literal('TEXT')` → `sendMessageSchema {content?, media[]≤10}` + superRefine (≥1 content/media + VIDEO requires duration); `messageMediaInputSchema` (plain object → clean OpenAPI); `messageMediaResponseSchema` (whitelist, NO objectKey). `messages.service`: `sendTextMessage`→**`sendMessage`** derives contentType (no media→TEXT / all-video→VIDEO / else IMAGE marker) + nested media create; `messageInclude.media` orderBy order asc; `serializeMessage` whitelists media. `conversations.service`: `conversationInclude.messages.media` (type-parity 5.3a lesson). Route call-site changed to `sendMessage`. **Presign reused as-is** (generic `/media/presign`, do NOT touch the media module). OpenAPI 33 paths (only the body schema changed).
- **Frontend (~13 files)**: `types/api.ts` (`MessageMedia` [+client-only `localUrl`/`uploadProgress`/`uploadStatus`], `Message.media`, `MessageMediaInput`, `SendMessageInput {content?, media?}`). `lib/imageResize.ts` NEW (Canvas thumbnail ≤512px JPEG q0.72, fallback to original on decode fail), `lib/uploadPool.ts` NEW (pool cap-3 ordered), `lib/messagePreview.ts` NEW (📷/🎥/📎 list preview), `messageCache.patchMessageMediaProgress`. `features/messaging/mediaUpload.ts` NEW (`prepareAttachment` probe+thumbnail+previewUrl, `uploadAttachments` pool-3 presign+2-PUT per item + resume, pending-stash Map keyed by temp-id). `useSendMessage` rewrite (vars `{tempId, content?, isRetry?}`; optimistic media localUrl+status; upload→patch progress→POST→swap+revoke; retry resume). Components: `MessageMediaGrid` (IG 1/2/3/4/5+ +N overlay), `MediaCell` (type-aware + progress/failed overlay), `MediaLightbox` (hand-rolled fixed overlay, ESC/swipe/arrows, mounted in AppLayout), `mediaLightboxStore`. `MessageBubble` renders grid above caption + opens lightbox. `MessageInput` rewrite (attach button + preview strip + validate ≤10/size/MIME + prepare→send). `MessageThread.onRetry` + `ConversationListItem` preview.

**Technical notes:**
- **contentType derived server-side** (D2 mix): the client does NOT send contentType; the server computes it (mix→IMAGE marker), the client renders per `media[].type` ⇒ a carousel mixing images+videos works.
- **Presign-first ⇒ generic key** (`media/user_<id>/<ts>_<rand>`): dropped the idea of `messages/{messageId}/…` (messageId doesn't exist yet at upload time). Trust the client URL (createStory precedent), do NOT verify S3.
- **Type parity (5.3a lesson)**: `media` goes into `messageInclude` ⇒ MUST add `conversationInclude.messages.media`.
- **Optimistic media + pending stash**: File/Blob can't be serialized into the query cache ⇒ stash `PreparedAttachment[]` in a module Map keyed by temp-id; the cache holds localUrl (objectURL) + progress/status; revoke on success swap.
- **Retry resume**: an item set to `a.uploaded` after upload ⇒ retry only re-uploads the not-done item (keeps done items' URLs), NOT a partial-send (POST only when all N media are ready).
- **2 uploads/image** (Q6): the original untouched (lightbox) + a JPEG thumbnail (grid). Video poster reuses `lib/video.ts extractVideoThumbnail`.
- **Lightbox open-gate**: an optimistic cell (has `uploadStatus`) does NOT open the lightbox (local urls only); opens when it's a real message (status cleared after swap).

**Tech debt arising (proposed for BACKLOG):**
1. [backend/messages] Orphan S3 media: upload finishes but the POST message fails / the user backs out → orphaned object (matches the Posts/Stories debt). Defer to Phase polish (cron sweep). MessageMedia already stores objectKey ⇒ recall 5.5 can clean it up.
2. [frontend/messaging] Drag-drop + paste-clipboard + reorder-before-send + edit-caption-after-send + pinch-zoom lightbox: defer to Phase polish (out of 5.4a scope).
3. [frontend/messaging] 512px thumbnail: if a single image looks soft on a large screen, consider raising the ceiling.

**Next:** Browser-verify 5.4a (attach 1/5/10, mix images+videos, caption, grid 1/2/3/4/5+, lightbox swipe/ESC, video player, progress, fail+retry, dark+mobile) — 2 incognito for realtime `message:new` carrying media. Then commit. Next: 5.4b (voice) / 5.4c (sticker-GIF-picker / post-share) / 5.5 (recall + group UI).

---

## 2026-06-13 — Checkpoint 5.3b + 5.3c: GROUP read receipts UI + GROUP composite avatar (+ 5.3a popover fix)

**Done (BE `tsc` 0 errors + group-validation smoke 5/5 on live server; FE `tsc -b` + `vite build` 0 errors 2077 modules; uncommitted on commit `2517993`). Browser-verify NOT yet run.**

- **5.3a popover fix (T2)**: the picker rendered in the top-left corner of the viewport instead of above the bubble. Root cause: a custom `PopoverAnchor` + `PopoverTrigger` coexisting → race on Radix's `hasCustomAnchor` mount-order → the Trigger unmounts the internal PopperAnchor during flip → positioning reference null → fallback (0,0). Fix: drop `PopoverTrigger`, make SmilePlus a plain button (`onClick setPickerOpen`), `PopoverAnchor` (bubble) is the ONLY anchor, `open` controlled. Outside-click/ESC still close (PopoverContent → onOpenChange).
- **5.3b GROUP read receipts UI (FE-only, ZERO backend change)**: `MessageThread` merges DIRECT+GROUP into 1 `useMemo` → `seenInfo {messageId, label} | null`. DIRECT keeps "Seen" + hide-on-reply (T5). GROUP: the newest own message with ≥1 other having read → "Seen by N" / "Seen by all" (N = number of others with read-index ≥ message index). `ConversationDetail` passes `participants` + `conversationType` (drop `otherReadMessageId`). `MessageBubble` prop `showSeen: boolean` → `showSeenLabel: string`.
- **5.3c GROUP composite avatar**: BE group min-2-others (`createGroupSchema.participantIds.min(2)` + service dual-gate dedupe/drop-creator `< 2` → 400, message "A group needs at least two other participants"). `GroupAvatar.tsx` (NEW) triangle layout (2 top + 1 bottom-center; >3 → 2 avatars + "+N" badge), renders plain `<img>`/`initials()` directly (NOT the Avatar component), container matches the single-avatar footprint. `ConversationListItem` + `ConversationDetail` header conditional on `type === 'GROUP'`.

**Technical notes:**
- **Radix Popover anchor race**: custom `PopoverAnchor` + `PopoverTrigger` simultaneously → drops the positioning ref (picker jumps top-left even though it still opens via the Trigger). Safe pattern = 1 anchor + controlled `open`, NO Trigger.
- **GROUP read receipts need NO backend**: the 5.2 `message:read` handler + `patchReadReceipt` are already type-agnostic (broadcast convo-room, patch by userId) ⇒ `participants[].lastReadMessageId` is always fresh in the `conversation(id)` cache ⇒ MessageThread recomputes "Seen by N" in realtime.
- **Positional read-receipt (kept from 5.2)**: cuid does NOT sort by time ⇒ compare the index in the already-sorted `messages` array, NOT the id string. GROUP does NOT apply `recipientRepliedAfter` (the recipient is many people).
- **GroupAvatar renders plain img/initials** (NOT Avatar): Avatar's min size `xs`=size-6 is too big for a 16-20px circle + wrapping Avatar in a small circle causes double rounded/ring layers + ugly clipping. Reuse the `initials()` export. Triangle = 3 absolute corner circles (`top-0 left-0` / `top-0 right-0` / `bottom-0 left-1/2 -translate-x-1/2`), circle = container/2 so the tiles fit snugly.
- **Group min-2 only gates CREATE**: existing 2-person GROUPs (created when it was `min(1)`) still exist; GroupAvatar renders 2 top circles gracefully. No migration.

**Tech debt arising (proposed for BACKLOG — awaiting confirmation):**
1. [backend/conversations] Legacy 2-person GROUPs (created under the old `min(1)`) remain in the DB after tightening to `min(2)`. Phase polish: cleanup/convert to DIRECT or accept it (GroupAvatar already renders gracefully).
2. [frontend/messaging] GROUP "Seen by N" currently shows only on the newest own message (simple). Messenger-accurate = a per-message avatar stack at each person's read point — defer (decided D8 in 5.3b).
3. [frontend/messaging] No group-create UI yet (groups created via API/Swagger). The D4 message "Group needs at least 2 other people" has no form surface yet — wire it in the Phase 5.5 group UI.

**Next:** Browser-verify 5.3b (group read receipts realtime) + 5.3c (composite avatar 3/4+/legacy) + 5.3a popover position. Docs sync (`frontend/CLAUDE.md` 5.3a-fix/5.3b/5.3c, phase rows `CLAUDE.md`/`ARCHITECTURE.md`) not yet written. Then commit + Phase 5.4 (media/voice) or 5.5 (recall/group UI).

---

## 2026-06-13 — Checkpoint 5.3a: Message Reactions (7-emoji quick set + aggregate chips + optimistic + realtime)

**Done (BE migration `add_message_reactions` applied + `prisma generate` + `tsc` 0 errors + reactions smoke 13/13 PASS on live server + OpenAPI 33 paths [32→+1]; FE `tsc -b` + `vite build` 0 errors 2077 modules [+9]).** Long-press (mobile) / hover (desktop) → 7-emoji picker → react; aggregate chips "👍 3  ❤️ 1" below the bubble; optimistic + socket `message:reaction` realtime. 8 decisions FINAL (D1–D8) settled before coding. GROUP "Seen by N" split into **5.3b** (FE-only).

- **Backend (~7 files + 1 migration)**: model **`MessageReaction`** (`@@id([messageId,userId])` + both `message`/`user` `onDelete: Cascade` — D1 Like parity; `Message.reactions` + `User.messageReactions`). `messages.schema`: `REACTION_EMOJIS_BACKEND` (byte-for-byte copy of FE) + `reactionSchema z.enum` + `messageResponseSchema.reactions`. `messages.service`: `messageInclude.reactions` (orderBy createdAt asc) + `serializeMessage` maps RAW (D2) + `getParticipantIds` helper (extracted from sendTextMessage, 3 call sites) + `reactToMessage`(upsert/replace) + `removeReaction`(deleteMany idempotent) (auth `assertCanReact`: 404 message gone / 403 non-participant). `conversations.service`: `conversationInclude.messages` include reactions (type parity). **`messages.routes.ts` NEW** (POST/DELETE `/:id/reactions`) mounted `/messages` in server.ts. `messages.openapi` +2 ops (1 path key). `io.ts` **`emitMessageReaction`** → user-rooms delta (D5/D6).
- **Frontend (~13 files)**: `npx shadcn add popover` (radix-ui umbrella, v4 ready, 0 adapt). `lib/reactions.ts` (SOURCE `REACTION_EMOJIS` + `groupReactionsByEmoji` + `myReaction`). `types/api.ts` (`MessageReaction` + `Message.reactions` + `MessageReactionPayload`; optimistic Message adds `reactions:[]`). `api/messages.ts` NEW (`messagesApi`). `hooks/useLongPress.ts` NEW (500ms, cancel-on-move, skip mouse). `useReactToMessage.ts` NEW (optimistic patch + rollback + reconcile + `toggle`). `messageCache.patchMessageReactions` (mirror setMessageFailed). `useGlobalSocketEvents` +`message:reaction` listener. `ReactionPicker`/`ReactionChips` NEW. `MessageBubble` refactor (controlled Popover, anchor=bubble, hover SmilePlus + long-press, `canReact` blocks temp, layout bubble→chips→status, meId local).

**8 decisions FINAL:** D1 user-relation cascade (Like parity); D2 RAW DTO `[{userId,emoji}]`; D3 2-endpoint POST/DELETE (toggle client-side); D4 return full message; D5 socket user-rooms; D6 delta payload `{conversationId,messageId,userId,emoji|null}`; D7 shadcn Popover; D8 GROUP "Seen by N" → 5.3b.

**Technical notes:**
- **Emoji byte-exactness**: `❤️` = U+2764 + U+FE0F (variation selector). FE `lib/reactions.ts` is the source; BE `REACTION_EMOJIS_BACKEND` is an exact copy — typing it by hand will silently fail the Zod enum match.
- **Type parity serializeMessage**: adding `reactions` to `messageInclude` ⇒ MUST add it to `conversationInclude.messages` too (same `MessageRow` type), otherwise the lastMessage preview breaks TS. Cost: 1 message/convo carries reactions — negligible.
- **canReact blocks temp/failed**: reacting needs a real id; optimistic (`temp-`) hides the trigger + chips. `useSendMessage`'s optimistic Message adds `reactions:[]` (type required).
- **Single toggle source**: both picker + chip call `toggle(id, myEmoji, tapped)` → tap-same=remove, different=replace. Optimistic key by meId ⇒ rapid clicks settle on the last click.
- **EPERM on generate**: the `tsx watch` dev server holds `query_engine-windows.dll.node` ⇒ `prisma generate` fails EPERM. Must stop the dev server → generate → restart. (Windows file-lock, not a code bug.)

**Next:** Browser-verify 2 incognito (long-press mobile, hover desktop, optimistic chip, cross-session realtime <1s, toggle off/replace, aggregate, layout order) → Phase **5.3b** GROUP "Seen by N" (FE-only).

---

## 2026-06-13 — Checkpoint 5.2 polish: typing heartbeat + typing-in-thread + date separators + avatar fix + profile links

**Done (FE `tsc -b` + `vite build` 0 errors 2068 modules; socket smoke typing/snapshot/regression PASS on live server; committed `34d2427`). Following the "5.2 follow-up" — typing was still broken in the browser after the listener-order fix, a 2nd root cause + a batch of UX polish.**

- **Typing heartbeat (root cause #2)**: the listener-order fix (follow-up) was NEEDED but NOT ENOUGH. The sender emits `typing:start` exactly once (activeRef guard) + the receiver's 4s TTL expires on its own → the indicator reverts after ~4s during continuous typing, and activeRef is stuck true ⇒ no re-emit ⇒ it never shows again. Fix `useTypingEmit`: **heartbeat re-emit `typing:start` every 2.5s** (< the receiver's 4s TTL) while typing; stop-debounce 3s unchanged.
- **Typing → bottom of MessageThread** (out of the header): `TypingIndicator` (text "X is typing" + 3 animated dots, keyframe `typing-dot` in index.css, no avatar) + auto-scroll keeps it in view when near-bottom. `ConversationDetail` header subtitle = **presence-only** (drop typing logic + `useTypingStore`).
- **Date separators**: `DateSeparator` + `formatDateSeparator`/`isSameDay` (format.ts). Inserted between bursts when **cross-day OR a gap >1h** (first burst = anchor); 24h local + IG-style (Today→`14:07` / `Yesterday` / weekday / `Jun 3` / `Jun 3, 2024`). **Removed per-burst timestamp** (`formatRelativeTime(burst.lastAt)`) — consolidated into the separator.
- **Avatar regression fix**: the 5.2 wrapper (relative outer for the online dot) split `SIZES[size]`→inner leaving `className`→outer ⇒ callers passing `size-16`/`ring-2` via className caused a **gap** (StoryRingItem/StoryBar) + **rectangular border** (StoryBar/StoryViewer ring around the non-rounded outer). Fix: outer keeps `rounded-full + SIZES[size] + className`, inner `size-full`.
- **Profile-link navigation**: another person's avatar in the thread + the DIRECT header (avatar/name) → `<Link to=/users/:username>`. `conversationDisplay` adds `otherUsername`. The GROUP header does NOT link (group settings deferred to 5.5); the back button is split out of the Link.

**Technical notes:**
- **Typing needs 2 independent fixes**: (1) BE listener-order (the receiver must join the convo room — register `socket.on` before await), (2) FE heartbeat (keep the receiver TTL alive). Missing either one → typing breaks in a different way (not joining the room / reverting after 4s).
- **Avatar wrapper rule**: when wrapping an extra element, push `size + shape (rounded-full) + className` to the OUTER, inner `size-full`. Letting `ring`/`size` from className fall onto the non-rounded/non-sized outer → the ring becomes rectangular + the size mismatches the inner. twMerge collapse (`size-14`+`size-16`→`size-16`) is only correct on the same element.
- **Renders-correctly-but-UI-empty ≠ CSS**: the typing diagnostic used an unconditional red banner + a `display` flag + computed-style to rule out H1(display)/H2(CSS)/H3(render-condition) → it was actually typing reverting (TTL) due to the missing heartbeat. The original subtitle class (`truncate text-xs text-muted-foreground`) was never the bug.

**Next:** Phase 5.3+ (reactions / media / recall / group UI). Browser-verify polish (typing persists during continuous typing, date separator branches, avatar fills the ring, profile navigate + back).

---

## 2026-06-13 — Checkpoint 5.2 follow-up: browser-verify fixes (4 issues)

**Done (BE `tsc` 0 errors + FE `tsc -b`/`vite build` 0 errors 2068 modules; socket verify smoke 3/3 + regression 5/5 PASS on live server).** 4 issues found during browser-verify, 2 decisions settled (T5 hide-seen-on-reply, T7 failed+retry).

- **Issue 2 (typing) — THE REAL ROOT CAUSE**: `socket/index.ts` connection handler is `async` and **`await getConversationPartners()` runs BEFORE registering `socket.on('conversation:join'|'typing'|'message:read')`**. The client emits `conversation:join` right after connecting → it lands inside the await window → the listener isn't attached yet → **the event is DROPPED by Socket.io** → the recipient never joins the convo room → typing/read-broadcast is lost. `message:new` isn't affected because `joinUserRoom` is synchronous before the await. **Fix**: register ALL `socket.on` synchronously BEFORE any await; move the async presence into a `void (async()=>{…})()` at the end. The diagnostic smoke proved it: user-room message:new RECEIVED but convo-room typing MISSING when the join is emitted right at connect.
- **Issue 4 (T7) — offline message lost**: `useSendMessage.onError` called `restoreMessages` → removed the optimistic → lost the message. **Fix**: do NOT restore; `markMessageFailed` sets `Message.failed=true` (keeps it on screen). `MessageBubble` failed → red ring + "Failed — tap to retry" → `onRetry(message)` (MessageThread `useSendMessage` mutate `{content, retryTempId}` → `clearMessageFailed` → resend, swap on success / re-mark on fail). Removed `snapshotMessages`/`restoreMessages`/`MessageCacheSnapshot` (orphan after the change).
- **Issue 1 (T1) — last-seen offline**: `presence:snapshot` only emitted `{online}`, no lastSeen → an already-offline partner didn't show "Active X ago". **Fix**: BE snapshot includes `lastSeen: Record<userId,ISO>` (query `User.lastSeenAt` for partnerIds). FE `presenceStore.setSnapshot({online,lastSeen})` merge; `ConversationDetail` "Active {rel} ago" (rel==='now' → "Active now").
- **Issue 3 (T5) — hide Seen on reply** (deviates from IG): `MessageThread.seenMessageId` added a check — if the recipient sent a message AFTER the read cursor (`messages.slice(readIdx+1).some(senderId!==me)`) → hide Seen (null); else keep the old positional logic.

**Verify**: socket verify smoke 3/3 (typing with immediate-join PASS, snapshot lastSeen PASS, B-not-online PASS) + regression 5/5 (presence:online, REST send, message:new, read-receipt, presence:offline+lastSeenAt). Issues 3+4 are frontend-logic (build passes) — **need browser confirm**: retry tap while offline; Seen disappears after B replies.

**Next:** Browser verify 2 incognito for the 4 issues → commit `fix(messaging): typing listener-order + offline retry + last-seen snapshot + hide-seen-on-reply (5.2 follow-up)` straight to main.

---

## 2026-06-12 — Checkpoint 5.2: Messaging Realtime (Socket.io — message:new + typing + presence + read receipts)

**Done (BE migration `add_user_last_seen_at` applied + `prisma generate` + BE `tsc` 0 errors + socket smoke 12/12 PASS; FE `tsc -b` + `vite build` 0 errors 2068 modules; OpenAPI still 32 paths. Replaced the 5s polling with Socket.io. Send is STILL REST — socket is receive-only.)**

- **Backend (~9 files + 1 migration)**: `User.lastSeenAt DateTime?`. Dep `socket.io@4.8`. New module **`src/socket/`** (io/auth/presence/rooms/index — singleton ref + JWT handshake + presence ref-count multi-tab + offline-debounce 5s + room helper). `server.ts` `initSocket(server, env.CORS_ORIGIN)` (attached to the `app.listen()` return, NOT `http.createServer`) + `io.close()` on shutdown. `messages.service`: export `isParticipant`, `sendTextMessage` broadcasts `emitNewMessage` at the end of the function, added `markConversationRead` + `getConversationPartners`. `conversations.service`/`schema` participants add `lastReadMessageId`.
- **Frontend (~13 files)**: `lib/socket.ts` singleton (auth callback reads a fresh token), 3 stores (socket/presence/typing), `lib/conversationCache.ts` + `messageCache` extend (insertIncomingMessage dedup + messageExists), 4 hooks (useSocketConnection/useGlobalSocketEvents/useConversationSocket/useTypingEmit), `useMessages` drops refetchInterval, `useSendMessage` patches the list instead of invalidate. UI: Avatar online dot, conversationDisplay otherUserId, ConversationListItem/ConversationDetail presence+typing, MessageThread seenMessageId positional, MessageBubble "Seen", MessageInput typing emit, AppLayout mounts global hooks.

**5 decisions FINAL (D1–D5) + 6 refinements (verified):**
- **D1 send stays REST** — socket broadcasts `message:new` after the DB write; `message:send` C→S unused. Smoke: B receives message:new with correct content PASS.
- **D2 presence contact-scoped** — connect emits online to partners + a snapshot to self; disconnect (last tab, debounce 5s) persists lastSeenAt + offline. Smoke: snapshot/online/offline PASS.
- **D3 migration `add_user_last_seen_at`** (snake_case) — `User.lastSeenAt DateTime?` nullable.
- **D4 participant DTO + lastReadMessageId** — read receipt. **Refinement: computed POSITIONALLY in MessageThread** (cuid does NOT sort by time ⇒ do NOT compare `id >=` lexically), MessageBubble receives prop `showSeen`. DIRECT only.
- **D5 conversations-list PATCH** — move-to-top + preview instead of invalidate-on-send; incoming patches the same way (idempotent).
- **Other refinements**: conversationDisplay `otherUserId`; Avatar relative-wrapper (dot not clipped); unread badge deferred; mount hooks in AppLayout (not App.tsx); do NOT touch conversations.openapi (the schema propagates by itself).

**Technical notes — new 5.2 patterns:**
- **io.ts type-only import of socket.io** ⇒ messages.service imports the emit helper with NO cycle (one-way service→io.ts, mirroring the lib/prisma singleton).
- **Auth callback (NO token param)**: `auth:(cb)=>cb({token: store.accessToken})` reads a fresh token on each reconnect ⇒ mid-connection token expiry self-fixes via the axios-refreshed store, no socket refresh path needed.
- **Reconnect safety net is MANDATORY**: Socket.io self-heals but does NOT replay missed messages ⇒ `socket.io.on('reconnect')` → `invalidateQueries(['conversations'])` (prefix-matches list+detail+messages). The condition for safely dropping polling.
- **Dedup self-echo race**: the broadcast also reaches the sender; the socket echo may arrive before the REST response ⇒ insertIncomingMessage replaces the temp (sender+content) instead of prepending, onSuccess checks messageExists instead of blind invalidate.
- **Presence flicker**: server-side offline debounce 5s + ref-count multi-tab (online once on the first tab, offline once on the last tab).
- **Typing TTL backstop 4s client** guards against a lost typing:stop; `socket.to(convoRoom)` excludes the typer server-side.

**DB note**: the socket smoke created 2 users `ska_/skb_<base36 ts>` + 1 direct conversation + 1 message — leftover in the dev DB (harmless).

**Next:** Browser verify 2 incognito (presence online/offline + last-seen, message realtime <1s without waiting 5s, typing indicator, "Seen", reconnect refetch, multi-tab dedup, dark+mobile). PASS → commit `feat: messaging realtime — socket.io message:new + typing + presence + read receipts (Checkpoint 5.2)` straight to main. Then Phase 5.3+ (reactions/media/recall/group UI).

---

## 2026-06-11 — Checkpoint 5.1: Messaging Foundation (Conversation/Message models + REST + responsive UI + optimistic send)

**Done (BE migration applied + `prisma generate` + BE `tsc` 0 errors + API smoke 31/31 PASS + OpenAPI 32 path keys; FE `tsc -b` + `vite build` 0 errors 2030 modules; FE browser verify 8/8 + bonus PASS; 3 UX fixes mid-test). Phase 5 kickoff — NO Socket.io (deferred to 5.2), NO image/video messages (deferred to 5.4).**

- **Backend (10 files + 1 migration)**: 3 models `Conversation`/`Participant`/`Message` + 2 enums (`ConversationType`, `MessageContentType` with all 8 values gated to TEXT). Module `conversations/` (schema/service/routes/openapi) + `messages/` (schema/service/openapi, NO routes — the endpoints live under `/conversations/:id/messages`). 6 endpoints: direct/group create, list, get, list+send messages. Mount `/conversations` + wire OpenAPI (Messages before Conversations so Conversation can `$ref` Message).
- **Frontend (~17 files)**: data layer (types + `api/conversations` + queryKeys + `messageCache` + `messageBurst`), 5 hooks (`useConversations`/`useConversation`/`useMessages` polling 5s/`useSendMessage` optimistic/`useStartDirectConversation`), 7 components + `MessagesPage` responsive + `conversationDisplay` helper. Wiring: 2 routes, Sidebar/BottomNav "Messages", profile Message button.

**4 decisions settled + 2 refinements (verified):**
- **D1 directKey race-safe**: `Conversation.directKey String? @unique` = `[a,b].sort().join(':')` → `findOrCreateDirectConversation` = `upsert` (idempotent, NO `$transaction` — matches the Follow/Like/StoryView idiom). GROUP `directKey=null`. Smoke: 2-direction → same id PASS.
- **D2 full nullable schema**: migrate all Conversation+Participant+Message fields; defer the `MessageMedia/MessageReaction/Call` models. `MessageContentType` has all 8 values in the DB + Zod gates TEXT (StoryItemType 4.3a pattern). `replyToId`/`sharedPostId` scalar-only (like `Notification.postId`; FK relation → 5.5).
- **D3 breakpoint md (768)**: reuse `useIsDesktop` (NO separate breakpoint).
- **D4 newest-first store / reverse render**: cache newest-first (BE cursor), `MessageThread` `[...].reverse()` → oldest top/newest bottom; optimistic temp prepend to page[0] = bottom after reverse.
- **R1 lastMessageAt** (confirmed: NO Prisma query orders a parent by its latest child): denormalize `Conversation.lastMessageAt @default(now())`, bump in `sendTextMessage`, order `[{lastMessageAt desc},{id desc}]`. Smoke: convo bubbles to top after send PASS.
- **R2 404-read/403-write** (`prefer-404-over-403-private`): non-participant GET convo/messages → **404** (hide existence); POST message → **403** (write). Smoke both PASS.

**Technical notes — new Phase 5.1 patterns:**
- **Avoid circular import between the 2 services**: each service does its own `isParticipant` check (NO shared helper) ⇒ one-way import `conversations.service → messages.service` (only `serializeMessage`), NO cycle.
- **Scroll preserve on prepend**: `useLayoutEffect` + `loadingOlder` ref (capture `scrollHeight` before fetchNextPage) → restore `scrollTop = scrollHeight - prev` when older loads (newestId unchanged); else scroll-bottom when newestId changes (new msg/initial).
- **Polling auto-pauses when tab inactive**: TanStack v5 `refetchInterval:5000` + default `refetchIntervalInBackground:false` ⇒ does NOT poll when the tab is hidden, refetches on focus. NO manual code.
- **Module split message-under-conversation**: the 2 message endpoints live in `conversations.routes` delegating to `messages.service` (the `posts/:id/comments` pattern); standalone `/messages/:id` (DELETE/reactions) deferred to 5.5 ⇒ NO `messages.routes.ts` in 5.1.
- **Optimistic = useCreateComment** (NOT useCreatePost): a reconcilable temp-id swapped in place; `swapTempMessage` falls back to invalidate.

**UX fixes (browser verify mid-test — 3 fixes, each `vite build` 0 errors):**
- **MessageBubble text wrap** (`MessageBubble.tsx`): bug where "Hello" wrapped mid-word → "He/llo" + long token overflows horizontally. Root cause = `max-w-[75%]` is a fraction of the wrapper `flex justify-*` **shrink-to-fit** ⇒ `width ≤ 0.75×(own width)` circularly collapses to min-content ⇒ `break-words` character-break. Fix: `max-w-[75%]` → **`max-w-full`** (the real cap = parent column `max-w-[80%]`, anchored to the definite row width — no more collapse) + `break-words` → **`[overflow-wrap:anywhere]`** (long no-space "zzz…"/URL breaks within the column). `whitespace-pre-wrap` kept (Shift+Enter newline). Note: the original proposal to keep `max-w-[75%]` would have made the bug WORSE (anywhere → collapse to ~1 char/line).
- **(Pattern 31) Global scrollbar styling** (`index.css`, cross-theme + thin): `::-webkit-scrollbar` 8px + track `transparent` + thumb `oklch(0.55 0 0 / 0.4)` (gray + alpha, **NOT a `var(--muted)` token** → the same color works correctly in both light + dark) hover `/0.6`; Firefox `html { scrollbar-width: thin; scrollbar-color }`. `.scrollbar-hide` (StoryBar/Carousel) KEEPS hiding — class specificity > global `::-webkit-scrollbar`. The minifier converts the thumb oklch→`#71717166` (gray gamut lossless, visually identical).
- **MessageInput textarea scrollbar**: tried `pr-4` (gap for the scrollbar) → switched to **`scrollbar-hide`** (reuse the Phase 4 util) + reverted to symmetric `px-3`. `scrollbar-hide` only hides the VISUAL (`overflow` kept) ⇒ scroll wheel/arrow/touch/auto-scroll-typing still work. The message thread does NOT opt in ⇒ still shows the thin-gray global (textarea-only hide).

**DB note**: the smoke test created 3 users `msga_/msgb_/msgc_<base36 ts>` + 1 group "Trip" + a few messages — leftover in the dev DB (harmless, can `prisma studio` delete if you want it clean).

**Next:** Browser verify DONE (31 BE smoke + 8 FE cases + bonus PASS; 3 UX fixes mid-test). Commit `feat: messaging foundation — conversations + messages + responsive UI (Checkpoint 5.1)` straight to main. Then Phase 5.2 Socket.io realtime.

---

## 2026-06-10 — Checkpoint 4.4 follow-up: browser-verify bugfixes (cron interval + video reopen)

**Done (2 bugs from the 4.4 browser verify; BE/FE `tsc` + `vite build` 0 errors 2013 modules):**
- **Cron interval 1h → 5 minutes** (`archiveExpiredStories.ts`): the archive page was empty because 3 expired stories hadn't flipped `isArchived`. Root cause was NOT a code bug — the sweep was correct (edit the jobs file → tsx reload → immediate-run archives all 3: isArchived false→true; `listArchivedStories` returns test1=2/test2=1); the cause was the 1h interval + the dev server not running continuously ⇒ no tick fired within the window the stories expired. 5 minutes + run-immediately makes archiving responsive. Docs synced (backend/CLAUDE, ARCHITECTURE §6, the 4.4 PROGRESS entry).
- **Video archive reopen frozen** (`StoryViewer.tsx`): reopening the SAME video story → the video stalls but the progress bar runs → desync. Fix Option A: add `isOpen` to the video play/pause effect deps.

**Technical notes:**
- **The video play effect must also gate on `isOpen`**: the viewer does NOT unmount on close (just `return null`) ⇒ `currentStoryIndex`/`currentStory.id` (component state) PERSIST across close. Reopening the same story ⇒ id unchanged ⇒ deps `[id, mediaType, isPaused]` unchanged ⇒ the effect doesn't re-fire ⇒ `<video key={id}>` (a fresh DOM remount, default paused, no `autoPlay`) never gets `play()` called. The progress bar still runs because it's a pure CSS animation on the new mount (not via the effect) ⇒ desync. Images aren't affected (just `<img>`, no play needed). Add `isOpen` (false→true) → deps change → re-fire → play. Close (true→false): the effect runs but `v=null` (already unmounted) → safe early return.
- **Cron is not load-bearing (confirmed again)**: expired stories are already hidden by the time-filter (`expiresAt>now`) in the active query; the cron only sets the flag for `/stories/archive`. A missed tick only delays the archive page, it does not expose expired stories.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[P3] [frontend/story-viewer]` `muted` state does NOT reset when the viewer reopens (persists across close because the component doesn't unmount) — if a prior session fell back to muted, reopen keeps it muted. Pre-existing, not caused by the video-reopen fix. Reset = `setMuted(false)` in the `!isOpen` branch of the init effect if you want mute to default each time it opens.

**Next:** Browser re-verify T1-T7 video reopen + the remaining T1-T22 of 4.4 (user). PASS → commit `feat: stories archive + cron + profile entry + view count (Checkpoint 4.4)` straight to main (folding in both follow-up bugfixes).

---

## 2026-06-09 — Checkpoint 4.4: Stories archive + cron + profile entry + view count/viewers (Phase 4 core done)

**Done (45/45 cases PASS = backend smoke 23/23 [API 17 + cron 6] + browser 22/22; migration applied; BE/FE `tsc` + `vite build` 0 errors 2013 modules; OpenAPI 27 paths). 3 feature groups:**
- **Archive + Cron**: cron flips `isArchived` when a story hits 24h + `GET /stories/archive` (own archived, cursor) + `ArchivePage` `/me/stories/archive` (9:16 thumbnail grid → opens the archive viewer). Deleting in the archive viewer updates the grid too.
- **Profile Entry**: `GET /users/:username` added `hasActiveStory` → the profile avatar has a coral ring when there's an active story, tap opens the viewer (single-user mode); self also gets an "Archive" button.
- **View Count + Viewers**: `viewCount` owner-only in the Story DTO + badge `👁 N views`; `GET /stories/:id/views` (owner-only) + `StoryViewersModal` (Radix dialog, infinite scroll); the viewer pauses when the modal is open.
- **2 UX fixes (browser verify)**: clicking the viewer in the modal closed both the viewer (not just the modal); `markStoryViewed` skips self-view (the owner does NOT enter the viewers list/viewCount) + cleaned up 12 legacy self-view rows (DB → 0).

**Technical notes — 5 new engineering patterns in Phase 4.4:**
- **Plain `setInterval` cron (0 deps)**: `src/jobs/archiveExpiredStories.ts` + `startArchiveJob()` (5 minutes, run-immediately to make up for downtime, try/catch so it doesn't crash) wired into `server.ts` after `app.listen`. NOT load-bearing for visibility (the active query already time-filters out expired) — the cron only sets the flag so the archive query is correct; a missed tick only delays the flag.
- **Owner-gate field privacy**: `serializeStory(...,{viewerId})` → `viewCount = isOwner ? _count.views : null`; gated at BE (non-owner always null), the feed excludes self ⇒ the feed is always null, no leak — NOT just hidden on FE.
- **StoryViewer 3-mode branch (extends the 4.2 hybrid dual-source)**: 1 component, `mode: feed | single-user | archive` decides `canCrossUserAdvance`/`shouldMarkSeen`/`isOwner`/data-source/init. Archive is unreachable via feed/userStories (both filter active) ⇒ requires a 3rd source `useArchivedStories`; archive mode = no mark-seen (BE rejects archived) + no cross-user + isOwner=true.
- **Archive infinite cache patch (storyCache extension)**: archive = `InfiniteData` (pages) ≠ feed/userStories's plain object ⇒ `removeStoryFromCaches`/snapshot/restore add a map-pages-filter branch; `useDeleteStory` +`cancelQueries(archivedStories())`.
- **`userProfileSchema` vs `publicUserSelect` kept separate**: `hasActiveStory` goes only into the profile DTO (`findFirst` existence + privacy gate), NOT into the 7-field `publicUserSelect` (reused for author/list-item) — avoids bloat + an extra query.
- (minor) Route `/stories/archive` placed **before** `/:id` (Express order, so it isn't swallowed as an id); `markStoryViewed` skip-self KEEPS the 404 (not 410, consistent with the codebase); the BE API `/stories/archive` (auth=me implicit) ≠ the FE page route `/me/stories/archive`; pause-on-modal combined with `||` does NOT touch `useStoryGestures` + ESC guard `modalOpenRef`.

**Tech debt arising (ALREADY appended to BACKLOG during the session — not appended again):**
- `[P3] [frontend/story-viewer]` Archive auto-advance across a page boundary = fetchNextPage + index++ (brief spinner) — no prefetch.
- `[P3] [backend/stories]` viewCount `_count.views` aggregates per row even for the feed (always null for non-owner but the aggregate still runs) — optimize if the feed grows.
- `[P3] [stories]` View count isn't realtime (the owner sees it only on refetch) — WebSocket in Phase 5.

**Next:** Commit `feat: stories archive + cron + profile entry + view count (Checkpoint 4.4)` straight to main. Then 4.3b (MENTION/STICKER/TAG + multi-touch) or Phase 5 messaging.

---

## 2026-06-09 — Checkpoint 4.3a: Story overlays builder (TEXT + EMOJI + video edit)

**Done (BE migration + smoke 7/7 + browser verify 42/42 PASS [22 original cases + 20 extension cases] + BE/FE `tsc` + `vite build` 0 errors, 2009 modules):**
- **Backend (5 files + migration)**: model `StoryItem` (x/y 0-1 normalized, `scale@1`/`rotation@0`, `payload Json`, FK `onDelete Cascade`, `@@index([storyId])`) + `Story.items[]`. Enum `StoryItemType` declares **all 5 values** (TEXT/EMOJI/MENTION/STICKER/TAG, phase-commented) but Zod `storyItemInputSchema` (discriminatedUnion) **gates TEXT+EMOJI** → 4.3b adds the Zod cases, **NO enum migration**. `createStorySchema.items` optional `.default([])` (before `.refine`, 4.1 zero-break); `storyResponseSchema.items`; `storyInclude.items` (select + `orderBy id asc` — cuid monotonic ⇒ stable z-order); `serializeStory` whitelist +items; `createStory` nested-create. Migration `20260609095111_add_story_items` (cascade FK). OpenAPI **25 paths** (discriminatedUnion → `oneOf` OK).
- **Frontend deps**: `@emoji-mart/react`+`@emoji-mart/data`+`emoji-mart` (~50KB — a deliberate exception to "no new deps"; **ships types**).
- **Types**: `StoryItemType`/`StoryItem`(discriminated)/`StoryItemInput`(no id); `Story.items`; `CreateStoryInput.items?`.
- **Overlay primitives**: `StoryOverlay` (reused editor+viewer), `StoryOverlayLayer` (viewer read-only `pointer-events-none`, null when empty), `useOverlayDrag` (**1 hook**, `getHandlers(item)` avoids hooks-in-loop; CropStage setPointerCapture idiom; normalize px→0-1 against contentRef; tap<5px=select / ≥5px=drag; trash hit when ref final pos <0.12), `TrashZone` (bottom-center, visible while dragging + highlight near), `AddTextOverlay`+`EmojiPickerOverlay` (inline `absolute z-50`, **NO nested Radix Dialog**; ESC/backdrop cancel).
- **`StoryEditStage`** (**image + video**): layout **mirrors the viewer** (max-w-md, h-20 top + h-20 bottom chrome), bg = `media.blob` objectURL → image `<img object-cover>` / video `<video object-contain bg-black>` paused seek 0.1s (no autoplay, matches poster), drag-reposition + drag-trash, tap-(de)select, top chrome X(close)/Back/Share.
- **`StoryComposer`**: `edit` step for **both image + video** (`crop→edit→upload` / `video→edit→upload`, same StoryEditStage). `editingMedia: StoryMediaPayload`; edit `onBack` conditional (video→`video`/image→`crop`). DialogContent **full-bleed during edit** (no title bar + bg-black + showClose=false + onEscapeKeyDown preventDefault) → content zone snug to the viewer.
- **`StoryViewer`**: restructured into flex-col chrome zones + `StoryOverlayLayer`. Gesture/progress/mute/swipe/cross-user **unchanged**.
- **`useCreateStory`**: mutate var `{media, items?}`; items go into CreateStoryInput on **both image + video paths**.
- **Fixed 3 issues + extended video-edit (same session, user approved NO defer)**: (1) **labels** — crop/video stage final `Next` (→edit), editor final `Share` (→upload+post); (2) **selected ring hugs text** — ring moved to the inner `inline-block` (shrink content) + `max-w-[80%]` on the outer absolute (resolves circular %), TEXT ring snug to the pill / EMOJI ring-offset-2; (3) **video flow into edit** — VideoStage→edit (V1 paused first frame, V2 object-contain letterbox), drag overlay on the poster, Share→upload. `vite build` 0 errors after the fix.
- **Docs**: backend/CLAUDE.md (StoryItem + endpoint), frontend/CLAUDE.md (Phase 4.3a section + coord rule + video-edit + ring fix), PROGRESS.md (this entry).

**Verify (code-level + backend functional):**
- **Migration applied** `20260609095111_add_story_items` (StoryItem + 5-value enum + cascade FK + storyId index); `prisma generate` OK (the dev server was down then → NO EPERM).
- **Backend smoke 7/7 PASS** (Node fetch on the dev server, backend trusts the client URL without S3): create a mix of TEXT+EMOJI → 201 + items with id/scale1/rotation0/payload in correct **array order**; no-items → `[]`; x=1.5 → 400; STICKER → 400 (Zod gate); TEXT missing text → 400; delete ×2 → 204 (cascade, no FK error). (Throwaway script, deleted.)
- **`tsc -b` BE + FE + `vite build`** 0 errors (2009 modules, +10 vs 4.2). OpenAPI build 25 paths + Story.items + StoryItem schema + CreateStoryRequest.items = oneOf.
- **Browser-interactive 42/42 PASS**: 22 cases of the original set (add text/emoji inline, drag, multi-overlay, trash delete + near-highlight, coord consistency editor↔viewer, backward-compat 4.1 no-items, empty→items[], cancel Back/X, ESC AddText, dark+mobile, regression 4.2 gesture/progress/mute/cross-user) + 20 extension cases (3 UX fixes: button labels, ring hugs short/long/multi-line text/emoji, video→edit poster-bg drag + viewer playback + coord video editor↔viewer mobile+desktop).

**Technical notes:**
- **2-layer container pattern (ring sizing fix)**: overlay = outer `absolute` (positioning + drag + transform + `max-w-[80%]` resolved against the content zone) + inner `inline-block` (shrink-wraps content, carries the ring). The outer shrinks to the inner ⇒ the ring hugs the text/pill. Putting `max-w` on the inner would resolve % wrong vs the parent shrink-fit (circular) → MUST split into 2 layers.
- **Video bg = paused first frame at 0.1s + object-contain letterbox** (decision): editor `<video muted preload=metadata>` `onLoadedMetadata`→`currentTime=0.1` (matches the `extractVideoThumbnail` poster), **NO autoplay** (frees CPU for dragging overlays). object-contain matches the viewer (both letterbox ⇒ overlay positions align; portrait isn't cropped).
- **Coord consistency**: editor+viewer share the **same layout** (max-w-md + h-20/h-20 chrome + object-fit per media type) ⇒ overlay 0-1 positions align. Edit is full-bleed (no-title-bar, full-screen desktop) so the editor content zone == the viewer. Mobile exact; desktop matches at max-w-md width.
- **2 refinements vs the E3 pseudocode** (settled during planning): (1) **symmetric chrome** h-20 on both top+bottom on both sides (the pseudocode mismatched auto/h-20) to avoid flex-1 shifting the aspect; (2) **edit full-bleed + drop title bar** (Dialog `sm:max-h-[90vh]` + `h-12` title would shrink/shift the content zone vs the viewer).
- **1 hook useOverlayDrag** (getHandlers per item) — NOT reusing `useStoryGestures` (viewer-nav is a different concern).
- **discriminatedUnion → oneOf** OpenAPI OK (no need for the z.union fallback the plan kept as a backup).
- **emoji-mart ships types** (no module declaration needed).
- **StoryItemType enum full-5** DB + Zod-gate-2 → 4.3b zero enum-migration.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[P2] [frontend/lint]` `npm run lint` config broken (eslint 9.39.4 `eslint.config.js:15 recommended undefined`) — **pre-existing**, NOT caused by 4.3a (the install only added emoji-mart, did not bump eslint). tsc+build is the verify source; the eslint.config needs a separate fix.
- `[P3] [frontend/story-overlay]` z-order = array order (no `order` field) — add `order` if 4.3b needs to reorder overlays.
- `[P3] [frontend/story-editor]` Desktop coord drifts slightly if the editor (Dialog full-bleed) vs the viewer (fixed inset-0) have a different viewport height (both max-w-md so the width matches) — exact on mobile.
- `[P3] [frontend/bundle]` Bundle 1041KB (>500KB warn) — emoji-mart contributes ~50KB; consider dynamic `import()` of the Picker.
- `[P3] [backend/stories]` BE does NOT validate that the actual image contains the overlay (trusts client x/y/payload) — consistent with "don't verify media".

**Next:** Commit 4.3a straight to main (`feat: story overlays builder — text + emoji + video edit (Checkpoint 4.3a)`). Then 4.3b (MENTION/STICKER/TAG + multi-touch scale/rotate).

---

## 2026-06-09 — Checkpoint 4.2: Advanced story viewer (progress bars + gestures + cross-user)

**Done (FRONTEND-ONLY, NO backend/migration; browser verify 15/15 PASS + `tsc -b` + `vite build` 0 errors, 1999 modules):**
- **Progress bars**: `StoryProgressBar`/`StoryProgressBars` (new) — each story has 1 bar filling linearly via the CSS keyframe `@story-progress` (index.css) + inline `animationDuration`/`animationPlayState`. The active bar's `onAnimationEnd → goNext` replaces the old `setTimeout` (source-of-truth for advancing). State pending/active/complete by index.
- **Gestures**: 1 hook `useStoryGestures` (new) combining hold-pause (200ms) / swipe-down dismiss (>100px) / tap 1/3÷2/3 — pointer events + `setPointerCapture` (CropStage idiom), overlay `touch-none` z-10 below header/mute/close (z-30/40).
- **Cross-user auto-advance**: the viewer reads `useStoriesFeed` items[] as the queue, forward-only + gate `isUnseenFlow` (tapping an already-seen ring views only that user then closes). Combined `goNext` (removed the 4.1 timer-vs-button duplication) + 1 init effect + `initializedRef` guard (fixes the 4.1 2-effect race).
- **Hybrid dual-source (deviates from plan, user accepted)**: FEED mode (cross-user) when the starting user is in the feed; SINGLE-USER mode (`useUserStories` fallback, no cross-user) when not — patches the composer "View story" regression (self is NOT in the feed → feed-only would open-then-close instantly). `startInFeed` decides the source + enables cross-user.
- **Mute toggle** for video (mirror PostVideo ref-sync) + **author avatar/username → `<Link>` profile** (header, `onClick={close}` closes the viewer before navigate). `storyViewerStore` rename `username → startUsername`.

**Technical notes:**
- **`initializedRef` guard is CRITICAL**: an optimistic view-mark mutates `items[]` (storiesFeed cache) → without the guard the init effect re-runs mid-way → resets the index. The guard resets only when `isOpen` goes false→true.
- **Progress pause**: the `animate-story-progress` class MUST stay fixed, ONLY change `animationPlayState` inline; adding/removing the class by isPaused → restarts the animation from 0. `animation-play-state:paused` freezes → resume in place for free.
- **1 gesture hook (not 2)**: can't spread 2 `onPointerDown` onto the same element. `finish()` reads refs (`deltaYRef`/`pausedRef`) not state → avoids stale-closure delta at pointerup. `onPointerCancel` is separate (cleanup, no nav).
- **Hybrid consequence**: the feed excludes self → `isOwner` Delete is only reachable in single-user mode (self-after-post); `currentStory.author.username` is shared for mark-viewed/delete in both modes (no need for `currentUser`).
- **@keyframes in index.css** (Tailwind v4 CSS-first, no config.js) next to `.scrollbar-hide`; `forwards` holds 100% before React changes state (avoids flickering back to 0).
- **author Link `onClick={close}` synchronous** within the click event, RR navigate in the same event → no race; body-scroll-lock cleanup when `isOpen` is false.

**Tech debt arising (proposed for BACKLOG — awaiting confirmation):**
- `[P3] [frontend/story-viewer]` The uncommitted BACKLOG entry "profile-entry-point single-user" is now **partially obsolete**: the data-source fallback (useUserStories) was DONE in 4.2; remaining = (a) a UI entry point from the profile page to open the viewer for own-stories, (b) verify cross-user-delete when the user is empty (still unreachable). Propose rewriting the entry.
- `[P3] [frontend/story-viewer]` Bar↔video drift when the video buffers (bar duration = fixed `story.duration`, video playback may stutter) — accepted (Option A, bar = source-of-truth); `onEnded` backup.

**Next:** Commit 4.2 straight to main (`feat: story viewer advanced — progress/gestures/cross-user`). Then 4.3 (StoryItem overlays) or polish the profile-entry-point. The 4.1 migration was already applied (browser verify ran against real data).

---

## 2026-06-08 — Checkpoint 4.1: Stories Core (backend + real StoryBar data + slim composer + viewer)

**Done (migration applied + BE+FE `tsc` + `vite build` 0 errors, 1996 modules + backend smoke 26/26):**
- **Backend schema**: new model `Story` (1 story = 1 media, media fields **flat on the row**: mediaUrl/mediaObjectKey/mediaType/thumbnailUrl?/thumbnailObjectKey?/duration?/width?/height?, expiresAt, isArchived, NO child-table) + `StoryView` (`@@id([storyId, viewerId])` + **a FULL `viewer User @relation`** parity with Like + `@@index([viewerId])`); `User` adds `stories[]`+`storyViews[]`. **NO visibility column** (privacy is user-level), **NO** StoryItem/AudioTrack/audioTrackId (deferred to 4.3/4.4). 2 indexes (`[authorId, expiresAt]`, `[isArchived, expiresAt]`). Migration `20260607181546_create_stories` applied (all 3 FKs ON DELETE CASCADE).
- **Backend module** `modules/stories/` (schema/service/routes/openapi): `POST /stories` (expiresAt=now+24h), `GET /stories/feed` (following-set + 1 query for the views Set to avoid N+1 + group-by-author + sort unseen-first + hasUnseenStory), `GET /users/:username/stories` (privacy mirrors listPostsByUsername + per-story isViewedByMe), `POST /stories/:id/view` (upsert idempotent 204), `DELETE /stories/:id` (owner 403 + S3 cleanup media+poster). `serializeStory` is a **whitelist** (does NOT leak objectKey). Wire server.ts `/stories`, users.routes `/:username/stories`, openapi (register + tag) → OpenAPI build **25 paths** (3.3 was 20, +5).
- **Frontend data layer**: types (`Story`/`StoryFeedItem`/responses/`CreateStoryInput`), queryKeys (`storiesFeed`/`userStories`), `api/stories.ts` (5 methods)+barrel, `lib/storyCache.ts` (plain-cache patch: mark viewed/remove/snapshot-restore).
- **Frontend hooks/stores**: `useStoriesFeed`/`useUserStories`/`useCreateStory`/`useViewStory`/`useDeleteStory` + `storyComposerStore`/`storyViewerStore`.
- **Frontend components** `components/story/`: `StoryBar` (EXTRACTED from FeedPage, wire data + keep scroll-arrows), `StoryRingItem` (coral ring unseen / muted seen), `StoryViewer` (hand-rolled `fixed inset-0`, body-scroll-lock + ESC, first-unseen start, tap prev/next, timer 5s image / duration video + onEnded, owner Delete, mark seen), slim `StoryComposer` (select→crop|video→upload→done, no caption) + `SelectStoryStage` (croppable img + mp4 ≤15s, GIF/AVIF reject) + `StoryCropStage` (cropImage utils, 9:16 locked). Reuse `composer/VideoStage`. Mount composer+viewer in AppLayout. FeedPage uses the `<StoryBar/>` component.

**Technical notes:**
- **3 decisions settled with the user**: (Q1) StoryView FULL `viewer User @relation` immediately; (Q2) composer **build a new slim one** NOT reusing the PostComposerModal skeleton (only reuse utilities); (Q3) 4.1 does both image + video.
- **Media flat on Story** (no PostMedia-style child-table) — simpler than Post, since 1 story = 1 media.
- **serializeStory whitelist from the start** — does NOT repeat the serializePost objectKey-leak tech-debt (spread raw media).
- **Viewer hand-rolled** (no Radix Dialog) so 4.2 can attach gestures; locks body scroll + ESC itself.
- **Video 15s gate frontend-only** (`SelectStoryStage` after getVideoMetadata); backend trusts the client (consistent with "don't verify media").
- **Images croppable-only** (jpeg/png/webp) since we force 9:16; GIF/AVIF rejected in the composer.
- **storyCache = plain useQuery cache** (`{items}`/`{stories}`), NOT InfiniteData like postCache → patch the object directly.
- **useCreateStory** mirrors useCreatePost but single media (image 1 PUT / video 2 PUT 90-10); onSuccess ONLY invalidates `userStories(me)` (feed excludes self).

**Verify:**
- **Migration applied** `20260607181546_create_stories` (Story + StoryView + 3 cascade FKs + 3 indexes); `prisma generate` OK. (Docker daemon was down during coding → only generate; applied after the user started Docker.)
- **Backend smoke 26/26 PASS** (Node script on the dev server + real MinIO, real presign+PUT): create image/video, expiresAt+24h, does NOT leak objectKey, video-missing-thumbnail→400, feed grouped+hasUnseen, follower/non-follower/anonymous, view 204 idempotent + isViewedByMe flip, missing→404, delete non-owner 403 / owner 204, privacy gate all 4 branches, **MinIO deletes media+video+poster after delete**. (Throwaway script, deleted.)
- **Browser-interactive NOT yet run** (waiting on the user; dev server BE:3000 + FE:5174 running): real StoryBar data, composer crop 9:16 / video 15s reject / GIF-AVIF reject, ring seen/unseen, viewer tap/timer/delete + body-scroll-lock, dark+mobile.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[P3] [backend/stories]` Backend does NOT validate video duration (15s) — the gate is client-only. Phase polish adds a server-side check (needs to read metadata / trust the client metadata field).
- `[P3] [frontend/stories]` The viewer has no sound unmute toggle yet (tries to play with sound, on fail → muted) — full audio UX in 4.2.
- `[P2] [frontend/stories]` Viewer auto-advance is within 1 user only (end → close); move to the next user + progress-bar animation + gestures → 4.2.
- `[P3] [backend/stories]` Orphan S3 on partial upload fail (video PUT ok, poster PUT fails) — carry-over pattern from posts.

**Next:** Browser-interactive verify (user) → commit `feat: stories core (Checkpoint 4.1)` straight to main. Then 4.2 (advanced viewer: progress-bar animation + hold/swipe gestures + auto-advance across users).

---

## 2026-06-07 — Checkpoint 3.3: Nested comments / replies (Phase 3 done)

**Done:**
- **Split endpoints (approach a, IG-style)**: `GET /posts/:id/comments` now returns only **ROOT** (`where parentId: null`) + `repliesCount` per item; `GET /comments/:id/replies` (NEW) lazy-loads replies chronological asc. `serializeComment` (mirror `serializePost`) flattens `_count.replies → repliesCount`, does NOT leak `_count`. **NO migration** (parentId/replies + the 2 cascades existed since Phase 2.3b-1).
- **Flatten-on-create**: `createComment` reassigns `parentId = parent.parentId ?? input.parentId` → a reply-of-a-reply goes back to root, DB chain at most 1 level. **Delete permission change**: comment-author only (dropped post-author from 2.3b-1).
- **Routes split**: created a separate `comments.routes.ts` (`GET /:id/replies`, `PATCH /:id`, `DELETE /:id`) mounted `/comments`; `GET/POST /posts/:id/comments` stay in `posts.routes.ts`. 2 pagination schemas (`commentListQuerySchema` default 10 / `replyListQuerySchema` default 4). Both responses share `{ comments, nextCursor }`.
- **Frontend**: `lib/commentCache.ts` (bump repliesCount + append/remove reply + snapshot/restore), `lib/parseMentions.tsx` (@mention → `<Link text-primary>`, lookbehind blocks emails), `useReplies`/`useDeleteComment` (new) + `useCreateComment` refactor (branch root/reply). UI: `RepliesList` (new, indent + lazy + inline reply form), `CommentItem` refactor (Reply/Delete actions + View/Hide replies toggle + @mention render), `CommentList` lift `replyingTo` + change infinite-scroll → "View more comments", `CommentForm` reply mode (prefill + chip + autoFocus to avoid id collision), `CommentDeleteConfirmDialog` (only when root has replies).
- Code-level verify: backend `tsc -b` 0 errors + OpenAPI build OK (20 paths, with `/comments/{id}/replies` + `repliesCount` in the Comment schema); frontend `tsc -b` + `vite build` 0 errors (1981 modules).

**Technical notes:**
- **Keep the wire envelope `{ comments, nextCursor }`** for both root and replies (reuse `commentListResponseSchema` + `CommentListResponse`) instead of `{ items }` like the spec — zero churn at root, `useReplies` mirrors `useComments` exactly.
- **Delete UX 2 branches**: reply + root-without-replies → instant optimistic; root WITH replies → `CommentDeleteConfirmDialog` warns of the cascade "deletes N replies" (reuse the post's `DeleteConfirmDialog` pattern).
- **post.commentsCount counts replies TOO** (backend `_count.comments` doesn't filter parentId) → reply create/delete also bumps `commentsCount` via `patchPostInCaches`; root delete subtracts `1 + repliesCount`.
- **Reply onSuccess swap-in-place (NOT invalidate)**: replies are chronological asc → the newest is on the LAST page; invalidate would refetch the first page (oldest) making the just-sent reply vanish in a long thread. Fix: `replaceReply` swaps temp→real in place, falling back to invalidate only if the temp isn't in the cache. Root still invalidates (the newest is on page 0, so it's correct).
- **`text-coral` does NOT exist** in the theme → @mention uses `text-primary` (coral = `--primary`).
- **id collision**: `COMMENT_INPUT_ID` is only attached to the MAIN form (`inputId` prop); the reply form uses `autoFocus` (many forms at once, no duplicate id).
- **Circular import `CommentItem ↔ RepliesList`** is safe (render-time binding + type-only `ReplyTarget`).
- **Reply on a 0-reply root**: auto-expand the empty RepliesList to host the form; on cancel while still 0 replies → collapse again (`handleReplyClose`).

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[P3] [frontend/comments]` Optimistic `post.commentsCount −(1+repliesCount)` on root delete relies on the cached repliesCount — may drift if replies were added server-side outside the session; reconciles on natural refetch.
- `[P3] [frontend/comments]` Edit comment UI not done yet (backend `updateComment` exists since 2.3b-1) — defer.
- `[P3] [frontend/comments]` @mention has no autocomplete yet (type @ → dropdown) — Phase polish; mention notifications → Phase 7.

**Next:** Browser-interactive verify 3.3 (root list 10 + "View more"; View/Hide replies 4/page; reply on root & on reply prefill correctly; @mention click + `email@gmail.com` not parsed; delete reply/root-without-replies instant + root-with-replies confirm cascade; post-author CANNOT delete another's comment; dark + mobile) + backend curl (root only, replies asc, flatten parentId=root, delete 403 for non-author & post-author). After PASS → tag `phase-3-complete` (3.1+3.2+3.3).

---

## 2026-06-07 — Checkpoint 3.2: Video upload + playback (+ delete post, private toggle, change visibility)

**Done:**
- **Video upload (1 MP4/post, single-media-only, NO mixing with images)**: presign adds `video/mp4` + per-type size cap (image 10MB / video 50MB), thumbnail extracted client-side (Canvas + `<video>` seek 0.1s, NO transcode). Composer forks into 2 branches after Select: image → crop, video → `VideoStage`. Render `PostVideo` (autoplay-on-scroll muted, object-contain letterbox, mute toggle, duration overlay) wired into PostCard/PostDetailView/PostsGrid (Play badge).
- **Migration `add_post_media_thumbnail_object_key`**: adds `thumbnailObjectKey String?` to PostMedia so `deletePost` deletes both the video and the poster from S3 (no orphan). This is the ONLY migration of 3.2 (the `thumbnailUrl`/`duration`/enum VIDEO fields existed since Phase 2).
- **Delete post (frontend)**: `useDeletePost` (optimistic remove from feed+userPosts, snapshot/rollback) + `DeleteConfirmDialog` + `PostActionMenu` (⋯ owner-only) wired into PostDetailView (NOT on the feed card, like IG). The backend DELETE + S3 cleanup existed since 2.3a.
- **Change visibility**: `PostActionMenu` adds a RadioGroup PUBLIC/FOLLOWERS/PRIVATE (radix DropdownMenu) → `useUpdatePost` (patch in-place). Backend PATCH /posts/:id already accepted visibility since 2.3a.
- **Private account toggle**: `ui/switch` (hand-rolled radix) + field `isPrivate` in `ProfileEditForm`. Backend (`updateProfileSchema.isPrivate` + service spread + gating postsCount/grid) ready since 2.5 — frontend just exposes the UI.
- Code-level verify: `tsc -b` backend + frontend + `vite build` 0 errors; Zod schema unit-check 13/13 (per-type cap + video-standalone refine); OpenAPI build OK.

**Technical notes:**
- **media.schema split into 2**: `presignRequestBaseSchema` (ZodObject, registered in OpenAPI) + `presignRequestSchema` (`.superRefine` per-type cap). Reason: registering ZodEffects (the product of refine) into zod-to-openapi risks breaking the spec → keep OpenAPI seeing a clean ZodObject, runtime validation uses the refined version. Size errors attach `path:['size']` to surface in `details.size`.
- **serializePost spreads raw `post.media`** (postInclude has no `select`) → `thumbnailUrl`/`duration`/`thumbnailObjectKey`/`objectKey` are present in the runtime response automatically. Consequence: only need to persist at create + add to the FE type + doc schema, do NOT touch the serializer. Side effect: `objectKey`+`thumbnailObjectKey` leak into the response (see tech debt).
- **Composer flow DERIVED** (`video ? 'video' : images.length ? 'image' : null`) instead of separate state → the 2 holders don't drift. `VideoStage` re-keyed `key={video.id}` like CropStage.
- **useCreatePost** `MediaPayload = CroppedImage | VideoMedia` discriminated by `contentType==='video/mp4'`. Video = **2 sequential PUTs** (video 0–90% + poster 90–100%) combined into 1 `MediaInput`. `extractVideoThumbnail` reads from the LOCAL blob (objectURL) → NO CORS issues.
- **PostVideo**: `muted` must sync via a ref effect (React only sets the `muted` attribute at mount, doesn't update it). IntersectionObserver threshold 0.5 play/pause; **each instance has its own observer** (no single-active coordinator yet). object-contain so a portrait video isn't cropped (the video flow has no crop step).
- **useUpdatePost / useDeletePost — deliberate deviation from spec**: neither does `invalidateQueries(feed)`. useUpdatePost uses `patchPostInCaches` replace in-place; useDeletePost optimistic remove + keeps `post(id)` until onSuccess (avoids a "not found" flash on the open detail) + navigates in onSuccess (not at confirm time) so onError rollback can still run (the component hasn't unmounted). Common reason: invalidate feed → refetch → reshuffle + lost scroll (settled in 2.4b); an owner's posts aren't in the owner's feed anyway.
- **Switch + DropdownMenu** hand-rolled from the `radix-ui` umbrella (v1.4.3, already exports `Switch`/`DropdownMenu`) — NO new dependency.
- Windows EPERM on `prisma generate` while tsx watch holds the DLL (known since 2.3b-1) — migrate apply OK, generate must retry after the dev server releases the DLL.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[P3] [backend/posts]` `objectKey` + `thumbnailObjectKey` leak into the runtime response (serializePost spreads raw media) — fix with a media `select` whitelist. (objectKey leaked since Phase 2; 3.2 adds thumbnailObjectKey.)
- `[P2] [frontend/feed]` Single-active-video coordinator: each `PostVideo` currently plays on its own when ≥50% visible → multiple videos play simultaneously if in the same viewport. Need a manager so only 1 video plays at a time.
- `[P3] [backend/video]` Transcode pipeline (BullMQ + ffmpeg) multi-resolution + server-side poster — production. Currently uploads the original MP4, poster client-extracted.
- `[P3] [frontend/video]` Client compress (ffmpeg.wasm) for videos hitting the 50MB ceiling.
- `[P3] [backend/media]` Orphan S3 on partial upload fail extended to the video 2-PUT (thumbnail PUT fails after video PUT → orphaned video) — carry-over from 3.1.

**Next:** Browser-interactive verify 3.2 (video upload/playback + delete + visibility + private) + backend curl (presign caps, POST video, DELETE → MinIO deletes both objects) + CORS playback from MinIO. Then 3.3 (nested comment/reply); tag `phase-3-complete` when 3.1+3.2+3.3 are done.

---

## 2026-06-06 — Checkpoint 3.1: Multi-image carousel (up to 5 photos)

**Done:**
- Post from 1 image → **carousel up to 5 images**. Backend ONLY changed `createPostSchema.media .max(1)→.max(5)` — NO migration (PostMedia[] + the `order` field were carousel-ready since Phase 2; `createPost` already maps `order` by index, `postInclude` already `orderBy {order: asc}`).
- Composer 5-step refactor single→array: **multi-select upfront + Add more** (IG-style), crop each image via a `cropIndex` cursor, **shared aspect ratio** locked from the first image (slides don't jump height), `ImageStrip` reorder ◀▶ + remove X. State container changed 4 single fields → `images: ComposerImage[]` + `cropIndex` + `ratio` lifted.
- `useCreatePost` single→array: **sequential** N presign+PUT, weighted combined progress + label "Uploading k/N…". Kept no-optimistic + onSuccess (does NOT touch feed).
- Render new `PostCarousel` (CSS scroll-snap, NO added library): `media.length<=1` short-circuits to `PostMedia` (zero Phase 2 regression); multiple images → native swipe + desktop arrows + dots + badge. Wire `PostCard`/`PostDetailView` + badge `PostsGrid`.
- 13 files: backend 1 line (`posts.schema.ts`) + 1 JSDoc; frontend refactor (composer 5 files, `useCreatePost`, render 3 files) + 3 new files (`PostCarousel.tsx`, `composer/ImageStrip.tsx`, `composer/types.ts`).

**Technical notes:**
- **CropStage re-key `key={image.id}`** mandatory — without re-keying, zoom/offset/previewUrl/vp leak into the next image (the subtlest bug of the cursor refactor).
- **Shared ratio** lifted to the container, `ratioLocked = images.some(i=>i.cropped !== null)`; `CropStage` ratio moved from internal `useState` → **controlled props** (`ratio`/`onRatioChange`/`ratioLocked`). Deleting all images → unlocks naturally.
- **GIF/AVIF passthrough = single-only**: keeps the original framing, can't force a shared ratio → blocks mixing into a carousel at `SelectStage` (`currentHasPassthrough || incomingPassthrough && (count>0 || batch>1)`).
- **Carousel feed does NOT wrap in `<Link>`** (swipe/arrow priority — a Link would swallow the gesture); a single image KEEPS the Link tap-to-open. Open the carousel detail via the comment icon. Native CSS scroll-snap instead of Swiper → 0 new dependency.
- **Sequential upload (NO Promise.all)**: combined progress `((i+filePct/100)/n)*100` is accurate + clear fail attribution (you know which file failed).
- `order` derived from the array index at submit → reorder/remove at any time stays correct, no separate bookkeeping needed.

**Tech debt arising (proposed for BACKLOG, already appended):**
- `[P3] [backend/media]` Orphan S3 cleanup on multi-image partial upload fail — 1 of N PUTs fails → already-uploaded images become orphans (POST /posts hasn't run); retry re-uploads ALL (new objectKey → more orphans).
- `[P3] [frontend/composer]` Pointer-drag reorder for `ImageStrip` (currently ◀▶ button swaps neighbour).

**Verify:** 9/10 — `tsc` backend + `tsc -b` frontend + `vite build` 0 errors (1967 modules), functionally code-complete. Item 10 (browser-interactive + backend curl 5-media) awaits user test: multi-select cap 5 / block a 6th image / block mixing GIF; crop shared-ratio lock from image 2; reorder ◀▶ + remove; sequential upload progress + label k/N; carousel swipe mobile / arrows desktop / dots / badge; **regression 1-image** no chrome; dark + mobile.

**Next:** Browser verify → done. Then Phase 3.2 (video) + 3.3 (nested comment/reply); tag `phase-3-complete` when all 3 sub-phases are done (do NOT tag now).

---

## 2026-06-06 — Checkpoint 2.5: Follow button + Profile counts + public profile route

**Done:**
- **Backend**: `GET /users/:username` from 7-field public → **ProfileUser DTO** (+ `postsCount/followersCount/followingCount` + `isFollowing: boolean|null`). Rename `getUserByUsername` → `getUserProfile(username, viewerId?)` (attach `optionalAuth` to the route). Reuse the `isFollowing()` helper (2.3b-1) + mirror the visibility gating of `listPostsByUsername`. Separate schema `userProfileSchema` (split from the self `userPublicSchema` that has email). NO migration (Follow already has both-direction indexes).
- **Frontend types**: add `ProfileUser` (extends `PublicUser`) + `ProfileResponse`. `PublicUser` KEEPS 7 fields (no bloat — still the post/comment author + list item).
- **Hooks** `features/users/`: `useUserProfile` (`useQuery` + `select` unwrap, cache keeps the envelope for patching). `followMutation` engine (mirror `likeMutation`) → `useFollow`/`useUnfollow`: optimistic toggle `isFollowing` + `followersCount ±1`, rollback `onError`, **invalidate `user(username)` onSettled** to reconcile the count (the follow response is only `{ following }`).
- **UI**: `FollowButton` (Follow coral / Following outline → hover Unfollow red / pending disabled). `ProfileEditForm` extracted into its own component. `UserProfilePage` merged from `ProfilePage` (deleted the old file): 1 component handles self (Edit profile) + other (FollowButton), REAL stats via `formatNumber`.
- **Routing**: `/users/:username` (public profile) + `/profile` → `ProfileRedirect` (→ `/users/<me>`). The author (avatar + @username) in `PostCard`/`PostDetailView`/`CommentItem` → `<Link>` profile → resolves the 2.4b tech-debt (author not clickable) + makes Follow reachable in-app.

**Technical notes:**
- **Circular import** `users.service` ↔ `follows.service` (follows imports `publicUserSelect`, users imports `isFollowing`): safe because both are used at call-time, NOT top-level — the exact pattern `posts.service` is already running fine.
- **postsCount = mirror the grid** (settled during planning): private account + non-owner + non-follower → **0** (like `listPostsByUsername` returning empty), NOT a bare PUBLIC count — avoids "header says N posts but the grid is empty". Owner: all 3 visibilities; follower: PUBLIC+FOLLOWERS; outside: PUBLIC.
- **isFollowing = null** for anonymous OR self → FollowButton renders only when `!== null` + `!isSelf`. isSelf uses `me.username === username` (clearer than relying on null).
- **Count reconcile**: the follow response does NOT include a count (unlike like) → optimistic + invalidate `onSettled`. Profile is 1 light fetch, no lost scroll.
- **Follow scope narrow**: only patch the `user(username)` cache; does NOT touch the feed → `post.isFollowingAuthor`/feed membership stay stale until natural refetch (accepted, out of scope).

**Tech debt resolved:** followers/following placeholder `0` (2.4c), missing public profile route `/users/:username` (2.4b), author name not clickable (2.4b) — all 3 DONE.

**Verify:** Backend e2e curl PASS — isFollowing null/false/true, followersCount increments correctly, no email leak; postsCount self=2 (all), non-follower public=1 (PUBLIC), non-follower private=0 (mirror grid), follower=2 (PUBLIC+FOLLOWERS). `tsc -b` backend + frontend + `vite build` 0 errors. **Browser-interactive awaits user test** (redirect /profile, self vs other, follow optimistic + rollback offline, dark/mobile).

**Next:** Browser verify → commit. Then consider followers/following list pages (2.6) or tag `phase-2-frontend-complete`.

---

## 2026-06-04 — Checkpoint 2.4c: Post composer (5-step modal) + Profile real posts grid

**Done:**
- Post composer 5-step modal (`Select → Crop → Caption → Upload → Done`), Zustand `composerStore` global (3 triggers: Sidebar Create, BottomNav Create, Profile empty-state), 1 instance rendered in `AppLayout`. Hand-rolled, NO new dependency.
- Crop UI hand-rolled with the Canvas API + pointer events (NO library): cover-fit base scale × zoom + drag-reposition, 3 aspect ratios (1:1 / 4:5 / 1.91:1), export via `canvas.toBlob` (≤1080w, quality 0.9). Geometry split into `lib/cropImage.ts` (pure), interaction in `CropStage.tsx`.
- `useCreatePost` orchestrates presign → PUT (progress) → POST /posts; `onSuccess` seeds the `post(id)` cache + invalidates `userPosts(me.username)`. DELIBERATELY does NOT touch the feed cache (feed = following-only, your own post isn't in your feed).
- ProfilePage refactor: real posts grid via `useUserPosts` (`PostsGrid` 3-col, hover overlay like/comment count, infinite scroll), real posts count. Empty state → CTA "Create your first post" opens the composer.
- Client media validation MATCHES backend exactly (5 MIME + 10MB) running BEFORE presign (`lib/image.ts validateMediaFile`), avoiding a wasted API call. Error in English.
- Bug fix (routing, mobile): `PostDetailPage` Back button `navigate('/')` → `navigate(-1)` — in page mode mobile entered from a profile post click, Back now returns to the correct source page instead of always to Feed.

**Technical notes:**
- **contentType threading** (risk #1): the MIME value must match in 3 places — `mediaApi.presign({contentType})`, the `Content-Type` of the PUT (wrap the blob into a `File` with the right type), and the actual blob. Crop PNG→JPEG ⇒ presign + upload are both `image/jpeg`, NOT `image/png`; a WebP source keeps `image/webp`. A mismatch → S3 rejects the signature.
- **GIF/AVIF passthrough**: gated by `PASSTHROUGH_MIME`, NOT through the canvas (re-encode loses GIF animation + AVIF decode is unstable) → upload the original file, only measure dimensions. Croppable (jpeg/png/webp) goes through the canvas.
- **width/height measured client-side** (`getImageDimensions` createImageBitmap + fallback `Image()`) → send `media[].width/height` so feed/grid renders the correct aspect (clamp [0.8, 1.91] existed since 2.4b). Crop output uses `canvas.width/height`.
- **No optimistic post**: unlike like/comment, a new post has no real id/url at submit → reconciling a temp-id in a cursor list breaks easily. Only invalidate after success (per the `useCreateComment.onSuccess` pattern).
- Composer mobile full-screen (`h-[100dvh] max-w-none rounded-none` < sm), reuse the `ui/dialog` shell (Radix handles focus-trap/ESC/overlay) like `PostDetailModal`.
- **Step 0 doc-sync**: `CLAUDE.md` Git workflow rule changed "always via a feature branch" → "commit straight to main (solo dev)" to match the 2.4a reality (the checkpoints already committed straight to main). Also fixed the stale "feature branch" trace in the PROGRESS.md 2.4b entry.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[frontend/profile]` followers/following count = `0` placeholder (backend has no total-count endpoint yet, only a list cursor). Posts count is also a loaded-count + "+" when more pages remain, not a true total. Defer to Phase 2.5 (needs a count API).
- `[frontend/composer]` Closing the modal mid-upload (`phase=uploading`) only silently aborts the PUT, no confirm — an orphan S3 object can arise (best-effort storage, acceptable). Consider a confirm-before-close.
- `[frontend/profile]` Public profile route `/users/:username` still missing (2.4b tech debt) — ProfilePage is still own-profile only.

**Verify:** 11/11 functional PASS (T1-T11: 3 triggers open the modal, validate rejects wrong MIME/>10MB without calling presign, crop 3 ratios + drag/zoom, back/next keep-clear state, submit presign→PUT→POST in correct order + matching contentType, grid update + count +1, view post pre-seeded, error retry without a phantom post, dark mode + mobile full-screen, GIF passthrough keeps animation, object-URL leak revoked). Mobile routing bug fixed + verified. `tsc -b` + `vite build` 0 errors.

**Next:** Phase 2.5 — follow button + `useFollow`, edit/delete comment, public profile route `/users/:username`, followers/following count API. Then tag `phase-2-frontend-complete`.

---

## 2026-06-03 — Checkpoint 2.4b: Frontend posts UI (feed + PostCard + PostDetail + like/comment)

**Done:**
- Frontend Phase 2.4b: real feed (`useFeed` infinite + IntersectionObserver sentinel), `PostCard`, `PostDetail` opens as a **modal on desktop / full page on mobile + direct URL** (background-location). Refactor `HomePage` → `FeedPage` (keep the Phase 1C StoryBar placeholder, remove the local PostCard + hardcoded POSTS). Hand-rolled, NO new dependency.
- Optimistic mutation layer: `useLikePost`/`useUnlikePost` (toggle + reconcile authoritative count in `onSuccess`, does NOT invalidate feed), `useCreateComment` (optimistic prepend + bump count + `onSuccess` invalidate). Helper `lib/postCache.ts` patches 1 post across ALL 3 caches (`post`/`feed`/`userPosts`) through 1 door + snapshot/restore for rollback.
- UI primitives hand-rolled: `ui/dialog` (from the `radix-ui` umbrella) + `ui/skeleton`; common `Avatar`/`Spinner`/`EmptyState`/`ErrorState`; hooks `useInfiniteScroll` + `useIsDesktop`; `lib/format` (relative time + compact number + aspect-ratio clamp [0.8, 1.91]).
- Bugfix (privacy): logout did NOT clear the React Query cache → logging in as user B showed user A's feed/cache for a few seconds before refetch (a potential private leak). Fix: `authStore.logout()` calls `queryClient.clear()`.
- UX change: comment order flipped **ASC → DESC (newest-first)** in both backend (`comments.service` orderBy desc) + frontend (optimistic **prepend** to `pages[0]`); a new comment shows immediately at the top without scrolling.
- UX change: like/comment count moved **next to the icon** (`♥ 13.8K  💬 42`, `tabular-nums`), removed the separate "X likes" line + "View all comments" link below.

**Technical notes:**
- `patchPostInCaches`: the `userPosts` cache key has a dynamic username → match by **predicate** (`['users', *, 'posts']`), NOT addressable by exact key. `mapPostInInfinite` returns the SAME reference when the post is unchanged → avoids redundant re-render of the whole feed.
- Like flow DELIBERATELY does NOT invalidate feed in `onSettled`: invalidate → refetch `GET /feed` → reshuffle order + lost scroll + flicker. Relies only on optimistic + the authoritative `likesCount` from the response.
- `radix-ui` is a combined package (`button.tsx` already `import { Slot } from "radix-ui"`) → get Dialog via `import { Dialog } from "radix-ui"`, NO need for `@radix-ui/react-dialog`. shadcn `Input` (React 18) does NOT forward ref → the comment icon focuses the input via `id` (`COMMENT_INPUT_ID`) instead of ref.
- Comment order flip: changing `orderBy asc→desc` did NOT need cursor-logic changes (Prisma `cursor + skip:1` follows orderBy: the next page = older comments) + NO migration.
- `authStore` importing `queryClient` is safe (acyclic — `queryClient.ts` only imports `@tanstack/react-query`). The 401-refresh-fail path in the axios interceptor also calls `logout()` → also clears the cache.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[frontend/post]` Author name/avatar in PostCard + PostDetail NOT yet clickable (the public profile route `/users/:username` doesn't exist) — wire when building the profile page 2.4c.
- `[frontend/feed]` No dedupe of post `id` when `flatMap`-ing the infinite pages — if the backend cursor returns a duplicate (a post inserted mid-paginate) → a duplicate React key. Consider dedupe by id.
- `[frontend/post]` Share/Save (PostActions) still disabled placeholders — wire in a later Phase.

**Next:** Commit 2.4b (straight to main) after browser-interactive verify (feed/like/comment/modal desktop+mobile/dark mode/logout-switch-user/comment newest-first). Then 2.4c: follow button + `useFollow`, create-post composer (presigned upload UI), profile real posts grid, edit/delete comment.

---

## 2026-06-02 — Checkpoint 2.3b-1: Follow + Like + Comment (backend, session 1/2)

**Done:**
- Schema: 3 new models `Follow`/`Like`/`Comment` + relations to `User`/`Post`; migration `add_follow_like_comment`. Phase 2 Comment has NO content enum (always text), `parentId` stored in the DB but shown flat in the UI.
- Module `follows`: follow/unfollow idempotent (upsert / deleteMany), self-follow → 400; `followers`/`following` cursor pagination; `isFollowing()` exported for session 2 reuse. Routes attached to `users.routes.ts` by `:username` (consistent with the codebase, not by `:id` from ARCHITECTURE §4).
- Module `likes`: like/unlike idempotent → `{ liked, likesCount }`; like gated by visibility (invisible post → 404), unlike always allowed (retract own data). Extracted helper `getViewablePost()` (gate visibility 404-over-403) into `posts.service` for shared use.
- Module `comments`: CRUD; list oldest-first (`createdAt asc`, IG-style); delete for comment-author OR post-author. Route split into 2 routers in the SAME `posts.routes.ts`: default (`/posts/:id/comments`) + `commentsRouter` named export (`/comments/:id`), mounted separately `/comments` in server.ts.
- Privacy gate `followers`/`following`: `optionalAuth` + helper `canViewSocialList` — a private account's list is visible only to the owner + followers, everyone else (including anonymous) → empty.
- Wiring: `openapi.ts` registerAll + 3 tags (Follows/Likes/Comments). `tsc -b` passes 0 errors. Code-complete, NOT yet committed — awaiting manual testing of 20 + 2 steps (privacy) before moving to session 2.

**Technical notes:**
- Comment route placement: the posts router mounts at `/posts` so it CANNOT produce an absolute `/comments/:id` from 1 router → solved with 2 routers in 1 file (default + `commentsRouter` named export), mounted separately `/comments` in server.ts.
- Follow relation naming is counter-intuitive (per ARCHITECTURE §3): `followers @relation("following")`, `following @relation("follower")`. Reference: "who follows me" = `where { followingId: me }`; "who I follow" = `where { followerId: me }`.
- Cursor `followers`/`following` = the userId next to the constant variable (`followingId`/`followerId` fixed) via the composite cursor `followerId_followingId` — DIFFERENT from the `(createdAt, id)` cursor of post/comment lists.
- `getViewablePost` shared by likes + comments (and `getPostById` in session 2) — ensures consistent 404-over-403 for reading private.
- Windows: `prisma generate` fails `EPERM` (rename `query_engine-windows.dll.node`) while `npm run dev` (tsx watch) holds the DLL → must stop the dev server before generate.

**Tech debt arising (proposed for BACKLOG, awaiting confirmation):**
- `[backend/build]` `tsc -b` produces `backend/tsconfig.tsbuildinfo` (currently untracked in git) — add it to `.gitignore`, don't commit the build artifact.

**Next:** After the user tests the 20 + 2 steps PASS → session 2 (2.3b-2): posts refactor (`postInclude` becomes a function + `serializePost`: likesCount/commentsCount/isLikedByMe/isFollowingAuthor; real follow-check for `getPostById` + `listPostsByUsername`) + module `feed` (`GET /feed`, 14 days, client-side shuffle) + wiring + docs (CLAUDE.md endpoints, phase status).

---

## 2026-06-01 — Checkpoint 2.3a: Posts module backend (Post + PostMedia, CRUD)

**Done:**
- Prisma: added `Post`, `PostMedia`, enums `PostVisibility`/`MediaType`, relation `User.posts`; migration `add_posts_and_media`.
- Module `posts/` (schema/service/routes/openapi): `POST /posts` (images and/or caption, refine at least 1), `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`, nested `GET /users/:username/posts` (cursor pagination, placed in users.routes calling posts.service).
- New middleware `optionalAuth` (verify token if present, no 401 if missing) for public routes that need to know the viewer; export `publicUserSelect` from users.service reused for `author` (does not leak email/passwordHash).
- Visibility: PUBLIC visible to all; PRIVATE/FOLLOWERS read by non-owner → 404 (hide existence); write (PATCH/DELETE) non-owner → 403; private account list → empty (real follow → 2.3b).
- `deletePost` deletes S3 objects best-effort (`DeleteObjectCommand` per key, logs on fail without throwing); does NOT verify the file exists at post create (trusts the client).
- Bugfix same session: the 2 GETs use optionalAuth but lacked `security` in OpenAPI → Swagger UI didn't send the bearer → an owner viewing a PRIVATE post got 404. Fixed with `security: [{ bearerAuth: [] }, {}]`.

**Technical notes:**
- An optional-auth endpoint MUST declare `security: [{ bearerAuth: [] }, {}]` in OpenAPI for Swagger UI to attach the token (the empty `{}` element keeps anonymous valid). Without it → Swagger doesn't send the header even after Authorize → `req.user` undefined. This is the root cause of the owner-404 bug.
- Cursor pagination: `take limit+1` to detect `hasMore`, `cursor: { id }, skip: 1`, `orderBy [createdAt desc, id desc]`; `nextCursor` = the id of the extra item.
- 404-over-403 for reading private (hide existence), keep 403 for write — a consistent security pattern.

**Tech debt arising:** (proposed, awaiting confirmation) see the section below.

**Next:** Checkpoint 2.3b — Follow/Like/Comment models + Feed (follow + shuffle); refactor FOLLOWERS visibility to use a real follow check.

---

## 2026-06-01 — Checkpoint 2.1: MinIO infrastructure (not yet coding features)

**Done:**
- Added the `minio` service to `backend/docker-compose.yml` (image `minio/minio:latest`, ports 9000 API / 9001 console, dev creds `minio`/`minio12345`, healthcheck `mc ready local`) + volume `minio_data`.
- Added 6 S3 env vars to `.env.example` (`S3_ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_URL`).
- Updated the `backend/CLAUDE.md` Storage section: service name, default creds, access model (bucket public-read for reads, presigned PUT for upload).
- Verified the infra via the console UI: created bucket `social-media-media`, set public-read, upload + share URL OK.

**Technical notes:**
- A MinIO bucket is private by default → the share URL returns 403. Must set the Access Policy to public-read (prefix `*`, readonly) manually after creating the bucket. Access model settled: **read** images via `S3_PUBLIC_URL` directly (no sign, reduces feed latency), **upload** via presigned PUT.
- `.env.example` is blocked from read/write by permission settings (matches `.env*`) → Claude can't Edit it, the user pastes the snippet by hand.
- Postgres maps host port 25432→5432; MinIO maps 9000/9001 directly.

**Tech debt arising:** `[backend/storage]` MinIO creds hardcoded in docker-compose (dev only) → BACKLOG. (Automate MinIO setup is already in BACKLOG.)

**Next:** Checkpoint 2.2 — install `@aws-sdk/client-s3` + `s3-request-presigner`, create `lib/s3.ts`, module `media/` with `POST /media/presign`, validate S3 vars in `config/env.ts`.

---

## 2026-05-30 — Frontend Phase 1B: Design system "Beng" + layout shell + dark mode

**Done:**
- Overrode all the shadcn Nova tokens (zinc base, purple primary) → warm-neutral + coral in `index.css` (`:root` + `.dark`, oklch hue 32–60, radius 0.625→0.75). 5 shadcn components (button/card/input/form/label) change theme automatically, no rewrite.
- Changed fonts: removed `@fontsource-variable/geist` → Bricolage Grotesque (heading) + Plus Jakarta Sans (body) via Google Fonts.
- Dark mode JS layer: `themeStore` (Zustand persist key `theme`), `useThemeEffect` (toggle `.dark` on `<html>`), `ThemeToggle`, FOUC inline script in `index.html`.
- New layout shell (`components/layout/`): `AppLayout` (Sidebar | main | RightRail + BottomNav mobile), `AuthLayout` (split coral panel); nested into guard routes in `App.tsx`.
- 4 pages restyled keeping auth/validation/mutation logic intact: Login/Register into AuthLayout; Home dropped the header + the orphan `useQuery` → story bar + feed placeholder; Profile header + stats + posts grid.
- IG-style story bar: `scrollbar-hide`, ~6 stories/view, hover-show arrows + auto-hide by `canScrollLeft/Right`, scroll measured at runtime (`offsetWidth` + `gap` × 3 items) instead of hardcoded px.

**Technical notes:**
- The token override is enough to restyle because all 5 shadcn components are 100% semantic-token, no hardcoded colors (verified before editing).
- `--destructive-foreground` added to `:root`/`.dark` + mapped `--color-destructive-foreground` in `@theme inline`, but the destructive button uses a subtle style (`bg-destructive/10 text-destructive`) so the visual hasn't changed yet — the token is ready.
- The FOUC script reads `stored.state.theme` (Zustand persist wraps `{state,version}`), not `stored.theme`.
- The story scroll step measures the first item `[data-story-item]`; balance your-story `size-17` (68px) to match a normal story (ring 64+4=68) + `gap-6.5` to avoid drift, instead of measuring a normal item separately.
- AppLayout/AuthLayout nested inside ProtectedRoute/PublicOnlyRoute (both render `<Outlet/>`).

**Tech debt arising (proposed for BACKLOG):**
- `[frontend/a11y]` ThemeToggle changed `<Button>` → `<div onClick>`: lost button semantics, keyboard access (Tab/Enter/Space), and focus ring. Revert to `<button>` or add `role="button"`/`tabIndex`/`onKeyDown`.
- `[frontend/layout]` The story bar `useEffect` init runs only at mount, doesn't re-check on resize → `canScrollRight` may be stale when the viewport changes. Consider `ResizeObserver`.
- `[frontend/nav]` Nav placeholders (Search/Explore/Reels/Messages/Notifications/Create/Settings) are visually disabled, no route yet — Phase 2+ wires real routes.

**Next:** Browser-interactive verify (light/dark/mobile, FOUC reload, story scroll snaps to whole items). Then Phase 2 — posts (model + API + real feed).

---

## 2026-05-28 — Frontend Phase 1A: Foundation

**Done:**
- Scaffolded Vite + React + TS in `frontend/`, path alias `@` → `src/`, shadcn init (Nova preset, Tailwind v4 CSS-first)
- axios client with a request interceptor (attach Bearer) + response interceptor (401 → refresh → retry; refresh fail → `logout()`)
- Zustand `authStore` (persist localStorage), TanStack Query (QueryClient + Provider + DevTools dev-only)
- React Router 6: `ProtectedRoute` + `PublicOnlyRoute`, 4 placeholder pages (`/login`, `/register`, `/`, `/profile`)
- `types/api.ts` hand-written to match the backend response; `HomePage` has a `useQuery(['me'])` smoke test
- Code-level verify pass: `tsc -b` + `npm run build` 0 errors; API contract matches (register/login `identifier`/me Bearer/refresh) via curl. 3 browser-interactive steps await manual testing.

**Technical notes:**
- create-vite latest pulls React 19 + Vite 8 (rolldown) + TS 6 → hard-pinned back to **React 18 + Vite 5 + TS 5.6 + React Router 6**. Vite 8 rolldown breaks on Node 22.1.0 (missing the native binding `@rolldown/binding-win32-x64-msvc`, needs Node ≥22.12).
- Tailwind v4 = CSS-first: NO `tailwind.config.js`, the theme lives in `src/index.css` via `@theme`, color space oklch (zinc base).
- shadcn init added `@import "shadcn/tailwind.css"` to index.css but the `shadcn` package is just the CLI (already removed from deps) → must delete that import or the build fails.
- TS 5.6 doesn't know `erasableSyntaxOnly` (a TS 5.8+ option) → removed from tsconfig.app/node.
- The interceptor uses a refresh-promise singleton for concurrent 401s; does NOT redirect in axios (only `logout()`, ProtectedRoute redirects itself).

**Tech debt arising (already appended to BACKLOG):**
- `[frontend/auth]` Token stored in localStorage → XSS can read it; Phase polish moves the refresh token to an httpOnly cookie.

**Next:** Phase 1B — real auth form UI (react-hook-form + Zod, login/register/profile), `npx shadcn@latest add` the v4 components. Upgrade Node to ≥22.12 to drop the Vite warning.

---

## 2026-05-27 — Swagger UI schema-first (Zod → OpenAPI)

**Done:**
- Integrated `@asteasolutions/zod-to-openapi` + `swagger-ui-express`, serving `/docs` and `/docs/json` (dev-only gated by `NODE_ENV`)
- `lib/openapi.ts` as the central registry + `extendZodWithOpenApi(z)` + security scheme `bearerAuth` + shared schemas (`User`, `Error`, `ValidationError`)
- 3 `*.openapi.ts` files per-feature (auth, users, health/Meta) register paths from the original Zod schemas, no edits to `*.schema.ts`
- Tags array document-level fixes the order Auth → Users → Meta
- Verify 9/9 pass: spec valid, $ref used correctly, refresh-token-as-access returns 401, prod mode `/docs` 404

**Technical notes:**
- Pin `@asteasolutions/zod-to-openapi@^7.3.0` — v8 latest peer-deps Zod ^4 (the project is on Zod 3.23)
- Circular import `lib/openapi` ↔ `modules/*/openapi` (the registry exports schemas + the paths import them back) → solved with lazy `require()` in `registerAll()`, not dynamic ESM import (tsx CJS context)
- `servers` URL and log use `localhost` instead of `env.HOST` because the default HOST `0.0.0.0` isn't reachable from a browser
- Path params must use the OpenAPI syntax `{username}`, not reuse the Express `:username`

**Tech debt arising (proposed to append to BACKLOG.md):**
- JWT verify error messages are lumped together: refresh-token-as-access and expired-token both return `"Token không hợp lệ hoặc đã hết hạn"` — should distinguish `TokenTypeMismatch` vs `TokenExpired` in `lib/jwt.ts` so the client knows whether to retry-with-refresh or force re-login
- `userPublicSchema` in `lib/openapi.ts` currently duplicates the field list with Prisma's `publicUserSelect` — adding a new field (e.g. `followersCount`) requires editing 2 places; consider deriving from the Prisma type once a generator exists
- `buildOpenApiDocument()` runs once at mount — if you need hot-reload of paths in dev, switch to calling it per `/docs/json` request (low cost)

**Next:** Awaiting confirmation to append to BACKLOG. Then Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router), possibly using `/docs/json` to auto-gen types.

---

## 2026-05-26 — Backend Phase 1 done

**Done:**
- Full auth flow (register/login/refresh/me/logout) + type-aware JWT
- Users module (GET /:username, PATCH /me)
- Prisma migration init, model User
- Middleware: auth/validate/asyncHandler/error
- Swagger UI at /docs (dev-only), OpenAPI 3.1 spec
- 9/9 verify pass (see PR/commit)

**Technical notes arising:**
- Pin zod-to-openapi ^7.3.0 (v8 requires Zod 4, incompatible with Zod 3.23)
- Circular import lib/openapi ↔ modules/*/openapi → solved with lazy require in registerAll()
- Schema User extracted to lib/openapi.ts (shared by 2 modules)

**Minor tech debt:** See `BACKLOG.md` — JWT error messages lumped together for every fail case.

**Next:** Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router)

---
