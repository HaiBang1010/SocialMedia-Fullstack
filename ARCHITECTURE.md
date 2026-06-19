# Social Media Platform — Architecture & Build Plan

> Blueprint for an Instagram-like platform: posts, stories, messaging, calls.
> Stack: React + Express + PostgreSQL + Socket.io + WebRTC.

---

## 1. Tech Stack (final)

### Frontend
| Concern | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite | Fast dev, ecosystem |
| Language | TypeScript | Type safety end-to-end |
| Styling | Tailwind CSS v4 (CSS-first) + Shadcn/ui | Theme in `src/index.css` via `@theme` (no `tailwind.config.js`); tokens oklch warm-neutral + coral "Beng" |
| Fonts | Bricolage Grotesque (heading) + Plus Jakarta Sans (body) | Google Fonts; brand display + UI body |
| UI state | Zustand | Lighter than Redux, enough for UI/auth/calls |
| Server state | TanStack Query | Cache, refetch, optimistic updates for free |
| Routing | React Router v6 | Standard |
| HTTP client | Axios | Has interceptor for JWT auto-refresh |
| Forms | react-hook-form + zod | Validation shares schema with backend |
| Real-time | socket.io-client | Same version as backend |
| WebRTC | LiveKit (`@livekit/components-react` + `livekit-client`) | Managed SFU — signaling + TURN handled by LiveKit Cloud (Phase 6; no simple-peer/P2P mesh) |

### Backend
| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Fits the TypeScript ecosystem |
| Framework | Express 4 | Plenty of documentation, easy to learn for full-stack beginners |
| Language | TypeScript strict | Mandatory for this project size |
| ORM | Prisma 5 | Type-safe, good migrations, excellent DX |
| Database | PostgreSQL 16 | Relational data + JSON fields when needed |
| Cache + Pub/Sub | Redis (later) | Sessions, rate limit, Socket.io adapter |
| Real-time | Socket.io (later) | Rooms, namespaces, fallback transports |
| Auth | JWT raw (jsonwebtoken) | Stateless. Access token in-memory + refresh token httpOnly cookie (Polish R1 — see §6 "Auth token transport") |
| API Docs | Swagger UI + zod-to-openapi | Schema-first, single source of truth |
| Storage | S3-compatible | MinIO local (active since Phase 2), R2/S3 prod |
| Validation | Zod | Shares schema with frontend |

### DevOps (later)
- Docker Compose for local dev (postgres + redis + minio + backend)
- Nginx reverse proxy for prod
- WebRTC TURN: handled by **LiveKit Cloud** (Phase 6 — no self-hosted Coturn). Deploy target: Vercel (FE) + Railway (BE).

---

## 2. Folder Structure

### Frontend
```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                  # Tailwind v4 @theme + tokens (warm-neutral/coral "Beng") + .dark
│   ├── api/                       # client.ts (axios interceptor), auth.ts, users.ts, ...
│   ├── components/
│   │   ├── ui/                    # shadcn: Button, Input, Card, Form, Label
│   │   ├── layout/                # AppLayout, Sidebar, RightRail, BottomNav, AuthLayout
│   │   ├── ThemeToggle.tsx
│   │   ├── ProtectedRoute.tsx, PublicOnlyRoute.tsx
│   │   ├── post/  story/  chat/  profile/   # (Phase 2+)
│   ├── features/                  # business logic per feature
│   ├── hooks/                     # useThemeEffect.ts (+ useSocket, useMediaUpload later)
│   ├── stores/                    # authStore.ts, themeStore.ts
│   ├── lib/                       # utils.ts (cn), apiError.ts, validations/ (+ socket.ts, peer.ts later)
│   ├── pages/                     # LoginPage, RegisterPage, HomePage, ProfilePage
│   └── types/                     # api.ts
├── index.html                     # FOUC theme script (set .dark before React mounts)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Backend (built in Phase 1)
```
backend/
├── src/
│   ├── server.ts                  # Express entry
│   ├── config/
│   │   └── env.ts                 # validated with Zod
│   ├── modules/                   # FEATURE-based
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schema.ts
│   │   │   └── auth.openapi.ts
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.schema.ts
│   │   │   └── users.openapi.ts
│   │   ├── posts/                 # (Phase 2)
│   │   ├── comments/              # (Phase 2-3)
│   │   ├── stories/               # (Phase 4)
│   │   ├── messages/              # (Phase 5)
│   │   ├── conversations/         # (Phase 5)
│   │   ├── calls/                 # (Phase 6)
│   │   ├── notifications/         # (Phase 7)
│   │   ├── media/                 # (Phase 2)
│   │   └── feed/                  # (Phase 2)
│   ├── socket/                    # (Phase 5+)
│   ├── middleware/
│   │   ├── auth.ts                # requireAuth (verify JWT)
│   │   ├── validate.ts            # Zod validation
│   │   ├── asyncHandler.ts
│   │   └── error.ts               # error handler + AppError
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   ├── openapi.ts             # registry + builder
│   │   └── health.openapi.ts
│   └── jobs/                      # (Phase 4+)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yml
├── .env.example
├── tsconfig.json
└── package.json
```

Principle: the backend is organized by **module/feature**, not by layer.

---

## 3. Database Schema (Prisma)

Phase 1 already has `User`. The full schema will be extended gradually across phases:

```prisma
model User {
  id            String   @id @default(cuid())
  username      String   @unique
  email         String   @unique
  passwordHash  String
  name          String
  bio           String?  @db.VarChar(160)
  avatarUrl     String?
  isPrivate     Boolean  @default(false)
  createdAt     DateTime @default(now())

  // Relations (added gradually per phase)
  posts         Post[]
  comments      Comment[]
  likes         Like[]
  stories       Story[]
  followers     Follow[] @relation("following")
  following     Follow[] @relation("follower")
  sentMessages  Message[]
  conversations Participant[]
  notifications Notification[]
}

model Follow {                    // Phase 2
  followerId   String
  followingId  String
  createdAt    DateTime @default(now())
  follower     User @relation("follower", fields: [followerId], references: [id])
  following    User @relation("following", fields: [followingId], references: [id])
  @@id([followerId, followingId])
}

model Post {                      // Phase 2
  id           String   @id @default(cuid())
  authorId     String
  caption      String?  @db.Text
  audioTrackId String?
  visibility   PostVisibility @default(PUBLIC)
  createdAt    DateTime @default(now())

  author       User @relation(fields: [authorId], references: [id])
  media        PostMedia[]
  comments     Comment[]
  likes        Like[]
  audioTrack   AudioTrack? @relation(fields: [audioTrackId], references: [id])

  @@index([authorId, createdAt])
}

enum PostVisibility { PUBLIC FOLLOWERS PRIVATE }

model PostMedia {                 // Phase 2
  id           String   @id @default(cuid())
  postId       String
  type         MediaType
  url          String
  thumbnailUrl String?
  duration     Int?
  order        Int
  width        Int?
  height       Int?
  post         Post @relation(fields: [postId], references: [id], onDelete: Cascade)
}

enum MediaType { IMAGE VIDEO VOICE STICKER GIF } // VOICE=5.4b; STICKER/GIF=5.4c (MessageMedia, Giphy-hosted URL, objectKey null)

model Comment {                   // Phase 2-3
  id          String   @id @default(cuid())
  postId      String
  authorId    String
  parentId    String?              // recursive — UI flattens to 1 level
  contentType CommentContentType
  content     String   @db.Text
  createdAt   DateTime @default(now())

  post        Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  author      User @relation(fields: [authorId], references: [id])
  parent      Comment? @relation("replies", fields: [parentId], references: [id])
  replies     Comment[] @relation("replies")

  @@index([postId, createdAt])
}

enum CommentContentType { TEXT IMAGE STICKER GIF }

model Like {                      // Phase 2
  userId    String
  postId    String
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
  post      Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  @@id([userId, postId])
}

model Story {                     // Phase 4
  id           String   @id @default(cuid())
  authorId     String
  mediaUrl     String
  mediaType    MediaType
  audioTrackId String?
  expiresAt    DateTime
  isArchived   Boolean  @default(false)
  createdAt    DateTime @default(now())

  author       User @relation(fields: [authorId], references: [id])
  items        StoryItem[]
  views        StoryView[]
  audioTrack   AudioTrack? @relation(fields: [audioTrackId], references: [id])

  @@index([authorId, expiresAt])
  @@index([isArchived, expiresAt])
}

model StoryItem {                 // Phase 4 — overlays
  id        String   @id @default(cuid())
  storyId   String
  type      StoryItemType
  x         Float                  // 0-1 relative position
  y         Float
  scale     Float    @default(1)
  rotation  Float    @default(0)
  payload   Json                   // { username }, { emoji }, etc.
  story     Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
}

enum StoryItemType { MENTION STICKER EMOJI TAG TEXT }

model StoryView {                 // Phase 4
  storyId  String
  viewerId String
  viewedAt DateTime @default(now())
  story    Story @relation(fields: [storyId], references: [id], onDelete: Cascade)
  @@id([storyId, viewerId])
}

model Conversation {              // Phase 5
  id           String   @id @default(cuid())
  type         ConversationType
  name         String?
  avatarUrl    String?
  createdAt    DateTime @default(now())
  participants Participant[]
  messages     Message[]
  calls        Call[]
}

enum ConversationType { DIRECT GROUP }

model Participant {               // Phase 5
  conversationId    String
  userId            String
  joinedAt          DateTime @default(now())
  lastReadMessageId String?
  isAdmin           Boolean  @default(false)
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user              User @relation(fields: [userId], references: [id])
  @@id([conversationId, userId])
}

model Message {                   // Phase 5
  id             String   @id @default(cuid())
  conversationId String
  senderId       String
  contentType    MessageContentType
  content        String?  @db.Text
  replyToId      String?
  sharedPostId   String?
  deletedAt      DateTime?
  createdAt      DateTime @default(now())

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User @relation(fields: [senderId], references: [id])
  media          MessageMedia[]
  reactions      MessageReaction[]
  replyTo        Message? @relation("replies", fields: [replyToId], references: [id])
  replies        Message[] @relation("replies")

  @@index([conversationId, createdAt])
}

enum MessageContentType { TEXT IMAGE VIDEO EMOJI STICKER GIF POST_SHARE VOICE }

model MessageMedia {              // Phase 5.4a (Rich — mirrors PostMedia/Story media fields)
  id                 String   @id @default(cuid())
  messageId          String
  type               MediaType // IMAGE | VIDEO (mix allowed within one message)
  order              Int      @default(0) // 0-indexed carousel order
  url                String
  objectKey          String?  // S3 cleanup key (recall 5.5); null for STICKER/GIF Giphy-hosted (5.4c)
  thumbnailUrl       String?  // image thumbnail / video poster (frontend-generated)
  thumbnailObjectKey String?  // S3 cleanup key for the thumbnail
  width              Int?     // original dims → grid aspect / no CLS
  height             Int?
  duration           Int?     // seconds, video only
  message            Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  @@unique([messageId, order])
}

model MessageReaction {           // Phase 5
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())
  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  @@id([messageId, userId])
}

model Call {                      // Phase 6 (IMPLEMENTED — LiveKit Cloud)
  id             String         @id @default(cuid()) // = the LiveKit room name (Decision Q9)
  conversationId String
  initiatorId    String
  type           CallType
  startedAt      DateTime       @default(now())
  endedAt        DateTime?      // null while ringing/ongoing
  endedReason    CallEndReason? // why it ended (Decision Q3)
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  initiator      User         @relation("initiatedCalls", fields: [initiatorId], references: [id])
  messages       Message[]    // the CALL entry(ies) referencing this call (1 in practice)
  @@index([conversationId, startedAt])
}

enum CallType { AUDIO VIDEO }
enum CallEndReason { COMPLETED MISSED DECLINED FAILED }

// Call-as-Message (Decision 1): `Message` += `callId String?` + `call Call? @relation(onDelete: SetNull)`
// and `MessageContentType` += `CALL` — mirrors the 5.4c sharedPost FK, so a call event rides the
// existing message pipeline (pagination / list preview / message:new / optimistic) for free.

model AudioTrack {                // Phase 3-4
  id        String  @id @default(cuid())
  title     String
  artist    String
  url       String
  duration  Int
  posts     Post[]
  stories   Story[]
}

model Notification {              // Phase 7
  id        String   @id @default(cuid())
  userId    String
  type      NotificationType
  actorId   String?
  postId    String?
  commentId String?
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
}

enum NotificationType { LIKE COMMENT FOLLOW MENTION MESSAGE STORY_VIEW }
```

> **Phase 7 — `Notification` ACTUAL (differs from the plan above):**
> - Field renamed `userId` → **`recipientId`** + added **`actorId`** (both FK `User`, named relations `recipient`/`actor` — like `Follow.follower`/`following`). `actor` is a REAL FK (the list always renders the actor's avatar+username); `postId`/`commentId` stay plain scalars (no FK) — the FE builds the deep-link, mirroring `Message.replyToId`. `readAt?` null = unread. Index `[recipientId, createdAt desc]` (list) + `[recipientId, readAt]` (unread-count).
> - **Enum has only 3 values `LIKE COMMENT FOLLOW`** (no MENTION/MESSAGE/STORY_VIEW). **MESSAGE + CALL do not store a Notification row** (covered by the per-conversation unread badge + existing socket — Decision D1/D2). MENTION + STORY_VIEW deferred (parser cost + flood) → BACKLOG.
> - **1h dedupe** in the service (`updateMany` bumps createdAt + resets readAt; no unique constraint because the key has a time window) + **self-skip** (recipient===actor → no-op) + `safeNotify` best-effort (a notif failure does not break like/comment/follow). Trigger: `likes`/`comments`/`follows` switched `upsert` → **`create`+catch-P2002** (detect 0→1 → re-action does NOT re-notify). Migration `add_notifications`.
> - **Search (Phase 7)**: `Post.searchVector` + `User.searchVector` = **GENERATED tsvector STORED + GIN** (Prisma declares `Unsupported("tsvector")?` to prevent drift, DDL hand-written in migration `add_search_vectors`). `GET /search` prefix `to_tsquery` (`token:*`, injection-safe sanitize; not `websearch_to_tsquery` because that only matches whole lexemes). **Default avatar**: `User.avatarUrl` set to DiceBear `9.x/toon-head` at register + backfill (no migration — field already exists). OpenAPI 41→47.
>
> **Phase 4.1 — `Story`/`StoryView` ACTUAL (differs from the plan above):**
> - `Story` stores **media flat on the row** (`mediaUrl`, `mediaObjectKey`, `mediaType`, `thumbnailUrl?`, `thumbnailObjectKey?`, `duration?`, `width?`, `height?`) — 1 story = 1 media, no child table. Added `mediaObjectKey`/`thumbnailObjectKey` for S3 cleanup (parity with PostMedia).
> - **No `visibility` column** — privacy is at user-level (private account + non-follower → hidden). **No** `audioTrackId`/`audioTrack`/`items` relation — `StoryItem` + `AudioTrack` deferred to 4.3/4.4, so Story 4.1 only has `author` + `views`.
> - `StoryView` added **`viewer User @relation`** (FULL FK, unlike the plan where `viewerId` is plain) + `@@index([viewerId])`; `@@id([storyId, viewerId])` (idempotent upsert). `User` added `stories Story[]` + `storyViews StoryView[]`.
> - `expiresAt = now()+24h` (set by backend at create). Active = `expiresAt > now AND isArchived = false`. Cron flips `isArchived` → Phase 4.4.
>
> **Phase 4.4 addendum:** `StoryView` added `@@index([storyId, viewedAt(sort: Desc)])` (backing the viewers-list cursor). Cron `archiveExpiredStories` (setInterval 1h, `server.ts`) flips `isArchived`. `Story` response added `viewCount` (owner-only, null for non-owner — the feed excludes self so it is always null). `getUserProfile` added `hasActiveStory` (drives the story ring on the profile avatar). No new model, just 1 additive index.
>
> **Phase 5.1 — `Conversation`/`Participant`/`Message` ACTUAL (differs from the plan above):**
> - `Conversation` added **`directKey String? @unique`** (sorted `"userA:userB"` for DIRECT, null for GROUP) → `findOrCreateDirectConversation` upsert-on-unique race-safe (no `$transaction`) + **`lastMessageAt DateTime @default(now())`** denormalized (bumped on every send) for list ordering `[{lastMessageAt desc},{id desc}]` — because no Prisma query orders a parent by child-latest. `@@index([lastMessageAt])`. The `calls Call[]` relation is **not yet declared** (Call model deferred to Phase 6).
> - `Message`: `replyToId`/`sharedPostId` = **plain scalar columns** (no FK relation `replyTo`/`replies`/`sharedPost` as in the plan — wired in 5.5 reply/post-share, following the `Notification.postId/commentId` precedent). `MessageContentType` declares **all 8 values** but Zod gates **TEXT** (5.1). `deletedAt?` soft-delete (recall 5.5). `media MessageMedia[]` + `reactions MessageReaction[]` **not yet declared** (model deferred to 5.4).
> - `Participant`: `@@id([conversationId, userId])` + `@@index([userId])`; `lastReadMessageId?` stored ahead of time (read-receipt UI → 5.3). `User` added `sentMessages[]` + `conversations Participant[]`.
> - **Deferred models (5.4/5.5)**: `MessageMedia`, `MessageReaction` NOT yet migrated in 5.1. Migration `create_conversations_and_messages`.
>
> **Phase 6 — `Call` ACTUAL (LiveKit Cloud):** migration `add_calls` adds model `Call` (id = LiveKit room name, `endedReason CallEndReason?`) + enums `CallType`/`CallEndReason` + `MessageContentType` += `CALL` (`ALTER TYPE ADD VALUE`, PG16 in-transaction) + `Message.callId String?` FK `SetNull` (mirrors sharedPost 5.4c) + back-relations `Conversation.calls` / `User.initiatedCalls`. No `livekitRoomName` column (= `call.id`). No webhook (deferred — missed/ended driven by client + LiveKit `emptyTimeout`).
>
> **Phase 5.2 — Realtime (Socket.io):** only added **`User.lastSeenAt DateTime?`** (nullable, set on socket disconnect — drives "last seen" presence). Migration `add_user_last_seen_at`. **No new model** — read receipts reuse `Participant.lastReadMessageId` (already present since 5.1, now serialized into the DTO + updated realtime via `message:read`). Presence + typing are **in-memory** (process-lifetime, not persisted except lastSeenAt). See §5 for the event contract.
>
> **Phase 5.3a — Reactions:** model **`MessageReaction`** migrated (migration `add_message_reactions`). Differs from the plan above: added **`user User @relation(onDelete: Cascade)`** (D1 — Like/StoryView parity, prevent orphan; plan kept `userId` plain scalar) + `User.messageReactions` + `Message.reactions` back-relation. `@@id([messageId, userId])` (1 reaction/user/message). Endpoint POST/DELETE `/messages/:id/reactions` (standalone `messages.routes.ts` mounted at `/messages`). Reaction broadcast realtime via `message:reaction` delta (§5). GROUP read receipts UI ("Seen by N") → Phase 5.3b (FE-only, no schema change).
>
> **Phase 5.4 (a/b/c) — Messaging media:** `MessageMedia` (5.4a Rich model) migrated. `MediaType` extended **+VOICE** (5.4b) **+STICKER/GIF** (5.4c, `ALTER TYPE ADD VALUE`). **5.4c:** `MessageMedia.objectKey` → **nullable** (STICKER/GIF = Giphy-hosted, no S3 key) + `Message.sharedPost Post? @relation("SharedPost", onDelete: SetNull)` wired (sharedPostId scalar existed since 5.1; back-relation `Post.sharedInMessages`). **EMOJI is content-derived** (server `isEmojiOnly` over content graphemes → contentType EMOJI; NOT a MediaType, no media row). `MessageContentType` unchanged (all 8 declared since 5.1). New module **`giphy/`** proxies Giphy (`GIPHY_API_KEY` server-side). Migrations `add_sticker_gif_media_types` + `add_message_shared_post_relation`. OpenAPI 33→35.

---

## 4. API Routes

```
# Auth (Phase 1 — DONE)
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
GET    /auth/me                       # auth required
POST   /auth/logout

# Users (Phase 1 — DONE)
GET    /users/groupable               # 5.5 — addable to a new group (recent partners + mutual follows); ?q=&limit=
GET    /users/:username
PATCH  /users/me                      # auth required

# Posts (Phase 2)
GET    /feed
GET    /posts/:id
POST   /posts
DELETE /posts/:id
PATCH  /posts/:id/visibility
POST   /posts/:id/like
DELETE /posts/:id/like

# Comments (Phase 2-3)
GET    /posts/:id/comments            # Phase 3.3: root only + repliesCount
POST   /posts/:id/comments            # optional parentId (reply, flatten to root)
GET    /comments/:id/replies          # Phase 3.3: lazy-load replies (chronological)
PATCH  /comments/:id                  # edit (comment author)
DELETE /comments/:id                  # Phase 3.3: comment author only

# Follows (Phase 2)
POST   /users/:id/follow
DELETE /users/:id/follow
GET    /users/:id/followers
GET    /users/:id/following

# Stories (Phase 4 — ACTUAL, differs from the plan on a few routes)
POST   /stories                       # create (image/video + overlay items[])
GET    /stories/feed                  # following users' active stories, grouped
GET    /users/:username/stories       # one user's active stories (not GET /stories/:id as in the plan)
POST   /stories/:id/view              # mark viewed → 204
DELETE /stories/:id                   # owner only → 204
GET    /stories/archive               # 4.4 — own archived (NOT /users/me/... — avoid username="me")
GET    /stories/:id/views             # 4.4 — viewers list (owner only, 403 else)

# Conversations & Messages (Phase 5.1 — ACTUAL; differs from plan: direct/group split, get-by-id added)
POST   /conversations/direct          # 5.1 — start/reuse 1-1 (idempotent directKey upsert)
POST   /conversations/group           # 5.1 — create group (creator = admin)
GET    /conversations                 # 5.1 — list, lastMessageAt desc, cursor
GET    /conversations/:id             # 5.1 — one (participant only → 404 else)
GET    /conversations/:id/messages    # 5.1 — newest-first, cursor (participant → 404 else)
POST   /conversations/:id/messages    # 5.1 — send TEXT (participant → 403 else)
DELETE /messages/:id                  # 5.5 — recall (soft delete deletedAt; sender only → 403, >15min → 410) → tombstone message
POST   /messages/:id/reactions        # 5.3a — set/replace reaction (whitelist 7 emoji) → full message
DELETE /messages/:id/reactions        # 5.3a — remove own reaction (idempotent) → full message
# 5.4c — emoji (jumbomoji)/sticker/GIF/post-share all go through POST /conversations/:id/messages:
#   emoji → content-only (server derives EMOJI); sticker/GIF → media[] type STICKER|GIF (no objectKey);
#   post-share → body.sharedPostId (exclusive with media; caption optional). No new message route.

# Sticker / GIF (Phase 5.4c — Giphy proxy, key server-side)
GET    /giphy/search                   # ?q=&type=gif|stickers&limit= (auth required)
GET    /giphy/trending                 # ?type=gif|stickers&limit= (auth required)

# Notifications (Phase 7 — LIKE/COMMENT/FOLLOW only; 1h dedupe + self-skip)
GET    /notifications                  # newest-first, cursor → { notifications, nextCursor }
GET    /notifications/unread-count      # nav badge → { count }
PATCH  /notifications/read-all          # → { count }
PATCH  /notifications/:id/read          # scoped by recipient, idempotent → { ok }
GET    /conversations/unread-total      # total unread messages across conversations → { total }

# Search (Phase 7 — Postgres full-text, prefix to_tsquery + GIN)
GET    /search                          # ?q=&type=posts|users|all&limit=&offset= (optionalAuth) → { posts, users }

# Media upload (Phase 2)
POST   /media/presign

# Calls (Phase 6 — LiveKit Cloud; mints tokens + tracks lifecycle, LiveKit handles WebRTC signaling)
POST   /calls/start                    # start a call → 201 { message (CALL), token, url }; 409 if in progress
POST   /calls/:id/token                # join/accept → 200 { token, url }; 409 full, 410 ended
POST   /calls/:id/decline              # recipient declines → 200 CALL message
POST   /calls/:id/end                  # body { action: 'leave'|'end_for_all', reason? } → 200 CALL message
# (no /calls/:id/history — call entries live in the messages list via Call-as-Message)
```

---

## 5. Socket.io Events

> **Phase 5.2 (DONE) — ACTUAL contract.** Send stays REST (D1: optimistic + persist in 5.1
> unchanged); the socket is receive-only for messages — `sendTextMessage` broadcasts `message:new`
> after the DB write. So `message:send` (C→S) from the original plan is **unused**. Rooms:
> `user:<userId>` (joined on connect — message:new + presence) and `convo:<conversationId>`
> (joined when the thread is open — typing + read receipts). Default namespace `/` + rooms (no
> per-conversation namespace). Handshake auth: JWT in `auth.token` (validated once, reused fresh
> from the store on reconnect).

```
// ── Phase 5.2 (implemented) ──
// Client → Server
'conversation:join'      conversationId            // join convo room (participant-verified)
'conversation:leave'     conversationId
'typing:start'           conversationId            // server enriches with username
'typing:stop'            conversationId
'message:read'           { conversationId }         // mark-on-open; server resolves newest id

// Server → Client
'message:new'            { conversationId, message }            // → each participant's user room
'message:reaction'       { conversationId, messageId, userId, emoji }   // 5.3a — delta (emoji null = removed); → each participant's user room
'message:deleted'        { conversationId, messageId, deletedAt }       // 5.5 — recall delta; → each participant's user room (client patches to tombstone)
'typing:user'            { conversationId, userId, username, typing }   // → convo room, excl. typer
'read-receipt:update'    { conversationId, userId, lastReadMessageId }  // → convo room, excl. reader
'presence:snapshot'      { online: userId[] }       // → the connecting socket (its online partners)
'presence:online'        { userId }                 // → partner user rooms (D2: contact-scoped)
'presence:offline'       { userId, lastSeenAt }     // → partner user rooms (5s offline debounce)

// ── Notifications (Phase 7) ──
'notification:new'       { notification }           // → recipient's user room (LIKE/COMMENT/FOLLOW; FE prepend list + bump badge + OS notif)

// ── Calls — Phase 6 (LiveKit Cloud; NO offer/answer/ice — LiveKit handles all WebRTC signaling) ──
// Server → Client only (3 thin notifications, fan out to user rooms like message:new):
'call:incoming'   { callId, conversationId, type, isGroup, initiator, conversationName } // → recipients
'call:declined'   { callId, conversationId, userId }                                     // → initiator
'call:ended'      { callId, conversationId, endedAt, endedReason }                        // → all participants
// The CALL message itself arrives via the existing 'message:new' (Call-as-Message).
```

---

## 6. Key Technical Decisions

### Feed algorithm (Phase 2 → Polish R2 mixed feed)
- **Phase 2**: posts from the Users you follow, window of N days (14 → **90** in Polish R2). Cursor `(createdAt, id)` chronological, limit 20/page. Shuffle client-side.
- **Polish R2 — single MIXED feed** (`getFeed` rewrite): followed posts first (keyset, **cursor `f:<postId>`**); when followed are exhausted on a page → fill the remainder with **ranked stranger PUBLIC posts** (switch to **cursor `s:<offset>`**). Stranger ranking = **FoF (followed-by-my-followings) → engagement (likes+comments) → recency**, computed **in-memory** over a capped pool (`STRANGER_POOL_CAP=100`) — reuses `postInclude`+`serializePost`, **no raw SQL**. `isFollowingAuthor` = true(followed)/false(stranger) → FE shows an inline Follow button for strangers (reuses an existing field, no DTO change). New user (0 follows) → 100% strangers (popular, since FoF is empty).
- **Onboarding (Q1)**: new user (`followingCount===0`) sees a grid of suggested + "Done" (FE FeedPage gate) BEFORE entering the mixed feed.
- PRIVATE / stranger-FOLLOWERS never enter the feed (stranger query is PUBLIC-only). No AI personalization.
- Polish phase: ranking beyond the pool cap (materialized score / keyset), stable per-session ordering.

### Comments: split endpoints + flatten on create (Phase 3.3 — approach a)
- The DB still allows the `parentId` self-relation, but **flatten to 1 level on create**: if a reply points at another reply, the backend reassigns `parentId = parent.parentId` (back to root) → DB chain is at most 1 level deep.
- **Split endpoints (NOT fully group on the client — approach b dropped)**:
  - `GET /posts/:id/comments` → **root only** (`parentId IS NULL`), newest-first, with `repliesCount`.
  - `GET /comments/:id/replies` → replies of one comment, lazy-load, chronological asc.
  - Reason for dropping approach (b) "fetch everything then group": cursor pagination can place a reply on a different page than its parent → grouping breaks.
- **Reply UI**: indent 1 level; "Reply" on a reply still attaches back to the root but prefixes `@<reply_author>`. @mention parses into a Link to the profile.
- **Delete**: comment-author only (changed from author-or-post-author). Cascade-deletes replies via `onDelete: Cascade` (self-relation + post).

### Stories: time-based filter, soft archive
- Create: `expiresAt = now() + 24h`.
- Active query: `WHERE expiresAt > NOW() AND isArchived = false`.
- Cron every 5 minutes (`src/jobs/archiveExpiredStories.ts`, Phase 4.4): `UPDATE WHERE expiresAt < NOW() SET isArchived = true`.
- Archive: `WHERE authorId = me AND isArchived = true`.

### Messaging: chat without follow
- No follow check when sending a message.
- CHECK the block list (model `Block` added later).
- First conversation with someone you don't follow → marked as a "request" client-side.

### Recall message (Phase 5.5 — DONE)
- Soft delete: `deletedAt = NOW()`, does not delete the row. **Sender only** (→ 403), **≤15 minutes** (→ 410). Reactions cleared.
- `serializeMessage` returns a **tombstone** when `deletedAt` is set (content/media/reactions/sharedPost empty) ⇒ the recalled content never reaches the client. `listMessages` KEEPS the tombstone (the thread shows a placeholder, holding its position); `conversationInclude.messages` filters `deletedAt:null` ⇒ the list preview jumps back to the previous message (skip-to-previous).
- Best-effort delete of S3 media (objectKey/thumbnailObjectKey) via `lib/s3.deleteObject` — **soft-fail** (log + continue; orphan-sweep cron → BACKLOG).
- Server emits `message:deleted { conversationId, messageId, deletedAt }` via socket (user rooms).
- Client renders a placeholder **"Message deleted"** (action label in UI = "Delete"; HTTP verb / internal = recall).

### Audio/Video calls (LiveKit Cloud — Phase 6)
- **LiveKit Cloud SFU** handles all of WebRTC: signaling, media routing, TURN, reconnect, Krisp noise-cancel. No simple-peer / P2P mesh / Coturn.
- The backend (`livekit-server-sdk`) only **mints access tokens** (`AccessToken`, TTL 1h) + **manages rooms** (`RoomServiceClient.createRoom` maxParticipants 50 + emptyTimeout 600s; `listParticipants` for the 50-cap + group auto-end) + stores `Call` lifecycle. `lib/livekit.ts` uses **dynamic `import()`** (the SDK is ESM-only, the backend compiles to CommonJS).
- **Call-as-Message**: a call event = a `Message` (`contentType CALL`, `callId` FK) → reuses messaging's pagination/preview/realtime/optimistic (mirrors sharedPost 5.4c).
- **Minimal socket events** (3): `call:incoming`/`call:declined`/`call:ended` — notification only, LiveKit handles signaling.
- **Group**: existing GROUP conversation, unlimited (soft cap 50). Late-join open. Non-initiator `leave` (room continues); initiator `end_for_all`. Auto-end when the room has ≤1 left (Q1).
- **Missed**: webhook deferred → initiator FE timeout 30s → `end` with reason MISSED.
- **Deploy**: LiveKit creds in `backend/.env` (`LIVEKIT_URL`/`_API_KEY`/`_API_SECRET`). Free tier 5000 participant-min + 100 concurrent.

### Media upload: presigned URLs
- Client requests a presigned URL: `POST /media/presign`.
- Client uploads directly to S3 → offloads the backend.
- After the upload completes, the client sends the reference URL.
- **Phase 2**: single image only. MIME whitelist `['image/jpeg', 'image/png', 'image/webp']`, max 5MB. Validate both on the client (before requesting presign) and on the server (when issuing presign). Storage = MinIO local (Docker, S3-compatible).
- **Phase 3**: extended to video + multi-file (carousel).
- Large video → queue transcode (BullMQ) to produce multiple resolutions + thumbnail.

### API documentation: Zod-driven (already in Phase 1)
- The Zod schemas in `modules/*/schema.ts` are the **single source of truth**.
- `modules/*/openapi.ts` registers Zod into the OpenAPI registry.
- `@asteasolutions/zod-to-openapi` generates the OpenAPI 3.1 spec.
- Swagger UI renders the spec at `/docs` (dev-only).
- **Do NOT hand-write JSDoc Swagger on the routes.**

### Auth token transport (Phase Polish R1 — httpOnly cookie)
- **Access token**: 1h, the client keeps it **in-memory** (Zustand, NOT localStorage/persist). Sent via `Authorization: Bearer`.
- **Refresh token**: 7d, **httpOnly cookie** (`sameSite:'lax'`, `secure` prod-only, `path:'/auth'`) — JS cannot read it → mitigates XSS token theft (before Polish it was stored in localStorage). The cookie is **set/cleared in the route** (not the service). `/auth/refresh` reads the cookie (non-rotating). `cookie-parser` + CORS `credentials:true` + explicit origin.
- **Boot-restore**: a reload with no persisted session → `useAuthBootstrap` calls `/auth/refresh` → `/auth/me`; route guards (`authStatus: loading|authenticated|unauthenticated`) show a spinner until resolved. Interceptor 401 → single-flight refresh → retry / logout.
- **Out of scope → BACKLOG**: refresh-token rotation + reuse detection; CSRF token (currently mitigated by sameSite=lax + path-scope `/auth`).

---

## 7. Build Phases

| Phase | Week | Deliverables | Status |
|---|---|---|---|
| 1. Foundation | 1-2 | Auth, user CRUD, profile, Swagger | ✅ Backend done |
| 1A Frontend | 1 | Vite setup, axios, Zustand, router | ✅ Done |
| 1B Frontend | 1 | Login/Register/Home/Profile UI | ✅ Done |
| 1C Frontend | 2 | Design system "Beng" + layout shell + dark mode | ✅ Done |
| 2. Posts core (BE) | 3-5 | Posts CRUD, MinIO upload, follow, like, flat comments, feed API | ✅ Backend done |
| 2. Posts core (FE) | 3-5 | Feed page, post card, create post, profile grid, like/comment/follow UI (shuffle client-side) | ✅ Done |
| 3. Posts advanced | 6 | Carousel (3.1) + video (3.2) + nested replies & @mention (3.3); sticker/gif → defer | ✅ Done |
| 4.1 Stories Core | 7 | BE module (Story/StoryView + 5 endpoints) + StoryBar with real data + slim composer (9:16 / video ≤15s) + basic viewer | 🟡 Code-complete (awaiting migration apply + verify) |
| 4.2 Stories viewer+ | 7 | Progress bars + gestures (hold/swipe) + auto-advance across users | ✅ Done |
| 4.3a Stories overlays | 8 | StoryItem: TEXT + EMOJI (drag) + video edit | ✅ Done |
| 4.3b Stories overlays | 8 | MENTION/STICKER/TAG + multi-touch scale/rotate | ⏸ Defer (BACKLOG) |
| 4.4 Stories archive | 8 | isArchived cron 5 min + archive page + profile ring entry + view count/viewers (AudioTrack defer) | ✅ Done → **Phase 4 complete** |
| 5.1 Messaging Foundation | 9 | Conversation/Message models + REST (direct/group/list/get/messages) + responsive list+detail UI + optimistic send + polling 5s + burst grouping (no Socket.io / media) | ✅ Done |
| 5.2 Messaging Realtime | 10 | Socket.io infra (JWT handshake + user/convo rooms) + message:new broadcast (REST send unchanged) + typing + presence (online + last-seen, contact-scoped) + read receipts; polling removed | ✅ Done |
| 5.3-5.4 Messaging | 11-12 | Reactions + GROUP read receipts (5.3) · media image/video + voice + emoji/sticker/GIF + post-share (5.4) | ✅ Done |
| 5.5 Messaging | 12 | Recall (soft-delete tombstone, sender ≤15min, S3 soft-fail, socket message:deleted) + group create UI (GET /users/groupable recent+mutual merge); reply-to + group member management → BACKLOG | ✅ Done → **Phase 5 complete** |
| 6. Calls | 13-14 | Audio + video calls (1-1 + group) via LiveKit Cloud SFU. Call-as-Message + 4 REST endpoints + 3 socket events (call:incoming/declined/ended). Webhook + screen-share → backlog | ✅ Done |
| 7. Polish | 15-16 | Notifications (LIKE/COMMENT/FOLLOW + 1h dedupe + `notification:new`) + unread badges + Postgres full-text search (tsvector + GIN) + default avatar (DiceBear). Hide post / block / MENTION+STORY_VIEW notif / push → backlog | ✅ Done → **project 7/7 complete** |
| Polish R1 | — | Toast (sonner) + Safari iOS voice (`audio/mp4`) + reply-to-message FULL (quote bubble + scroll/jump + long-press action sheet) + httpOnly cookie auth (refresh cookie + access token in-memory + boot-gate) | ✅ Done |
| Polish R2 | — | Avatar upload (react-easy-crop + presign) + suggested follows (`/users/suggested` FoF+popular) + mixed feed (followed + ranked strangers, window 14→90, phase-cursor) + onboarding gate + stranger inline-Follow | ✅ Done |

---

## 8. Open questions (to be decided when the corresponding phase is reached)

1. **Mobile app** later — will we build it?
2. **Push notifications** (web push)? Needs a Service Worker + VAPID keys.
3. **Search** — is Postgres full-text enough, or do we need Meilisearch?
4. **OAuth** (Google/Apple)? — Polish phase.
5. **Deployment** — VPS Docker, or split services (Render/Railway/Fly.io)?
6. **Region** — VN server or global? Affects realtime latency + TURN.

---

*This plan will be adjusted as realities are encountered in the code.*
