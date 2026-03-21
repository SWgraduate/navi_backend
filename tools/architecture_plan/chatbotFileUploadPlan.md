## Plan: File Upload + File-Aware Chat v1

Implement a single unified document ingestion path for PDF and images (camera/gallery both become image files), add attachment binding per conversation, and update retrieval to run hybrid mode (bound docs first, then global fallback). This keeps the API stable, minimizes duplicate logic, and directly matches your selected v1 scope.

**Steps**

1. Phase 1 — Normalize contracts and feature flag foundation.
   1.1 Add feature flag/config for file-aware retrieval mode (`ENABLE_FILE_AWARE_CHAT` default true in non-prod if desired).
   1.2 Generalize ingestion DTO/types from PDF-specific names to document-oriented contracts while keeping backward-compatible response shape.
   1.3 Define attachment-binding contracts (bind/list/unbind request/response DTOs) and retrieval filter type (`documentIds?: string[]`).
2. Phase 2 — Unified upload architecture (PDF + image + camera image).
   2.1 Replace PDF-only multer filter with document-aware filter accepting `application/pdf`, `image/jpeg`, `image/png`, `image/webp` and shared max-size policy.
   2.2 Keep a single upload endpoint (`POST /rag/documents/upload`) with `multipart/form-data` file payload; camera capture and image picker both call same endpoint.
   2.3 Introduce extractor strategy (`DocumentExtractionService`): PDF path reuses current parser, image path uses OCR/vision-to-text extraction, then both continue through same normalization/chunk/embed/upsert pipeline.
   2.4 Preserve dedup/content-hash and ingestion status lifecycle for both document types.
3. Phase 3 — Attachment context binding APIs (conversation-scoped).
   3.1 Add `ChatContextController` endpoints for bind/list/unbind attachment documents per user + conversation.
   3.2 Add `AttachmentContextService` for ownership checks, idempotent bind behavior, and bound-doc resolution.
   3.3 Add Mongo model for bindings (`chat_attachment_bindings`) with indexes on userId + conversationId and unique constraint for (userId, conversationId, documentId).
4. Phase 4 — Hybrid retrieval orchestration in chat.
   4.1 Extend Pinecone query API to accept metadata filter by document IDs.
   4.2 Extend retrieval service to support scoped retrieval (`boundDocumentIds`) and keep existing global retrieval path.
   4.3 In `ChatService.processChatTask`, resolve bound docs for the conversation when feature flag is ON.
   4.4 Retrieval policy: query bound docs first; if 0 chunks, automatically fallback to global corpus retrieval; keep current safe no-context behavior.
   4.5 Persist retrieval mode metadata in chat result for observability (`bound`, `global-fallback`, `global-only`).
5. Phase 5 — Test UI and API integration (parallel with phases 3/4 after phase 2 starts).
   5.1 Update Upload UI to expose three user actions: - Upload File (pdf/image) - Upload Image (gallery) - Take Photo (camera capture)
   Internally all image actions call the same upload API with file payload.
   5.2 Add attachment bind/list/unbind actions in chat UI (conversation-aware) and include bound-files indicator.
   5.3 Keep chat send/status APIs unchanged; only add optional context attachment operations.
6. Phase 6 — Validation and rollout.
   6.1 Regenerate tsoa routes/swagger and verify endpoint contracts.
   6.2 Add/adjust unit tests for middleware validation, extraction routing, attachment binding service, and hybrid retrieval fallback behavior.
   6.3 Add integration test scenarios: (a) PDF-bound answer, (b) image-bound answer, (c) no bound docs → global retrieval, (d) bound docs no hits → global fallback.
   6.4 Add logging/metrics fields to confirm selected retrieval path and fallback rate during rollout.

Dependency notes:

- Step 2.1 blocks Step 2.2.
- Step 2.3 depends on Step 1.2.
- Step 4 depends on Step 3 for bound-document resolution model/service.
- Step 5.1 can start after Step 2.1 interface is settled.
- Step 5.2 depends on Step 3 APIs.

Parallelizable work:

- Step 5.1 can run in parallel with Step 3.
- Step 6 test additions can be split per layer (ingestion/retrieval/UI API client).

**Relevant files**

- `/Users/baysaa/projects/navi_new/navi_backend/src/middleware/uploadPdfMiddleware.ts` — replace with generalized document upload middleware and allowed MIME map.
- `/Users/baysaa/projects/navi_new/navi_backend/src/app.ts` — keep `RegisterRoutes` multer integration aligned with renamed middleware.
- `/Users/baysaa/projects/navi_new/navi_backend/src/controllers/rag/RagIngestionController.ts` — keep stable endpoint path, accept broader file inputs, route to generalized ingest service.
- `/Users/baysaa/projects/navi_new/navi_backend/src/rag/ingestion/services/RagIngestionService.ts` — add extractor strategy selection (pdf vs image) while reusing normalize/chunk/embed/upsert flow.
- `/Users/baysaa/projects/navi_new/navi_backend/src/rag/ingestion/services/PdfExtractionService.ts` — retained for PDF branch.
- `/Users/baysaa/projects/navi_new/navi_backend/src/services/VisionService.ts` — reuse/adapt for OCR text extraction from uploaded images.
- `/Users/baysaa/projects/navi_new/navi_backend/src/rag/ingestion/types/rag.types.ts` — rename/extend command/result interfaces for document-level ingestion.
- `/Users/baysaa/projects/navi_new/navi_backend/src/rag/ingestion/services/PineconeIndexService.ts` — add metadata filter support for document-scoped retrieval queries.
- `/Users/baysaa/projects/navi_new/navi_backend/src/rag/retrieval/types/retrieval.types.ts` — add optional filter fields for scoped retrieval.
- `/Users/baysaa/projects/navi_new/navi_backend/src/rag/retrieval/services/RagRetrievalService.ts` — implement scoped + fallback retrieval flow contract.
- `/Users/baysaa/projects/navi_new/navi_backend/src/services/ChatService.ts` — integrate feature flag + attachment resolution + hybrid retrieval policy.
- `/Users/baysaa/projects/navi_new/navi_backend/src/controllers/ChatController.ts` — preserve existing chat endpoint contract (no breaking changes).
- `/Users/baysaa/projects/navi_new/navi_backend/src/settings.ts` — add file-aware retrieval feature flag config.
- `/Users/baysaa/projects/navi_new/navi_backend/src/controllers/ConversationController.ts` — reference ownership patterns for new context controller.
- `/Users/baysaa/projects/navi_new/navi_backend/src/services/ConversationService.ts` — reference ownership checks for bind/list/unbind permissions.
- `/Users/baysaa/projects/navi_new/navi_backend/src/controllers/ChatContextController.ts` — new controller for attachment binding APIs.
- `/Users/baysaa/projects/navi_new/navi_backend/src/services/AttachmentContextService.ts` — new service for bind/list/unbind + resolve.
- `/Users/baysaa/projects/navi_new/navi_backend/src/models/ChatAttachmentBinding.ts` — new Mongo model for conversation attachment bindings.
- `/Users/baysaa/projects/navi_new/navi_backend/tools/test-ui/src/components/Upload/UploadPanel.tsx` — implement three-option UX with unified upload call.
- `/Users/baysaa/projects/navi_new/navi_backend/tools/test-ui/src/api/uploadApi.ts` — generalize `uploadPdf` to `uploadDocument` and keep backward compatibility alias if needed.
- `/Users/baysaa/projects/navi_new/navi_backend/tools/test-ui/src/components/Chat/MessageInput.tsx` — add bind/list/unbind interaction hooks if needed.

**Verification**

1. API contract checks
   1.1 `POST /api/rag/documents/upload` accepts PDF and image files, rejects unsupported mimetypes with 400.
   1.2 `POST/GET/DELETE /api/chat/context/attachments` enforce JWT user ownership and return deterministic errors.
2. Retrieval behavior checks
   2.1 With bound docs that have hits, response `sources` come from bound documents and mode=`bound`.
   2.2 With bound docs but no hits, system retries global retrieval and mode=`global-fallback`.
   2.3 Without bound docs, system uses current global retrieval mode (`global-only`).
3. Processing checks
   3.1 PDF and image ingestion both produce `documentId`, status transitions, and chunkCount.
   3.2 Duplicate upload detection still works across same content hash.
4. UI checks
   4.1 File picker, image picker, and camera capture all upload successfully through unified endpoint.
   4.2 User can bind/unbind document to current conversation and chat reflects selected context.
5. Regression checks
   5.1 Existing chat create/status endpoints remain backward compatible.
   5.2 Existing PDF ingestion tests still pass with generalized naming.

**Decisions**

- Included scope: PDF + image ingestion, camera unified as image upload, hybrid retrieval (bound-first then global fallback), conversation-level attachment binding.
- Excluded from v1: DOCX/TXT ingestion, async queue worker migration, advanced multi-intent router, re-index scheduler.
- API shape decision: keep one upload endpoint for all document sources to avoid duplicate backend paths and simplify clients.
- Security decision: binding operations and attachment resolution are scoped by authenticated `userId` and `conversationId` ownership checks.

**Further Considerations**

1. OCR backend choice for images: Option A (reuse current vision LLM path) / Option B (deterministic OCR engine first, cheaper + faster) / Option C (hybrid OCR then vision fallback). Recommendation: Option A first for speed of delivery, then optimize with Option B if cost/latency is high.
2. Binding granularity: conversation-scoped (recommended) vs user-global scope. Recommendation: conversation-scoped to avoid stale/accidental context leakage across chats.
3. Size policy: keep 10MB for all types in v1 or lower for images to control token/cost. Recommendation: keep 10MB initially, monitor ingestion latency and tune by mime type.
