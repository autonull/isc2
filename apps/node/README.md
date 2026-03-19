# ISC Relay Node

Production-ready relay/supernode for the ISC decentralized network.

## Features

- **Circuit Relay**: Allows browser peers to connect via WebSockets and proxy connections
- **DHT Server**: Helps peers discover each other via distributed hash table
- **PubSub**: GossipSub protocol for message broadcasting
- **Simulator (Optional)**: Bot activity for demo/testing networks
- **Admin API**: WebSocket + HTTP interface for node management

## Quick Start

### Basic Relay Node

```bash
# Install dependencies
pnpm install

# Run development mode
pnpm --filter @isc/apps/node dev

# Or build and run
pnpm --filter @isc/apps/node build
pnpm --filter @isc/apps/node start
```

### Relay Node with Simulator

Enable bot simulation to populate your network with synthetic activity:

```bash
# Environment variables
export ISC_SIMULATOR=true      # Enable simulator
export ISC_BOT_COUNT=10        # Number of bots (default: 5)
export ISC_ADMIN_TOKEN=secret  # Admin API token
export ISC_ADMIN_PORT=9091     # Admin API port

# Run with simulator
pnpm --filter @isc/apps/node dev
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ISC_SIMULATOR` | `false` | Enable bot simulator |
| `ISC_BOT_COUNT` | `5` | Number of bots to create |
| `ISC_ADMIN_TOKEN` | `admin-token-change-me` | Admin API authentication |
| `ISC_ADMIN_PORT` | `9091` | Admin API port |

## Admin Interface

The admin API provides both WebSocket and HTTP interfaces:

### Web UI

Open `http://localhost:9091` in your browser to access the admin dashboard:

- View node status and metrics
- Start/stop simulator
- Adjust bot count
- View active bots
- Watch live logs

### WebSocket API

Connect to `ws://localhost:9091` and send JSON commands:

```javascript
// Connect
const ws = new WebSocket('ws://localhost:9091');

// Authenticate and get status
ws.send(JSON.stringify({
  id: '1',
  action: 'status',
  authToken: 'your-token'
}));

// Start simulator with 10 bots
ws.send(JSON.stringify({
  id: '2',
  action: 'simulator:start',
  params: { botCount: 10 },
  authToken: 'your-token'
}));

// Get simulator status
ws.send(JSON.stringify({
  id: '3',
  action: 'simulator:status',
  authToken: 'your-token'
}));
```

### API Actions

| Action | Description |
|--------|-------------|
| `status` | Get node status and metrics |
| `config` | Update node configuration |
| `simulator:start` | Start simulator with bot count |
| `simulator:stop` | Stop simulator |
| `simulator:status` | Get simulator metrics |
| `simulator:config` | Update simulator config |
| `simulator:bots` | List active bots |
| `peers` | Get connected peers |
| `logs` | Get log buffer |

## Bot Behavior

Simulated bots:

- Have clearly marked names: `"{Name} (Bot)"`
- Post messages about their topics of interest
- Participate in DHT discovery
- Are **non-persistent** (reset on node restart)
- Can create content that **persists** if the network persists

## Running a Public Relay

To run a public relay node:

1. **Configure addresses** for public access:
   ```javascript
   addresses: {
     listen: [
       '/ip4/0.0.0.0/tcp/9090/ws',
       '/ip4/0.0.0.0/udp/9091/quic-v1/webtransport'
     ]
   }
   ```

2. **Set up reverse proxy** (nginx example):
   ```nginx
   location / {
     proxy_pass http://localhost:9090;
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
   }
   ```

3. **Secure admin API**:
   - Change `ISC_ADMIN_TOKEN`
   - Use `ISC_ADMIN_PORT` on internal network only
   - Or enable `allowedIPs` in config

4. **Consider disabling simulator** on public nodes:
   ```bash
   export ISC_SIMULATOR=false
   ```

## Bootstrap Node

Other nodes can use your relay as a bootstrap node:

```javascript
import { createLibp2p } from 'libp2p';
import { bootstrap } from '@libp2p/bootstrap';

const node = await createLibp2p({
  peerDiscovery: [
    bootstrap({
      list: [
        '/ip4/your-relay-ip/tcp/9090/ws/p2p/your-peer-id'
      ]
    })
  ]
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   ISC Relay Node                        │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Relay     │  │  Supernode  │  │   Simulator     │ │
│  │  (circuit   │  │  (delegated │  │   (optional)    │ │
│  │   relay,    │  │   compute)  │  │                 │ │
│  │   DHT)      │  │             │  │                 │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │           Admin API (WebSocket + HTTP)            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Development

```bash
# Run tests
pnpm --filter @isc/apps/node test

# Type check
pnpm --filter @isc/apps/node typecheck

# Lint
pnpm --filter @isc/apps/node lint
```

## License

MIT
