# Baspaldaq

Baspaldaq is a HackAlem AI Hackathon project that helps businesses turn rough real-world problems into clear, student-ready practical assignments. The current product foundation includes the first task-entry interaction and an immersive readiness-system prototype. AI analysis and the complete business workflow are intentionally not implemented yet.

## Product foundation

The initial business flow starts with one focused natural-language input. Submitting an idea launches a continuous Three.js sequence: the camera follows a rocket down and through a right-hand turn before the same scene opens into a split workspace and a seven-planet readiness system.

The interface uses a restrained near-black palette with lavender, cyan, lime, coral, and amber accents. Liquid-glass material is limited to controls and the task composer so it reinforces hierarchy without reducing readability. The local `public/launch.mp3` asset is played through Howler.js from the launch gesture and fades as the rocket reaches the system.

Typography uses the locally bundled Onest variable font. It was selected for long-form screen readability and verified support for Latin, Cyrillic, and Kazakh through the font project's documented Turkic language coverage.

The spatial scene uses Three.js through React Three Fiber and Drei. It is lazy-loaded behind the initial interface so the 3D bundle does not block the first interaction, while reduced-motion preferences shorten the transition and suppress launch audio.

## Architecture

- `client/` - React and Vite single-page application
- `server/` - Express API and Prisma setup
- `.env.example` - shared local configuration template

The frontend uses React, React Router, TanStack Query, Tailwind CSS v4, Motion, Three.js, React Three Fiber, Drei, GSAP, Lenis, Radix UI primitives, Hugeicons, dotLottie, Howler.js, React Hook Form, Zod, Zustand, and Onest Variable.

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
