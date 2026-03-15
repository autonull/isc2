# ISC Network TUI Simulator

A Text-based User Interface (TUI) network simulator for Internet Semantic Chat (ISC) using actual Libp2p networking and local Semantic Embeddings (ONNX/Xenova all-MiniLM-L6-v2).

## Features
- **N-Peer Mesh Simulation**: Runs multiple independent libp2p nodes in a single process.
- **Split-screen TUI**: Displays logs and input boxes side-by-side using `blessed`.
- **Semantic Messaging**: Broadcasts messages directly to peers over Libp2p Streams, routing based on `cosineSimilarity` between each peer's descriptive embedding vector.

## Quick Start
```bash
# Run simulator with default 2 peers
node apps/tui/test.js

# Run with N peers (e.g. 3)
npx tsx apps/tui/src/test-runner.ts 3
```

## Navigation
- `TAB`: Switch focus between input boxes.
- `ENTER`: Send a message.
- `ESC / C-c / q`: Exit the simulator.
