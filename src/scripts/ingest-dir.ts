import { DirectoryIngestService } from '../services/rag/DirectoryIngestService';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config();
const run = async () => {
    const service = new DirectoryIngestService();
    const targetDir = path.join(process.cwd(), '/rag-document/'); 
    
    console.log('Starting ingestion from:', targetDir);
    await service.ingestDirectory(targetDir);
    console.log('Ingestion complete.');
};
run().catch(console.error);