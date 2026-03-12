# Getting Started with ISC

> **Internet Semantic Chat** - Meet your thought neighbors.

Welcome to ISC, a fully decentralized, browser-only social platform that uses in-browser LLM embeddings to place ideas in a shared vector space — then serendipitously connects you with peers whose mental distributions are closest to yours.

## Quick Start

### Option 1: Browser PWA (Recommended)

1. **Open the app**: Navigate to your ISC instance in any modern browser
2. **Install as PWA**: Click the install icon in your browser's address bar
3. **Create your first channel**: Describe what you're thinking about
4. **Discover peers**: Find people with similar thoughts
5. **Start chatting**: Connect via encrypted WebRTC

### Option 2: CLI Client

```bash
# Install dependencies
pnpm install

# Build the CLI
cd apps/cli && pnpm build

# Initialize your identity
node dist/index.js init

# Create a channel
node dist/index.js channel create "AI Ethics" -d "Ethical implications of machine learning"

# Announce to DHT
node dist/index.js announce channel "AI Ethics"

# Query for semantic matches
node dist/index.js query semantic
```

## First Steps

### 1. Create Your Identity

On first launch, ISC automatically generates a cryptographic identity (ed25519 keypair) stored locally in your browser. This is your decentralized identity — no accounts, no passwords.

**Optional**: Set a passphrase to encrypt your private key for additional security.

### 2. Create Your First Channel

A **channel** represents what you're thinking about right now.

- **Name**: Give your thought a name (e.g., "AI Ethics")
- **Description**: Describe your thinking (e.g., "Ethical implications of machine learning and autonomy")
- **Relations** (optional): Add context like location, time, mood, domain

Example:
```
Name: AI Ethics
Description: Exploring the ethical implications of autonomous AI systems
Relations:
  - in_location: Remote work context
  - with_mood: Reflective and curious
  - under_domain: Philosophy, Technology
```

### 3. Discover Peers

Click the **Discover** tab to find peers with similar thoughts. ISC uses semantic matching to find people thinking about similar concepts, even if they use different words.

**Proximity levels**:
- **Very Close** (≥85% similarity): Strong semantic match
- **Nearby** (70-85% similarity): Related thinking
- **Orbiting** (55-70% similarity): Tangential connection

### 4. Start Chatting

Click **Start Chat** on any match to open an encrypted WebRTC conversation. Messages are:
- End-to-end encrypted
- Signed with your cryptographic identity
- Delivered with read receipts

## Features

### Core Features

| Feature | Description |
|---------|-------------|
| **Semantic Matching** | Find peers by thought similarity, not keywords |
| **Encrypted Chat** | WebRTC DTLS + Noise protocol encryption |
| **Multiple Channels** | Manage multiple thought contexts simultaneously |
| **Offline-First** | Works offline, syncs when reconnected |
| **PWA Installable** | Install as a native app on any device |

### Social Features

| Feature | Description |
|---------|-------------|
| **Posts** | Share thoughts with your semantic neighborhood |
| **For You Feed** | Discover posts ranked by semantic similarity |
| **Following Feed** | See posts from people you follow |
| **Likes & Reposts** | Engage with content semantically |
| **Video Calls** | Face-to-face conversations via WebRTC |

### Advanced Features

| Feature | Description |
|---------|-------------|
| **Supernode Delegation** | Low-power devices can delegate computation |
| **Reputation System** | Build trust through verified interactions |
| **Communities** | Shared channel distributions for groups |
| **Chaos Mode** | Add randomness for serendipitous discovery |

## Tips & Tricks

### Writing Good Channel Descriptions

✅ **Do**:
- Be specific about your thinking
- Use natural language
- Include context when relevant
- Update as your thoughts evolve

❌ **Don't**:
- Use keyword stuffing
- Write overly generic descriptions
- Include personal information

### Finding Better Matches

1. **Be specific**: "Distributed consensus in Byzantine fault-tolerant systems" matches better than "blockchain"
2. **Add relations**: Location, time, and mood context improve matching
3. **Update regularly**: As your thinking evolves, update your channels
4. **Multiple channels**: Create channels for different thought threads

### Privacy Best Practices

- **No personal info**: Don't include identifying information in channel descriptions
- **Use relations carefully**: Location relations reveal geographic information
- **Ephemeral by default**: Announcements expire after 5 minutes
- **Block/mute**: Use moderation tools if needed

## Troubleshooting

### Common Issues

**"No matches found"**
- Create a more specific channel description
- Wait for more peers to announce
- Check your network connection
- Try refreshing the Discover tab

**"Message not delivered"**
- Check if peer is still online
- Verify your network connection
- Peer may have gone offline
- Message will retry when peer reconnects

**"Camera/microphone not working"**
- Grant permissions in browser settings
- Check if another app is using the device
- Try lowering video quality in settings
- Restart your browser

**"App won't load"**
- Clear browser cache and reload
- Check browser compatibility (Chrome, Firefox, Safari, Edge)
- Ensure JavaScript is enabled
- Try incognito/private mode

### Getting Help

- **Documentation**: Browse the [docs/](docs/) folder
- **Issues**: Report bugs on GitHub
- **Community**: Join community discussions

## Next Steps

1. **Explore the interface**: Try all tabs (Now, Discover, Chats, Settings)
2. **Create multiple channels**: Experiment with different thought contexts
3. **Find your first match**: Discover peers with similar thinking
4. **Start a conversation**: Say hello to a thought neighbor
5. **Share your experience**: Help others discover ISC

---

**Welcome to decentralized social networking. Route by semantic geometry, not topic labels.**
