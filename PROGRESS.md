# Progress Log

> Nhật ký work session. Mỗi lần ngồi xuống code → cập nhật mục mới nhất.
> Mục đích: 1 tuần sau quay lại không lạc đường.
> Đọc cùng với README.md (status cao cấp) và BACKLOG.md (việc sắp tới).

---

## 2026-06-04 — Checkpoint 2.4c: Post composer (5-step modal) + Profile real posts grid

**Done:**
- Post composer 5-step modal (`Select → Crop → Caption → Upload → Done`), Zustand `composerStore` global (3 trigger: Sidebar Create, BottomNav Create, Profile empty-state), render 1 instance ở `AppLayout`. Hand-roll, KHÔNG thêm dependency.
- Crop UI hand-rolled bằng Canvas API + pointer events (KHÔNG dùng library): cover-fit base scale × zoom + drag-reposition, 3 aspect ratio (1:1 / 4:5 / 1.91:1), export `canvas.toBlob` (≤1080w, quality 0.9). Geometry tách `lib/cropImage.ts` (pure), interaction ở `CropStage.tsx`.
- `useCreatePost` orchestrate presign → PUT (progress) → POST /posts; `onSuccess` seed `post(id)` cache + invalidate `userPosts(me.username)`. CỐ TÌNH không đụng feed cache (feed = following-only, post của mình không thuộc feed mình).
- ProfilePage refactor: posts grid thật qua `useUserPosts` (`PostsGrid` 3-col, hover overlay like/comment count, infinite scroll), posts count thật. Empty state → CTA "Create your first post" mở composer.
- Client media validation MATCH backend exact (5 MIME + 10MB) chạy TRƯỚC presign (`lib/image.ts validateMediaFile`), tránh waste API call. Error tiếng Anh.
- Bug fix (routing, mobile): `PostDetailPage` nút Back `navigate('/')` → `navigate(-1)` — page mode mobile vào từ profile click post, Back giờ về đúng trang nguồn thay vì luôn về Feed.

**Lưu ý kỹ thuật:**
- **contentType threading** (rủi ro #1): giá trị MIME phải khớp 3 chỗ — `mediaApi.presign({contentType})`, `Content-Type` của PUT (wrap blob thành `File` đúng type), và blob thực. Crop PNG→JPEG ⇒ presign + upload đều `image/jpeg`, KHÔNG `image/png`; nguồn WebP giữ `image/webp`. Lệch → S3 từ chối signature.
- **GIF/AVIF passthrough**: gated bằng `PASSTHROUGH_MIME`, KHÔNG qua canvas (re-encode mất animation GIF + AVIF decode không ổn định) → upload file gốc, chỉ đo dimensions. Croppable (jpeg/png/webp) mới qua canvas.
- **width/height đo client-side** (`getImageDimensions` createImageBitmap + fallback `Image()`) → gửi `media[].width/height` để feed/grid render đúng aspect (clamp [0.8, 1.91] đã có từ 2.4b). Crop output dùng `canvas.width/height`.
- **Không optimistic post**: khác like/comment, post mới chưa có real id/url khi submit → reconcile temp-id trong cursor list dễ vỡ. Chỉ invalidate sau success (theo pattern `useCreateComment.onSuccess`).
- Composer mobile full-screen (`h-[100dvh] max-w-none rounded-none` < sm), reuse shell `ui/dialog` (Radix lo focus-trap/ESC/overlay) như `PostDetailModal`.
- **Step 0 doc-sync**: `CLAUDE.md` Git workflow rule đổi "luôn qua feature branch" → "commit thẳng main (solo dev)" cho khớp reality 2.4a (các checkpoint đã commit thẳng main). Sửa luôn dấu vết "feature branch" stale ở PROGRESS.md entry 2.4b.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[frontend/profile]` followers/following count = `0` placeholder (backend chưa có total-count endpoint, chỉ list cursor). Posts count cũng là loaded-count + "+" khi còn page, không phải total thật. Defer Phase 2.5 (cần count API).
- `[frontend/composer]` Đóng modal giữa lúc upload (`phase=uploading`) chỉ abort PUT ngầm, không confirm — orphan S3 object có thể phát sinh (best-effort storage, acceptable). Cân nhắc confirm-before-close.
- `[frontend/profile]` Public profile route `/users/:username` vẫn chưa có (tech debt 2.4b) — ProfilePage còn own-profile only.

**Verify:** 11/11 functional PASS (T1-T11: 3 trigger mở modal, validate reject sai MIME/>10MB không gọi presign, crop 3 ratio + drag/zoom, back/next giữ-clear state, submit presign→PUT→POST đúng thứ tự + contentType khớp, grid update + count +1, view post pre-seeded, error retry không post ma, dark mode + mobile full-screen, GIF passthrough còn animation, object-URL leak revoke). Bug routing mobile fixed + verify. `tsc -b` + `vite build` 0 lỗi.

**Next:** Phase 2.5 — follow button + `useFollow`, edit/delete comment, public profile route `/users/:username`, followers/following count API. Sau đó tag `phase-2-frontend-complete`.

---

## 2026-06-03 — Checkpoint 2.4b: Frontend posts UI (feed + PostCard + PostDetail + like/comment)

**Done:**
- Frontend Phase 2.4b: feed thật (`useFeed` infinite + IntersectionObserver sentinel), `PostCard`, `PostDetail` mở **modal trên desktop / full page trên mobile + direct URL** (background-location). Refactor `HomePage` → `FeedPage` (giữ StoryBar placeholder Phase 1C, xóa PostCard local + POSTS hardcode). Hand-roll, KHÔNG thêm dependency.
- Mutation layer optimistic: `useLikePost`/`useUnlikePost` (toggle + reconcile authoritative count ở `onSuccess`, KHÔNG invalidate feed), `useCreateComment` (optimistic prepend + bump count + `onSuccess` invalidate). Helper `lib/postCache.ts` patch 1 post trên CẢ 3 cache (`post`/`feed`/`userPosts`) qua 1 cửa + snapshot/restore cho rollback.
- UI primitives hand-roll: `ui/dialog` (từ `radix-ui` umbrella) + `ui/skeleton`; common `Avatar`/`Spinner`/`EmptyState`/`ErrorState`; hooks `useInfiniteScroll` + `useIsDesktop`; `lib/format` (relative time + compact number + aspect-ratio clamp [0.8, 1.91]).
- Bugfix (privacy): logout KHÔNG clear React Query cache → login user B thấy feed/cache user A vài giây trước refetch (rò rỉ private tiềm năng). Fix: `authStore.logout()` gọi `queryClient.clear()`.
- UX change: comment order đảo **ASC → DESC (newest-first)** cả backend (`comments.service` orderBy desc) + frontend (optimistic **prepend** vào `pages[0]`); comment mới hiện ngay đầu list không cần scroll.
- UX change: like/comment count chuyển sang **cạnh icon** (`♥ 13.8K  💬 42`, `tabular-nums`), bỏ dòng "X likes" + link "View all comments" riêng dưới.

**Lưu ý kỹ thuật:**
- `patchPostInCaches`: `userPosts` cache key có username động → match bằng **predicate** (`['users', *, 'posts']`), KHÔNG addressable bằng exact key. `mapPostInInfinite` trả về CÙNG reference khi post không đổi → tránh re-render thừa toàn feed.
- Like flow CỐ TÌNH KHÔNG invalidate feed ở `onSettled`: invalidate → refetch `GET /feed` → reshuffle thứ tự + mất scroll + flicker. Chỉ dựa optimistic + `likesCount` authoritative từ response.
- `radix-ui` là gói gộp (`button.tsx` đã `import { Slot } from "radix-ui"`) → Dialog lấy qua `import { Dialog } from "radix-ui"`, KHÔNG cần thêm `@radix-ui/react-dialog`. shadcn `Input` (React 18) KHÔNG forward ref → comment icon focus input qua `id` (`COMMENT_INPUT_ID`) thay ref.
- Comment order đảo: đổi `orderBy asc→desc` KHÔNG cần sửa cursor logic (Prisma `cursor + skip:1` đi theo orderBy: page sau = comment cũ hơn) + KHÔNG migration.
- `authStore` import `queryClient` an toàn (acyclic — `queryClient.ts` chỉ import `@tanstack/react-query`). Path 401-refresh-fail trong axios interceptor cũng gọi `logout()` → cũng clear cache.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[frontend/post]` Author name/avatar trong PostCard + PostDetail CHƯA clickable (route `/users/:username` public profile chưa có) — wire khi làm profile page 2.4c.
- `[frontend/feed]` Chưa dedupe post `id` khi `flatMap` các page infinite — nếu cursor backend trả trùng (post chèn giữa lúc paginate) → duplicate React key. Cân nhắc dedupe theo id.
- `[frontend/post]` Share/Save (PostActions) vẫn disabled placeholder — wire Phase sau.

**Next:** Commit 2.4b (commit thẳng main) sau khi verify browser-interactive (feed/like/comment/modal desktop+mobile/dark mode/logout-switch-user/comment newest-first). Sau đó 2.4c: follow button + `useFollow`, create-post composer (presigned upload UI), profile real posts grid, edit/delete comment.

---

## 2026-06-02 — Checkpoint 2.3b-1: Follow + Like + Comment (backend, phiên 1/2)

**Done:**
- Schema: 3 model mới `Follow`/`Like`/`Comment` + relations vào `User`/`Post`; migration `add_follow_like_comment`. Comment Phase 2 KHÔNG enum content (luôn text), `parentId` lưu DB nhưng UI hiển thị flat.
- Module `follows`: follow/unfollow idempotent (upsert / deleteMany), self-follow → 400; `followers`/`following` cursor pagination; `isFollowing()` export cho phiên 2 reuse. Routes gắn vào `users.routes.ts` theo `:username` (đồng bộ codebase, không theo `:id` của ARCHITECTURE §4).
- Module `likes`: like/unlike idempotent → `{ liked, likesCount }`; like gated visibility (post không thấy → 404), unlike luôn cho phép (retract own data). Tách helper `getViewablePost()` (gate visibility 404-over-403) vào `posts.service` để dùng chung.
- Module `comments`: CRUD; list oldest-first (`createdAt asc`, IG-style); delete cho comment-author HOẶC post-author. Route split 2 router trong CÙNG `posts.routes.ts`: default (`/posts/:id/comments`) + `commentsRouter` named export (`/comments/:id`), mount `/comments` riêng ở server.ts.
- Privacy gate `followers`/`following`: `optionalAuth` + helper `canViewSocialList` — account private chỉ owner + follower xem list, còn lại (kể cả anonymous) → empty.
- Wiring: `openapi.ts` registerAll + 3 tag (Follows/Likes/Comments). `tsc -b` pass 0 lỗi. Code-complete, CHƯA commit — chờ test thủ công 20 + 2 bước (privacy) trước khi sang phiên 2.

**Lưu ý kỹ thuật:**
- Comment route placement: posts router mount tại `/posts` nên KHÔNG đẻ được absolute `/comments/:id` từ 1 router → giải bằng 2 router cùng file (default + `commentsRouter` named export), mount tách `/comments` trong server.ts.
- Follow relation naming ngược trực giác (theo ARCHITECTURE §3): `followers @relation("following")`, `following @relation("follower")`. Quy chiếu: "ai follow tôi" = `where { followingId: me }`; "tôi follow ai" = `where { followerId: me }`.
- Cursor `followers`/`following` = userId cạnh biến (`followingId`/`followerId` cố định) qua composite cursor `followerId_followingId` — KHÁC cursor `(createdAt, id)` của post/comment list.
- `getViewablePost` dùng chung likes + comments (và `getPostById` ở phiên 2) — đảm bảo nhất quán 404-over-403 cho read private.
- Windows: `prisma generate` fail `EPERM` (rename `query_engine-windows.dll.node`) khi `npm run dev` (tsx watch) đang giữ DLL → phải tắt dev server trước khi generate.

**Tech debt phát sinh (đề xuất BACKLOG, chờ confirm):**
- `[backend/build]` `tsc -b` sinh `backend/tsconfig.tsbuildinfo` (đang untracked trong git) — thêm vào `.gitignore`, không commit build artifact.

**Next:** Sau khi user test 20 + 2 bước PASS → phiên 2 (2.3b-2): posts refactor (`postInclude` thành function + `serializePost`: likesCount/commentsCount/isLikedByMe/isFollowingAuthor; follow-check thật cho `getPostById` + `listPostsByUsername`) + module `feed` (`GET /feed`, 14 ngày, shuffle client-side) + wiring + docs (CLAUDE.md endpoints, phase status).

---

## 2026-06-01 — Checkpoint 2.3a: Posts module backend (Post + PostMedia, CRUD)

**Done:**
- Prisma: thêm `Post`, `PostMedia`, enum `PostVisibility`/`MediaType`, relation `User.posts`; migration `add_posts_and_media`.
- Module `posts/` (schema/service/routes/openapi): `POST /posts` (ảnh và/hoặc caption, refine ít nhất 1), `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`, nested `GET /users/:username/posts` (cursor pagination, đặt trong users.routes gọi posts.service).
- Middleware `optionalAuth` mới (verify token nếu có, không 401 nếu thiếu) cho route public cần biết viewer; export `publicUserSelect` từ users.service reuse cho `author` (không lộ email/passwordHash).
- Visibility: PUBLIC ai cũng xem; PRIVATE/FOLLOWERS read bởi non-owner → 404 (giấu existence); write (PATCH/DELETE) non-owner → 403; account private list → empty (follow thật để 2.3b).
- `deletePost` xóa object S3 best-effort (`DeleteObjectCommand` từng key, fail thì log không throw); KHÔNG verify file tồn tại khi tạo post (tin client).
- Bugfix cùng session: 2 GET dùng optionalAuth thiếu `security` trong OpenAPI → Swagger UI không gửi bearer → owner xem post PRIVATE bị 404. Fix bằng `security: [{ bearerAuth: [] }, {}]`.

**Lưu ý kỹ thuật:**
- Endpoint optional-auth PHẢI khai `security: [{ bearerAuth: [] }, {}]` trong OpenAPI thì Swagger UI mới đính token (phần tử `{}` rỗng giữ anonymous vẫn hợp lệ). Thiếu → Swagger không gửi header dù đã Authorize → `req.user` undefined. Đây là root cause bug owner-404.
- Cursor pagination: `take limit+1` để phát hiện `hasMore`, `cursor: { id }, skip: 1`, `orderBy [createdAt desc, id desc]`; `nextCursor` = id item dư.
- 404-over-403 cho read private (giấu existence), giữ 403 cho write — nhất quán pattern bảo mật.

**Tech debt phát sinh:** (đề xuất, chờ confirm) xem mục dưới.

**Next:** Checkpoint 2.3b — Follow/Like/Comment models + Feed (follow + shuffle); refactor visibility FOLLOWERS dùng follow check thật.

---

## 2026-06-01 — Checkpoint 2.1: MinIO infrastructure (chưa code feature)

**Done:**
- Thêm service `minio` vào `backend/docker-compose.yml` (image `minio/minio:latest`, ports 9000 API / 9001 console, creds dev `minio`/`minio12345`, healthcheck `mc ready local`) + volume `minio_data`.
- Thêm 6 S3 env vars vào `.env.example` (`S3_ENDPOINT/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET/PUBLIC_URL`).
- Cập nhật `backend/CLAUDE.md` section Storage: service name, creds default, access model (bucket public-read cho đọc, presigned PUT cho upload).
- Verify hạ tầng qua console UI: tạo bucket `social-media-media`, set public-read, upload + share URL OK.

**Lưu ý kỹ thuật:**
- Bucket MinIO mặc định private → share URL trả 403. Phải set Access Policy public-read (prefix `*`, readonly) thủ công sau khi tạo bucket. Access model chốt: **đọc** ảnh qua `S3_PUBLIC_URL` trực tiếp (không sign, giảm latency feed), **upload** mới qua presigned PUT.
- `.env.example` bị permission settings chặn đọc/ghi (match `.env*`) → Claude không Edit được, user paste tay snippet.
- Postgres map host port 25432→5432; MinIO map thẳng 9000/9001.

**Tech debt phát sinh:** `[backend/storage]` creds MinIO hardcode trong docker-compose (dev only) → BACKLOG. (Automate MinIO setup đã có sẵn trong BACKLOG.)

**Next:** Checkpoint 2.2 — cài `@aws-sdk/client-s3` + `s3-request-presigner`, tạo `lib/s3.ts`, module `media/` với `POST /media/presign`, validate S3 vars trong `config/env.ts`.

---

## 2026-05-30 — Frontend Phase 1B: Design system "Beng" + layout shell + dark mode

**Done:**
- Override toàn bộ shadcn token Nova (zinc base, primary tím) → warm-neutral + coral trong `index.css` (`:root` + `.dark`, oklch hue 32–60, radius 0.625→0.75). 5 component shadcn (button/card/input/form/label) tự đổi theme, không rewrite.
- Đổi font: gỡ `@fontsource-variable/geist` → Bricolage Grotesque (heading) + Plus Jakarta Sans (body) qua Google Fonts.
- Dark mode JS layer: `themeStore` (Zustand persist key `theme`), `useThemeEffect` (toggle `.dark` trên `<html>`), `ThemeToggle`, FOUC inline script trong `index.html`.
- Layout shell mới (`components/layout/`): `AppLayout` (Sidebar | main | RightRail + BottomNav mobile), `AuthLayout` (split coral panel); lồng vào guard route trong `App.tsx`.
- 4 page restyle giữ nguyên logic auth/validation/mutation: Login/Register vào AuthLayout; Home bỏ header + `useQuery` orphan → story bar + feed placeholder; Profile header + stats + posts grid.
- Story bar IG-style: `scrollbar-hide`, ~6 story/view, arrow hover-show + auto-hide theo `canScrollLeft/Right`, scroll đo runtime (`offsetWidth` + `gap` × 3 item) thay px hardcode.

**Lưu ý kỹ thuật:**
- Token override đủ restyle vì cả 5 shadcn component 100% semantic token, không hardcode màu (verify trước khi sửa).
- `--destructive-foreground` thêm vào `:root`/`.dark` + map `--color-destructive-foreground` trong `@theme inline`, nhưng button destructive đang dùng style subtle (`bg-destructive/10 text-destructive`) nên chưa đổi visual — token để sẵn.
- FOUC script đọc `stored.state.theme` (Zustand persist bọc `{state,version}`), không phải `stored.theme`.
- Story scroll step đo item đầu `[data-story-item]`; cân bằng your-story `size-17` (68px) khớp story thường (ring 64+4=68) + `gap-6.5` để tránh drift, thay vì đo riêng item normal.
- AppLayout/AuthLayout lồng trong ProtectedRoute/PublicOnlyRoute (cả hai render `<Outlet/>`).

**Tech debt phát sinh (đề xuất append BACKLOG):**
- `[frontend/a11y]` ThemeToggle đổi `<Button>` → `<div onClick>`: mất button semantics, keyboard access (Tab/Enter/Space) và focus ring. Revert về `<button>` hoặc thêm `role="button"`/`tabIndex`/`onKeyDown`.
- `[frontend/layout]` Story bar `useEffect` init chỉ chạy lúc mount, không re-check khi resize → `canScrollRight` có thể stale khi đổi viewport. Cân nhắc `ResizeObserver`.
- `[frontend/nav]` Nav placeholder (Search/Explore/Reels/Messages/Notifications/Create/Settings) đang disabled visual, chưa có route — Phase 2+ wire route thật.

**Next:** Verify browser-interactive (light/dark/mobile, FOUC reload, story scroll trọn item). Sau đó Phase 2 — posts (model + API + feed thật).

---

## 2026-05-28 — Frontend Phase 1A: Foundation

**Done:**
- Scaffold Vite + React + TS trong `frontend/`, path alias `@` → `src/`, shadcn init (preset Nova, Tailwind v4 CSS-first)
- axios client với request interceptor (gắn Bearer) + response interceptor (401 → refresh → retry; refresh fail → `logout()`)
- Zustand `authStore` (persist localStorage), TanStack Query (QueryClient + Provider + DevTools dev-only)
- React Router 6: `ProtectedRoute` + `PublicOnlyRoute`, 4 page placeholder (`/login`, `/register`, `/`, `/profile`)
- `types/api.ts` viết tay khớp response backend; `HomePage` có `useQuery(['me'])` smoke test
- Verify code-level pass: `tsc -b` + `npm run build` 0 lỗi; contract API khớp (register/login `identifier`/me Bearer/refresh) qua curl. 3 bước browser-interactive chờ test thủ công.

**Lưu ý kỹ thuật:**
- create-vite latest kéo React 19 + Vite 8 (rolldown) + TS 6 → pin cứng về **React 18 + Vite 5 + TS 5.6 + React Router 6**. Vite 8 rolldown vỡ trên Node 22.1.0 (thiếu native binding `@rolldown/binding-win32-x64-msvc`, cần Node ≥22.12).
- Tailwind v4 = CSS-first: KHÔNG có `tailwind.config.js`, theme nằm trong `src/index.css` qua `@theme`, color space oklch (zinc base).
- shadcn init thêm `@import "shadcn/tailwind.css"` vào index.css nhưng package `shadcn` chỉ là CLI (đã gỡ khỏi deps) → phải xóa import đó nếu không build fail.
- TS 5.6 không biết `erasableSyntaxOnly` (option TS 5.8+) → gỡ khỏi tsconfig.app/node.
- Interceptor dùng refresh-promise singleton cho concurrent 401; KHÔNG redirect trong axios (chỉ `logout()`, ProtectedRoute tự redirect).

**Tech debt phát sinh (đã append BACKLOG):**
- `[frontend/auth]` Token lưu localStorage → XSS đọc được; Phase polish chuyển refresh token sang httpOnly cookie.

**Next:** Phase 1B — UI auth form thực (react-hook-form + Zod, login/register/profile), `npx shadcn@latest add` các component v4. Nâng Node lên ≥22.12 để bỏ warning Vite.

---

## 2026-05-27 — Swagger UI schema-first (Zod → OpenAPI)

**Done:**
- Tích hợp `@asteasolutions/zod-to-openapi` + `swagger-ui-express`, serve `/docs` và `/docs/json` (dev-only gate qua `NODE_ENV`)
- `lib/openapi.ts` làm registry trung tâm + `extendZodWithOpenApi(z)` + security scheme `bearerAuth` + shared schemas (`User`, `Error`, `ValidationError`)
- 3 file `*.openapi.ts` per-feature (auth, users, health/Meta) đăng ký paths từ Zod schema gốc, không sửa `*.schema.ts`
- Tags array document-level cố định thứ tự Auth → Users → Meta
- Verify 9/9 pass: spec valid, $ref dùng đúng, refresh-token-as-access trả 401, prod mode `/docs` 404

**Lưu ý kỹ thuật:**
- Pin `@asteasolutions/zod-to-openapi@^7.3.0` — v8 latest peer-deps Zod ^4 (project đang Zod 3.23)
- Circular import `lib/openapi` ↔ `modules/*/openapi` (registry export schema + paths import lại schema) → giải bằng lazy `require()` trong `registerAll()`, không bằng dynamic ESM import (tsx CJS context)
- `servers` URL và log dùng `localhost` thay `env.HOST` vì HOST mặc định `0.0.0.0` không gọi được từ browser
- Path params phải dùng cú pháp OpenAPI `{username}`, không reuse Express `:username`

**Tech debt phát sinh (đề xuất append vào BACKLOG.md):**
- JWT verify error message gộp chung: refresh-token-as-access và expired-token đều trả `"Token không hợp lệ hoặc đã hết hạn"` — nên phân biệt `TokenTypeMismatch` vs `TokenExpired` ở `lib/jwt.ts` để client biết retry-with-refresh hay buộc re-login
- `userPublicSchema` trong `lib/openapi.ts` đang duplicate field list với `publicUserSelect` của Prisma — khi thêm field mới (vd `followersCount`) phải sửa 2 chỗ; cân nhắc derive từ Prisma type sau khi có generator
- `buildOpenApiDocument()` chạy 1 lần khi mount — nếu cần hot-reload paths trong dev cần chuyển sang gọi mỗi request `/docs/json` (chi phí thấp)

**Next:** Đợi xác nhận để append BACKLOG. Sau đó Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router), có thể dùng `/docs/json` để auto-gen types.

---

## 2026-05-26 — Backend Phase 1 hoàn thành

**Done:**
- Auth flow đầy đủ (register/login/refresh/me/logout) + JWT type-aware
- Users module (GET /:username, PATCH /me)
- Prisma migration init, model User
- Middleware: auth/validate/asyncHandler/error
- Swagger UI tại /docs (dev-only), OpenAPI 3.1 spec
- 9/9 verify pass (xem PR/commit)

**Lưu ý kỹ thuật phát sinh:**
- Pin zod-to-openapi ^7.3.0 (v8 yêu cầu Zod 4, không tương thích Zod 3.23)
- Circular import lib/openapi ↔ modules/*/openapi → giải bằng lazy require trong registerAll()
- Schema User extract về lib/openapi.ts (dùng chung 2 module)

**Tech debt nhỏ:** Xem `BACKLOG.md` — JWT error message gộp chung mọi case fail.

**Next:** Frontend Phase 1A — Foundation (Vite + Tailwind + axios + Zustand + router)

---