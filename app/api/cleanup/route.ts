import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';

async function readCodeMap(): Promise<Record<string, { fileName: string, createdAt: number }>> {
    const codeMapPath = path.join(process.cwd(), 'uploads', 'code_map.json');
    try {
        const data = await fs.readFile(codeMapPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

export async function GET() {
    const codeMap = await readCodeMap();
    const now = Date.now();
    const expiredTime = 60 * 60 * 1000; // 1小時
    let cleanedCount = 0;

    for (const [code, fileInfo] of Object.entries(codeMap)) {
        if (now - fileInfo.createdAt > expiredTime) {
            const filePath = path.join(process.cwd(), 'uploads', fileInfo.fileName);
            try {
                await fs.unlink(filePath);
                delete codeMap[code];
                cleanedCount++;
            } catch (error) {
                console.error(`清理文件 ${fileInfo.fileName} 時出錯:`, error);
            }
        }
    }

    const codeMapPath = path.join(process.cwd(), 'uploads', 'code_map.json');
    await fs.writeFile(codeMapPath, JSON.stringify(codeMap, null, 2));

    return NextResponse.json({ message: `清理了 ${cleanedCount} 個過期文件` });
}