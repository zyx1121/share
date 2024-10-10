import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(req: NextRequest) {
    const chunkDir = path.join(process.cwd(), 'uploads');

    // 確保 uploads 目錄存在
    try {
        await fs.access(chunkDir);
    } catch (error) {
        await fs.mkdir(chunkDir, { recursive: true });
    }

    const formData = await req.formData();
    const chunk = formData.get('chunk') as Blob;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const fileName = formData.get('fileName') as string;

    // 檢查 chunk 是否為空
    if (chunk.size === 0) {
        return NextResponse.json({ error: '不能上傳空的檔案分塊' }, { status: 400 });
    }

    const chunkFilePath = path.join(chunkDir, `${fileName}_chunk-${chunkIndex}`);
    const arrayBuffer = await chunk.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await fs.writeFile(chunkFilePath, buffer);

    return NextResponse.json({ message: '分塊上傳成功' });
}