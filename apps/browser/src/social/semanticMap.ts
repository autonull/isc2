/**
 * Semantic Map Service
 * 
 * 2D projection and interactive visualization of embedding space.
 * References: SOCIAL.md#semantic-map
 */

import { cosineSimilarity } from '@isc/core/math';
import type { Channel } from '@isc/core/types';

/**
 * 2D point for visualization
 */
export interface Point2D {
  x: number;
  y: number;
  data: unknown; // Original data (channel, post, etc.)
}

/**
 * Project high-dimensional embedding to 2D using PCA-like approach
 */
export function projectTo2D(embedding: number[], referencePoints: Point2D[]): Point2D {
  if (referencePoints.length === 0) {
    return { x: 0, y: 0, data: null };
  }
  
  // Use MDS-like projection based on similarity to reference points
  const similarities = referencePoints.map(p => 
    cosineSimilarity(embedding, (p.data as { embedding: number[] }).embedding)
  );
  
  // Barycentric-like projection
  let x = 0, y = 0, totalWeight = 0;
  for (let i = 0; i < referencePoints.length; i++) {
    const weight = Math.max(similarities[i], 0);
    x += referencePoints[i].x * weight;
    y += referencePoints[i].y * weight;
    totalWeight += weight;
  }
  
  if (totalWeight > 0) {
    x /= totalWeight;
    y /= totalWeight;
  }
  
  return { x, y, data: { embedding } };
}

/**
 * Compute 2D positions for channels
 */
export async function computeChannelPositions(channels: Channel[]): Promise<Point2D[]> {
  if (channels.length === 0) return [];
  
  // Initialize with random positions on unit circle
  const positions: Point2D[] = channels.map((channel, i) => ({
    x: Math.cos(i * 2 * Math.PI / channels.length),
    y: Math.sin(i * 2 * Math.PI / channels.length),
    data: { embedding: channel.distributions[0]?.mu ?? [] },
  }));
  
  // Run force-directed layout
  return forceDirectedLayout(positions, 100);
}

/**
 * Force-directed layout optimization
 */
function forceDirectedLayout(points: Point2D[], iterations: number): Point2D[] {
  const repulsion = 0.5;
  const attraction = 0.01;
  const damping = 0.8;
  
  const velocities = points.map(() => ({ x: 0, y: 0 }));
  
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < points.length; i++) {
      let vx = 0, vy = 0;
      
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        
        // Repulsion (all points push apart)
        const repulse = repulsion / (dist * dist);
        vx += (dx / dist) * repulse;
        vy += (dy / dist) * repulse;
        
        // Attraction (similar points pull together)
        const sim = cosineSimilarity(
          (points[i].data as { embedding: number[] }).embedding,
          (points[j].data as { embedding: number[] }).embedding
        );
        if (sim > 0.5) {
          const attract = attraction * (sim - 0.5);
          vx -= (dx / dist) * attract;
          vy -= (dy / dist) * attract;
        }
      }
      
      // Apply velocity with damping
      velocities[i].x = (velocities[i].x + vx) * damping;
      velocities[i].y = (velocities[i].y + vy) * damping;
      
      // Update position
      points[i].x += velocities[i].x;
      points[i].y += velocities[i].y;
    }
  }
  
  // Normalize to unit circle
  const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  
  let maxDist = 0;
  for (const p of points) {
    const dist = Math.sqrt((p.x - centerX) ** 2 + (p.y - centerY) ** 2);
    maxDist = Math.max(maxDist, dist);
  }
  
  if (maxDist > 0) {
    for (const p of points) {
      p.x = centerX + (p.x - centerX) / maxDist * 0.8;
      p.y = centerY + (p.y - centerY) / maxDist * 0.8;
    }
  }
  
  return points;
}

/**
 * Find semantic neighbors in 2D space
 */
export function findNeighbors(
  point: Point2D,
  allPoints: Point2D[],
  radius: number = 0.3
): Point2D[] {
  return allPoints.filter(p => {
    if (p === point) return false;
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    return Math.sqrt(dx * dx + dy * dy) < radius;
  });
}

/**
 * Compute cluster centers using k-means
 */
export function kmeansClusters(
  points: Point2D[],
  k: number,
  maxIterations: number = 20
): Point2D[] {
  if (points.length <= k) return points;
  
  // Initialize centroids randomly
  const centroids: Point2D[] = [];
  const used = new Set<number>();
  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * points.length);
    if (!used.has(idx)) {
      used.add(idx);
      centroids.push({ ...points[idx] });
    }
  }
  
  // Iterate
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign points to clusters
    const clusters = Array.from({ length: k }, () => [] as Point2D[]);
    for (const p of points) {
      let minDist = Infinity;
      let clusterIdx = 0;
      for (let i = 0; i < k; i++) {
        const dx = p.x - centroids[i].x;
        const dy = p.y - centroids[i].y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
          minDist = dist;
          clusterIdx = i;
        }
      }
      clusters[clusterIdx].push(p);
    }
    
    // Update centroids
    let changed = false;
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const newX = clusters[i].reduce((sum, p) => sum + p.x, 0) / clusters[i].length;
        const newY = clusters[i].reduce((sum, p) => sum + p.y, 0) / clusters[i].length;
        if (Math.abs(newX - centroids[i].x) > 0.001 || Math.abs(newY - centroids[i].y) > 0.001) {
          centroids[i].x = newX;
          centroids[i].y = newY;
          changed = true;
        }
      }
    }
    
    if (!changed) break;
  }
  
  return centroids;
}

/**
 * SVG/Canvas rendering helpers
 */
export function renderSemanticMap(
  points: Point2D[],
  container: HTMLElement,
  options: {
    onPointClick?: (point: Point2D) => void;
    showLabels?: boolean;
  } = {}
): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.background = '#1a1a2e';
  
  // Draw connections for neighbors
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 0.3) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', `${(points[i].x + 0.5) * 100}%`);
        line.setAttribute('y1', `${(points[i].y + 0.5) * 100}%`);
        line.setAttribute('x2', `${(points[j].x + 0.5) * 100}%`);
        line.setAttribute('y2', `${(points[j].y + 0.5) * 100}%`);
        line.setAttribute('stroke', 'rgba(100, 200, 255, 0.2)');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }
    }
  }
  
  // Draw points
  for (const point of points) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', `${(point.x + 0.5) * 100}%`);
    circle.setAttribute('cy', `${(point.y + 0.5) * 100}%`);
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', '#4fc3f7');
    circle.setAttribute('stroke', '#fff');
    circle.setAttribute('stroke-width', '2');
    circle.style.cursor = 'pointer';
    
    if (options.onPointClick) {
      circle.addEventListener('click', () => options.onPointClick!(point));
    }
    
    svg.appendChild(circle);
    
    // Optional label
    if (options.showLabels && point.data) {
      const channel = point.data as { name?: string };
      if (channel.name) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', `${(point.x + 0.55) * 100}%`);
        text.setAttribute('y', `${(point.y + 0.5) * 100}%`);
        text.setAttribute('fill', '#fff');
        text.setAttribute('font-size', '12');
        text.textContent = channel.name.slice(0, 15);
        svg.appendChild(text);
      }
    }
  }
  
  container.innerHTML = '';
  container.appendChild(svg);
}
