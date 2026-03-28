## Plan: File Upload + File-Aware Chat v1

Implement a single unified document ingestion path for PDF and images (camera/gallery both become image files), add attachment binding per conversation, and update retrieval to run hybrid mode (bound docs first, then global fallback). This keeps the API stable, minimizes duplicate logic, and directly matches your selected v1 scope.

---

**Steps**

1. Phase 1 — Normalize contracts and feature flag foundation.
   1.1 ~~Add feature flag/config for file-aware retrieval mode (`GLOBAL_CONFIG.enableFileAwareChat`).~~
       **ALREADY DONE** — `src/settings.ts` defines `GLOBAL_CONFIG.enableFileAwareChat` which is automatically derived from `isProd`:
       `false` in production, `true` in development. No action needed.

   1.2 Rename PDF-specific contracts to document-oriented names.
       Exact renames in `src/rag/ingestion/types/rag.types.ts`:
       - `IngestPdfCommand` → `IngestDocumentCommand`
       - `IngestPdfResult` → `IngestDocumentResult`

       Exact renames in `src/rag/ingestion/services/RagIngestionService.ts`:
       - Method `ingestPdf()` → `ingestDocument()`
       - Update all internal references accordingly.

       Also update `src/controllers/rag/RagIngestionController.ts` to call `ingestDocument()`.

   1.3 Define attachment-binding contracts and add `retrievalMode` to Chat result schema.
       - Define bind/list/unbind request and response DTOs (new file or in a new `attachment.types.ts`).
       - Add optional `documentIds?: string[]` filter to `RetrieveContextParams` in
         `src/rag/retrieval/types/retrieval.types.ts`.
       - Add `retrievalMode: 'bound' | 'global-fallback' | 'global-only'` to `IChatRetrievalMeta`
         in `src/models/Chat.ts`. This field records which retrieval path was used, enabling
         observability. Also update `ChatRetrievalMetaSchema` in the same file.

2. Phase 2 — Unified upload architecture (PDF + image + camera image).
   2.1 The upload middleware `src/middleware/uploadPdfMiddleware.ts` already accepts
       `application/pdf`, `image/jpeg`, `image/png`, `image/webp` (already done in a previous commit).
       Verify it still enforces 10MB limit and validates both MIME type and file extension.
       No code changes expected — just confirm it is working as intended.

   2.2 Keep the single upload endpoint `POST /rag/documents/upload` with `multipart/form-data`.
       Camera capture and image picker on the client both call the same endpoint with a file payload.
       No endpoint changes needed.

   2.3 Introduce extractor strategy in `RagIngestionService`:
       - Inspect `command.mimeType` at the start of `ingestDocument()`.
       - If `application/pdf`: call existing `PdfExtractionService.extractTextFromBuffer()`.
       - If `image/jpeg | image/png | image/webp`: call a new image extraction method (see below).
       - After extraction, both paths continue identically: normalize → hash → dedup → chunk → embed → upsert.

       **Image extraction — what to add to `VisionService`:**
       The existing `VisionService.parseGraduationRecord()` is a structured JSON extractor for a
       specific academic schema. It is NOT usable for general document text extraction.
       Add a NEW public method to `VisionService`:
       ```
       extractTextFromImage(imageBase64: string, mimeType: string): Promise<string>
       ```
       This method should:
       - Use the same `visionModel` (already configured in constructor).
       - Prompt the model to return ONLY raw extracted text, no structured output, no explanation.
       - Return the raw string (to be passed into `TextNormalizationService` just like PDF output).
       - Throw an error with a clear message if the model returns empty text or signals failure.

       **Error contract for image extraction failure:**
       - If `VisionService.extractTextFromImage()` throws, `RagIngestionService.ingestDocument()`
         should catch it, call `ragDocumentRepository.markFailed(documentId, errorMessage)`,
         and rethrow so the controller returns a 500 with a descriptive message.
       - Do NOT silently swallow image extraction errors.

   2.4 Preserve dedup/content-hash and ingestion status lifecycle for both document types.
       No changes needed here — the existing hash/dedup logic operates on normalized text,
       which is the output of both extraction paths.

   2.5 **Non-document image quality warning (new):**
       If `VisionService.extractTextFromImage()` returns fewer than a minimum character threshold
       (e.g. 50 characters after normalization), treat it like an empty document:
       throw an error with message "Image contains insufficient text for ingestion".
       This prevents garbage embeddings from non-document photos.

3. Phase 3 — Attachment context binding APIs (conversation-scoped).
   3.1 Add `ChatContextController` at `src/controllers/ChatContextController.ts`.
       Endpoints:
       - `POST /chat/context/attachments` — bind document to conversation.
       - `GET /chat/context/attachments` — list bound documents for a conversation.
       - `DELETE /chat/context/attachments/:documentId` — unbind a document.
       All endpoints require JWT. Accept `conversationId` as query/body param.
       After adding controller, run `pnpm tsoa` to regenerate routes and swagger.

   3.2 Add `AttachmentContextService` at `src/services/AttachmentContextService.ts`.
       Responsibilities:
       - `bindDocument(userId, conversationId, documentId)`: ownership check (user owns conversation),
         verify RagDocument exists and is `processed`, idempotent upsert into binding collection.
       - `listBoundDocuments(userId, conversationId)`: return array of bound document metadata.
       - `unbindDocument(userId, conversationId, documentId)`: ownership check, delete binding record.
         **Does NOT delete the RagDocument or its Pinecone vectors** — documents persist
         independently in the global corpus. Unbinding only removes the conversation-scoped pointer.
       - `resolveBoundDocumentIds(userId, conversationId)`: returns `string[]` of documentIds for
         use in retrieval. Called internally by `ChatService`.

   3.3 Add `ChatAttachmentBinding` Mongoose model at `src/models/ChatAttachmentBinding.ts`.
       Fields: `userId` (String, required), `conversationId` (String, required),
       `documentId` (String, required), timestamps.
       Indexes: `{ userId: 1, conversationId: 1 }`, unique constraint on
       `{ userId: 1, conversationId: 1, documentId: 1 }` to enforce idempotency.

   3.4 **Cascade delete (new — not in original plan):**
       In `src/services/ConversationService.ts`, in the method that deletes a conversation,
       add a call to delete all `ChatAttachmentBinding` documents matching that `conversationId`.
       This prevents orphaned binding records accumulating in MongoDB.

4. Phase 4 — Hybrid retrieval orchestration in chat.
   4.1 Extend `PineconeIndexService.queryTopK()` to accept an optional metadata filter.
       Current signature: `queryTopK({ vector, topK, namespace? })`
       New signature: `queryTopK({ vector, topK, namespace?, filter? })`
       Where `filter` is `Record<string, unknown> | undefined`.
       For scoped retrieval, pass: `filter: { documentId: { $in: boundDocumentIds } }`.
       The Pinecone SDK's `index.query()` already accepts a `filter` field — just pass it through.

   4.2 Extend `RetrieveContextParams` in `src/rag/retrieval/types/retrieval.types.ts`:
       Add `boundDocumentIds?: string[]`.
       In `RagRetrievalService.retrieveContext()`, if `boundDocumentIds` is provided and non-empty,
       pass `filter: { documentId: { $in: boundDocumentIds } }` to `pineconeIndexService.queryTopK()`.
       Otherwise run the existing unfiltered global query.
       Return the resulting `retrievalMode` from `retrieveContext()` as part of `RetrieveContextResult`.
       Update `RetrieveContextResult` to include `retrievalMode: 'bound' | 'global-fallback' | 'global-only'`.

   4.3 In `ChatService.processChatTask()`:
       - If `GLOBAL_CONFIG.enableFileAwareChat` is true AND `conversationId` is present:
         call `attachmentContextService.resolveBoundDocumentIds(userId, conversationId)`.
       - Pass resolved `boundDocumentIds` to `ragRetrievalService.retrieveContext()`.

   4.4 Retrieval fallback policy — **more precise than original plan**:
       Two-attempt strategy:

       **Attempt 1 (bound):** Query Pinecone filtered to `boundDocumentIds`.
       Use a higher `minScore` threshold: `MIN_BOUND_SCORE = 0.3` (not the default 0.0).
       Rationale: if bound docs return chunks scoring below 0.3, they are likely noise and the
       fallback should trigger. "0 chunks after score filtering" is the fallback condition.

       **Attempt 2 (global fallback):** If attempt 1 returns 0 useful chunks, re-run
       `ragRetrievalService.retrieveContext()` without any filter (existing global path).
       Set `retrievalMode = 'global-fallback'` in the result.

       **No bound docs:** If `boundDocumentIds` is empty, skip attempt 1 entirely.
       Set `retrievalMode = 'global-only'`.

       **Both attempts use the same safe no-context behavior:** if global retrieval also returns
       0 chunks, `buildContextText()` returns empty string and LLM receives "(no relevant context found)".

   4.5 Persist `retrievalMode` in `IChatRetrievalMeta` (already planned in Phase 1.3).
       The `update("done", ...)` call in `processChatTask` should include
       `retrievalMeta: { topK, usedChunks, retrievalMode }`.

5. Phase 5 — Test UI and API integration (parallel with phases 3/4 after phase 2.3 is stable).
   5.1 Update Upload UI to expose three user actions:
       - Upload File (PDF or image from file system)
       - Upload Image (gallery picker)
       - Take Photo (camera capture)
       All three call the same `POST /api/rag/documents/upload` endpoint with a file payload.
       Internally no distinction — the backend routes by MIME type.

   5.2 Add attachment bind/list/unbind actions in chat UI (conversation-aware).
       Include a bound-files indicator so users can see which documents are active for the
       current conversation. Bind/unbind calls go to the Phase 3 endpoints.

   5.3 Keep chat send/status APIs unchanged — only the new context attachment APIs are added.

6. Phase 6 — Validation and rollout.
   6.1 After every controller change, run `pnpm tsoa` to regenerate `src/generated/routes.ts`
       and `src/generated/swagger.json`. Do not batch this to the end of the phase.

   6.2 Add/adjust unit tests per layer:
       - Middleware: rejects unsupported MIME types, enforces size limit.
       - `VisionService.extractTextFromImage`: returns text, throws on empty result.
       - `AttachmentContextService`: bind idempotency, ownership rejection, cascade resolve.
       - `RagRetrievalService`: scoped filter passed through, fallback triggered at score threshold.

   6.3 Integration test scenarios (in priority order):
       (a) PDF upload → ingest → bind to conversation → chat uses bound doc → mode=`bound`.
       (b) Image upload → ingest → bind → chat uses bound doc → mode=`bound`.
       (c) Conversation with no bindings → chat uses global retrieval → mode=`global-only`.
       (d) Bound docs exist but all chunks score < 0.3 → fallback to global → mode=`global-fallback`.
       (e) Duplicate upload (same content hash) → returns `isDuplicate: true`, skips re-ingestion.
       (f) Conversation delete → bindings are cleaned up from MongoDB.

   6.4 Add logging for retrieval path confirmation. In `processChatTask`, log the `retrievalMode`
       and fallback rate. This helps tune `MIN_BOUND_SCORE` (0.3) in production if needed.

---

**Dependency notes:**

- Step 1.2 (rename contracts) must happen before Step 2.3 (extraction routing uses new names).
- Step 2.3 (image extraction method) blocks Step 2.5 (empty text check).
- Step 4.1 (Pinecone filter) blocks Step 4.2 (retrieval service scoped query).
- Step 4.2 blocks Step 4.3 (ChatService integration).
- Step 3 (binding model + service) must be complete before Step 4.3 (ChatService resolves bound docs).
- Step 1.3 (retrievalMode in Chat schema) must happen before Step 4.5 (persisting it).
- Step 5.2 depends on Step 3 APIs being stable.

**Parallelizable work:**

- Step 5.1 (Upload UI unification) can start after Step 2.1 interface is confirmed.
- Step 5.2 (Chat UI binding) can run in parallel with Step 3 backend work.
- Step 6.2 unit tests can be written per layer in parallel as each layer is completed.

---

**Relevant files**

**Modified files:**
- `src/settings.ts` — Phase 1.1 DONE. No further changes needed.
- `src/rag/ingestion/types/rag.types.ts` — rename `IngestPdfCommand/Result` → `IngestDocumentCommand/Result`.
- `src/rag/ingestion/services/RagIngestionService.ts` — rename `ingestPdf()` → `ingestDocument()`, add MIME-type routing to extractor strategy.
- `src/controllers/rag/RagIngestionController.ts` — call `ingestDocument()`, keep endpoint path stable.
- `src/middleware/uploadPdfMiddleware.ts` — verify already accepts all types (no code changes expected).
- `src/app.ts` — no changes expected; confirm multer integration unchanged.
- `src/services/VisionService.ts` — add `extractTextFromImage(imageBase64, mimeType): Promise<string>` method.
- `src/rag/ingestion/services/PineconeIndexService.ts` — add optional `filter` field to `QueryTopKParams` and pass it to `index.query()`.
- `src/rag/retrieval/types/retrieval.types.ts` — add `boundDocumentIds?: string[]` to `RetrieveContextParams`; add `retrievalMode` to `RetrieveContextResult`.
- `src/rag/retrieval/services/RagRetrievalService.ts` — implement scoped filter and return `retrievalMode`.
- `src/models/Chat.ts` — add `retrievalMode: 'bound' | 'global-fallback' | 'global-only'` to `IChatRetrievalMeta` interface and `ChatRetrievalMetaSchema`.
- `src/services/ChatService.ts` — integrate `GLOBAL_CONFIG.enableFileAwareChat` flag, `AttachmentContextService.resolveBoundDocumentIds()`, hybrid retrieval policy, and persist `retrievalMode`.
- `src/services/ConversationService.ts` — add cascade delete of `ChatAttachmentBinding` records on conversation delete.

**New files:**
- `src/models/ChatAttachmentBinding.ts` — Mongoose model for conversation-scoped document bindings.
- `src/services/AttachmentContextService.ts` — bind/list/unbind/resolve service.
- `src/controllers/ChatContextController.ts` — TSOA controller for attachment binding API endpoints.
- `src/rag/retrieval/types/attachment.types.ts` — DTOs for bind/list/unbind request/response (optional, can go in retrieval.types.ts).

**Test UI files:**
- `tools/test-ui/src/components/Upload/UploadPanel.tsx` — three-option UX, all calling unified upload API.
- `tools/test-ui/src/api/uploadApi.ts` — rename `uploadPdf` → `uploadDocument`, keep alias if needed.
- `tools/test-ui/src/components/Chat/MessageInput.tsx` — bind/list/unbind hooks.

---

**Verification**

1. API contract checks
   1.1 `POST /api/rag/documents/upload` accepts PDF and image files, rejects unsupported MIME types with 400.
   1.2 Image upload with < 50 chars of extracted text returns 500 with "insufficient text" message.
   1.3 `POST/GET/DELETE /api/chat/context/attachments` enforce JWT user ownership, return deterministic errors.
   1.4 Binding a non-existent or non-processed documentId returns 404/400 with clear message.

2. Retrieval behavior checks
   2.1 With bound docs scoring ≥ 0.3, response `sources` come from bound docs and `retrievalMode = 'bound'`.
   2.2 With bound docs but all scores < 0.3, system retries global retrieval and `retrievalMode = 'global-fallback'`.
   2.3 Without bound docs, system uses global retrieval and `retrievalMode = 'global-only'`.

3. Processing checks
   3.1 PDF and image ingestion both produce `documentId`, correct status transitions, and `chunkCount > 0`.
   3.2 Duplicate upload (same file content) returns `isDuplicate: true` and skips re-ingestion for both types.
   3.3 Image with no readable text returns ingestion error (not a silent empty document).

4. Data integrity checks (new)
   4.1 Deleting a conversation also deletes all its `ChatAttachmentBinding` records.
   4.2 Unbinding a document does NOT remove its vectors from Pinecone or its `RagDocument` record.
   4.3 Binding the same document twice returns the same result (idempotent, no duplicate records).

5. UI checks
   5.1 File picker, image picker, and camera capture all upload successfully through unified endpoint.
   5.2 User can bind/unbind document to current conversation and bound-files indicator updates.

6. Regression checks
   6.1 Existing `POST /chat` and `GET /chat/status/:taskId` remain backward compatible.
   6.2 Global retrieval behavior (no bindings) is identical to pre-feature behavior.
   6.3 All existing ingestion tests pass with renamed `ingestDocument()` and renamed types.

---

**Decisions**

- Included scope: PDF + image ingestion, camera unified as image upload, hybrid retrieval (bound-first then global fallback), conversation-level attachment binding.
- Excluded from v1: DOCX/TXT ingestion, async queue worker migration, advanced multi-intent router, re-index scheduler.
- API shape: single upload endpoint for all document sources to avoid duplicate backend paths and simplify clients.
- Security: binding operations and attachment resolution are scoped by authenticated `userId` and `conversationId` ownership checks.
- Unbind behavior: removing a binding does NOT delete the underlying document or vectors. Documents exist independently in the global corpus. Unbinding only removes the conversation-scoped pointer.
- Feature flag: `GLOBAL_CONFIG.enableFileAwareChat` defaults to `false` in production for safe rollout. Flip to `true` after integration tests pass.
- Fallback threshold: use `MIN_BOUND_SCORE = 0.3` (not the existing default 0.0) for bound retrieval. Chunks scoring below this are noise and should trigger global fallback.

---

**Further Considerations**

1. OCR backend choice for images: Option A (current VisionService LLM path) is recommended for v1 for speed of delivery. Monitor ingestion cost and latency per image. If cost is high, migrate to Option B (deterministic OCR engine like Tesseract) in v2 — it is cheaper and faster for printed text.
2. `MIN_BOUND_SCORE = 0.3` is a starting recommendation. Observe actual score distributions in logs after rollout and adjust up/down. This value should eventually be a config constant alongside `DEFAULT_MIN_SCORE`.
3. Image size policy: 10MB is fine for v1. If large images cause vision LLM timeouts, add a per-MIME-type size cap (e.g. 5MB for images) independently of the PDF cap. This is a one-line change in the middleware.
4. Future: consider storing `retrievalMode` stats in an analytics collection to measure fallback rate over time and detect when the global corpus needs more documents.
