import crypto from 'crypto';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

// 生成 6 位數字代碼的函數
function generateSixDigitCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// 更新代碼映射的函數
async function updateCodeMap(code: string, fileName: string) {
    const codeMapPath = path.join(process.cwd(), 'uploads', 'code_map.json');
    let codeMap: Record<string, { fileName: string, createdAt: number }> = {};
    try {
        const data = await fs.readFile(codeMapPath, 'utf-8');
        codeMap = JSON.parse(data);
    } catch (error) {
        // 如果文件不存在，我們將創建一個新的
    }
    codeMap[code] = { fileName, createdAt: Date.now() };
    await fs.writeFile(codeMapPath, JSON.stringify(codeMap, null, 2));
}

export async function POST(req: NextRequest) {
    const fileName = req.nextUrl.searchParams.get('fileName');
    if (!fileName) {
        return NextResponse.json({ error: '缺少文件名' }, { status: 400 });
    }

    const chunkDir = path.join(process.cwd(), 'uploads');

    // 確保 uploads 目錄存在
    try {
        await fs.access(chunkDir);
    } catch (error) {
        await fs.mkdir(chunkDir, { recursive: true });
    }

    const chunkFiles = await fs.readdir(chunkDir, { withFileTypes: true });
    const fileChunks = chunkFiles
        .filter(dirent => dirent.isFile() && dirent.name.startsWith(`${fileName}_chunk-`))
        .map(dirent => dirent.name);

    // 檢查是否有分塊文件
    if (fileChunks.length === 0) {
        return NextResponse.json({ error: '沒有找到文件分塊，可能是空文件或資料夾' }, { status: 400 });
    }

    // 排序文件分塊
    fileChunks.sort((a, b) => {
        const aIndex = parseInt(a.split('-').pop() || '0', 10);
        const bIndex = parseInt(b.split('-').pop() || '0', 10);
        return aIndex - bIndex;
    });

    try {
        // 合併文件分塊
        const finalFilePath = path.join(chunkDir, fileName);
        await fs.writeFile(finalFilePath, '');

        for (const chunkFile of fileChunks) {
            const chunkPath = path.join(chunkDir, chunkFile);
            const chunkData = await fs.readFile(chunkPath);
            await fs.appendFile(finalFilePath, chunkData);
            await fs.unlink(chunkPath); // 刪除已處理的分塊
        }

        // 檢查最終文件大小
        const stats = await fs.stat(finalFilePath);
        if (stats.size === 0) {
            await fs.unlink(finalFilePath); // 刪除空文件
            return NextResponse.json({ error: '合併後的文件為空' }, { status: 400 });
        }

        // 生成下載代碼
        const downloadCode = generateDownloadCode();
        await updateCodeMap(downloadCode, fileName);
        return NextResponse.json({ code: downloadCode });
    } catch (error) {
        console.error('合併文件時出錯:', error);
        return NextResponse.json({ error: '合併文件時出錯' }, { status: 500 });
    }
}

// 生成下載代碼的函數
function generateDownloadCode(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(4).toString('base64url');
    return `${timestamp}${randomPart}`.slice(0, 8);
}