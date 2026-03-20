/**
 * File Sharing Screen
 *
 * UI for managing file transfers:
 * - Upload files to peers
 * - Download files from peers
 * - View transfer progress
 * - Browse staged files
 */

import { h, Fragment } from 'preact';
import { useState, useCallback, useRef } from 'preact/hooks';
import { FilePreview } from '../components/FilePreview.js';
import type { FileInfo, TransferProgress } from '../services/enhancedFileTransfer.js';

interface FileSharingScreenProps {
  node: any; // Libp2p node
  peerId?: string;
  onClose?: () => void;
}

export function FileSharingScreen({ node, peerId, onClose }: FileSharingScreenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [uploadTarget, setUploadTarget] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock data - would be connected to useFileTransfer hook in real implementation
  const [stagedFiles, setStagedFiles] = useState<FileInfo[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<TransferProgress[]>([]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) {
      // In real implementation, would call stageFile from useFileTransfer
      console.log('File dropped:', file.name, file.size);
    }
  }, []);

  const handleFileSelect = useCallback(async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = Array.from(target.files || []);
    
    for (const file of files) {
      console.log('File selected:', file.name, file.size);
      // In real implementation, would call stageFile from useFileTransfer
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleUpload = useCallback(async (fileHash: string, targetPeerId: string) => {
    console.log('Uploading file:', fileHash, 'to peer:', targetPeerId);
    // In real implementation, would call uploadFile from useFileTransfer
  }, []);

  const handleDownload = useCallback(async (peerId: string, fileHash: string) => {
    console.log('Downloading file:', fileHash, 'from peer:', peerId);
    // In real implementation, would call downloadFile from useFileTransfer
  }, []);

  const handleCancelTransfer = useCallback((transferId: string) => {
    console.log('Cancelling transfer:', transferId);
    // In real implementation, would call cancelTransfer from useFileTransfer
  }, []);

  const handleDeleteFile = useCallback(async (fileHash: string) => {
    console.log('Deleting file:', fileHash);
    // In real implementation, would call deleteFile from useFileTransfer
    setStagedFiles(prev => prev.filter(f => f.hash !== fileHash));
  }, []);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  return (
    <div class="file-sharing-screen">
      <div class="file-sharing-header">
        <h2>📁 File Sharing</h2>
        {onClose && (
          <button class="close-btn" onClick={onClose}>✕</button>
        )}
      </div>

      {/* Upload Zone */}
      <div
        class={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <div class="upload-zone-content">
          <span class="upload-icon">📤</span>
          <p class="upload-text">
            Drag & drop files here, or <span class="upload-link">browse</span>
          </p>
          <p class="upload-hint">
            Max file size: 100MB • Supported: images, videos, audio, documents, archives
          </p>
        </div>
      </div>

      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <section class="transfers-section">
          <h3>Active Transfers</h3>
          <div class="transfers-list">
            {activeTransfers.map(transfer => (
              <div key={transfer.fileId} class="transfer-item">
                <div class="transfer-info">
                  <span class="transfer-icon">
                    {transfer.status === 'uploading' ? '📤' : '📥'}
                  </span>
                  <div class="transfer-details">
                    <span class="transfer-name">{transfer.fileName}</span>
                    <span class="transfer-status">
                      {transfer.status} • {formatFileSize(transfer.transferredBytes)} / {formatFileSize(transfer.totalBytes)}
                    </span>
                  </div>
                </div>
                <div class="transfer-progress-bar">
                  <div
                    class="transfer-progress-fill"
                    style={{ width: `${transfer.progress * 100}%` }}
                  />
                </div>
                <div class="transfer-actions">
                  {transfer.status !== 'completed' && (
                    <button
                      class="cancel-btn"
                      onClick={() => handleCancelTransfer(transfer.fileId)}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Staged Files */}
      <section class="staged-files-section">
        <h3>My Files ({stagedFiles.length})</h3>
        {stagedFiles.length === 0 ? (
          <div class="empty-state">
            <span class="empty-icon">📂</span>
            <p>No files staged yet</p>
            <p class="empty-hint">Upload files to share with peers</p>
          </div>
        ) : (
          <div class="staged-files-grid">
            {stagedFiles.map(file => (
              <FilePreview
                key={file.hash}
                file={file}
                onShare={() => {
                  setUploadTarget(peerId || '');
                  setSelectedFile(file);
                }}
                onDelete={() => handleDeleteFile(file.hash)}
                compact
              />
            ))}
          </div>
        )}
      </section>

      {/* Upload Modal */}
      {selectedFile && (
        <div class="modal-overlay" onClick={() => setSelectedFile(null)}>
          <div class="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Share File</h3>
            <FilePreview file={selectedFile} compact />
            
            <div class="upload-form">
              <label>
                Target Peer ID
                <input
                  type="text"
                  value={uploadTarget}
                  onChange={e => setUploadTarget((e.target as HTMLInputElement).value)}
                  placeholder="Enter peer ID or select from matches"
                />
              </label>
              
              <div class="modal-actions">
                <button
                  class="btn secondary"
                  onClick={() => setSelectedFile(null)}
                >
                  Cancel
                </button>
                <button
                  class="btn primary"
                  onClick={() => {
                    if (uploadTarget && selectedFile) {
                      handleUpload(selectedFile.hash, uploadTarget);
                      setSelectedFile(null);
                    }
                  }}
                >
                  Send File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .file-sharing-screen {
          padding: 20px;
          max-width: 900px;
          margin: 0 auto;
        }

        .file-sharing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .file-sharing-header h2 {
          margin: 0;
          font-size: 24px;
          color: var(--text-primary, #fff);
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted, #888);
          font-size: 20px;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: var(--bg-tertiary, #0f0f1a);
          color: var(--text-primary, #fff);
        }

        .upload-zone {
          border: 2px dashed var(--border-color, #2a2a3e);
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--bg-secondary, #1a1a2e);
        }

        .upload-zone.dragging {
          border-color: var(--accent, #3b82f6);
          background: rgba(59, 130, 246, 0.1);
        }

        .upload-zone:hover {
          border-color: var(--accent-light, #60a5fa);
        }

        .upload-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        .upload-text {
          margin: 0 0 8px;
          color: var(--text-primary, #fff);
          font-size: 16px;
        }

        .upload-link {
          color: var(--accent, #3b82f6);
          text-decoration: underline;
        }

        .upload-hint {
          margin: 0;
          color: var(--text-muted, #888);
          font-size: 13px;
        }

        .transfers-section,
        .staged-files-section {
          margin-top: 32px;
        }

        .transfers-section h3,
        .staged-files-section h3 {
          margin: 0 0 16px;
          font-size: 18px;
          color: var(--text-primary, #fff);
        }

        .transfers-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transfer-item {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transfer-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .transfer-icon {
          font-size: 24px;
        }

        .transfer-details {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .transfer-name {
          font-weight: 600;
          color: var(--text-primary, #fff);
        }

        .transfer-status {
          font-size: 12px;
          color: var(--text-muted, #888);
        }

        .transfer-progress-bar {
          height: 6px;
          background: var(--bg-tertiary, #0f0f1a);
          border-radius: 3px;
          overflow: hidden;
        }

        .transfer-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent, #3b82f6), var(--accent-light, #60a5fa));
          transition: width 0.3s ease;
        }

        .transfer-actions {
          display: flex;
          justify-content: flex-end;
        }

        .cancel-btn {
          padding: 6px 12px;
          background: var(--bg-tertiary, #0f0f1a);
          border: none;
          border-radius: 4px;
          color: var(--text-primary, #fff);
          cursor: pointer;
          font-size: 13px;
          transition: background 0.2s;
        }

        .cancel-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .staged-files-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-muted, #888);
        }

        .empty-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-state p {
          margin: 8px 0;
        }

        .empty-hint {
          font-size: 14px;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h3 {
          margin: 0 0 16px;
          color: var(--text-primary, #fff);
        }

        .upload-form {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .upload-form label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: var(--text-primary, #fff);
          font-size: 14px;
        }

        .upload-form input {
          padding: 12px;
          background: var(--bg-tertiary, #0f0f1a);
          border: 1px solid var(--border-color, #2a2a3e);
          border-radius: 6px;
          color: var(--text-primary, #fff);
          font-size: 14px;
        }

        .upload-form input:focus {
          outline: none;
          border-color: var(--accent, #3b82f6);
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn.secondary {
          background: var(--bg-tertiary, #0f0f1a);
          border: 1px solid var(--border-color, #2a2a3e);
          color: var(--text-primary, #fff);
        }

        .btn.secondary:hover {
          background: var(--bg-secondary, #1a1a2e);
        }

        .btn.primary {
          background: var(--accent, #3b82f6);
          border: none;
          color: #fff;
        }

        .btn.primary:hover {
          background: var(--accent-light, #60a5fa);
        }
      `}</style>
    </div>
  );
}
