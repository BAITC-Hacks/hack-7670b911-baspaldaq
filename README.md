# Baspaldaq

Baspaldaq turns a business problem into a practical task brief. A user submits a description, the API extracts only supported facts with exact source evidence, asks adaptive clarification questions, and produces an editable task card. The readiness score is calculated by the backend from seven weighted dimensions; AI suggestions do not earn points until the user confirms them.

## Architecture

- `client/` - React, Vite, Motion, and the Three.js launch experience
- `server/` - Express 5 API, Prisma ORM, and the AI analysis workflow
- `server/prisma/` - SQLite schema and committed Prisma migrations
- `.env.example` - environment variable template

OpenAI calls run only on the server. The browser communicates with `/api`; in development, Vite proxies those requests to `VITE_API_URL`.

## Local Setup

Requirements: Node.js 20.19 or newer and npm 10 or newer.

```powershell
npm ci
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:deploy
npm run dev
```

Set `OPENAI_API_KEY` in the ignored local `.env` before using AI analysis. Do not put the key in client variables, commit it, or share it in chat. The local SQLite URL `file:./dev.db` resolves next to `server/prisma/schema.prisma`, so the database file is `server/prisma/dev.db`.

The client URL is printed by Vite. The API listens on `PORT`, and `GET /api/health` checks both the API and its database schema.

## Deployment

The repository does not select or authenticate to a hosting provider. To deploy the API, use a Node.js service with persistent writable storage for SQLite and configure `PORT`, `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_TIMEOUT_MS`, and `CLIENT_ORIGIN` in the host environment. Point `DATABASE_URL` at a file on the mounted persistent disk; an ephemeral application filesystem will lose SQLite data on redeploy.

Use these commands in the backend service:

```text
Build: npm ci && npm run prisma:generate
Pre-deploy migration: npm run prisma:deploy
Start: npm start
```

For a separately hosted static client, set `VITE_API_URL` to the public API origin before `npm run build`, and set the API's `CLIENT_ORIGIN` to the exact public client origin. The client build is written to `client/dist/`.

## Validation

```powershell
npm run build
npm run test --workspace server
npm run prisma:validate
npm run prisma:deploy
```
