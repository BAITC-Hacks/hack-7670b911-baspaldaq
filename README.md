# Baspaldaq

Baspaldaq turns a business problem into a practical task brief. A user submits a description, sees an immediate readiness score, and improves the brief through a one-question-at-a-time conversation. The API extracts only supported facts with exact source evidence and recalculates the score after each useful answer.

## Architecture

- `client/` - React, Vite, Motion, and the Three.js launch experience
- `server/` - Express 5 API, Prisma ORM, and the AI analysis workflow
- `server/prisma/` - SQLite schema and committed Prisma migrations
- `.env.example` - environment variable template

OpenAI calls run only on the server. The browser communicates with `/api`; in development, Vite proxies those requests to `VITE_API_URL`.

## Readiness And Conversation

The deterministic backend score uses seven fixed weights: context and need 20, data and materials 20, expected result 15, success criteria 15, constraints 10, users 10, and business connection 10. Each dimension earns zero for missing information, half its weight for partial information, and full weight for complete information; the total is rounded to an integer. Levels are `draft` (0-39), `workable` (40-69), `ready` (70-89), and `priority` (90-100).

Grounded evidence from the submitted description contributes immediately. AI output cannot assign points, and each evidence quote is checked against the original user text. After analysis, the client sees one prioritized question at a time. Each reply is checked for relevance; an unclear response gets one simpler rephrase and may then be skipped. A separate question about the project, such as its price, receives its own answer without closing the current clarification question or changing the score. Unknown prices and terms are never invented.

The editor for the ten task fields stays available below the conversation. Sound effects use the supplied `public/launch.mp3` and `public/ai-answer.mp3` files plus short browser-generated tones for accepted answers, rephrasing, skips, and level changes.

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
