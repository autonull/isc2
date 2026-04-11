import { SimulationEngine, LLMService } from './simulation';
import { DashboardComponent } from './components/Dashboard';
import { SpaceCanvas } from './components/SpaceCanvas';

import './style.css';

async function bootstrap() {
  const engine = new SimulationEngine();
  const llm = new LLMService();
  engine.setLLM(llm);

  // Auto-initialize the LLM service to start right out of the box
  // The LLMService progress callbacks will be hooked up by the Dashboard shortly
  setTimeout(() => {
    llm.initialize('SmolLM2-135M-Instruct-q4f16_1-MLC').catch(e => {
        console.error("Failed auto-initialization of LLM:", e);
    });
  }, 500);

  // Auto-start the engine simulation
  setTimeout(() => {
     engine.start();
  }, 1000);

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

    // 3. User UI Layer (Hidden by default)
    const userUiContainer = document.createElement('div');
    userUiContainer.id = 'user-ui-container';
    userUiContainer.style.position = 'absolute';
    userUiContainer.style.top = '20px';
    userUiContainer.style.right = '20px';
    userUiContainer.style.width = '1000px';
    userUiContainer.style.maxWidth = 'calc(100vw - 400px)';
    userUiContainer.style.height = 'calc(100vh - 40px)';
    userUiContainer.style.zIndex = '1000';
    userUiContainer.style.display = 'none';
    userUiContainer.style.borderRadius = '12px';
    userUiContainer.style.overflow = 'hidden';
    userUiContainer.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    userUiContainer.style.border = '1px solid #475569';
    // Add flexbox to let UI take full height smoothly
    userUiContainer.style.display = 'none';
    userUiContainer.style.flexDirection = 'column';
    appEl.appendChild(userUiContainer);

    // Provide a way to close the UI layer
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close UI ✕';
    closeBtn.style.padding = '8px';
    closeBtn.style.background = '#ef4444';
    closeBtn.style.color = 'white';
    closeBtn.style.border = 'none';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.zIndex = '1001';
    closeBtn.addEventListener('click', () => {
        userUiContainer.style.display = 'none';
    });
    userUiContainer.appendChild(closeBtn);

    // Container for the actual app
    const appWrapper = document.createElement('div');
    appWrapper.style.flex = '1';
    appWrapper.style.position = 'relative';
    appWrapper.style.overflow = 'hidden';
    appWrapper.style.background = '#1e2028'; // Match IRC theme bg
    appWrapper.style.display = 'flex';
    appWrapper.style.flexDirection = 'column';
    userUiContainer.appendChild(appWrapper);

    // Expose toggle logic to Dashboard
    (window as any).toggleUserUi = async () => {
        if (userUiContainer.style.display === 'none') {
            userUiContainer.style.display = 'flex';

            // Only initialize once
            if (!appWrapper.hasChildNodes()) {
                const uiRoot = document.createElement('div');
                uiRoot.id = 'app'; // Important for ISC vanilla CSS selectors
                uiRoot.className = 'app'; // Important for layout!
                uiRoot.style.width = '100%';
                uiRoot.style.height = '100%';
                appWrapper.appendChild(uiRoot);

                // Set localStorage to enable test mode/bypass PWA so it runs smoothly embedded
                localStorage.setItem('isc-test-mode', 'true');
                localStorage.setItem('isc-onboarding-completed', 'true');

                // Load required CSS from the main app
                import('@isc/apps/browser/styles/main.css');
                import('@isc/apps/browser/vanilla/styles/irc.css');

                // Dynamically import the browser app
                const { createApp } = await import('@isc/apps/browser/vanilla/app');

                // Provide the shared Network Medium to the real app's DI
                const { browserNetwork } = await import('@isc/adapters/browser/network.js');

                // We monkey-patch the BrowserNetworkAdapter instance to route traffic through the Simulation Engine's Medium
                const localAdapter = engine.networkMedium.createPeer('human-user');

                browserNetwork.announce = localAdapter.announce.bind(localAdapter);
                browserNetwork.query = localAdapter.query.bind(localAdapter);
                browserNetwork.publish = localAdapter.publish.bind(localAdapter);
                browserNetwork.subscribe = localAdapter.subscribe.bind(localAdapter);
                browserNetwork.unsubscribe = localAdapter.unsubscribe.bind(localAdapter);
                browserNetwork.start = async () => {}; // Bypass real libp2p
                browserNetwork.stop = async () => {};

                const app = createApp(uiRoot);
                await app.start();
            }
        } else {
            userUiContainer.style.display = 'none';
        }
    };

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
