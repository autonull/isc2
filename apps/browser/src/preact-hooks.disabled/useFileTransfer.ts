/**
 * File Transfer Hook
 *
 * Provides React hook for file upload/download with progress tracking
 */

import { useState, useCallback, useEffect } from 'preact/hooks';
import type { Libp2p } from 'libp2p';
import type { FileInfo, TransferProgress } from '../services/enhancedFileTransfer.js';
import { getEnhancedFileTransferService } from '../services/enhancedFileTransfer.js';

interface UseFileTransferReturn {
  // State
  stagedFiles: FileInfo[];
  activeTransfers: TransferProgress[];
  isUploading: boolean;
  isDownloading: boolean;

  // Actions
  stageFile: (file: File) => Promise<FileInfo>;
  uploadFile: (peerId: string, fileHash: string) => Promise<void>;
  downloadFile: (peerId: string, fileHash: string, fileName?: string) => Promise<Blob>;
  cancelTransfer: (transferId: string) => void;
  deleteFile: (fileHash: string) => Promise<void>;
  getFileInfo: (fileHash: string) => FileInfo | null;

  // Progress for specific transfer
  getTransferProgress: (fileId: string) => TransferProgress | undefined;
}

export function useFileTransfer(node: Libp2p | null): UseFileTransferReturn {
  const [service, setService] = useState<any>(null);
  const [stagedFiles, setStagedFiles] = useState<FileInfo[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<TransferProgress[]>([]);
  const [transfersMap, setTransfersMap] = useState<Map<string, TransferProgress>>(new Map());

  // Initialize service when node is available
  useEffect(() => {
    if (node) {
      const fileService = getEnhancedFileTransferService(node);
      setService(fileService);

      // Load staged files
      const files = fileService.listStagedFiles();
      setStagedFiles(files);

      // Subscribe to progress updates
      const unsubscribe = fileService.onTransferProgress((progress: TransferProgress) => {
        setTransfersMap(prev => {
          const next = new Map(prev);
          if (progress.status === 'completed' || progress.status === 'error' || progress.status === 'cancelled') {
            next.delete(progress.fileId);
          } else {
            next.set(progress.fileId, progress);
          }
          return next;
        });

        setActiveTransfers(prev => {
          const filtered = prev.filter(t => t.fileId !== progress.fileId);
          if (progress.status !== 'completed' && progress.status !== 'error' && progress.status !== 'cancelled') {
            filtered.push(progress);
          }
          return filtered;
        });
      });

      return unsubscribe;
    }
  }, [node]);

  const stageFile = useCallback(async (file: File): Promise<FileInfo> => {
    if (!service) throw new Error('File transfer service not initialized');

    const fileInfo = await service.stageFile(file);
    setStagedFiles(prev => [...prev, fileInfo]);
    return fileInfo;
  }, [service]);

  const uploadFile = useCallback(async (peerId: string, fileHash: string): Promise<void> => {
    if (!service) throw new Error('File transfer service not initialized');

    await service.uploadFile(peerId, fileHash);
  }, [service]);

  const downloadFile = useCallback(async (peerId: string, fileHash: string, fileName?: string): Promise<Blob> => {
    if (!service) throw new Error('File transfer service not initialized');

    const result = await service.downloadFile(peerId, fileHash, fileName);
    
    // Add downloaded file info to staged files
    setStagedFiles(prev => [...prev, result.info]);
    
    return result.blob;
  }, [service]);

  const cancelTransfer = useCallback((transferId: string) => {
    if (!service) return;
    service.cancelTransfer(transferId);
  }, [service]);

  const deleteFile = useCallback(async (fileHash: string): Promise<void> => {
    if (!service) return;
    await service.deleteFile(fileHash);
    setStagedFiles(prev => prev.filter(f => f.hash !== fileHash));
  }, [service]);

  const getFileInfo = useCallback((fileHash: string): FileInfo | null => {
    if (!service) return null;
    return service.getFileInfo(fileHash);
  }, [service]);

  const getTransferProgress = useCallback((fileId: string): TransferProgress | undefined => {
    return transfersMap.get(fileId);
  }, [transfersMap]);

  return {
    stagedFiles,
    activeTransfers,
    isUploading: activeTransfers.some(t => t.status === 'uploading'),
    isDownloading: activeTransfers.some(t => t.status === 'downloading'),
    stageFile,
    uploadFile,
    downloadFile,
    cancelTransfer,
    deleteFile,
    getFileInfo,
    getTransferProgress,
  };
}
