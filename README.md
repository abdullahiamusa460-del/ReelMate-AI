# ReelMate AI

ReelMate AI is an assistant that helps manage Instagram DMs, understand shared Reels, and draft context-aware replies.

The repository contains two parts:

- **Frontend** (this directory): a Next.js 16 App Router UI.
- **Backend** (`backend/`): a Python/FastAPI + PostgreSQL + SQLAlchemy API that the frontend calls through a secure server-side proxy.

> **Demo only by default.** Every conversation, Reel, metric and notification is fictional sample data unless an eligible Instagram account is actually connected. The backend never connects to a personal Instagram account, never calls an AI model unless configured, and never claims a message was delivered unless Instagram accepted it.

## Quick start

### Frontend

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build      # production build
npm run typecheck  # TypeScript check
```

### Backend

See [`backend/README.md`](./backend/README.md) for full setup, configuration, migrations, testing and Docker instructions.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit SECRET_KEY, ENCRYPTION_KEY, API_ACCESS_TOKEN, etc.
alembic upgrade head
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Connecting frontend to backend

In the repository root, create `.env.local`:

```bash
BACKEND_URL=http://127.0.0.1:8000
BACKEND_API_TOKEN=<same value as API_ACCESS_TOKEN in backend .env>
```

The Next.js proxy at `src/app/api/backend/[...path]/route.ts` forwards
`/api/backend/*` to the FastAPI backend, so no backend credentials are exposed
to the browser. Start both services and the frontend will load workspace data
from the backend; if the backend is unreachable it falls back to a clearly
labelled local preview.

```bash
npm run build      # production build
npm run typecheck  # TypeScript check
```

## What's included

| Route | Page |
| --- | --- |
| `/` | Dashboard — AI ON/OFF switch, connection status, demo metrics, activity chart, intended workflow, recent events |
| `/inbox` | Instagram Inbox — searchable conversation list, Reel messages, sample chat, AI insight panel, disabled composer |
| `/reels` | Reel Intelligence — Reel cards, simulated analysis, summaries, topics, suggested replies, detail modal |
| `/assistant` | AI Assistant — personality, tone, language, length, custom instructions, auto-reply rules, live preview |
| `/activity` | Activity History — filterable timeline of simulated message / Reel / reply events |
| `/connection` | Instagram Connection — explicit “not connected” status, readiness checklist, setup requirements, demo vs. real comparison |

Additional behaviour:

- Interactive AI toggle with status indicators and notifications.
- Toast notifications plus a notification centre with unread state and “mark read”.
- Loading skeletons and empty states for inbox filters, Reel filters, activity filters and search.
- Responsive app shell: desktop sidebar, mobile drawer and mobile tab bar.
- Demo preferences persist in `localStorage` under `reelmate-ai:v1`.
- Simulated Reel analysis for the two unanalyzed demo Reels, generated locally.
- Gradient avatars and Reel thumbnails are generated with CSS — no real Instagram media is used.

## The intended workflow (not implemented)

When the assistant is ON and a real account is connected, the product is designed to:

1. Receive an eligible Instagram DM through an authorized backend.
2. Access the shared Reel only when the connected account is permitted to.
3. Analyze the accessible content and understand the conversation.
4. Generate a reply based on the assistant settings.
5. Send it through the Instagram Messaging API from the authorized backend.

In this repository, steps 1 and 5 are visibly blocked, steps 3–4 are clearly labelled simulations, and every screen states that no Instagram account is connected.

## Demo vs. real

| Area | This build | Real integration |
| --- | --- | --- |
| Conversations | Fictional sample chats in `src/data` | Live DMs from an authorized account |
| Reels | CSS gradient thumbnails, pre-written summaries | Accessible metadata + model-generated analysis |
| Replies | Local drafts only; send button disabled | Delivered via Instagram Messaging API |
| Metrics | Static sample totals | Computed from backend events |
| Account status | Hard-coded “not connected” | Verified OAuth connection status |
| Settings | Browser `localStorage` | Persisted server-side, applied by the backend |

Connection setup requirements (Meta app, OAuth, webhook verification, server-side tokens, messaging permissions) are documented on `/connection` as guidance only.

## Tech stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** (strict)
- **Tailwind CSS 4** with custom theme tokens, utilities and animations
- **lucide-react** icons
- No UI kit, chart library, state library or data-fetching library

## Project structure

```
.
├── backend/              # Python/FastAPI + PostgreSQL + SQLAlchemy API
│   ├── app/              # API routes, services, models, schemas, workers
│   ├── alembic/          # database migrations
│   ├── tests/            # pytest suite
│   ├── Dockerfile        # backend container
│   ├── docker-compose.yml# backend + Postgres
│   ├── README.md         # backend setup, config, migrations, testing
│   ├── requirements.txt  # backend dependencies
│   └── .env.example      # backend configuration template
├── src/                  # Next.js frontend
│   ├── app/              # routes: dashboard, inbox, reels, assistant, activity, connection
│   │   └── api/backend/[...path]/route.ts  # server-side proxy to FastAPI
│   ├── components/
│   │   ├── dashboard/        # AI control, stats, chart, workflow, activity, queue
│   │   ├── inbox/            # conversation list, chat panel, insight panel
│   │   ├── reels/            # Reel card, thumbnail, detail modal (with upload)
│   │   ├── layout/           # shell, sidebar, topbar, toasts, navigation
│   │   ├── providers/        # app provider wired to backend (demo/live fallback)
│   │   ├── icons/            # local Instagram glyph
│   │   └── ui/               # reusable primitives
│   ├── data/                 # fictional demo conversations, Reels, activity, insights
│   ├── lib/                  # formatting, draft templates, Reel helpers, defaults, backend client
│   └── types/                # shared domain types (backend-aligned camelCase)
```

## What is intentionally simulated or absent

- **Personal Instagram accounts**: the official Instagram messaging API does not support them. OAuth callbacks discard the token and report `unsupported_personal_account`.
- **AI without configuration**: when no AI provider is configured, replies use a clearly labelled template and Reel video analysis is unavailable. The fallback is never presented as AI.
- **Scraping / passwords / cookies / browser automation**: only Meta's official Instagram API, OAuth, webhooks and messaging endpoints are used.
- **URL-only Reel summaries**: a Reel is analysed only after its actual media is downloaded or uploaded; a URL or caption alone is never summarised.
- **Unverified delivery claims**: `delivered=true` is only set when Instagram accepts the message. Demo sends are `delivered=false`, `mode="demo"`.

The shapes in `src/types` and the demo data in `src/data` describe the interface the UI expects from the backend.
