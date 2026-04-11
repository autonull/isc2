export class SpaceCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private agents: any[] = [];
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver;

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
  }

  private resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      // Must use getBoundingClientRect for absolute reliable dims, offsetWidth can be 0 if flexbox acts up
      const rect = parent.getBoundingClientRect();
      this.canvas.width = rect.width || window.innerWidth - 350; // fallback width
      this.canvas.height = rect.height || window.innerHeight;
      console.log(`[SpaceCanvas] Resized to ${this.canvas.width}x${this.canvas.height}`);
    }
  }

  private loop() {
    this.render();
    this.animationId = requestAnimationFrame(() => this.loop());
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
    for (let x = spacing; x < w; x += spacing) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); this.ctx.stroke();
    }
    for (let y = spacing; y < h; y += spacing) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); this.ctx.stroke();
    }

    // Draw agents (mocking projection for now)
    this.agents.forEach((agent, i) => {
      // Very simple deterministic mock position based on name length/hash
      const seed = agent.profile.name.length * 0.1;
      const x = w * (0.3 + (Math.sin(seed * i) * 0.2));
      const y = h * (0.3 + (Math.cos(seed * i) * 0.2));

      this.ctx.beginPath();
      this.ctx.arc(x, y, 10, 0, Math.PI * 2);
      this.ctx.fillStyle = '#3b82f6';
      this.ctx.fill();

      this.ctx.fillStyle = 'white';
      this.ctx.font = '12px system-ui';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(agent.profile.name, x, y - 15);
    });
  }

  public destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.resizeObserver.disconnect();
  }
}
