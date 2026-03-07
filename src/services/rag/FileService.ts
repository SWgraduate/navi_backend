import fs from 'fs';
import path from 'path';
const pdf = require('pdf-parse');

export class FileService {
    private static instance: FileService;
    private constructor() { }
    public static getInstance(): FileService {
        if (!FileService.instance) {
            FileService.instance = new FileService();
        }
        return FileService.instance;
    }
    public async extractTextFromFile(filePath: string): Promise<string> {
        const fileBuffer = fs.readFileSync(filePath);
        const extension = path.extname(filePath).toLowerCase();
        return this.extractTextFromBuffer(fileBuffer, extension);
    }
    public async extractTextFromBuffer(buffer: Buffer, extension: string): Promise<string> {
        if (extension === '.pdf') {
            const data = await pdf(buffer);
            return data.text;
        }
        else if (extension === '.txt' || extension === '.md' || extension === '.json') {
            return buffer.toString('utf-8');
        }
        else {
            throw new Error(`Unsupported file type: ${extension}`);
        }
    }
}