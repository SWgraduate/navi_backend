import { DirectoryIngestService } from 'src/services/rag/DirectoryIngestService';
import dotenv from 'dotenv';
import path from 'path';
import { logger } from 'src/utils/log';

dotenv.config();
const run = async () => {
    const service = new DirectoryIngestService();
    const targetDir = path.join(process.cwd(), '/rag-document/');
    logger.i('Starting ingestion from:', targetDir);
    await service.ingestDirectory(targetDir);
    logger.s('Ingestion complete.');
};
run().catch(console.error);