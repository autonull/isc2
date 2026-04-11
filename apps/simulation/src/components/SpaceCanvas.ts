export class SpaceCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private agents: any[] = [];
  private edges: { from: string, to: string, time: number }[] = [];
  private animationId: number | null = null;
  private time: number = 0;
  private agentStates: Map<string, { tx: number, ty: number, cx: number, cy: number }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get 2d context");
    this.ctx = ctx;

    // Fallback resize if observer misses
    window.addEventListener('resize', () => this.resize());

    // Explicit first resize
    this.resize();
    this.loop();
  }

  public setAgents(agents: any[], positions?: Map<string, { x: number, y: number }>) {
    this.agents = agents;
    // Initialize states for new agents
    this.agents.forEach((a, i) => {
        if (!this.agentStates.has(a.peerId)) {
            let targetX = 0.5;
            let targetY = 0.5;
            if (positions && positions.has(a.peerId)) {
                const p = positions.get(a.peerId)!;
                targetX = p.x;
                targetY = p.y;
            } else {
                const angle = (i / this.agents.length) * Math.PI * 2;
                const radius = 0.3;
                targetX = 0.6 + Math.cos(angle) * radius;
                targetY = 0.5 + Math.sin(angle) * radius;
            }

            this.agentStates.set(a.peerId, {
                cx: targetX,
                cy: targetY,
                tx: targetX,
                ty: targetY
            });
        } else if (positions && positions.has(a.peerId)) {
            // Update targets based on UMAP position
            const state = this.agentStates.get(a.peerId)!;
            const p = positions.get(a.peerId)!;
            state.tx = p.x;
            state.ty = p.y;
        }
    });

    // Cleanup removed agents
    for (const key of this.agentStates.keys()) {
        if (!this.agents.find(a => a.peerId === key)) {
            this.agentStates.delete(key);
        }
    }
  }

  public setEdges(edges: { from: string, to: string, time: number }[]) {
      this.edges = edges;
  }

  public resize() {
    let w = window.innerWidth;
    let h = window.innerHeight;

    // Explicitly set the DOM attributes so the context buffer isn't squished
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  private loop() {
    this.time += 0.01;
    this.update();
    this.render();
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  private update() {
    // Make agents drift slightly over time towards their target
    this.agents.forEach(agent => {
        const state = this.agentStates.get(agent.peerId);
        if (state) {
            // LERP towards target
            state.cx += (state.tx - state.cx) * 0.05;
            state.cy += (state.ty - state.cy) * 0.05;
        }
    });
  }

  private render() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (w <= 0 || h <= 0) return;

    this.ctx.clearRect(0, 0, w, h);

    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(0, 0, w, h);

    // Draw grid
    this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    this.ctx.lineWidth = 1;
    const spacing = 50;

    const offsetX = (this.time * 10) % spacing;
    const offsetY = (this.time * 10) % spacing;

    for (let x = offsetX; x < w; x += spacing) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); this.ctx.stroke();
    }
    for (let y = offsetY; y < h; y += spacing) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); this.ctx.stroke();
    }

    const now = Date.now();

    this.edges.forEach(edge => {
        const fromState = this.agentStates.get(edge.from);
        const toState = this.agentStates.get(edge.to);

        if (fromState && toState) {
            const age = now - edge.time;
            if (age < 5000) {
                const opacity = 1 - (age / 5000);
                this.ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`;
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(w * fromState.cx, h * fromState.cy);
                this.ctx.lineTo(w * toState.cx, h * toState.cy);
                this.ctx.stroke();

                const progress = (this.time * 5) % 1;
                const px = w * fromState.cx + (w * toState.cx - w * fromState.cx) * progress;
                const py = h * fromState.cy + (h * toState.cy - h * fromState.cy) * progress;

                this.ctx.beginPath();
                this.ctx.arc(px, py, 4, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                this.ctx.fill();
            }
        }
    });

    this.agents.forEach((agent) => {
      const state = this.agentStates.get(agent.peerId);
      if (!state) return;

      const x = w * state.cx;
      const y = h * state.cy;

      const isThinking = agent.currentTopic === "Thinking...";
      const radius = isThinking ? 12 + Math.sin(this.time * 10) * 4 : 12;

      this.ctx.shadowBlur = isThinking ? 20 : 10;
      this.ctx.shadowColor = isThinking ? '#60a5fa' : '#3b82f6';

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = isThinking ? '#60a5fa' : '#3b82f6';
      this.ctx.fill();

      this.ctx.shadowBlur = 0;

      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 16px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(agent.profile.name, x, y - 25);

      // Render subscribed topics as little badges under the agent
      if (agent.subscribedTopics && agent.subscribedTopics.size > 0) {
          const topics = Array.from(agent.subscribedTopics);
          this.ctx.font = '10px system-ui';

          let currentY = y + 25;
          topics.slice(0, 3).forEach(topic => {
              const text = `#${topic}`;
              const textWidth = this.ctx.measureText(text).width;

              this.ctx.fillStyle = 'rgba(16, 185, 129, 0.2)'; // Emerald transparent
              this.ctx.beginPath();
              this.ctx.roundRect(x - (textWidth/2) - 4, currentY - 10, textWidth + 8, 14, 4);
              this.ctx.fill();

              this.ctx.fillStyle = '#6ee7b7'; // Emerald text
              this.ctx.fillText(text, x, currentY);
              currentY += 18;
          });

          if (topics.length > 3) {
             this.ctx.fillStyle = '#cbd5e1';
             this.ctx.fillText(`+${topics.length - 3} more`, x, currentY);
             currentY += 18;
          }

          // Draw the thought bubble below the badges
          if (agent.currentTopic && agent.currentTopic !== "Thinking...") {
              let displayThought = agent.currentTopic;
              if (displayThought.length > 30) {
                  displayThought = displayThought.substring(0, 30) + '...';
              }

              this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              this.ctx.font = '14px system-ui';
              this.ctx.fillText(`"${displayThought}"`, x, currentY + 10);
          }
      } else {
          // Just draw the thought if no topics
          if (agent.currentTopic && agent.currentTopic !== "Thinking...") {
              let displayThought = agent.currentTopic;
              if (displayThought.length > 30) {
                  displayThought = displayThought.substring(0, 30) + '...';
              }

              this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
              this.ctx.font = '14px system-ui';
              this.ctx.fillText(`"${displayThought}"`, x, y + 25);
          }
      }
    });
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    window.removeEventListener('resize', () => this.resize());
  }
}
