# ReelMate AI — Backend

Python/FastAPI + PostgreSQL + SQLAlchemy backend for ReelMate AI. It connects to
the existing Next.js frontend (kept in the repository root) through a secure
server-side proxy at `src/app/api/backend/[...path]/route.ts`.

> **Demo only by default.** No Instagram account is connected, no AI model is
> called, and no message is ever claimed as delivered unless Instagram accepts it.
> Only a Meta-verified Instagram Business or Creator account can be connected
> through the official Instagram API.

## What it provides

- **Auth & rate limiting**: API bearer-token auth, general + sensitive endpoint rate limits.
- **Database**: async SQLAlchemy 2.0 with Alembic migrations (`asyncpg` Postgres / `aiosqlite` test fallback).
- **Models**: users, integration, conversations, messages, Reels, Reel analyses, AI settings, activity logs, webhook events, jobs.
- **Instagram integration (official API only)**: OAuth authorization URL, callback handling with personal-account detection, token encryption (Fernet), integration verify, webhook subscription, disconnect.
- **AI providers**: configurable `demo` / OpenAI-compatible (vision, sampled video frames via ffmpeg) / Gemini, with a clearly labelled template fallback that is never presented as AI.
- **Reel analysis**: only after actual media bytes are downloaded or uploaded (SSRF-checked, size-capped, ffprobe/ffmpeg). A URL or caption alone is never summarised.
- **Replies**: eligibility check, draft generation, sending via Instagram Messaging API; `delivered=true` only after delivery succeeds. Demo sends are `delivered=false`, `mode="demo"`.
- **Background job queue**: DB-backed (`jobs` table), `FOR UPDATE SKIP LOCKED`, retries with exponential backoff, dead-letter after max attempts.
- **Webhooks**: signature validation, idempotent event processing.
- **REST API** (versioned, camelCase): dashboard, AI status, inbox, conversations, Reel analysis, settings, integration, activity, jobs, demo reset.
- **Demo mode**: idempotent seed from existing frontend sample data, clearly `is_demo=True`, separated from live mode.

## Quick start (Linux)

1. **Install system dependencies**

   ```bash
   # PostgreSQL 18+, ffmpeg, ffprobe, python 3.11+
   sudo apt-get install -y postgresql ffmpeg python3-pip python3-venv
   ```

2. **Create the database**

   ```bash
   sudo -u postgres psql -c "CREATE USER reelmate WITH PASSWORD 'reelmate';"
   sudo -u postgres createdb -O reelmate reelmate
   ```

   Or use the data-directory approach used in this repo:

   ```bash
   /path/to/postgres/bin/pg_ctl initdb -D /home/dazumi/ReelMate/.pgdata
   /path/to/postgres/bin/pg_ctl start -D /home/dazumi/ReelMate/.pgdata -l /home/dazumi/ReelMate/.pgdata/server.log
   sudo -u postgres psql -c "CREATE USER reelmate WITH PASSWORD 'reelmate';" -h 127.0.0.1
   sudo -u postgres createdb -O reelmate reelmate -h 127.0.0.1
   ```

3. **Set up the backend**

   ```bash
   cd /home/dazumi/ReelMate/backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env: set SECRET_KEY, ENCRYPTION_KEY, API_ACCESS_TOKEN and any Instagram/AI values you have.
   ```

4. **Run migrations**

   ```bash
   alembic upgrade head
   ```

5. **Start the API**

   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

   Health check: `http://127.0.0.1:8000/health`

6. **Connect the frontend**

   In the repository root, create/verify `.env.local`:

   ```bash
   BACKEND_URL=http://127.0.0.1:8000
   BACKEND_API_TOKEN=<same value as API_ACCESS_TOKEN in backend .env>
   ```

   Then run the frontend:

   ```bash
   cd /home/dazumi/ReelMate
   npm install
   npm run dev
   ```

   The Next.js proxy forwards `/api/backend/*` to the FastAPI backend, so no
   backend credentials are ever exposed to the browser.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | `postgresql+asyncpg://reelmate:reelmate@127.0.0.1:5432/reelmate` (Postgres) or `sqlite+aiosqlite:///./reelmate.db` (tests only) |
| `SECRET_KEY` | Session/signing secret (`secrets.token_urlsafe(48)`) |
| `ENCRYPTION_KEY` | Fernet key for encrypting Instagram access tokens (`Fernet.generate_key()`) |
| `API_ACCESS_TOKEN` | Shared proxy auth token; must match frontend `BACKEND_API_TOKEN` |
| `IG_APP_ID` / `IG_APP_SECRET` | Meta app credentials for Instagram OAuth |
| `IG_REDIRECT_URI` | OAuth callback, e.g. `http://localhost:8000/api/v1/integration/oauth/callback` |
| `IG_WEBHOOK_VERIFY_TOKEN` | Token Meta uses for webhook challenge verification |
| `AI_PROVIDER` | `demo` \| `openai` \| `gemini` |
| `AI_API_KEY` | API key for the configured AI provider |
| `ENABLE_WORKER` | `true` to run the background job worker |

Never commit `.env`. Commit only `.env.example`.

## Migrations

Schema is managed with Alembic. The initial revision is
`d49e3d641d06_initial_schema`.

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
alembic downgrade -1
```

## Testing

Tests use SQLite at `/tmp/opencode/reelmate-test.db` and run without the worker:

```bash
cd /home/dazumi/ReelMate/backend
source .venv/bin/activate
python -m pytest
```

## Truthfulness rules (enforced)

- A Reel is analysed only after its actual media is downloaded or uploaded; a URL or caption alone is never summarised.
- `delivered=true` / "Reply sent" is only set when the Instagram Messaging API accepted the message.
- Demo sends return `delivered=false`, `mode="demo"` and never claim delivery.
- Personal Instagram accounts are detected via the official API and reported as `unsupported_personal_account`; the token is discarded.
- Template fallback responses are never labelled as AI-generated.

## API surface

All versioned routes live under `/api/v1`. The frontend proxies them via
`/api/backend/*`.

| Route | Method | Description |
| --- | --- | --- |
| `/health` | GET | Health check (public) |
| `/api/v1/status` | GET | Assistant + connection status |
| `/api/v1/dashboard` | GET | Dashboard stats, recent activity, attention queue |
| `/api/v1/settings` | GET / PUT | AI assistant settings |
| `/api/v1/settings/reset` | POST | Reset settings to defaults |
| `/api/v1/assistant/activation` | POST | Enable/disable the assistant |
| `/api/v1/inbox` | GET | Conversation list |
| `/api/v1/conversations/{id}` | GET | Single conversation |
| `/api/v1/conversations/{id}/read` | POST | Mark conversation read |
| `/api/v1/conversations/{id}/draft` | POST | Generate a reply draft |
| `/api/v1/conversations/{id}/messages` | POST | Send a reply |
| `/api/v1/reels` | GET | List Reels |
| `/api/v1/reels/{id}` | GET | Single Reel |
| `/api/v1/reels/{id}/analyze` | POST | Analyse a Reel (media only) |
| `/api/v1/reels/{id}/upload` | POST | Upload Reel media file |
| `/api/v1/activity` | GET | Activity log |
| `/api/v1/integration` | GET | Integration / connection state |
| `/api/v1/integration/connect-url` | GET | Instagram OAuth URL |
| `/api/v1/integration/verify` | POST | Re-check connected account |
| `/api/v1/integration/subscribe-webhooks` | POST | Subscribe to messaging webhooks |
| `/api/v1/integration/disconnect` | POST | Remove stored credentials |
| `/api/v1/jobs` | GET | List background jobs |
| `/api/v1/jobs/{id}` | GET | Single job status |
| `/api/v1/demo/reset` | POST | Reset demo workspace (idempotent) |

## Demo vs. live mode

- **Demo** (default): sample conversations, Reels and activity served from the database; clearly `is_demo=True`; analyses `source="demo_seed"`; replies are local drafts and never delivered.
- **Live**: an eligible Instagram Business/Creator account is connected via OAuth; messages are received through webhooks; replies can be delivered through the Instagram Messaging API; personal accounts are rejected.

A live workspace still never pretends a personal account is connected, and never summarises a Reel without accessing its media.
