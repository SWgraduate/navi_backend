// Parse text from pdf file

import { PDFParse } from "pdf-parse";

export class PdfExtractionService {
    async extractTextFromBuffer(fileBuffer: Buffer): Promise<string> {
        const parser = new PDFParse({ data: fileBuffer });
        const result = await parser.getText();
        return result.text ?? "";
    }
}