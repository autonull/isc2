/**
 * Space View Component
 *
 * 2D semantic map visualization showing peers in "thought space".
 * Closer peers = more semantically similar.
 *
 * Features:
 * - Interactive pan/zoom
 * - Peer hover details
 * - Cluster highlighting
 * - Self position indicator
 * - Ghost peer rendering
 */

import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { SpaceViewService, ProjectedPeer, Cluster } from '../services/spaceView.js';

interface SpaceViewProps {
  service: SpaceViewService;
  onPeerClick?: (peerId: string) => void;
  height?: number;
}

export function SpaceView({ service, onPeerClick, height = 500 }: SpaceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredPeer, setHoveredPeer] = useState<ProjectedPeer | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<ProjectedPeer | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  
  // View state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Subscribe to service updates
  useEffect(() => {
    const unsubscribe = service.onUpdate((state) => {
      setClusters(state.clusters);
      renderCanvas(state.peers, state.clusters);
    });

    return unsubscribe;
  }, [service]);

  // Render canvas
  const renderCanvas = useCallback((peers: ProjectedPeer[], clusters: Cluster[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height, centerX, centerY, scale, offset);

    // Draw clusters
    clusters.forEach(cluster => {
      drawCluster(ctx, cluster, centerX, centerY, scale, offset);
    });

    // Draw peers
    peers.forEach(peer => {
      drawPeer(ctx, peer, centerX, centerY, scale, offset);
    });

    // Draw hover tooltip
    if (hoveredPeer) {
      drawTooltip(ctx, hoveredPeer, width, height);
    }
  }, [hoveredPeer]);

  // Draw grid lines
  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    scale: number,
    offset: { x: number; y: number }
  ) => {
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1;

    const gridSize = 50 * scale;
    const offsetX = (centerX + offset.x) % gridSize;
    const offsetY = (centerY + offset.y) % gridSize;

    // Vertical lines
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center point
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.beginPath();
    ctx.arc(centerX + offset.x, centerY + offset.y, 4, 0, Math.PI * 2);
    ctx.fill();
  };

  // Draw cluster region
  const drawCluster = (
    ctx: CanvasRenderingContext2D,
    cluster: Cluster,
    centerX: number,
    centerY: number,
    scale: number,
    offset: { x: number; y: number }
  ) => {
    const x = centerX + offset.x + cluster.center.x * scale;
    const y = centerY + offset.y + cluster.center.y * scale;
    const radius = cluster.radius * scale;

    // Gradient fill
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, hexToRgba(cluster.color, 0.2));
    gradient.addColorStop(1, hexToRgba(cluster.color, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Cluster label
    if (cluster.peerCount > 1) {
      ctx.fillStyle = cluster.color;
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${cluster.peerCount} peers`,
        x,
        y + radius + 15
      );
    }
  };

  // Draw peer point
  const drawPeer = (
    ctx: CanvasRenderingContext2D,
    peer: ProjectedPeer,
    centerX: number,
    centerY: number,
    scale: number,
    offset: { x: number; y: number }
  ) => {
    const x = centerX + offset.x + peer.position.x * scale;
    const y = centerY + offset.y + peer.position.y * scale;

    // Check if visible
    if (x < -20 || x > ctx.canvas.width + 20 || y < -20 || y > ctx.canvas.height + 20) {
      return;
    }

    const isSelf = peer.isSelf;
    const isGhost = (peer as any).isGhost;
    const isSynthetic = (peer as any).isSynthetic;

    // Glow effect for self
    if (isSelf) {
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, 20);
      glowGradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
      glowGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Point color
    let color = isSelf ? '#3b82f6' : '#10b981';
    if (isGhost) color = '#6b7280';
    if (isSynthetic) color = '#f59e0b';

    // Opacity based on status
    let opacity = 1;
    if (isGhost) opacity = (peer as any).ghostOpacity || 0.5;
    if (!peer.online) opacity = 0.5;

    // Draw point
    ctx.fillStyle = hexToRgba(color, opacity);
    ctx.beginPath();
    ctx.arc(x, y, isSelf ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();

    // Online indicator
    if (peer.online && !isGhost) {
      ctx.fillStyle = hexToRgba(color, 0.3);
      ctx.beginPath();
      ctx.arc(x, y, isSelf ? 12 : 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Label (only for self or hovered)
    if (isSelf || hoveredPeer?.peerId === peer.peerId) {
      ctx.fillStyle = '#fff';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        peer.identity.name || peer.peerId.slice(0, 8),
        x,
        y - 12
      );
    }
  };

  // Draw tooltip
  const drawTooltip = (
    ctx: CanvasRenderingContext2D,
    peer: ProjectedPeer,
    width: number,
    height: number
  ) => {
    const padding = 10;
    const lineHeight = 20;
    const lines = [
      peer.identity.name || 'Anonymous',
      `Similarity: ${(peer.similarity * 100).toFixed(0)}%`,
      ...(peer.matchedTopics.slice(0, 3).map(t => `• ${t}`)),
    ];

    const tooltipWidth = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2;
    const tooltipHeight = lines.length * lineHeight + padding * 2;

    // Position tooltip
    let x = 10;
    let y = height - tooltipHeight - 10;

    ctx.fillStyle = 'rgba(15, 15, 26, 0.95)';
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, tooltipWidth, tooltipHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(lines[0], x + padding, y + padding + 14);

    ctx.fillStyle = '#888';
    ctx.font = '12px system-ui';
    lines.slice(1).forEach((line, i) => {
      ctx.fillText(line, x + padding, y + padding + 14 + (i + 1) * lineHeight);
    });
  };

  // Mouse handlers
  const handleMouseDown = useCallback((e: MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [offset]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Find hovered peer
    const peers = service.getState().peers;
    let found: ProjectedPeer | null = null;

    for (const peer of peers) {
      const px = centerX + offset.x + peer.position.x * scale;
      const py = centerY + offset.y + peer.position.y * scale;
      const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      
      if (dist < 15) {
        found = peer;
        break;
      }
    }

    setHoveredPeer(found);

    // Handle dragging
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [offset, scale, isDragging, dragStart, service]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(0.2, Math.min(5, prev * delta)));
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    if (hoveredPeer && !isDragging) {
      setSelectedPeer(hoveredPeer);
      onPeerClick?.(hoveredPeer.peerId);
    }
  }, [hoveredPeer, isDragging, onPeerClick]);

  // Zoom controls
  const zoomIn = useCallback(() => setScale(s => Math.min(5, s * 1.2)), []);
  const zoomOut = useCallback(() => setScale(s => Math.max(0.2, s / 1.2)), []);
  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div class="space-view-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        class="space-view-canvas"
        style={{ height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleClick}
      />

      {/* Zoom controls */}
      <div class="space-view-controls">
        <button onClick={zoomIn} title="Zoom in">+</button>
        <button onClick={zoomOut} title="Zoom out">−</button>
        <button onClick={resetView} title="Reset view">⟲</button>
      </div>

      {/* Legend */}
      <div class="space-view-legend">
        <div class="legend-item">
          <span class="legend-dot self"></span>
          <span>You</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot peer"></span>
          <span>Live peer</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot ghost"></span>
          <span>Ghost peer</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot synthetic"></span>
          <span>Demo peer</span>
        </div>
      </div>

      {/* Selected peer panel */}
      {selectedPeer && (
        <div class="space-view-panel">
          <button class="panel-close" onClick={() => setSelectedPeer(null)}>×</button>
          <h3>{selectedPeer.identity.name || 'Anonymous'}</h3>
          <p class="panel-bio">{selectedPeer.identity.bio || 'No bio'}</p>
          <div class="panel-stats">
            <div class="stat">
              <span class="stat-label">Similarity</span>
              <span class="stat-value">{(selectedPeer.similarity * 100).toFixed(0)}%</span>
            </div>
            <div class="stat">
              <span class="stat-label">Status</span>
              <span class="stat-value">{selectedPeer.online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <div class="panel-topics">
            {selectedPeer.matchedTopics.map(topic => (
              <span class="topic-tag" key={topic}>{topic}</span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .space-view-container {
          position: relative;
          width: 100%;
          background: #0f0f1a;
          border-radius: 12px;
          overflow: hidden;
        }

        .space-view-canvas {
          width: 100%;
          cursor: grab;
        }

        .space-view-canvas:active {
          cursor: grabbing;
        }

        .space-view-controls {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .space-view-controls button {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(15, 15, 26, 0.9);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #fff;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .space-view-controls button:hover {
          background: rgba(59, 130, 246, 0.2);
        }

        .space-view-legend {
          position: absolute;
          bottom: 12px;
          left: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background: rgba(15, 15, 26, 0.9);
          border-radius: 8px;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #888;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .legend-dot.self {
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
        }

        .legend-dot.peer {
          background: #10b981;
        }

        .legend-dot.ghost {
          background: #6b7280;
        }

        .legend-dot.synthetic {
          background: #f59e0b;
        }

        .space-view-panel {
          position: absolute;
          top: 12px;
          left: 12px;
          width: 280px;
          padding: 16px;
          background: rgba(15, 15, 26, 0.95);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 12px;
        }

        .panel-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: #888;
          font-size: 20px;
          cursor: pointer;
        }

        .panel-close:hover {
          color: #fff;
        }

        .space-view-panel h3 {
          margin: 0 0 8px;
          color: #fff;
          font-size: 16px;
        }

        .panel-bio {
          color: #888;
          font-size: 13px;
          margin: 0 0 16px;
          line-height: 1.5;
        }

        .panel-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 14px;
          color: #fff;
          font-weight: 600;
        }

        .panel-topics {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .topic-tag {
          padding: 4px 8px;
          background: rgba(59, 130, 246, 0.2);
          border-radius: 4px;
          font-size: 11px;
          color: #60a5fa;
        }
      `}</style>
    </div>
  );
}

// Helper function
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
