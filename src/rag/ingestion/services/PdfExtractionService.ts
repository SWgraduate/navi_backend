// Parse text from pdf file

import { PDFParse } from "pdf-parse";
import { logger } from "src/utils/log";

export class PdfExtractionService {
    async extractTextFromBuffer(fileBuffer: Buffer): Promise<string> {
        try {
            if (!fileBuffer || fileBuffer.length === 0) {
                throw new Error("File buffer is empty");
            }

            logger.i(`Extracting text from PDF buffer (size: ${fileBuffer.length} bytes)`);

            const parser = new PDFParse({ data: fileBuffer });
            const result = await parser.getText();

            const text = result.text ?? "";
            logger.i(`Successfully extracted ${text.length} characters from PDF`);

            return text;
        } catch (error) {
            logger.e("PDF extraction failed", error);
            throw new Error(
                `Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}