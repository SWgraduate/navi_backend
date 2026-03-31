/**
 * 로컬 전용 관리자 인제스트 스크립트
 * 사용법: pnpm ingest
 *
 * - .md 파일을 DATA_DIR에서 읽어 corpus namespace에 인제스트
 * - 내용이 변경된 파일만 기존 벡터 삭제 후 재인제스트
 * - 변경 없는 파일은 스킵
 */

import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { MONGO_URI } from 'src/settings';
import { RagIngestionService } from 'src/rag/ingestion/services/RagIngestionService';
import { PineconeIndexService } from 'src/rag/ingestion/services/PineconeIndexService';
import { TextNormalizationService } from 'src/rag/ingestion/services/TextNormalizationService';
import { ContentHashService } from 'src/rag/ingestion/services/ContentHashService';
import { RagDocumentModel } from 'src/rag/ingestion/models/RagDocument';

const DATA_DIR = '/Users/baysaa/projects/navi-data-collection';
const NAMESPACE = 'corpus';

const ragIngestionService = new RagIngestionService();
const pineconeIndexService = new PineconeIndexService();
const normalizationService = new TextNormalizationService();
const hashService = new ContentHashService();

async function ingestFile(fileName: string, buffer: Buffer): Promise<void> {
    const rawText = buffer.toString('utf-8');
    const normalizedText = normalizationService.normalize(rawText);
    const newHash = hashService.createHash(normalizedText);

    const existing = await RagDocumentModel.findOne({ originalFileName: fileName });

    if (existing) {
        if (existing.contentHash === newHash) {
            console.log(`  → 스킵 (변경 없음)`);
            return;
        }

        console.log(`  → 변경 감지 - 기존 벡터 삭제 중...`);
        await pineconeIndexService.deleteByDocumentId(existing._id.toString(), NAMESPACE);
        await RagDocumentModel.deleteOne({ _id: existing._id });
    }

    const result = await ragIngestionService.ingestDocument({
        fileBuffer: buffer,
        originalFileName: fileName,
        mimeType: 'text/markdown',
        fileSize: buffer.length,
        namespace: NAMESPACE,
        actor: { userId: 'admin-script', role: 'admin' },
    });

    console.log(`  → ${result.status} | chunks: ${result.chunkCount}`);
}

async function run(): Promise<void> {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB 연결 완료\n');

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.md'));
    console.log(`${files.length}개 파일 발견\n`);

    let success = 0, skipped = 0, failed = 0;

    for (const fileName of files) {
        console.log(`처리 중: ${fileName}`);
        const filePath = path.join(DATA_DIR, fileName);
        const buffer = fs.readFileSync(filePath);

        try {
            const before = await RagDocumentModel.findOne({ originalFileName: fileName });
            await ingestFile(fileName, buffer);
            const after = await RagDocumentModel.findOne({ originalFileName: fileName });

            if (before?.contentHash === after?.contentHash && before) {
                skipped++;
            } else {
                success++;
            }
        } catch (error) {
            console.error(`  → 실패: ${error instanceof Error ? error.message : String(error)}`);
            failed++;
        }
    }

    console.log(`\n완료 — 성공: ${success} | 스킵: ${skipped} | 실패: ${failed}`);
}

run().catch(console.error).finally(() => process.exit());
