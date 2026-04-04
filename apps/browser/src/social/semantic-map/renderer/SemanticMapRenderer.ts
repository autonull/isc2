/* eslint-disable */
/**
 * Semantic Map Renderer
 *
 * SVG/Canvas rendering for semantic maps.
 * Decoupled from business logic.
 */

import type { Point2D } from '../types/semanticMap.ts';
import { RENDER_CONFIG, SEMANTIC_MAP_CONFIG } from '../config/semanticConfig.ts';
import { distance } from '../utils/vectorMath.ts';

interface RenderOptions {
  onPointClick?: (point: Point2D) => void;
  showLabels?: boolean;
  showConnections?: boolean;
  width?: number;
  height?: number;
}

/**
 * Render semantic map to SVG
 */
export function renderToSVG(
  points: Point2D[],
  container: HTMLElement,
  options: RenderOptions = {}
): SVGSVGElement {
  const svg = createSVGElement(container);
  const { width, height } = getDimensions(container, options);

  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `-1.2 -1.2 2.4 2.4`);

  if (options.showConnections !== false) {
    renderConnections(svg, points);
  }

  points.forEach((point) => {
    renderPoint(svg, point, options);
  });

  return svg;
}

/**
 * Create SVG element
 */
function createSVGElement(_container: HTMLElement): SVGSVGElement {
  const svg = document.createElementNS(RENDER_CONFIG.svgNamespace, 'svg');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.background = '#1a1a2e';
  return svg;
}

/**
 * Get render dimensions
 */
function getDimensions(
  container: HTMLElement,
  options: RenderOptions
): { width: number; height: number } {
  const rect = container.getBoundingClientRect();
  return {
    width: options.width ?? rect.width,
    height: options.height ?? rect.height,
  };
}

/**
 * Render connections between nearby points
 */
function renderConnections(svg: SVGSVGElement, points: Point2D[]): void {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dist = distance(points[i], points[j]);

      if (dist < SEMANTIC_MAP_CONFIG.neighborRadius) {
        const line = document.createElementNS(RENDER_CONFIG.svgNamespace, 'line');
        line.setAttribute('x1', String(points[i].x));
        line.setAttribute('y1', String(points[i].y));
        line.setAttribute('x2', String(points[j].x));
        line.setAttribute('y2', String(points[j].y));
        line.setAttribute('stroke', RENDER_CONFIG.connectionColor);
        line.setAttribute('stroke-width', '0.02');
        line.setAttribute('opacity', String(RENDER_CONFIG.connectionOpacity));
        svg.appendChild(line);
      }
    }
  }
}

/**
 * Render individual point
 */
function renderPoint(
  svg: SVGSVGElement,
  point: Point2D,
  options: RenderOptions
): void {
  const circle = document.createElementNS(RENDER_CONFIG.svgNamespace, 'circle');
  circle.setAttribute('cx', String(point.x));
  circle.setAttribute('cy', String(point.y));
  circle.setAttribute('r', String(RENDER_CONFIG.nodeRadius / 100));
  circle.setAttribute('fill', RENDER_CONFIG.nodeColor);
  circle.setAttribute('stroke', RENDER_CONFIG.nodeStroke);
  circle.setAttribute('stroke-width', '0.02');
  circle.style.cursor = 'pointer';

  if (options.onPointClick) {
    circle.addEventListener('click', () => options.onPointClick!(point));
  }

  svg.appendChild(circle);

  if (options.showLabels && point.data) {
    renderLabel(svg, point);
  }
}

/**
 * Render label for point
 */
function renderLabel(svg: SVGSVGElement, point: Point2D): void {
  const channel = point.data as { name?: string };
  if (!channel?.name) return;

  const text = document.createElementNS(RENDER_CONFIG.svgNamespace, 'text');
  text.setAttribute('x', String(point.x + RENDER_CONFIG.labelOffset));
  text.setAttribute('y', String(point.y));
  text.setAttribute('fill', RENDER_CONFIG.labelColor);
  text.setAttribute('font-size', String(RENDER_CONFIG.labelFontSize / 100));
  text.textContent = channel.name.slice(0, RENDER_CONFIG.labelMaxLength);
  svg.appendChild(text);
}

/**
 * Clear container
 */
export function clearContainer(container: HTMLElement): void {
  container.innerHTML = '';
}

/**
 * Render point to canvas (alternative to SVG)
 */
export function renderToCanvas(
  points: Point2D[],
  canvas: HTMLCanvasElement,
  options: RenderOptions = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Transform coordinates to canvas space
  const toCanvasX = (x: number) => ((x + 1) / 2) * width;
  const toCanvasY = (y: number) => ((1 - y) / 2) * height;

  // Draw connections
  if (options.showConnections !== false) {
    ctx.strokeStyle = RENDER_CONFIG.connectionColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const dist = distance(points[i], points[j]);
        if (dist < SEMANTIC_MAP_CONFIG.neighborRadius) {
          ctx.beginPath();
          ctx.moveTo(toCanvasX(points[i].x), toCanvasY(points[i].y));
          ctx.lineTo(toCanvasX(points[j].x), toCanvasY(points[j].y));
          ctx.stroke();
        }
      }
    }
  }

  // Draw points
  points.forEach((point) => {
    const x = toCanvasX(point.x);
    const y = toCanvasY(point.y);

    ctx.beginPath();
    ctx.arc(x, y, RENDER_CONFIG.nodeRadius, 0, Math.PI * 2);
    ctx.fillStyle = RENDER_CONFIG.nodeColor;
    ctx.fill();
    ctx.strokeStyle = RENDER_CONFIG.nodeStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (options.showLabels && point.data) {
      const channel = point.data as { name?: string };
      if (channel?.name) {
        ctx.fillStyle = RENDER_CONFIG.labelColor;
        ctx.font = `${RENDER_CONFIG.labelFontSize}px sans-serif`;
        ctx.fillText(
          channel.name.slice(0, RENDER_CONFIG.labelMaxLength),
          x + 12,
          y
        );
      }
    }
  });
}
