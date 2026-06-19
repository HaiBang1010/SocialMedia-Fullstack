# Beng — Social Media Platform

*Moments worth keeping.*

Instagram-like social network — feed, stories, messaging, calls. Build to learn full-stack.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | JWT — access token in memory + refresh token in **httpOnly cookie** (Polish R1; was localStorage) |
| API docs | Swagger UI + OpenAPI 3.1 (schema-first from Zod) |
| Storage | S3-compatible (MinIO local) — presigned upload |
| Real-time | Socket.io (active since Phase 5.2 — message:new, typing, presence, read receipts) |
| Sticker / GIF | Giphy API via backend proxy (Phase 5.4c) |
| Calls | LiveKit Cloud — SFU (managed signaling + TURN, Krisp noise-cancel); `@livekit/components-react` + `livekit-client` (Phase 6) |
| Notifications / Search | In-app notifications (LIKE/COMMENT/FOLLOW) + browser Notification API + sound; Postgres full-text search (ts_vector + GIN); default avatar DiceBear toon-head (Phase 7) |

## Project structure

```
social-media/
├── README.md                   ← you are reading this
├── ARCHITECTURE.md             ← overall design (data model, API, technical decisions)
├── PROGRESS.md                 ← work session log (updated on every coding session)
├── BACKLOG.md                  ← tech debt + ideas not yet done
├── CLAUDE.md                   ← project memory for Claude Code
├── WORKING_WITH_CLAUDE.md      ← guide to using Claude Code effectively
├── .claude/
│   └── settings.json           ← permissions for Claude Code
├── .claudeignore               ← files Claude Code does not read
├── .gitignore
│
├── backend/                    ← Express API (Phase 1–7 backend ALREADY DONE — + stories, messaging realtime, media/voice/sticker/GIF, giphy proxy, recall + group create, calls via LiveKit Cloud, notifications + full-text search + default avatar)
│   ├── CLAUDE.md
│   ├── README.md               ← detailed step-by-step setup
│   ├── docker-compose.yml
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── server.ts
│       ├── config/
│       ├── lib/
│       ├── middleware/
│       └── modules/
│
└── frontend/                   ← React app (Phase 1–7 FE done — posts/carousel/video/comments + stories + messaging realtime + media/voice/sticker/GIF/emoji + post share + recall + group create + audio/video calls via LiveKit + notifications page/badges + search page + sound/browser notif)
    ├── CLAUDE.md
    └── README.md
```

## Quick start

**Prerequisites:** Node.js 20+, Docker Desktop, code editor.

### Backend (code already exists)

```bash
cd backend
npm install
cp .env.example .env       # change the 2 JWT_SECRET + GIPHY_API_KEY (5.4c) + LIVEKIT_URL/_API_KEY/_API_SECRET (calls, Phase 6)
                           # Phase 7 + Polish R1 require NO new env (cookie auth uses the existing NODE_ENV + CORS_ORIGIN)
docker compose up -d        # start Postgres + MinIO
npx prisma migrate dev      # apply migrations
npm run dev                 # → http://localhost:3000
                            # → http://localhost:3000/docs (Swagger UI)
```

### Frontend (Phase 1–6 FE done)

```bash
cd frontend
npm install
npm run dev                 # → http://localhost:5173
                            # needs the backend running on :3000 at the same time
```

> Calls (Phase 6) need a LiveKit Cloud project (free tier) — set `LIVEKIT_*` in `backend/.env`. Sound assets are optional in `frontend/public/sounds/`: `ringtone.mp3` (incoming call) + `notification.mp3` (message arrive, Phase 7) — CC0; if missing it runs visual-only (badge + browser notification still work).

Read `backend/README.md` for detailed step-by-step setup, especially if you are new to full-stack.

## Build status

| Phase | Content | Status |
|---|---|---|
| 1 | Backend auth + folder structure (+ Swagger) | ✅ Done |
| 1A | Frontend foundation (Vite 5, React 18, axios, Zustand, router, Tailwind v4) | ✅ Done |
| 1B | Frontend auth UI (login/register form, profile) | ✅ Done |
| 1C | Design system "Beng" + layout shell + dark mode | ✅ Done |
| 2 (BE) | Posts core backend: posts CRUD, MinIO upload, follow, like, flat comment, feed API | ✅ Done |
| 2 (FE) | Posts core frontend: feed, post card, create post, profile grid, like/comment, follow button + profile counts, public profile `/users/:username` | ✅ Done |
| 3 | Posts advanced: carousel ≤5 images (3.1) + video upload/playback + delete/visibility/private (3.2) + nested comments/replies + @mention (3.3) — sticker/gif defer | ✅ Done |
| 4 | Stories: 24h expire, viewer + gestures, text/emoji overlays, archive + cron, profile ring, view count/viewers | ✅ Done |
| 5.1–5.4 | Messaging: 1-1 + group, Socket.io realtime (typing/presence/read receipts), reactions, media (image/video) + voice, emoji/sticker/GIF (Giphy), post share | ✅ Done |
| 5.5 | Messaging: recall (soft-delete tombstone, 15-minute window) + group create UI (recent + mutual followers); reply-to + group member management → backlog | ✅ Done |
| 6 | Calls: audio + video, 1-1 + group, via LiveKit Cloud (SFU). Call-as-Message in thread + 4 REST + 3 socket events (call:incoming/declined/ended); webhook + screen-share → backlog | ✅ Done |
| 7 | Notifications (LIKE/COMMENT/FOLLOW) + unread badges + browser notif + sound + Postgres full-text search + default avatar (DiceBear toon-head); hide post / block / push → backlog | ✅ Done → **project 7/7 complete** |
| Polish R1 | Toast system (sonner) + Safari iOS voice (`audio/mp4`) + reply-to-message FULL (quote bubble + scroll/jump) + httpOnly cookie auth (refresh cookie + access token in memory) | ✅ Done |
| Polish R2 | Avatar upload (crop + presign) + Suggested follows (`/users/suggested` FoF+popular) + **Mixed feed** (followed + ranked strangers fill, window 14→90) + onboarding gate + stranger inline-Follow | ✅ Done |

Per-phase details: see `ARCHITECTURE.md`. Detailed progress: see `PROGRESS.md`.

## API Endpoints (core — Phase 1–3 backend)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | - | health check |
| GET | `/docs` · `/docs/json` | - | Swagger UI + OpenAPI 3.1 spec (dev only) |
| POST | `/auth/register` · `/login` · `/refresh` | - | register / login / refresh token |
| GET | `/auth/me` | ✓ | current user |
| GET | `/users/:username` | optional | public profile + counts (posts/followers/following) + isFollowing |
| PATCH | `/users/me` | ✓ | edit profile |
| GET | `/users/:username/posts` | optional | list a user's posts (cursor) |
| POST · DELETE | `/users/:username/follow` | ✓ | follow / unfollow (idempotent) |
| GET | `/users/:username/followers` · `/following` | optional | social lists (cursor) |
| POST | `/media/presign` | ✓ | request a presigned upload URL (MinIO) |
| POST | `/posts` | ✓ | create post (≤5 images carousel or 1 video, and/or caption) |
| GET | `/posts/:id` | optional | view a post (visibility follow-aware) |
| PATCH · DELETE | `/posts/:id` | ✓ | edit / delete post (owner) |
| POST · DELETE | `/posts/:id/like` | ✓ | like / unlike (idempotent) |
| POST | `/posts/:id/comments` | ✓ | add comment or reply (`parentId` optional, flatten to root) |
| GET | `/posts/:id/comments` | optional | list **ROOT** comments + `repliesCount` (cursor) |
| GET | `/comments/:id/replies` | optional | list replies of a comment (chronological, cursor) |
| PATCH · DELETE | `/comments/:id` | ✓ | edit / delete comment (comment author only) |
| GET | `/feed` | ✓ | **mixed feed** — followed users' posts + ranked PUBLIC posts from strangers as fill (90 days, cursor phase `f:`/`s:`) (Polish R2) |
| GET | `/users/suggested` | ✓ | suggested accounts to follow (FoF + popular fallback) (Polish R2) |

> Every response returning a post (single / list / feed) includes `likesCount`, `commentsCount`, `isLikedByMe`, `isFollowingAuthor`. Details: `backend/CLAUDE.md` + Swagger `/docs`.

**Stories / Messaging / Giphy / Calls / Notifications / Search** (Phase 4–7) — full list in `backend/CLAUDE.md` + Swagger `/docs` (47 path keys):
- **Stories**: `POST/GET /stories`, `GET /stories/feed`, `POST /stories/:id/view`, `GET /stories/:id/views`, `GET /stories/archive`, `GET /users/:username/stories`, `DELETE /stories/:id`
- **Conversations & Messages**: `POST /conversations/direct|/group`, `GET /conversations[/:id]`, `GET/POST /conversations/:id/messages`, `POST/DELETE /messages/:id/reactions`, `DELETE /messages/:id` (recall, 5.5), `GET /users/groupable` (group create, 5.5)
- **Giphy proxy**: `GET /giphy/search`, `GET /giphy/trending` (sticker + GIF, key server-side)
- **Calls** (Phase 6): `POST /calls/start`, `POST /calls/:id/token` (join), `POST /calls/:id/decline`, `POST /calls/:id/end` — LiveKit token mint + lifecycle; call entries appear in the thread as a CALL message
- **Notifications** (Phase 7): `GET /notifications` (cursor), `GET /notifications/unread-count`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` — LIKE/COMMENT/FOLLOW, 1h dedupe, `notification:new` socket
- **Search** (Phase 7): `GET /search?q=&type=posts|users|all` — Postgres full-text (prefix `to_tsquery` + GIN, ts_rank); + `GET /conversations/unread-total` (nav badge total unread)

## Project conventions

- **TypeScript end-to-end** — type safety from DB through API to UI
- **Feature modules** — one folder per feature (auth/, posts/, ...) instead of layers (controllers/services/)
- **Thin routes, thick services** — business logic in the service, the route only coordinates
- **Two-layer validation** — Zod at the API + Prisma at the DB
- **Schema-first** — Zod is the single source of truth for both validation and OpenAPI docs
- **Never commit secrets** — `.env` is always in `.gitignore`
- **Versioned migrations** — every schema change goes through `prisma migrate`, never edit the DB by hand

## Workflow with Claude Code

This project is designed to work well with Claude Code:

- `CLAUDE.md` at the root and in each subfolder = fixed rules Claude reads automatically
- `.claude/settings.json` = permissions allowing/forbidding bash commands
- `.claudeignore` = files Claude does not read (node_modules, .env, old migrations)
- `PROGRESS.md` = work session log, paste it into a prompt when context is needed

Read `WORKING_WITH_CLAUDE.md` to understand how to use it effectively.

## License

Personal learning project. No specific license.

## Scope discipline

- When a task belongs to one side (frontend/backend) and you discover the other side needs changes →
  STOP, tell the user, ask first before editing. Do NOT expand scope on your own, however reasonable the rationale.
- Exception: fixing small typos/comments is OK, but changing logic/messages in bulk must be asked first.
