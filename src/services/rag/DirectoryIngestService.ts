import fs from 'fs';
import path from 'path';
import { FileService } from './FileService';
import { VectorStoreService } from './VectorStoreService';
import { logger } from 'src/utils/log';

export class DirectoryIngestService {
    private fileService = FileService.getInstance();
    private vectorStoreService = VectorStoreService.getInstance();
    public async ingestDirectory(directoryPath: string): Promise<void> {
        if (!fs.existsSync(directoryPath)) {
            logger.e(`Directory not found: ${directoryPath}`);
            return;
        }
        const files = fs.readdirSync(directoryPath);
        logger.i(`Found ${files.length} files in ${directoryPath}`);
        for (const file of files) {
            const fullPath = path.join(directoryPath, file);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                try {
                    logger.i(`Processing ${file}...`);
                    const text = await this.fileService.extractTextFromFile(fullPath);

                    if (!text || text.trim().length === 0) {
                        logger.w(`Skipped empty file: ${file}`);
                        continue;
                    }
                    await this.vectorStoreService.processDocument(text, {
                        source: file,
                        path: fullPath
                    });

                    logger.s(`Done: ${file}`);
                } catch (error) {
                    logger.e(`Failed to process ${file}:`, error);
                }
            }
        }
    }
}