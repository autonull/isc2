import { SimulationEngine, LLMService } from './simulation';
import { DashboardComponent } from './components/Dashboard';
import { SpaceCanvas } from './components/SpaceCanvas';

import './style.css';

async function bootstrap() {
  const engine = new SimulationEngine();
  const llm = new LLMService();
  engine.setLLM(llm);

  // Add default agents
  engine.addAgent({
    name: "Alice",
    bio: "A cryptography enthusiast who loves distributed systems.",
    interests: ["cryptography", "p2p", "security"]
  });
  engine.addAgent({
    name: "Bob",
    bio: "An AI researcher focusing on local LLMs and semantic embeddings.",
    interests: ["machine learning", "embeddings", "ai"]
  });
  engine.addAgent({
    name: "Charlie",
    bio: "A frontend developer passionate about decentralized UIs.",
    interests: ["ui/ux", "web components", "decentralization"]
  });
  engine.addAgent({
    name: "Diana",
    bio: "A systems engineer interested in network protocols.",
    interests: ["networking", "protocols", "architecture"]
  });

  const appEl = document.getElementById('app');
  if (appEl) {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#0f172a';

    const dashboard = new DashboardComponent(appEl, engine, llm);

    // Create canvas explicitly instead of trusting the string template innerHTML
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        canvasContainer.innerHTML = '';
        const canvasEl = document.createElement('canvas');
        canvasEl.id = 'sim-canvas';
        canvasEl.style.position = 'absolute';
        canvasEl.style.top = '0';
        canvasEl.style.left = '0';
        canvasEl.style.width = '100%';
        canvasEl.style.height = '100%';
        canvasEl.style.display = 'block';
        canvasContainer.appendChild(canvasEl);

        // Let it layout first
        setTimeout(() => {
            const spaceCanvas = new SpaceCanvas(canvasEl);
            spaceCanvas.setAgents(engine.agents);

            setInterval(() => {
              const listEl = document.getElementById('agent-list');
              if (listEl) {
                listEl.innerHTML = engine.agents.map(a => `
                  <div style="padding: 5px 0; border-bottom: 1px solid #475569;">
                    <strong>${a.profile.name}</strong><br/>
                    <small style="color: #cbd5e1;">${a.currentTopic || 'No current thought'}</small>
                  </div>
                `).join('');
              }

              spaceCanvas.setAgents(engine.agents);
              // Pass engine edges down to canvas for rendering
              spaceCanvas.setEdges(engine.recentEdges);

              const chatContainer = document.getElementById('chat-container');
              if (!chatContainer) {
                  const chatDiv = document.createElement('div');
                  chatDiv.id = 'chat-container';
                  chatDiv.style.position = 'absolute';
                  chatDiv.style.bottom = '20px';
                  chatDiv.style.right = '20px';
                  chatDiv.style.width = '300px';
                  chatDiv.style.maxHeight = '300px';
                  chatDiv.style.background = 'rgba(30, 41, 59, 0.9)';
                  chatDiv.style.color = 'white';
                  chatDiv.style.borderRadius = '8px';
                  chatDiv.style.padding = '10px';
                  chatDiv.style.overflowY = 'auto';
                  chatDiv.style.fontFamily = 'system-ui';
                  chatDiv.style.zIndex = '100';
                  canvasContainer.appendChild(chatDiv);
              } else {
                  chatContainer.innerHTML = '<strong>Global Feed (DHT)</strong><br/><br/>' +
                    engine.dhtNetwork.slice(-10).map(d => {
                        const agent = engine.agents.find(a => a.peerId === d.peerId);
                        const name = agent ? agent.profile.name : 'Unknown';
                        return `<div style="margin-bottom: 5px;"><strong style="color: #60a5fa;">${name}</strong>: <span style="color: #cbd5e1; font-size: 0.9em;">${d.topic}</span></div>`;
                    }).join('');
              }
            }, 1000);
        }, 100);
    }
  }
}

bootstrap();
