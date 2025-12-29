# Weeks 2-4 Roadmap (Front-end -> LLM App / AI Engineering)

This roadmap assumes:
- Weekdays: 3h/day
- Weekends: 4h/day
- Track: LLM application / AI engineering
- Stack: Next.js + Express (Node)

---

## Week 2 — RAG Productionization + Data Ingest

### Outcomes
- RAG v2 that is stable and explainable (citations, chunking strategy, prompt template)
- A simple doc-ingest pipeline (upload/import, chunk, embed, store)
- Basic evaluation around retrieval quality

### Scope (What to build)
- Doc ingest
  - Support at least: `.md` / `.txt` (PDF optional)
  - Chunking rules documented
  - Metadata stored: filename, chunk index, createdAt
- Retrieval
  - topK retrieval with configurable K
  - Return citations in final response
  - Add a simple “show sources” UI on the web
- Prompting
  - Separate prompt templates for: normal chat vs RAG answer
  - Guardrails: “if no relevant context, say you don’t know”

### Learning (Minimum theory)
- Embeddings, chunking, recall vs precision
- Prompt injection basics (what it is and simple mitigations)

### Definition of Done
- You can demo: upload/import docs -> ask questions -> answer cites sources
- You have `eval_rag.json` with ~10 questions and expected source references

---

## Week 3 — Agent / Tool Calling + Observability

### Outcomes
- Agent v1 that can select and call tools
- Tool call traces visible (logs + optionally UI)
- Cost/latency controls

### Scope (What to build)
- Tools (2-4 total)
  - `searchKnowledgeBase(query)`
  - `summarize(text)`
  - `generateInterviewQA(role, jd)` or `draftPRD(input)`
  - Optional: `fetchUrl(url)` (be careful with SSRF)
- Agent loop
  - Model decides when to call tools
  - Cap tool calls per request
  - Record tool call steps (name, args, duration)
- Observability
  - RequestId propagation
  - Latency logging
  - Basic rate limiting
  - Simple cache for repeated prompts

### Learning (Minimum theory)
- Function calling / tool calling mental model
- Reliability: retries, timeouts, idempotency

### Definition of Done
- Demo scenario: “根据我简历生成面试题并给答案”，会先检索再生成
- You have `eval_agent.json` with ~10 tasks and pass/fail notes

---

## Week 4 — Polishing for Resume + Deployment

### Outcomes
- Resume-ready project with clear README + demo script
- Deployed demo (optional but recommended)
- Clear story: what problem you solved and your engineering tradeoffs

### Scope (What to build)
- Product polish
  - Better UI states (loading, error, empty)
  - Session list + rename/delete
  - “Copy answer” / “Copy citations”
- Engineering polish
  - Config docs: required env vars
  - Add a simple `Makefile` or `scripts` section (optional)
  - Add basic tests or at least a reproducible evaluation command
- Deployment (choose 1)
  - Deploy web (Vercel/Netlify) + deploy API (Render/Fly/VM)
  - Or keep local demo but document steps clearly

### Learning (Minimum theory)
- Deployment tradeoffs, secrets management, CORS
- How to explain RAG/Agent in interviews

### Definition of Done
- README includes: architecture diagram, prompt strategy, RAG design, tool calling design, evaluation
- 5-minute demo script ready
- 3 strong resume bullet points ready
