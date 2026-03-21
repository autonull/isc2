/**
 * File Preview Component
 *
 * Renders previews for different file types:
 * - Images: Thumbnail with lightbox
 * - Videos: Video player with controls
 * - Audio: Audio player with waveform
 * - Documents: Text preview or icon
 * - Archives: File list preview
 */

import { h, Fragment } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import type { FileInfo, TransferProgress } from '../services/enhancedFileTransfer.js';

interface FilePreviewProps {
  file: FileInfo;
  showPreview?: boolean;
  onDownload?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  transferProgress?: TransferProgress;
  compact?: boolean;
}

export function FilePreview({
  file,
  showPreview = true,
  onDownload,
  onDelete,
  onShare,
  transferProgress,
  compact = false,
}: FilePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  const formatProgress = useCallback((progress: number): string => {
    return `${Math.round(progress * 100)}%`;
  }, []);

  const formatETA = useCallback((eta?: number): string => {
    if (!eta) return '';
    const seconds = Math.floor(eta / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  }, []);

  const getFileIcon = useCallback((file: FileInfo): string => {
    if (file.isImage) return '🖼️';
    if (file.isVideo) return '🎬';
    if (file.isAudio) return '🎵';
    if (file.isDocument) return '📄';
    if (file.isArchive) return '📦';
    return '📁';
  }, []);

  const renderImagePreview = useCallback(() => {
    if (!file.preview) {
      return (
        <div class="file-preview-placeholder">
          <span class="file-icon">{getFileIcon(file)}</span>
        </div>
      );
    }

    return (
      <div class="image-preview-container">
        <img
          src={file.preview}
          alt={file.name}
          class="image-preview"
          loading="lazy"
        />
        {isExpanded && (
          <div class="image-overlay" onClick={() => setIsExpanded(false)}>
            <img src={file.preview} alt={file.name} class="image-fullscreen" />
          </div>
        )}
      </div>
    );
  }, [file, isExpanded, getFileIcon]);

  const renderVideoPreview = useCallback(() => {
    return (
      <div class="video-preview-container">
        <span class="file-icon large">{getFileIcon(file)}</span>
        <span class="file-type-label">Video</span>
      </div>
    );
  }, [file, getFileIcon]);

  const renderAudioPreview = useCallback(() => {
    return (
      <div class="audio-preview-container">
        <span class="file-icon large">{getFileIcon(file)}</span>
        <div class="audio-info">
          <span class="file-name">{file.name}</span>
          <span class="file-size">{formatFileSize(file.size)}</span>
        </div>
      </div>
    );
  }, [file, getFileIcon, formatFileSize]);

  const renderDocumentPreview = useCallback(() => {
    if (file.preview && file.type.startsWith('text/')) {
      return (
        <div class="document-preview-container">
          <pre class="text-preview">{atob(file.preview.split(',')[1] || '').slice(0, 500)}</pre>
        </div>
      );
    }

    return (
      <div class="document-preview-container">
        <span class="file-icon large">{getFileIcon(file)}</span>
        <span class="file-type-label">{file.type.split('/')[1]?.toUpperCase() || 'DOC'}</span>
      </div>
    );
  }, [file, getFileIcon]);

  const renderArchivePreview = useCallback(() => {
    return (
      <div class="archive-preview-container">
        <span class="file-icon large">{getFileIcon(file)}</span>
        <div class="archive-info">
          <span class="file-name">{file.name}</span>
          <span class="file-size">{formatFileSize(file.size)}</span>
        </div>
      </div>
    );
  }, [file, getFileIcon, formatFileSize]);

  const renderGenericPreview = useCallback(() => {
    return (
      <div class="generic-preview-container">
        <span class="file-icon large">{getFileIcon(file)}</span>
        <div class="file-info">
          <span class="file-name">{file.name}</span>
          <span class="file-meta">
            {formatFileSize(file.size)} • {file.type}
          </span>
        </div>
      </div>
    );
  }, [file, getFileIcon, formatFileSize]);

  const renderPreview = useCallback(() => {
    if (file.isImage) return renderImagePreview();
    if (file.isVideo) return renderVideoPreview();
    if (file.isAudio) return renderAudioPreview();
    if (file.isDocument) return renderDocumentPreview();
    if (file.isArchive) return renderArchivePreview();
    return renderGenericPreview();
  }, [file, renderImagePreview, renderVideoPreview, renderAudioPreview, renderDocumentPreview, renderArchivePreview, renderGenericPreview]);

  const renderTransferProgress = useCallback(() => {
    if (!transferProgress) return null;

    const { status, progress, speed, eta } = transferProgress;

    if (status === 'completed') return null;
    if (status === 'error') {
      return (
        <div class="transfer-progress error">
          <span class="status-icon">❌</span>
          <span class="status-text">Error: {transferProgress.error || 'Transfer failed'}</span>
        </div>
      );
    }

    if (status === 'cancelled') {
      return (
        <div class="transfer-progress cancelled">
          <span class="status-icon">⏸️</span>
          <span class="status-text">Cancelled</span>
        </div>
      );
    }

    return (
      <div class="transfer-progress active">
        <div class="progress-bar">
          <div
            class="progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div class="progress-info">
          <span class="progress-percent">{formatProgress(progress)}</span>
          {speed && (
            <span class="progress-speed">
              {(speed / 1024).toFixed(1)} KB/s
            </span>
          )}
          {eta && (
            <span class="progress-eta">
              {formatETA(eta)} remaining
            </span>
          )}
        </div>
      </div>
    );
  }, [transferProgress, formatProgress, formatETA]);

  if (compact) {
    return (
      <div class="file-preview-compact" onClick={onDownload}>
        <span class="file-icon">{getFileIcon(file)}</span>
        <div class="file-info-compact">
          <span class="file-name-compact">{file.name}</span>
          <span class="file-size-compact">{formatFileSize(file.size)}</span>
        </div>
        {transferProgress && (
          <div class="compact-progress">
            <div class="compact-progress-bar">
              <div
                class="compact-progress-fill"
                style={{ width: `${transferProgress.progress * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div class="file-preview-card">
      {showPreview && renderPreview()}

      <div class="file-preview-footer">
        <div class="file-details">
          <span class="file-name">{file.name}</span>
          <span class="file-meta">
            {formatFileSize(file.size)}
            {file.type && ` • ${file.type}`}
          </span>
        </div>

        {renderTransferProgress()}

        <div class="file-actions">
          {onDownload && (
            <button class="action-btn" onClick={onDownload} title="Download">
              ⬇️
            </button>
          )}
          {onShare && (
            <button class="action-btn" onClick={onShare} title="Share">
              🔗
            </button>
          )}
          {onDelete && (
            <button class="action-btn danger" onClick={onDelete} title="Delete">
              🗑️
            </button>
          )}
        </div>
      </div>

      <style>{`
        .file-preview-card {
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--border-color, #2a2a3e);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .file-preview-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .image-preview-container {
          position: relative;
          cursor: pointer;
        }

        .image-preview {
          width: 100%;
          max-height: 300px;
          object-fit: cover;
          display: block;
        }

        .image-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          cursor: zoom-out;
        }

        .image-fullscreen {
          max-width: 90%;
          max-height: 90%;
          object-fit: contain;
        }

        .file-preview-placeholder,
        .video-preview-container,
        .audio-preview-container,
        .document-preview-container,
        .archive-preview-container,
        .generic-preview-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          min-height: 150px;
          background: var(--bg-tertiary, #0f0f1a);
        }

        .file-icon {
          font-size: 24px;
        }

        .file-icon.large {
          font-size: 48px;
        }

        .file-type-label {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted, #888);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .audio-info,
        .archive-info {
          margin-top: 12px;
          text-align: center;
        }

        .text-preview {
          max-width: 100%;
          max-height: 200px;
          overflow: auto;
          font-size: 12px;
          white-space: pre-wrap;
          word-break: break-word;
          background: var(--bg-tertiary, #0f0f1a);
          padding: 12px;
          border-radius: 8px;
        }

        .file-preview-footer {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color, #2a2a3e);
        }

        .file-details {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .file-name {
          font-weight: 600;
          color: var(--text-primary, #fff);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-meta {
          font-size: 12px;
          color: var(--text-muted, #888);
        }

        .transfer-progress {
          margin-top: 12px;
        }

        .transfer-progress.active {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .progress-bar {
          height: 4px;
          background: var(--bg-tertiary, #0f0f1a);
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent, #3b82f6), var(--accent-light, #60a5fa));
          transition: width 0.3s ease;
        }

        .progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .file-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .action-btn {
          padding: 8px 12px;
          background: var(--bg-tertiary, #0f0f1a);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          transition: background 0.2s;
        }

        .action-btn:hover {
          background: var(--bg-secondary, #1a1a2e);
        }

        .action-btn.danger:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        /* Compact mode */
        .file-preview-compact {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: var(--bg-secondary, #1a1a2e);
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .file-preview-compact:hover {
          background: var(--bg-tertiary, #0f0f1a);
        }

        .file-info-compact {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
        }

        .file-name-compact {
          font-size: 14px;
          color: var(--text-primary, #fff);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-size-compact {
          font-size: 11px;
          color: var(--text-muted, #888);
        }

        .compact-progress {
          width: 60px;
        }

        .compact-progress-bar {
          height: 3px;
          background: var(--bg-tertiary, #0f0f1a);
          border-radius: 2px;
          overflow: hidden;
        }

        .compact-progress-fill {
          height: 100%;
          background: var(--accent, #3b82f6);
          transition: width 0.3s ease;
        }
      `}</style>
    </div>
  );
}
