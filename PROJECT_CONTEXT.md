# Project Context

## Goal
Front-end engineer transitioning to LLM application / AI engineering.

## Time Budget
- Weekdays: 3 hours/day
- Weekends: 4 hours/day

## Current Repo
- Repo name (local): `llm-chat-starter`
- GitHub: `git@github.com:misshy/LLM-chat.git`

## Tech Stack
- Web: Next.js (App Router) in `apps/web`
- API: Express in `apps/api`

## How to Run (Local)
- Web: `npm run dev:web` (port 3000)
- API: `npm run dev:api` (port 4000)

## Key Endpoints
- API health: `GET http://localhost:4000/health`
- Chat: `POST http://localhost:4000/chat`

## Model Provider
- DeepSeek (OpenAI-compatible Chat Completions)

### Required Environment Variables (DO NOT COMMIT SECRETS)
- `DEEPSEEK_API_KEY` (required)

### Optional Environment Variables
- `DEEPSEEK_BASE_URL` (default: `https://api.deepseek.com`)
- `DEEPSEEK_MODEL` (default: `deepseek-chat`)
- `DEEPSEEK_TIMEOUT_MS` (default: `20000`)

## Current Implementation Notes
- Frontend calls `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`) and appends `/chat`.
- Backend `/chat` proxies to DeepSeek `/chat/completions` (non-stream).

## Next Milestones
1. Confirm DeepSeek end-to-end works locally (web -> api -> deepseek).
2. Add prompt templates + structured JSON output.
3. Add RAG (document ingest + vector search + citations).
4. Add tool calling (agent) + basic evaluation set.
