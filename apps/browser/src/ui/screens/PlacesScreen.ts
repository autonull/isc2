import { UIComponent } from '../Component.js';

export interface PlaceNode {
  id: string;
  text: string;
  x: number;
  y: number;
  type: 'thought' | 'resource' | 'question';
}

export interface PlaceEdge {
  id: string;
  sourceId: string;
  targetId: string;
}

interface PlacesState {
  nodes: PlaceNode[];
  edges: PlaceEdge[];
  isAddingNode: boolean;
}

export class PlacesScreen extends UIComponent<any, PlacesState> {
  private draggingNodeId: string | null = null;
  private startX: number = 0;
  private startY: number = 0;
  private nodeStartX: number = 0;
  private nodeStartY: number = 0;

  constructor(props: any) {
    super('div', props, {
      nodes: [
        { id: '1', text: 'AI Ethics', x: 200, y: 150, type: 'thought' },
        { id: '2', text: 'Interpretability', x: 350, y: 100, type: 'thought' },
        { id: '3', text: 'Accountability', x: 400, y: 250, type: 'thought' },
        { id: '4', text: 'Who decides?', x: 550, y: 180, type: 'question' },
        { id: '5', text: 'Regulation framework', x: 150, y: 300, type: 'resource' }
      ],
      edges: [
        { id: 'e1', sourceId: '1', targetId: '2' },
        { id: 'e2', sourceId: '1', targetId: '3' },
        { id: 'e3', sourceId: '3', targetId: '4' },
        { id: 'e4', sourceId: '1', targetId: '5' }
      ],
      isAddingNode: false
    });
    this.element.className = 'screen places-screen';
    this.element.dataset.testid = 'places-screen';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.height = '100%';
    this.element.style.background = '#f8f9fa';

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  protected onMount() {
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
  }

  protected onUnmount() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.draggingNodeId) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const newX = this.nodeStartX + dx;
    const newY = this.nodeStartY + dy;

    // Mutate DOM directly for performance instead of full state render on every pixel move
    const nodeEl = this.element.querySelector(`[data-id="${this.draggingNodeId}"]`) as HTMLElement;
    if (nodeEl) {
      nodeEl.style.left = `${newX}px`;
      nodeEl.style.top = `${newY}px`;
      nodeEl.style.zIndex = '100';
      nodeEl.style.cursor = 'grabbing';
      nodeEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';

      // Update edges live directly via DOM as well
      const NODE_W = 120;
      const NODE_H = 40;
      const xC = newX + NODE_W / 2;
      const yC = newY + NODE_H / 2;

      this.state.edges.forEach(edge => {
        if (edge.sourceId === this.draggingNodeId) {
          const line = this.element.querySelector(`line[data-edge-id="${edge.id}"]`);
          if (line) {
             line.setAttribute('x1', xC.toString());
             line.setAttribute('y1', yC.toString());
          }
        }
        if (edge.targetId === this.draggingNodeId) {
          const line = this.element.querySelector(`line[data-edge-id="${edge.id}"]`);
          if (line) {
             line.setAttribute('x2', xC.toString());
             line.setAttribute('y2', yC.toString());
          }
        }
      });
    }
  }

  private handleMouseUp(e: MouseEvent) {
    if (!this.draggingNodeId) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    // Persist final position to state and re-render edges
    const newNodes = this.state.nodes.map(n => {
      if (n.id === this.draggingNodeId) {
        return { ...n, x: this.nodeStartX + dx, y: this.nodeStartY + dy };
      }
      return n;
    });

    this.draggingNodeId = null;
    this.setState({ nodes: newNodes });
  }

  private handleMouseDownNode(e: MouseEvent, id: string) {
    // Only drag on left click and if not clicking an input/button
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON') return;

    this.draggingNodeId = id;
    this.startX = e.clientX;
    this.startY = e.clientY;

    const node = this.state.nodes.find(n => n.id === id);
    if (node) {
      this.nodeStartX = node.x;
      this.nodeStartY = node.y;
    }
  }

  private handleAddNode(text: string, type: 'thought' | 'resource' | 'question') {
    if (!text.trim()) return;
    const newNode: PlaceNode = {
      id: 'n_' + Date.now(),
      text,
      x: 100 + Math.random() * 50,
      y: 100 + Math.random() * 50,
      type
    };
    this.setState({
      nodes: [...this.state.nodes, newNode],
      isAddingNode: false
    });
  }

  protected render() {
    this.element.innerHTML = `
      <div class="channel-header" style="padding: 16px 20px; border-bottom: 1px solid #e1e8ed; background: white; display: flex; justify-content: space-between; align-items: center; z-index: 10;">
        <div>
          <h2 style="font-size: 20px; font-weight: bold; margin: 0; color: #14171a;">🗺️ Places (Idea Boards)</h2>
          <p style="font-size: 14px; color: #657786; margin: 4px 0 0 0;">Collaborative semantic graphs.</p>
        </div>
        <button id="add-node-btn" style="padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 20px; font-size: 14px; font-weight: bold; cursor: pointer;">+ Add Node</button>
      </div>

      <div id="add-node-panel" style="display: none; padding: 16px; background: white; border-bottom: 1px solid #e1e8ed; z-index: 9;">
        <div style="display: flex; gap: 8px; max-width: 600px; margin: 0 auto;">
          <input type="text" id="new-node-input" placeholder="Type a thought, question, or resource..." style="flex: 1; padding: 8px 12px; border: 1px solid #e1e8ed; border-radius: 6px; outline: none;" />
          <select id="new-node-type" style="padding: 8px; border: 1px solid #e1e8ed; border-radius: 6px;">
            <option value="thought">Thought</option>
            <option value="question">Question</option>
            <option value="resource">Resource</option>
          </select>
          <button id="save-node-btn" style="padding: 8px 16px; background: #17bf63; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Save</button>
          <button id="cancel-node-btn" style="padding: 8px 16px; background: transparent; color: #657786; border: 1px solid #e1e8ed; border-radius: 6px; font-weight: bold; cursor: pointer;">Cancel</button>
        </div>
      </div>

      <div id="canvas-container" style="flex: 1; position: relative; overflow: hidden; background-image: radial-gradient(#e1e8ed 1px, transparent 0); background-size: 20px 20px;">
        <svg id="edges-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
        </svg>
        <div id="nodes-container" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
        </div>
      </div>
    `;

    const addBtn = this.element.querySelector('#add-node-btn');
    addBtn?.addEventListener('click', () => this.setState({ isAddingNode: true }));

    const cancelBtn = this.element.querySelector('#cancel-node-btn');
    cancelBtn?.addEventListener('click', () => {
      this.setState({ isAddingNode: false });
      (this.element.querySelector('#new-node-input') as HTMLInputElement).value = '';
    });

    const saveBtn = this.element.querySelector('#save-node-btn');
    saveBtn?.addEventListener('click', () => {
      const input = this.element.querySelector('#new-node-input') as HTMLInputElement;
      const typeSelect = this.element.querySelector('#new-node-type') as HTMLSelectElement;
      this.handleAddNode(input.value, typeSelect.value as any);
      input.value = '';
    });

    // Event delegation for dragging
    const nodesContainer = this.element.querySelector('#nodes-container');
    nodesContainer?.addEventListener('mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const nodeEl = (mouseEvent.target as HTMLElement).closest('.place-node') as HTMLElement;
      if (nodeEl && nodeEl.dataset.id) {
        this.handleMouseDownNode(mouseEvent, nodeEl.dataset.id);
      }
    });

    // Make sure we render on initial mount immediately after innerHTML set
    this.renderCanvas();
  }

  private getNodeColor(type: string) {
    if (type === 'question') return { bg: '#fff0f2', border: '#e0245e', text: '#e0245e' };
    if (type === 'resource') return { bg: '#e8f4fd', border: '#1da1f2', text: '#1da1f2' };
    return { bg: '#ffffff', border: '#e1e8ed', text: '#14171a' };
  }

  protected update(prevState: PlacesState) {
    const addPanel = this.element.querySelector('#add-node-panel') as HTMLElement;
    if (addPanel) {
      addPanel.style.display = this.state.isAddingNode ? 'block' : 'none';
      if (this.state.isAddingNode && !prevState.isAddingNode) {
        const input = this.element.querySelector('#new-node-input') as HTMLInputElement;
        setTimeout(() => input?.focus(), 50);
      }
    }

    // Surgical or complete re-render of canvas elements
    if (prevState.nodes !== this.state.nodes || prevState.edges !== this.state.edges || prevState.isAddingNode !== this.state.isAddingNode) {
       this.renderCanvas();
    }

    // In Vanilla architecture, sometimes state changes trigger full re-render implicitly.
    // If it hasn't, force renderCanvas manually if needed, or simply render it initially if the node list is missing.
    const nodesContainer = this.element.querySelector('#nodes-container');
    if (nodesContainer && nodesContainer.children.length === 0 && this.state.nodes.length > 0) {
       this.renderCanvas();
    }
  }

  private renderCanvas() {
    const svg = this.element.querySelector('#edges-svg') as unknown as SVGSVGElement;
    const nodesContainer = this.element.querySelector('#nodes-container') as HTMLElement;

    if (!svg || !nodesContainer) return;

    // We assume node width ~120px and height ~40px for center calculations
    const NODE_W = 120;
    const NODE_H = 40;

    // Render edges
    let edgesHtml = '';
    this.state.edges.forEach(edge => {
      const s = this.state.nodes.find(n => n.id === edge.sourceId);
      const t = this.state.nodes.find(n => n.id === edge.targetId);
      if (s && t) {
        const x1 = s.x + NODE_W / 2;
        const y1 = s.y + NODE_H / 2;
        const x2 = t.x + NODE_W / 2;
        const y2 = t.y + NODE_H / 2;
        edgesHtml += `<line data-edge-id="${edge.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#aab8c2" stroke-width="2" />`;
      }
    });
    svg.innerHTML = edgesHtml;

    // Render nodes
    // Using string replacement for performance instead of full innerHTML if possible,
    // but full innerHTML is fine for small board sizes.
    let nodesHtml = '';
    this.state.nodes.forEach(node => {
      const colors = this.getNodeColor(node.type);
      nodesHtml += `
        <div class="place-node" data-id="${this.escapeHTML(node.id)}"
             style="position: absolute; left: ${node.x}px; top: ${node.y}px; width: ${NODE_W}px;
                    background: ${colors.bg}; border: 1px solid ${colors.border}; color: ${colors.text};
                    padding: 8px 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    cursor: grab; user-select: none; font-size: 13px; font-weight: 500; text-align: center;
                    box-sizing: border-box; display: flex; align-items: center; justify-content: center;
                    z-index: 1;">
          ${this.escapeHTML(node.text)}
        </div>
      `;
    });
    nodesContainer.innerHTML = nodesHtml;
  }

  private escapeHTML(str: string): string {
    if (!str) return '';
    return str.replace(/[&<>'"]/g,
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}
