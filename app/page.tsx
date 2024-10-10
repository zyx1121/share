'use client'

import { useState, DragEvent, useCallback, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { FiUpload, FiDownload } from 'react-icons/fi';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast"

export default function UploadPage() {
  const [, setFile] = useState<File | null>(null);
  const [uploadCode, setUploadCode] = useState<string>('');
  const [, setUploadProgress] = useState<number>(0);
  const [downloadCode, setDownloadCode] = useState<string>('');
  const [, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState<boolean>(false);
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const downloadInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

  const [isDownloading, setIsDownloading] = useState(false);

  const uploadChunk = useCallback(async (file: File, chunkIndex: number, chunkData: Blob) => {
    const formData = new FormData();
    formData.append('chunk', chunkData);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('fileName', file.name);

    try {
      const response = await fetch('/api/upload-chunk', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', errorText);
        throw new Error(`上傳分塊 ${chunkIndex + 1} 失敗: ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Error uploading chunk:', error);
      throw error;
    }
  }, []);

  const handleUpload = useCallback(async (fileToUpload: File) => {
    if (!fileToUpload) {
      toast({
        variant: "destructive",
        title: "錯誤",
        description: "請先選擇一個檔案。",
        duration: 5000,
      });
      return;
    }
    setIsUploading(true);
    setUploadCode('');
    setUploadProgress(0);

    const uploadToast = toast({
      title: "上傳開始",
      description: "準備上傳文件...",
      duration: Infinity,
    });

    const totalChunks = Math.ceil(fileToUpload.size / CHUNK_SIZE);
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, fileToUpload.size);
      const chunkData = fileToUpload.slice(chunkStart, chunkEnd);

      try {
        await uploadChunk(fileToUpload, i, chunkData);
        const progress = ((i + 1) / totalChunks) * 100;
        setUploadProgress(progress);

        // 更新 toast 顯示上傳進度
        toast({
          id: uploadToast.id,
          title: "上傳中",
          description: `上傳進度：${progress.toFixed(2)}%`,
          duration: Infinity,
        });
      } catch (error) {
        console.error('Error uploading chunk:', error);
        toast({
          id: uploadToast.id,
          variant: "destructive",
          title: "上傳失敗",
          description: error instanceof Error ? error.message : "上傳過程中發生未知錯誤，請稍後再試",
          duration: 5000,
        });
        setIsUploading(false);
        return;
      }
    }

    // 所有分塊上傳完成後，請求伺服器合併檔案
    try {
      const response = await fetch(`/api/merge-file?fileName=${fileToUpload.name}`, {
        method: 'POST',
      });
      const data = await response.json();
      setUploadCode(data.code);
      setIsUploading(false);
      setShowSuccessDialog(true);

      // 更新 toast 顯示上傳完成
      toast({
        id: uploadToast.id,
        title: "上傳完成",
        description: "文件已成功上傳",
        duration: 5000,
      });
    } catch (error) {
      console.error('Error merging file:', error);
      toast({
        id: uploadToast.id,
        variant: "destructive",
        title: "上傳失敗",
        description: "合併文件時發生錯誤，請稍後再試",
        duration: 5000,
      });
      setIsUploading(false);
    }
  }, [toast, setIsUploading, setUploadCode, setUploadProgress, uploadChunk, CHUNK_SIZE]);

  const handleFileChange = useCallback((selectedFile: File | undefined) => {
    if (!selectedFile) {
      return;
    }

    if (selectedFile.webkitRelativePath) {
      toast({
        variant: "destructive",
        title: "錯誤",
        description: "請選擇檔案，不要選擇資料夾。",
        duration: 5000,
      });
      return;
    }

    if (selectedFile.size === 0) {
      toast({
        variant: "destructive",
        title: "錯誤",
        description: "請不要上傳空檔案。",
        duration: 5000,
      });
      return;
    }

    setFile(selectedFile);
    setUploadCode('');
    setUploadProgress(0);
    handleUpload(selectedFile);
  }, [toast, setFile, setUploadCode, setUploadProgress, handleUpload]);

  useEffect(() => {
    const handleGlobalDrop = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
        handleFileChange(event.dataTransfer.files[0]);
      }
    };

    const handleGlobalDragOver = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(true);
    };

    const handleGlobalDragLeave = (event: DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
    };

    document.addEventListener('drop', handleGlobalDrop as unknown as EventListener);
    document.addEventListener('dragover', handleGlobalDragOver as unknown as EventListener);
    document.addEventListener('dragleave', handleGlobalDragLeave as unknown as EventListener);

    return () => {
      document.removeEventListener('drop', handleGlobalDrop as unknown as EventListener);
      document.removeEventListener('dragover', handleGlobalDragOver as unknown as EventListener);
      document.removeEventListener('dragleave', handleGlobalDragLeave as unknown as EventListener);
    };
  }, [handleFileChange]);

  useEffect(() => {
    if (isDownloadDialogOpen && downloadInputRef.current) {
      downloadInputRef.current.focus();
    }
  }, [isDownloadDialogOpen]);

  useEffect(() => {
    const cleanup = async () => {
      try {
        const response = await fetch('/api/cleanup', { method: 'GET' });
        const data = await response.json();
        console.log(data.message);
      } catch (error) {
        console.error('執行清理任務時出錯:', error);
      }
    };

    cleanup();
  }, []);

  const handleDownload = async () => {
    if (!downloadCode) {
      toast({
        variant: "destructive",
        title: "錯誤",
        description: "請輸入下載代碼",
        duration: 5000,
      });
      return;
    }

    setIsDownloading(true);

    // 立即顯示準備下載的通知
    const downloadToast = toast({
      title: "準備下載",
      description: "正在準備您的文件...",
      duration: Infinity, // 保持通知到我們更新或關閉它
    });

    try {
      const response = await fetch(`/api/download/${downloadCode}`);
      if (response.ok) {
        // 更新通知為下載開始
        toast({
          id: downloadToast.id,
          title: "下載開始",
          description: "文件準備中，請稍候...",
          duration: 5000,
        });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        let fileName = 'downloaded_file';
        if (contentDisposition) {
          const fileNameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/i);
          if (fileNameMatch) {
            fileName = decodeURIComponent(fileNameMatch[1]);
          }
        }
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        setIsDownloadDialogOpen(false);

        // 更新通知為下載完成
        toast({
          id: downloadToast.id,
          title: "下載完成",
          description: "文件已成功下載",
          duration: 5000,
        });
      } else {
        // 更新知為下載失敗
        toast({
          id: downloadToast.id,
          variant: "destructive",
          title: "下載失敗",
          description: "無效的下載代碼或文件不存在",
          duration: 5000,
        });
      }
    } catch (error) {
      console.error('下載錯誤:', error);
      // 更新通知為下載錯誤
      toast({
        id: downloadToast.id,
        variant: "destructive",
        title: "下載錯誤",
        description: "下載過程中發生錯誤，請稍後再試",
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyAndClose = () => {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(uploadCode)
        .then(() => {
          setShowSuccessDialog(false);
          toast({
            title: "複製成功",
            description: "下載代碼已複製到剪貼板",
            duration: 3000, // 3秒後自動消失
          });
        })
        .catch(err => {
          console.error('無法複製到貼板:', err);
          toast({
            variant: "destructive",
            title: "複製失敗",
            description: "無法複製到剪貼板，請手動複製下載代碼",
            duration: 3000, // 3秒後自動消失
          });
        });
    } else {
      toast({
        variant: "destructive",
        title: "複製失敗",
        description: "您的瀏覽器不支持自動複製，請手動複製下載代碼",
        duration: 3000, // 3秒後自動消失
      });
    }
  };

  const handleOpenDownloadDialog = () => {
    setIsDownloadDialogOpen(true);
    // 使用 setTimeout 來確保在對話框完全打開後聚焦
    setTimeout(() => {
      if (downloadInputRef.current) {
        downloadInputRef.current.focus();
      }
    }, 100);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 gap-8 font-mono relative">
      {isDragging && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <p className="text-white text-2xl">放開以上傳文件</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-8">
        <div
          className="flex flex-col items-center justify-center w-64 h-64 border-2 border-dashed rounded-lg cursor-pointer"
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <input
            id="fileInput"
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFileChange(file);
              }
            }}
            className="hidden"
            aria-label="選擇要上傳的文件"
          />
          <FiUpload size={64} />
        </div>

        <AlertDialog open={isDownloadDialogOpen} onOpenChange={setIsDownloadDialogOpen}>
          <AlertDialogTrigger asChild>
            <div
              className="flex flex-col items-center justify-center w-64 h-64 border-2 border-dashed rounded-lg cursor-pointer"
              onClick={handleOpenDownloadDialog}
            >
              <FiDownload size={64} />
            </div>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>輸入下載代碼</AlertDialogTitle>
            </AlertDialogHeader>
            <div className="flex items-center space-x-2">
              <Input
                ref={downloadInputRef}
                type="text"
                value={downloadCode}
                onChange={(e) => setDownloadCode(e.target.value)}
                placeholder="輸入8位下載代碼"
                aria-label="輸入下載代碼"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? (
                  <>
                    <span className="loading loading-spinner loading-sm mr-2"></span>
                    下載中...
                  </>
                ) : (
                  '下載'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <AlertDialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>上傳成功</AlertDialogTitle>
            <AlertDialogDescription>
              您的文件已成功上傳。下載代碼：{uploadCode}（有效期1小時）
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleCopyAndClose}>確認並複製</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}