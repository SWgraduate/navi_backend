import fs from 'fs';
import path from 'path';
import { FileService } from './FileService';
import { VectorStoreService } from './VectorStoreService';
export class DirectoryIngestService {
    private fileService = FileService.getInstance();
    private vectorStoreService = VectorStoreService.getInstance();
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
                try {
                    console.log(`Processing ${file}...`);
                    const text = await this.fileService.extractTextFromFile(fullPath);
                    
                    if (!text || text.trim().length === 0) {
                        console.log(`Skipped empty file: ${file}`);
                        continue;
                    }
                    await this.vectorStoreService.processDocument(text, {
                        source: file,
                        path: fullPath
                    });
                    
                    console.log(`Done: ${file}`);
                } catch (error) {
                    console.error(`Failed to process ${file}:`, error);
                }
            }
        }
    }
}