export class SpaceCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private agents: any[] = [];
  private edges: { from: string, to: string, time: number }[] = [];
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver;
  private time: number = 0;
  private agentStates: Map<string, { tx: number, ty: number, cx: number, cy: number }> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get 2d context");
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.canvas.parentElement) {
       this.resizeObserver.observe(this.canvas.parentElement);
    }

    // Fallback resize if observer misses
    window.addEventListener('resize', () => this.resize());

    // Explicit first resize
    setTimeout(() => {
        this.resize();
        this.loop();
    }, 100);
  }

  public setAgents(agents: any[]) {
    this.agents = agents;
    // Initialize states for new agents
    this.agents.forEach((a, i) => {
        if (!this.agentStates.has(a.peerId)) {
            // Distribute agents in a circle initially
            const angle = (i / this.agents.length) * Math.PI * 2;
            const radius = 0.3; // 30% of screen from center
            const targetX = 0.5 + Math.cos(angle) * radius;
            const targetY = 0.5 + Math.sin(angle) * radius;

            this.agentStates.set(a.peerId, {
                cx: targetX,
                cy: targetY,
                tx: targetX,
                ty: targetY
            });
        }
    });
  }

  public setEdges(edges: { from: string, to: string, time: number }[]) {
      this.edges = edges;
  }

  private resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      // Ensure we always have a reasonable fallback dimension if rect gives 0 (can happen in some hidden DOM states)
      this.canvas.width = rect.width > 0 ? rect.width : (window.innerWidth - 350);
      this.canvas.height = rect.height > 0 ? rect.height : window.innerHeight;
    } else {
      this.canvas.width = window.innerWidth - 350;
      this.canvas.height = window.innerHeight;
    }
  }

  private loop() {
    this.time += 0.01;
    this.update();
    this.render();
    this.animationId = requestAnimationFrame(() => this.loop());
  }

  private update() {
    // Make agents drift slightly over time
    this.agents.forEach(agent => {
        const state = this.agentStates.get(agent.peerId);
        if (state) {
            // Random walk target adjustment
            if (Math.random() < 0.02) {
                state.tx += (Math.random() - 0.5) * 0.1;
                state.ty += (Math.random() - 0.5) * 0.1;

                // Clamp to screen bounds relative
                state.tx = Math.max(0.1, Math.min(0.9, state.tx));
                state.ty = Math.max(0.1, Math.min(0.9, state.ty));
            }

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

    // Clear background
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, w, h);

    // Draw grid
    this.ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    this.ctx.lineWidth = 1;
    const spacing = 50;

    // Animate grid offset slightly
    const offsetX = (this.time * 10) % spacing;
    const offsetY = (this.time * 10) % spacing;

    for (let x = offsetX; x < w; x += spacing) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); this.ctx.stroke();
    }
    for (let y = offsetY; y < h; y += spacing) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); this.ctx.stroke();
    }

    const now = Date.now();

    // Draw active connections (hearing)
    this.edges.forEach(edge => {
        const fromState = this.agentStates.get(edge.from);
        const toState = this.agentStates.get(edge.to);

        if (fromState && toState) {
            // Fade out over 5 seconds
            const age = now - edge.time;
            if (age < 5000) {
                const opacity = 1 - (age / 5000);
                this.ctx.strokeStyle = `rgba(139, 92, 246, ${opacity})`; // Purple communication lines
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(w * fromState.cx, h * fromState.cy);
                this.ctx.lineTo(w * toState.cx, h * toState.cy);
                this.ctx.stroke();

                // Draw a small moving particle along the line
                const progress = (this.time * 5) % 1;
                const px = w * fromState.cx + (w * toState.cx - w * fromState.cx) * progress;
                const py = h * fromState.cy + (h * toState.cy - h * fromState.cy) * progress;

                this.ctx.beginPath();
                this.ctx.arc(px, py, 3, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                this.ctx.fill();
            }
        }
    });

    // Draw agents
    this.agents.forEach((agent) => {
      const state = this.agentStates.get(agent.peerId);
      if (!state) return;

      const x = w * state.cx;
      const y = h * state.cy;

      // Pulse effect if they are thinking
      const isThinking = agent.currentTopic === "Thinking...";
      const radius = isThinking ? 12 + Math.sin(this.time * 10) * 4 : 12;

      // Draw glow
      this.ctx.shadowBlur = isThinking ? 20 : 10;
      this.ctx.shadowColor = isThinking ? '#60a5fa' : '#3b82f6';

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = isThinking ? '#60a5fa' : '#3b82f6';
      this.ctx.fill();

      // Reset shadow for text
      this.ctx.shadowBlur = 0;

      // Label
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 14px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(agent.profile.name, x, y - 25);

      // Draw a thought bubble if they have a thought
      if (agent.currentTopic && agent.currentTopic !== "Thinking...") {
          // Truncate long thoughts
          let displayThought = agent.currentTopic;
          if (displayThought.length > 30) {
              displayThought = displayThought.substring(0, 30) + '...';
          }

          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          this.ctx.font = '12px system-ui';
          this.ctx.fillText(`"${displayThought}"`, x, y + 25);
      }
    });
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', () => this.resize());
  }
}
