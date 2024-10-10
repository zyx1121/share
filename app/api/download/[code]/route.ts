import { createReadStream, promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 讀取代碼映射的函數
async function readCodeMap(): Promise<Record<string, { fileName: string, createdAt: number }>> {
    const codeMapPath = path.join(process.cwd(), 'uploads', 'code_map.json');
    try {
        const data = await fs.readFile(codeMapPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
    const { code } = params;
    const codeMap = await readCodeMap();
    const fileInfo = codeMap[code];

    if (!fileInfo) {
        return NextResponse.json({ error: '找不到文件' }, { status: 404 });
    }

    if (Date.now() - fileInfo.createdAt > 60 * 60 * 1000) {
        return NextResponse.json({ error: '下載代碼已過期' }, { status: 410 });
    }

    const filePath = path.join(process.cwd(), 'uploads', fileInfo.fileName);

    try {
        const fileStats = await fs.stat(filePath);
        const fileStream = createReadStream(filePath);

        return new NextResponse(fileStream as any, {
            headers: {
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileInfo.fileName)}`,
                'Content-Type': 'application/octet-stream',
                'Content-Length': fileStats.size.toString(),
            },
        });
    } catch (error) {
        console.error('讀取文件時出錯:', error);
        return NextResponse.json({ error: '讀取文件時出錯' }, { status: 500 });
    }
}
