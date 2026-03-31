// 로컬에서만 실행되는 스크립트 

import path from 'path';
import fs from 'fs';
import { RagIngestionService } from 'src/rag/ingestion/services/RagIngestionService';

const DATA_DIR = 'Users/baysaa/projects/navi-data-collection';
const service = new RagIngestionService();

async function run(){
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.md'));

    for (const fileName of files) {
        const filePath = path.join(DATA_DIR, fileName);
        const buffer = fs.readFileSync(filePath);

        console.log(`Ingesting ${fileName}`);
        const result = await service.ingestDocument({
            fileBuffer: buffer,
            originalFileName: fileName,
            mimeType: 'text/markdown',
            fileSize: buffer.length,
            namespace: 'corpus',
            actor: { userId: 'admin-script', role: 'admin'},
        });

        console.log(`-> ${result.status} | chunks: ${result.chunkCount}`)
    }
}

run().catch(console.error).finally(() => process.exit());
