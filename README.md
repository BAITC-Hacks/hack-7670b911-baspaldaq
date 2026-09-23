# Baspaldaq

Baspaldaq is a HackAlem AI Hackathon project that will help businesses turn rough real-world problems into clear, student-ready practical assignments. This repository currently contains only the validated development foundation; the product workflow and final visual design are intentionally not implemented yet.

## Architecture

- `client/` - React and Vite single-page application
- `server/` - Express API and Prisma setup
- `.env.example` - shared local configuration template

The frontend uses React, React Router, TanStack Query, Tailwind CSS v4, Motion, GSAP, Lenis, Radix UI primitives, Hugeicons, dotLottie, Howler.js, React Hook Form, Zod, and Zustand.

The backend uses Node.js, Express, Prisma, SQLite, and the Vercel AI SDK. AI provider calls and domain database models are not implemented yet.

## Setup

Requirements: Node.js 20.19 or newer and npm 10 or newer.

```bash
npm install
copy .env.example .env
npm run prisma:generate
```

Adjust `.env` for your local environment. Never commit that file.

## Development

Run the client and server together:

```bash
npm run dev
```

Or run them separately:

```bash
npm run dev:client
npm run dev:server
```

The client URL is printed by Vite. The API health endpoint is `GET /api/health` on the configured server port.

## Validation

```bash
npm run build
npm run prisma:validate
```

Hackathon team repository for BASPALDAQ
