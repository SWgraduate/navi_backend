// 실행 명령어: pnpm ts-node -r tsconfig-paths/register tools/extract_departments.ts
import * as fs from 'fs';
import * as path from 'path';

//경로 잡기
async function main() {
    const currentDir = __dirname;
    const dirPath = path.join(currentDir, '..', '.agents', 'outputs');
    const filePath = path.join(dirPath, 'valid_departments.json')

    //폴더 만들기
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }
        fs.writeFileSync(filePath, JSON.stringify({}, null, 2), 'utf-8')
    }
    catch (error) {
        console.log(error);
        process.exit(1);
    }
}

main();

