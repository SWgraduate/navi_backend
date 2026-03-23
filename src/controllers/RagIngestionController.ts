import {
    Controller,
    FormField,
    Post,
    Request,
    Route,
    Security,
    Tags,
    UploadedFile,
} from "tsoa";

import { GLOBAL_CONFIG } from "src/settings";
import { IngestDocumentResult } from "src/rag/ingestion/types/rag.types";
import { RagIngestionService } from "src/rag/ingestion/services/RagIngestionService";

@Route("rag/documents")
@Tags("RAG")
@Security("jwt")
export class RagIngestionController extends Controller {
    private readonly ragIngestionService = new RagIngestionService();

    /**
     * [Admin only] 문서를 전역 지식 베이스(corpus)에 업로드합니다.
     * PDF 및 이미지 파일을 지원하며, 텍스트 추출 → 청킹 → 임베딩 → 벡터 DB 저장 순서로 처리됩니다.
     * @param file 업로드할 파일 (PDF, JPEG, PNG, WebP)
     * @param role 업로더의 권한 역할 (반드시 `admin` 이어야 합니다)
     */
    @Post("/upload")
    public async uploadDocument(
        @Request() request: any,
        @UploadedFile() file: Express.Multer.File,
        @FormField() role: "user" | "admin" = "user",
    ): Promise<IngestDocumentResult> {
        if (role !== "admin") {
            this.setStatus(403);
            throw new Error("Admin access required");
        }

        if (!file) {
            this.setStatus(400);
            throw new Error("No file uploaded");
        }

        const result = await this.ragIngestionService.ingestDocument({
            fileBuffer: file.buffer,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            namespace: GLOBAL_CONFIG.pineconeCorpusNamespace,
            actor: { userId: request.user.userId, role },
        });

        this.setStatus(result.isDuplicate ? 200 : 201);
        return result;
    }
}
