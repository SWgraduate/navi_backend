import fs from 'fs';
import path from 'path';
import { FileService } from './FileService';
import { VectorStoreService } from './VectorStoreService';
import { DocumentHashService } from './DocumentHashService';
import IngestionRegistry from '../../models/IngestionRegistry';

export class DirectoryIngestService {
    private fileService = FileService.getInstance();
    private vectorStoreService = VectorStoreService.getInstance();
    private hashService = DocumentHashService.getInstance();

    public async ingestDirectory(directoryPath: string): Promise<void> {
        if (!fs.existsSync(directoryPath)) {
            console.error(`Directory not found: ${directoryPath}`);
            return;
        }
        
        const files = fs.readdirSync(directoryPath);
        console.log(`Found ${files.length} files in ${directoryPath}`);

        for (const file of files) {
            const fullPath = path.join(directoryPath, file);
            const stat = fs.statSync(fullPath);
            
            if (stat.isFile()) {
                await this.processSingleFile(file, fullPath);
            }
        }
    }

    private async processSingleFile(file: string, fullPath: string) {
        try {
            console.log(`\nProcessing ${file}`);
            const documentId = file; // ID = filename

            // 1. Extract the text
            const text = await this.fileService.extractTextFromFile(fullPath);

            if(!text || text.trim().length == 0) {
                console.log(`[SKIP] Skipped empty file: ${file}`);
                return;
            }

            // 2. Normalize text and Compute hash
            const docHash = this.hashService.getDocumentHash(text);

            // 3. Check Ingestion Registry
            const existingRecord = await IngestionRegistry.findOne({ documentId });

            // 4. Deduplication Decision
            if (existingRecord && existingRecord.docHash === docHash && existingRecord.status === 'SUCCESS') {
                console.log(`[SKIP] Document ${file} is unchanged. Skipping ingestion`);
                return;
            }
            
            console.log(`[INGEST] Document ${file} is new or updated. Proceeding with embedding.`);

            // 5. Embed and Store
            const chunkCount = await this.vectorStoreService.processDocument(
                text,
                { source: file, path: fullPath },
                documentId,
                docHash
            );

            // 6. Update Registry
            if (existingRecord) {
                existingRecord.docHash = docHash;
                existingRecord.chunkCount = chunkCount;
                existingRecord.status = 'SUCCESS';
                await existingRecord.save();
            } else {
                await IngestionRegistry.create({
                    documentId,
                    fileName: file,
                    docHash,
                    chunkCount,
                    status: 'SUCCESS'
                });
            }

            console.log(`Done: ${file}`);
        } catch (error) {
            console.log(`Failed to process ${file}:`, error);
        }
    }
}