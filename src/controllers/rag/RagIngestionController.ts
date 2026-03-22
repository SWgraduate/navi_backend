import { 
    Controller,
    FormField,
    Post, 
    Route,
    Tags,
    UploadedFile,
} from "tsoa";  

import { IngestDocumentResult } from "../../rag/ingestion/types/rag.types";
import { RagIngestionService } from "../../rag/ingestion/services/RagIngestionService";

@Route("rag/documents")
@Tags("RAG")
export class RagIngestionController extends Controller {
    private readonly ragIngestionService = new RagIngestionService();

    /**
     * PDF 문서를 업로드하고 RAG(Retrieval-Augmented Generation) 파이프라인으로 처리합니다.
     * 업로드된 PDF는 텍스트 추출 → 청킹(chunking) → 임베딩(embedding) → 벡터 DB 저장 순서로 인제스트됩니다.
     * 동일한 내용의 문서가 이미 존재할 경우 중복으로 처리되어 200을 반환하고,
     * 신규 문서는 성공적으로 저장 완료 시 201을 반환합니다.
     * @param file 업로드할 PDF 파일 (`multipart/form-data` 형식)
     * @param userId 문서를 업로드하는 사용자의 고유 ID
     * @param role 업로더의 권한 역할 (`user` 또는 `admin`, 기본값: `user`)
     */
    @Post("/upload")
    public async uploadPdf(
        @UploadedFile() file: Express.Multer.File,
        @FormField() userId: string,
        @FormField() role: "user" | "admin" = "user"
    ): Promise<IngestDocumentResult> {
        if (!file) {
            this.setStatus(400);
            throw new Error("No PDF file uploaded");
        }

        const result = await this.ragIngestionService.ingestPdf({
            fileBuffer: file.buffer,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            actor: { userId, role },
        });

        this.setStatus(result.isDuplicate ? 200 : 201);
        return result;
    }
}