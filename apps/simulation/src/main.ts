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

    // 1. Create a dedicated root canvas layer that takes up the FULL screen, under everything
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvas-container';
    canvasContainer.style.position = 'absolute';
    canvasContainer.style.top = '0';
    canvasContainer.style.left = '0';
    canvasContainer.style.width = '100vw';
    canvasContainer.style.height = '100vh';
    canvasContainer.style.zIndex = '1';

    const canvasEl = document.createElement('canvas');
    canvasEl.id = 'sim-canvas';
    canvasEl.width = window.innerWidth;
    canvasEl.height = window.innerHeight;
    canvasEl.style.display = 'block';

    canvasContainer.appendChild(canvasEl);
    appEl.appendChild(canvasContainer);

    // 2. Create the Dashboard Layer overlay
    const dashContainer = document.createElement('div');
    dashContainer.id = 'dash-container';
    dashContainer.style.position = 'absolute';
    dashContainer.style.top = '0';
    dashContainer.style.left = '0';
    dashContainer.style.zIndex = '10';
    appEl.appendChild(dashContainer);

    const dashboard = new DashboardComponent(dashContainer, engine, llm);

    // Let it layout first
    setTimeout(() => {
        const spaceCanvas = new SpaceCanvas(canvasEl);
        spaceCanvas.setAgents(engine.agents, engine.agentPositions);

        // Force explicit resize on class instance
        spaceCanvas.resize();

        setInterval(() => {
            dashboard.updateAgents();

            // Force size check every tick against full window
            if (canvasEl.width !== window.innerWidth) canvasEl.width = window.innerWidth;
            if (canvasEl.height !== window.innerHeight) canvasEl.height = window.innerHeight;

            spaceCanvas.setAgents(engine.agents, engine.agentPositions);
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
                appEl.appendChild(chatDiv); // Append to appEl to be above canvas
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

bootstrap();
