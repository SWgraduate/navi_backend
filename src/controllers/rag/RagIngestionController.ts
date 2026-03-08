import { 
    Controller,
    FormField,
    Post, 
    Route,
    Tags,
    UploadedFile,
} from "tsoa";  

import { IngestPdfResult } from "../../modules/rag/types/rag.types";
import { RagIngestionService } from "../../modules/rag/services/RagIngestionService";

@Route("rag/documents")
@Tags("RAG")
export class RagIngestionController extends Controller {
    private readonly ragIngestionService = new RagIngestionService();

    @Post("/upload")
    public async uploadPdf(
        @UploadedFile() file: Express.Multer.File,
        @FormField() userId: string,
        @FormField() role: "user" | "admin" = "user"
    ): Promise<IngestPdfResult> {
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