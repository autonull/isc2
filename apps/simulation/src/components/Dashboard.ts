import { SimulationEngine } from '../simulation/SimulationEngine';
import { LLMService } from '../simulation/LLMService';

export class DashboardComponent {
  private el: HTMLElement;
  private engine: SimulationEngine;
  private llm: LLMService;

  constructor(el: HTMLElement, engine: SimulationEngine, llm: LLMService) {
    this.el = el;
    this.engine = engine;
    this.llm = llm;
    this.render();
  }

  public render() {
    this.el.innerHTML = `
      <div style="display: flex; height: 100vh; width: 100vw; font-family: system-ui;">
        <div style="width: 350px; background: #1e293b; color: white; padding: 20px; overflow-y: auto; z-index: 10; flex-shrink: 0;">
          <h2>ISC Simulation Dashboard</h2>

          <div style="margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
            <h3>Simulation Controls</h3>
            <button id="btn-toggle-sim" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
              ${this.engine.isRunning ? 'Pause' : 'Start'}
            </button>
            <div style="margin-top: 10px;">
              <label>Tick Interval (ms): </label>
              <input type="number" id="input-tick" value="${this.engine.tickInterval}" style="width: 80px;" />
            </div>
          </div>

          <div style="margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
            <h3>LLM Status</h3>
            <div id="llm-status">
              ${this.llm.isReady() ? '<span style="color: #4ade80;">Ready</span>' : '<span style="color: #fbbf24;">Not initialized</span>'}
            </div>
            <button id="btn-init-llm" style="margin-top: 10px; padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; display: ${this.llm.isReady() ? 'none' : 'block'}">
              Initialize WebLLM
            </button>
          </div>

          <div style="margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
            <h3>Agents (${this.engine.agents.length})</h3>
            <div id="agent-list">
              ${this.engine.agents.map(a => `
                <div style="padding: 5px 0; border-bottom: 1px solid #475569;">
                  <strong>${a.profile.name}</strong><br/>
                  <small style="color: #cbd5e1;">${a.currentTopic || 'No current thought'}</small>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div id="canvas-container" style="flex: 1; position: relative; background: #0f172a; height: 100vh; overflow: hidden;">
          <canvas id="sim-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block;"></canvas>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents() {
    const btnToggle = this.el.querySelector('#btn-toggle-sim');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        if (this.engine.isRunning) {
          this.engine.pause();
        } else {
          this.engine.start();
        }
        this.render();
      });
    }

    const inputTick = this.el.querySelector('#input-tick') as HTMLInputElement;
    if (inputTick) {
      inputTick.addEventListener('change', (e: any) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val) && val > 0) {
          this.engine.setTickInterval(val);
        }
      });
    }

    const btnInitLlm = this.el.querySelector('#btn-init-llm');
    if (btnInitLlm) {
      btnInitLlm.addEventListener('click', async () => {
        const statusEl = this.el.querySelector('#llm-status');
        if (statusEl) statusEl.innerHTML = '<span style="color: #fbbf24;">Loading model...</span>';

        this.llm.setProgressCallback((p) => {
          if (statusEl) statusEl.innerHTML = `<span style="color: #60a5fa;">Loading: ${(p*100).toFixed(1)}%</span>`;
        });

        await this.llm.initialize();
        this.render();
      });
    }
  }
}
