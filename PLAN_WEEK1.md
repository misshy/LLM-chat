# Week 1 Plan (Front-end -> LLM App / AI Engineering)

## Week Goal (Deliverables)
- A runnable web demo: chat UI + API
- Real LLM integration (DeepSeek)
- RAG knowledge base with citations
- Simple tool calling (agent) with 2-3 tools
- Basic engineering: timeout/retry strategy, logs, simple evaluation set
- Resume-ready README and 5-minute demo script

## Daily Time Budget
- Weekdays: 3h/day
- Weekends: 4h/day

---

## Day 1 (3h) — Repo + Minimal Chain
- Run web + api locally
- Ensure frontend -> `/chat` works (initially mock is OK)
- Confirm request/response format

**Done definition**
- Local chat works from browser

## Day 2 (3h) — Real DeepSeek Integration + Prompt Basics
- Configure `DEEPSEEK_API_KEY`
- Replace mock with real DeepSeek response (non-stream)
- Add a basic system prompt and make output more stable

**Done definition**
- Same UI returns real model answer
- Basic error message when key missing / upstream failure

## Day 3 (3h) — UX Improvement + Streaming (optional)
- Improve chat UX (loading, error UI, scroll)
- Optional: implement streaming (SSE) end-to-end

**Done definition**
- Usable chat experience (even if not streaming)

## Day 4 (3h) — RAG v1
- Ingest local docs (md/txt/pdf)
- Chunk + embed + retrieve topK
- Add citations to response

**Done definition**
- Questions about docs answered with citations

## Day 5 (3h) — Tool Calling / Agent v1
- Define 2-3 tools (e.g., `searchKnowledgeBase`, `summarize`, `generateInterviewQA`)
- Log tool calls for observability

**Done definition**
- Agent can decide to call tools and produce final answer

## Day 6 (4h) — Engineering + Evaluation
- Add request logging (latency, model, requestId)
- Add timeout + retry policy
- Create 10-case evaluation set and record results

**Done definition**
- `eval.json` exists and can be re-run manually

## Day 7 (4h) — Resume Packaging
- Write README (architecture, tradeoffs, how to run)
- Prepare 5-min demo script
- Extract 3 resume bullet points

**Done definition**
- README + demo script ready

