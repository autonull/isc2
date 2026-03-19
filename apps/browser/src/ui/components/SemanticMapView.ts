import { UIComponent } from '../Component.js';
import { renderToSVG } from '../../social/semantic-map/renderer/SemanticMapRenderer.js';
import type { Point2D } from '../../social/semantic-map/types/semanticMap.js';

interface SemanticMapState {
  points: Point2D[];
}

export interface SemanticMapViewProps {
  points: any[]; // Raw points/matches
  onPeerClick?: (peerId: string) => void;
}

export class SemanticMapView extends UIComponent<SemanticMapViewProps, SemanticMapState> {
  private resizeObserver: ResizeObserver | null = null;
  private containerId = `map-container-${Math.random().toString(36).substring(7)}`;

  constructor(props: SemanticMapViewProps) {
    super('div', props, { points: [] });
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    this.element.style.minHeight = '400px';
    this.element.style.position = 'relative';
    this.element.style.background = '#f5f8fa';
    this.element.style.borderRadius = '12px';
    this.element.style.overflow = 'hidden';
    this.element.style.border = '1px solid #e1e8ed';
    this.element.id = this.containerId;
  }

  protected onMount() {
    this.processPoints(this.props.points || []);

    // Auto-resize
    this.resizeObserver = new ResizeObserver(() => {
       this.renderMap();
    });
    this.resizeObserver.observe(this.element);
  }

  protected onUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  // Simplified transformation from raw match data to 2D points for now
  // Real implementation would use SemanticLayoutService
  private processPoints(rawMatches: any[]) {
      if (!rawMatches || rawMatches.length === 0) {
          this.setState({ points: [] });
          return;
      }

      const center: Point2D = { x: 0, y: 0, id: 'self', label: 'You', isCenter: true, type: 'channel' };
      const points: Point2D[] = [center];

      rawMatches.forEach((match, index) => {
         const peer = match.peer || match;
         const sim = match.similarity || Math.random();
         // Fake projection around center based on similarity (closer to 1 = closer to center)
         const radius = (1 - sim) * 300;
         const angle = (index / rawMatches.length) * Math.PI * 2;
         points.push({
             x: Math.cos(angle) * radius,
             y: Math.sin(angle) * radius,
             id: peer.id || `peer-${index}`,
             label: peer.name || peer.id?.substring(0, 8) || 'Unknown',
             type: 'peer',
             metadata: { similarity: sim }
         });
      });

      this.setState({ points });
  }

  public setProps(newProps: Partial<SemanticMapViewProps>) {
    super.setProps(newProps);
    if (newProps.points) {
      this.processPoints(newProps.points);
    }
  }

  protected render() {
      this.renderMap();
  }

  protected update(prevState: SemanticMapState) {
     if (prevState.points !== this.state.points) {
         this.renderMap();
     }
  }

  private renderMap() {
      if (!this.element) return;
      this.element.innerHTML = '';

      if (this.state.points.length === 0) {
          this.element.innerHTML = '<div style="display: flex; height: 100%; align-items: center; justify-content: center; color: #657786;">No peers to map.</div>';
          return;
      }

      try {
          const svg = renderToSVG(this.state.points, this.element, {
              showLabels: true,
              showConnections: true,
              onPointClick: (point: Point2D) => {
                  if (point.id !== 'self' && this.props.onPeerClick) {
                      this.props.onPeerClick(point.id);
                  }
              }
          });

          if (svg) {
              this.element.appendChild(svg);
          }
      } catch (e) {
          console.error('[SemanticMapView] Render failed:', e);
          this.element.innerHTML = '<div style="display: flex; height: 100%; align-items: center; justify-content: center; color: #d93025;">Failed to render map.</div>';
      }
  }
}
