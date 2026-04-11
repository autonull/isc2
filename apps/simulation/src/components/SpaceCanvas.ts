export class SpaceCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private agents: any[] = [];
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
            // Assign a random target position on initialization
            const seed = a.profile.name.length * 0.1;
            const targetX = 0.3 + (Math.sin(seed * i) * 0.4);
            const targetY = 0.3 + (Math.cos(seed * i) * 0.4);

            this.agentStates.set(a.peerId, {
                cx: targetX, // Current X
                cy: targetY, // Current Y
                tx: targetX, // Target X
                ty: targetY  // Target Y
            });
        }
    });
  }

  private resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      const rect = parent.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth - 350;
      this.canvas.height = rect.height || window.innerHeight;
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

    // Draw agents
    this.agents.forEach((agent) => {
      const state = this.agentStates.get(agent.peerId);
      if (!state) return;

      const x = w * state.cx;
      const y = h * state.cy;

      // Pulse effect if they are thinking
      const isThinking = agent.currentTopic === "Thinking...";
      const radius = isThinking ? 10 + Math.sin(this.time * 10) * 3 : 10;

      // Draw glow
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#3b82f6';

      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = isThinking ? '#60a5fa' : '#3b82f6';
      this.ctx.fill();

      // Reset shadow for text
      this.ctx.shadowBlur = 0;

      // Label
      this.ctx.fillStyle = 'white';
      this.ctx.font = '14px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(agent.profile.name, x, y - 20);

      // Draw connection lines to center (mock gravity/concept map)
      this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.2)';
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(w/2, h/2);
      this.ctx.stroke();
    });

    // Draw center node (Global topic)
    this.ctx.beginPath();
    this.ctx.arc(w/2, h/2, 20, 0, Math.PI * 2);
    this.ctx.fillStyle = '#8b5cf6';
    this.ctx.fill();
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 16px system-ui';
    this.ctx.fillText("Semantic Core", w/2, h/2 - 30);
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.resizeObserver.disconnect();
  }
}
