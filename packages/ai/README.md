# Retrace AI Pipeline

This package contains the LangGraph pipeline that will summarize Retrace checkpoint captures and write AI output back to Appwrite.

## Install

```bash
cd packages/ai
python -m pip install -r requirements.txt
```

## Test

```bash
cd packages/ai
python -m pytest -q
```

## Environment

Required:

```bash
GEMINI_API_KEY=
```

The package loads the monorepo root `.env` first, then `packages/ai/.env` if present.

## Prompt Log

- Prompt 1: Created Gemini model setup, shared Pydantic state schema, base LangGraph skeleton, node stubs, test, and README.
  - Prompt 8 updated model selection to use `GEMINI_API_KEY`, programmatic model listing, and confirmed `PRO_MODEL` / `FLASH_MODEL` constants.

## Prompt 2 — Orchestrator

Files modified: `src/graph/nodes/orchestrator.py`, `src/graph/graph.py`, `src/graph/state.py`, `tests/test_graph.py`.

What was built: deterministic capture classifier plus conditional graph routing.

Routing logic: pure Python, no LLM calls. The orchestrator counts captures by type, sets routing flags, logs the route decision, and lets LangGraph fan out to the relevant specialist nodes before synthesis.

## Prompt 3 - Specialist Agents + Architecture Fixes

Files created: `src/graph/nodes/text_agent.py`, `src/graph/nodes/url_agent.py`, `src/graph/nodes/video_agent.py`, `src/graph/nodes/file_agent.py`.

Files modified: `src/graph/state.py`, `src/graph/graph.py`, `src/graph/nodes/orchestrator.py`, `tests/test_graph.py`, `requirements.txt`.

Files deleted: `src/graph/nodes/audio_agent.py`.

Corrections applied:
- Audio captures are reclassified as text and handled by the text agent.
- URLs are split into public web URLs and YouTube captures.
- The file agent handles both images and documents.

Libraries chosen:
- YouTube transcripts: `youtube-transcript-api`, because current 2026 references still list it as the widely used no-key baseline; failures are handled gracefully because YouTube caption extraction remains brittle.
- URL extraction: Jina Reader API first, then LangChain `WebBaseLoader`, then metadata fallback.
- PDFs: LangChain community `PyPDFParser`/`pypdf` for lightweight in-memory parsing.
- DOCX: direct OOXML extraction for no-disk, no-heavy-runtime text reads.
- Images: LangChain/Gemini content blocks with base64 image data and MIME type.

## Prompt 4 - Synthesis Agent

Files created: `tests/test_synthesis.py`.

Files modified: `src/graph/nodes/synthesis.py`, `src/graph/state.py`, `src/graph/graph.py`, `tests/test_graph.py`, `README.md`.

What it does: reads the structured outputs from the text, URL, YouTube, and file agents, builds one synthesis context, makes one `flash` structured-output call, and sets `diagram_warranted` for conditional routing to the diagram stub or writer stub.

## Prompt 5 - Diagram Agent

Files created: `src/utils/mermaid_templates.py`, `src/utils/mermaid_validator.py`, `tests/test_diagram.py`.

Files modified: `src/graph/nodes/diagram.py`, `README.md`.

What it does: conditionally generates Mermaid syntax from synthesis output, validates and cleans it, retries once on failure, and stores the raw Mermaid string on `diagram_mermaid`.

Diagram types supported: `concept_map`, `flowchart`, `timeline`, `comparison_table`, `sequence`, `tree`.

## Prompt 6 - Writer Agent

Files created: `tests/test_writer.py`, `tests/test_end_to_end.py`.

Files modified: `src/graph/nodes/writer.py`, `src/graph/state.py`, `README.md`.

What it does: converts synthesis into clean readable `FinalOutput`, copies `diagram_mermaid` from graph state, sets `capture_count` and `checkpoint_name`, and acts as the final node before pipeline end.

Model: `flash_lite`, because this is a formatting task rather than a reasoning task.

## Prompt 7 - Appwrite Integration + Trigger

Files created: `appwrite_function/main.py`, `appwrite_function/requirements.txt`, `appwrite_function/.env.example`, `tests/test_appwrite_integration.py`.

Files modified: `src/models/gemini.py`.

What it does: adds an Appwrite Function entrypoint for checkpoint-created events, skips non-checkpoint rows, fetches checkpoint captures, runs `run_pipeline`, and writes AI status/output into the existing private capture-details JSON file for that checkpoint.

Important implementation note: the live `capture_items` table rejected new `ai*` columns with `column_limit_exceeded`, so Prompt 7 uses the existing lightweight `capture_details` index plus private `capture-details` Storage JSON instead of adding oversized fields to the hot capture table.

## Prompt 8 - Resume Card Generator

Files created: `src/models/resume_card.py`, `src/resume/generator.py`, `src/resume/__init__.py`, `appwrite_function_resume/main.py`, `appwrite_function_resume/requirements.txt`, `appwrite_function_resume/.env.example`, `tests/test_resume_card.py`, `apps/web/app/api/resume-card/route.ts`, `apps/web/lib/redis.ts`, `apps/web/types/resume_card.ts`.

Files modified: `src/models/gemini.py`, `requirements.txt`, `appwrite_function/requirements.txt`, `appwrite_function/.env.example`, `tests/test_end_to_end.py`, `apps/web/lib/sessions.ts`, `apps/web/components/app/NavigatorPanel.tsx`, `apps/web/components/app/CheckpointSection.tsx`, `apps/web/app/sessions/[id]/page.tsx`, `apps/web/package.json`, `README.md`.

What it does: generates a lightweight "where you left off" card from already-computed checkpoint AI summaries. It does not run the LangGraph pipeline and does not reprocess raw captures.

Model selection: `get_available_models()` fetches Gemini model names with `GEMINI_API_KEY`. `PRO_MODEL` is used by synthesis and diagram agents. `FLASH_MODEL` is used by text, URL, YouTube, file, writer, and resume-card generation.

Important implementation note: because live checkpoint AI fields are stored in private `capture_details` JSON files, the resume generator reads checkpoint rows from `capture_items`, loads each checkpoint's private details JSON, and only uses entries where `aiStatus` is `complete`.

Frontend integration: the NavigatorPanel calls a Next.js server route that checks Upstash Redis first, calls the authenticated Appwrite resume-card function on cache miss, stores successful cards, and invalidates the cache when checkpoint AI polling reaches `complete`.

## Prompt 9 - Custom Selection + Grand Summarization

Files created: `src/models/summaries.py`, `appwrite_function_summarize/main.py`, `appwrite_function_summarize/requirements.txt`, `appwrite_function_summarize/.env.example`, `tests/test_summaries.py`, `apps/web/components/app/SummaryModal.tsx`, `apps/web/types/summaries.ts`.

Files modified: `src/resume/generator.py`, `tests/test_resume_card.py`, `apps/web/lib/sessions.ts`, `apps/web/components/app/NavigatorPanel.tsx`, `apps/web/.env.local`, `README.md`.

What it does: adds two lightweight summarization paths that read already-computed checkpoint AI summaries from private `capture_details` JSON files. Custom selection summarizes 2+ selected complete checkpoints with `FLASH_MODEL`; grand summarization synthesizes the full session from 2+ complete checkpoints with `PRO_MODEL`.

Appwrite function: `retrace-summarize`, authenticated HTTP function, Python 3.12, timeout 60 seconds.

## Simple Checkpoint AI Pipeline

Files created: `src/models/checkpoint_summary.py`, `src/checkpoint_pipeline/pipeline.py`, `tests/test_checkpoint_pipeline.py`.

Files modified: `appwrite_function/main.py`, `apps/web/lib/sessions.ts`, `apps/web/components/app/CheckpointSummaryView.tsx`, `apps/web/components/app/NavigatorPanel.tsx`.

What it does: adds a simple three-node LangGraph checkpoint pipeline: `content_processor -> summarizer -> optional diagram_generator`. It processes captured notes, text/audio transcripts, URLs through Jina Reader, YouTube transcripts, images through Gemini vision, and documents through lightweight extraction before making one structured Gemini Flash summary call.

Model selection: live Gemini model discovery confirmed `FLASH_MODEL = "models/gemini-3.5-flash"` and `PRO_MODEL = "models/gemini-3.1-pro-preview"`.

Appwrite note: the live `capture_items` table accepted `aiTitle` but rejected `aiSummary` with `column_limit_exceeded`, so the function writes direct checkpoint fields when available and always syncs the complete AI payload to the existing private `capture_details` JSON for frontend compatibility.
