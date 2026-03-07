import crypto from 'crypto';

export class DocumentHashService {
    private static instance: DocumentHashService;

    private constructor() {}

    public static getInstance(): DocumentHashService {
        if (!DocumentHashService.instance){
            DocumentHashService.instance = new DocumentHashService();        
        }
        return DocumentHashService.instance;
    }

    /**
     * Normalizes text by converting to lowercase, collapsing
     * multiple spaces into one, and trimming whitespace.
     */
    public normalizeText(text: string): string {
        return text.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    public computeHash(normalizedText: string): string {
        return crypto.createHash('sha256').update(normalizedText).digest('hex');
    }

    /* Convenience method to normalize and hash in one go */
    public getDocumentHash(rawText: string): string {
        const normalized = this.normalizeText(rawText);
        return this.computeHash(normalized);
    }
}
