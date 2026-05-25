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
      <div style="position: absolute; top: 0; left: 0; height: 100vh; width: 350px; background: rgba(30, 41, 59, 0.95); color: white; padding: 20px; overflow-y: auto; z-index: 10; border-right: 1px solid #475569; font-family: system-ui;">
        <h2>ISC Simulation</h2>

        <div style="margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
          <h3 style="margin-top: 0;">Simulation Controls</h3>
          <button id="btn-toggle-sim" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-bottom: 10px;">
            ${this.engine.isRunning ? 'Pause Simulation' : 'Start Simulation'}
          </button>

          <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
            <label>Tick Interval (ms): </label>
            <input type="number" id="input-tick" value="${this.engine.tickInterval}" style="width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: white;" />
          </div>

          <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
            <label title="Refresh rate for UMAP projection">UMAP Chance (%): </label>
            <input type="number" id="input-umap-chance" value="${Math.round(this.engine.umapChance * 100)}" style="width: 80px; padding: 5px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: white;" />
          </div>
        </div>

        <div style="margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
          <button id="btn-toggle-ui" style="width: 100%; padding: 12px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; margin-bottom: 15px;">
            Jump In (Open UI)
          </button>

          <h3 style="margin-top: 0;">LLM Configuration</h3>
          <div id="llm-status" style="margin-bottom: 10px;">
            Status: ${this.llm.isReady() ? '<span style="color: #4ade80;">Ready</span>' : '<span style="color: #fbbf24;">Initializing (Auto-start)...</span>'}
          </div>

          <div style="margin-bottom: 10px;">
            <label style="display: block; margin-bottom: 5px; font-size: 14px;">WebLLM Model:</label>
            <select id="select-model" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: white;" ${this.llm.isReady() ? 'disabled' : ''}>
              <option value="SmolLM2-135M-Instruct-q4f16_1-MLC">SmolLM2-135M-Instruct</option>
              <option value="Llama-3.2-1B-Instruct-q4f16_1-MLC">Llama-3.2-1B-Instruct</option>
              <option value="Llama-3.2-3B-Instruct-q4f16_1-MLC">Llama-3.2-3B-Instruct</option>
            </select>
          </div>

          <button id="btn-init-llm" style="width: 100%; padding: 8px 16px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; display: ${this.llm.isReady() ? 'none' : 'block'}">
            Re-Initialize Engine
          </button>
        </div>

        <div style="margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
          <h3 style="margin-top: 0;">Agents (${this.engine.agents.length})</h3>
          <div id="agent-list">
            ${this.renderAgents()}
          </div>
          <button id="btn-add-agent" style="margin-top: 10px; width: 100%; padding: 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">
            + Add Agent
          </button>
        </div>

        <div id="add-agent-form" style="display: none; margin-bottom: 20px; background: #334155; padding: 15px; border-radius: 8px;">
           <h3 style="margin-top: 0;">New Agent</h3>
           <input type="text" id="new-agent-name" placeholder="Name" style="width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 8px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: white;" />
           <textarea id="new-agent-bio" placeholder="Biography" style="width: 100%; box-sizing: border-box; height: 60px; margin-bottom: 10px; padding: 8px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: white; resize: vertical;"></textarea>
           <input type="text" id="new-agent-interests" placeholder="Interests (comma separated)" style="width: 100%; box-sizing: border-box; margin-bottom: 10px; padding: 8px; border-radius: 4px; border: 1px solid #475569; background: #1e293b; color: white;" />

           <div style="display: flex; gap: 10px;">
             <button id="btn-save-agent" style="flex: 1; padding: 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
             <button id="btn-cancel-agent" style="flex: 1; padding: 8px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
           </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private renderAgents(): string {
     return this.engine.agents.map(a => {
         const initials = a.profile.name.substring(0, 2).toUpperCase();
         return `
          <div style="padding: 10px 0; border-bottom: 1px solid #475569; position: relative; display: flex; align-items: flex-start; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
              ${initials}
            </div>
            <div style="flex-grow: 1; min-width: 0;">
              <strong style="display: block; margin-bottom: 2px;">${a.profile.name}</strong>
              <small style="color: #cbd5e1; display: block; max-height: 40px; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">${a.currentTopic || 'No current thought'}</small>
            </div>
            <button class="btn-del-agent" data-id="${a.peerId}" style="background: transparent; color: #ef4444; border: 1px solid #ef4444; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 12px; margin-left: 5px;">X</button>
          </div>
        `;
     }).join('');
  }

  public updateAgents() {
     const listEl = this.el.querySelector('#agent-list');
     if (listEl) {
         listEl.innerHTML = this.renderAgents();

         const delBtns = listEl.querySelectorAll('.btn-del-agent');
         delBtns.forEach(btn => {
             btn.addEventListener('click', (e) => {
                 const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
                 if (id) {
                     this.engine.removeAgent(id);
                     this.render(); // full re-render to update counts
                 }
             });
         });
     }
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

    const inputUmap = this.el.querySelector('#input-umap-chance') as HTMLInputElement;
    if (inputUmap) {
      inputUmap.addEventListener('change', (e: any) => {
          let val = parseInt(e.target.value);
          if (!isNaN(val)) {
              if (val < 0) val = 0;
              if (val > 100) val = 100;
              e.target.value = val;
              this.engine.umapChance = val / 100;
          }
      });
    }

    const btnToggleUi = this.el.querySelector('#btn-toggle-ui');
    if (btnToggleUi) {
        btnToggleUi.addEventListener('click', () => {
            if (typeof (window as any).toggleUserUi === 'function') {
                (window as any).toggleUserUi();
            }
        });
    }

    const btnInitLlm = this.el.querySelector('#btn-init-llm');
    const selectModel = this.el.querySelector('#select-model') as HTMLSelectElement;

    if (btnInitLlm) {
      btnInitLlm.addEventListener('click', async () => {
        const statusEl = this.el.querySelector('#llm-status');
        if (statusEl) statusEl.innerHTML = 'Status: <span style="color: #fbbf24;">Loading model...</span>';

        this.llm.setProgressCallback((p) => {
          if (statusEl) statusEl.innerHTML = `Status: <span style="color: #60a5fa;">Loading: ${(p*100).toFixed(1)}%</span>`;
        });

        const selectedModel = selectModel ? selectModel.value : undefined;
        await this.llm.initialize(selectedModel);
        this.render();
      });
    }

    // Add/Delete Agent logic
    const delBtns = this.el.querySelectorAll('.btn-del-agent');
    delBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
            if (id) {
                this.engine.removeAgent(id);
                this.render();
            }
        });
    });

    const btnAddAgent = this.el.querySelector('#btn-add-agent');
    const formAddAgent = this.el.querySelector('#add-agent-form') as HTMLElement;
    const btnCancelAgent = this.el.querySelector('#btn-cancel-agent');
    const btnSaveAgent = this.el.querySelector('#btn-save-agent');

    if (btnAddAgent && formAddAgent) {
        btnAddAgent.addEventListener('click', () => {
            formAddAgent.style.display = 'block';
            (btnAddAgent as HTMLElement).style.display = 'none';
        });
    }

    if (btnCancelAgent && formAddAgent && btnAddAgent) {
        btnCancelAgent.addEventListener('click', () => {
            formAddAgent.style.display = 'none';
            (btnAddAgent as HTMLElement).style.display = 'block';
        });
    }

    if (btnSaveAgent) {
        btnSaveAgent.addEventListener('click', () => {
            const nameEl = this.el.querySelector('#new-agent-name') as HTMLInputElement;
            const bioEl = this.el.querySelector('#new-agent-bio') as HTMLTextAreaElement;
            const interestsEl = this.el.querySelector('#new-agent-interests') as HTMLInputElement;

            if (nameEl && bioEl && interestsEl && nameEl.value.trim() !== '') {
                this.engine.addAgent({
                    name: nameEl.value.trim(),
                    bio: bioEl.value.trim(),
                    interests: interestsEl.value.split(',').map(i => i.trim()).filter(i => i !== '')
                });

                this.engine.forceUpdatePositions();
                this.render();
            }
        });
    }
  }
}
