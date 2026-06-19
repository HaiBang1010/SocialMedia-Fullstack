# Backend — Phase 1 Setup Guide

A step-by-step guide for beginners. Read and follow it in order — don't skip steps.

## What you need to prepare

| Tool | Why | Where to install |
|---|---|---|
| Node.js 20+ | Run the backend | https://nodejs.org (choose LTS) |
| Docker Desktop | Run PostgreSQL | https://docker.com |
| Code editor | Edit code | VS Code (https://code.visualstudio.com) |
| Postman or curl | Test the API | Postman (https://postman.com) |

After installing, open a terminal and check the versions to confirm:
```bash
node --version    # v20.x.x or higher
docker --version  # Docker version 24.x.x or higher
```

---

## Step 1 — Place the backend folder into your project

You are in `social-media/`. Copy this `backend/` folder into it. The final structure:

```
social-media/
├── backend/         ← from this guide
└── frontend/        ← a later phase
```

Enter the backend folder in your terminal:
```bash
cd social-media/backend
```

---

## Step 2 — Install dependencies

```bash
npm install
```

This command reads `package.json` and downloads all the libraries into `node_modules/`. It takes ~1-2 minutes.

> 💡 **Never commit `node_modules/` to Git** — it is heavy and can be reinstalled with `npm install`. The `.gitignore` file already excludes it.

---

## Step 3 — Start PostgreSQL with Docker

Why Docker? — So you don't have to install Postgres directly on your machine. Each project gets its own DB, no conflicts, and easy cleanup.

Start Postgres in detached (background) mode:
```bash
docker compose up -d
```

Verify that Postgres is running:
```bash
docker compose ps
```

You should see the `social-media-postgres` container in the `healthy` or `running` state.

> ⚠️ **If you get the error `port 5432 already in use`**: you have another Postgres running. Either stop it, or change the port in `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL` accordingly.

---

## Step 4 — Create the `.env` file from the template

```bash
cp .env.example .env
```

(On Windows: `copy .env.example .env`)

Open the `.env` file. **You MUST change these 2 secrets** (random, at least 32 characters):
```
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
```

A quick way to generate a random secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice and paste the values into the 2 variables.

---

## Step 5 — Create the database schema with Prisma

```bash
npx prisma migrate dev --name init
```

This command:
1. Reads `prisma/schema.prisma`
2. Creates a SQL migration file in `prisma/migrations/`
3. Applies it to Postgres → creates the `User` table
4. Generates the Prisma Client (typed query API) in `node_modules/`

Verify the schema was created:
```bash
npx prisma studio
```

→ Opens a browser at http://localhost:5555. You'll see an empty `User` table. Close the tab when done.

---

## Step 6 — Run the server

```bash
npm run dev
```

You should see:
```
🚀 Server chạy tại http://0.0.0.0:3000
   Environment: development
```

Test the health check (open another terminal):
```bash
curl http://localhost:3000/health
```

Returns:
```json
{"status":"ok","timestamp":"2026-..."}
```

→ **The server works!** To run in watch mode (auto reload when you edit code), just leave `npm run dev` running in that terminal.

---

## Step 7 — Test the entire auth flow with curl

### 7.1 Register

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Response (201):
```json
{
  "user": { "id": "...", "username": "test_user", ... },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

**SAVE** the `accessToken` to use in the next step.

### 7.2 Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@example.com",
    "password": "password123"
  }'
```

(`identifier` can be an email OR a username)

### 7.3 Get current user (token required)

Replace `<TOKEN>` with the accessToken from step 7.1:
```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

Returns the current user info.

### 7.4 Update profile

```bash
curl -X PATCH http://localhost:3000/users/me \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"bio": "Hello world!", "name": "New Name"}'
```

### 7.5 Test the error cases

**Register with a duplicate email** → 409 Conflict:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test_user2","email":"test@example.com","password":"password123","name":"x"}'
```

**Login with wrong password** → 401:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"wrong"}'
```

**Access /auth/me without a token** → 401:
```bash
curl http://localhost:3000/auth/me
```

**Validation error (password too short)** → 400 with details:
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"x","email":"bad","password":"123","name":""}'
```

---

## When you hit an error, check in this order

1. Is Postgres running? → `docker compose ps`
2. Does `.env` have the correct `DATABASE_URL` and the 2 JWT_SECRETs?
3. Has the migration run? → `npx prisma studio` to check whether the User table exists
4. Is the server running? → does `npm run dev` produce logs?
5. Read the server logs — the error message is usually quite clear.

---

## What each file is for

```
backend/
├── docker-compose.yml      → Postgres container
├── package.json            → list of deps + npm scripts
├── tsconfig.json           → TypeScript settings
├── .env                    → secrets (DO NOT commit)
├── .env.example            → template (commit)
├── .gitignore
│
├── prisma/
│   └── schema.prisma       → table definitions → Prisma generates code
│
└── src/
    ├── server.ts           → Express app entry, registers middleware + routes
    │
    ├── config/
    │   └── env.ts          → reads .env + validates with Zod
    │
    ├── lib/                → utilities reused in many places
    │   ├── prisma.ts       → singleton Prisma client
    │   ├── jwt.ts          → sign/verify JWT
    │   └── password.ts     → hash/verify password
    │
    ├── middleware/         → Express middleware
    │   ├── auth.ts         → requireAuth (verify JWT)
    │   ├── validate.ts     → validate request body with Zod
    │   ├── asyncHandler.ts → wraps async routes, catches errors
    │   └── error.ts        → centralized error handler
    │
    └── modules/            → one folder per feature
        ├── auth/
        │   ├── auth.routes.ts   → defines endpoints
        │   ├── auth.service.ts  → business logic
        │   └── auth.schema.ts   → Zod validation schemas
        └── users/
            ├── users.routes.ts
            ├── users.service.ts
            └── users.schema.ts
```

**Convention**: routes only orchestrate (call the service, return the response). Do NOT write complex logic in routes. Logic lives in the **service**. This makes it easier to test and reuse later.

---

## Commonly used commands

```bash
npm run dev               # run the dev server (auto reload)
npm run prisma:studio     # GUI to view/edit data in the DB
npm run prisma:migrate    # create a new migration when you change the schema
docker compose up -d      # start Postgres
docker compose down       # stop Postgres (without deleting data)
docker compose down -v    # stop + delete all data (reset the DB)
```

---

## When do you move on to the next Phase?

When you have done ALL of the following:
- [x] Server runs without errors
- [x] Register creates a user (check `npx prisma studio`)
- [x] Login returns a token
- [x] `GET /auth/me` with a token returns the correct user
- [x] Update profile succeeds
- [x] The error cases (409, 401, 400) all work

→ Let me know you're done, and I'll continue with the **frontend** (Vite + React + auth UI).
