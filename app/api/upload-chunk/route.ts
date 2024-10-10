import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 移除 Edge Runtime 配置
// export const runtime = 'edge'

export async function POST(req: NextRequest) {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as Blob;
    const chunkIndex = formData.get('chunkIndex') as string;
    const fileName = formData.get('fileName') as string;

    if (chunk.size === 0) {
        return NextResponse.json({ error: '不能上傳空的檔案分塊' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    const chunkFileName = `${fileName}_chunk-${chunkIndex}`;
    const chunkPath = path.join(uploadsDir, chunkFileName);

    try {
        // 確保上傳目錄存在
        await fs.mkdir(uploadsDir, { recursive: true });

        // 將分塊寫入文件
        const buffer = Buffer.from(await chunk.arrayBuffer());
        await fs.writeFile(chunkPath, buffer);

        return NextResponse.json({
            message: '分塊上傳成功',
            chunkIndex,
            fileName,
            size: chunk.size
        });
    } catch (error) {
        console.error('保存分塊時出錯:', error);
        return NextResponse.json({ error: '保存分塊時出錯' }, { status: 500 });
    }
}