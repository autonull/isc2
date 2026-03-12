# ISC Frequently Asked Questions

## General Questions

### What is ISC?

ISC (Internet Semantic Chat) is a fully decentralized, browser-only social platform that connects you with people thinking about similar concepts. Instead of matching by keywords or topics, ISC uses AI embeddings to understand the semantic meaning of your thoughts and finds people with proximal thinking — even if they use completely different words.

### How is ISC different from Twitter/X or other social networks?

| Feature | Traditional Social Networks | ISC |
|---------|---------------------------|-----|
| **Identity** | Account-based with email/phone | Cryptographic keypair, no accounts |
| **Discovery** | Algorithmic feed, keywords | Semantic similarity via embeddings |
| **Storage** | Centralized servers | Your browser (localStorage/IndexedDB) |
| **Privacy** | Data collection, ads | No tracking, no ads, E2E encrypted |
| **Censorship** | Central moderation | Community-driven, opt-in filters |

### Is ISC free?

Yes, ISC is completely free and open source (MIT license). There are no premium features, no ads, and no data collection.

### Do I need to create an account?

No. ISC uses cryptographic keypairs generated locally in your browser. Your "identity" is your public key — no email, password, or phone number required.

---

## Technical Questions

### How does semantic matching work?

1. **Embedding**: Your channel description is converted to a 384-dimensional vector using a local AI model
2. **LSH Hashing**: The vector is hashed using Locality-Sensitive Hashing for efficient lookup
3. **DHT Query**: The hash is used to query the distributed hash table for similar vectors
4. **Similarity Ranking**: Results are ranked by cosine similarity to find the closest matches

### What AI model does ISC use?

ISC uses `Xenova/all-MiniLM-L6-v2`, a sentence-transformers model that:
- Runs entirely in your browser via WebAssembly
- Produces 384-dimensional embeddings
- Is quantized for efficiency (~22MB download)
- Works offline after initial load

### Where is my data stored?

All data is stored locally in your browser:
- **Identity**: IndexedDB (optionally encrypted with passphrase)
- **Channels**: IndexedDB
- **Messages**: localStorage
- **Settings**: localStorage

Nothing is stored on central servers.

### How does peer-to-peer communication work?

ISC uses libp2p for P2P networking:
1. **Discovery**: Kademlia DHT for peer discovery
2. **Connection**: WebRTC for direct browser-to-browser connections
3. **Encryption**: Noise protocol + DTLS for E2E encryption
4. **Fallback**: Circuit relays for NAT traversal

### What happens if the other person goes offline?

Messages are queued locally and delivered when the peer reconnects. If they don't reconnect within the TTL (time-to-live), the message expires naturally.

---

## Privacy & Security

### Is my data private?

Yes. ISC provides strong privacy guarantees:
- No central servers collecting data
- All embeddings computed locally
- E2E encrypted chat via WebRTC
- Ephemeral announcements (5-minute TTL)
- No persistent profiles

### Can someone trace messages back to me?

Your cryptographic identity (public key) is visible to peers you interact with, but:
- It's not linked to any real-world identity
- It changes if you clear your browser data
- Messages are not stored on any server

### What information is announced to the DHT?

Only the following is announced:
- Your peer ID (cryptographic identity)
- Channel embedding vector (not the raw text)
- Model version used
- Timestamp and TTL

The raw text of your channel description is **never** broadcast.

### Can I be doxxed through ISC?

Risk is minimal if you follow best practices:
- Don't include identifying information in channel descriptions
- Be careful with location relations
- Use the block/mute features if needed
- Clear browser data to generate new identity

### Is the code open source?

Yes, ISC is fully open source under the MIT license. You can audit the code at any time.

---

## Usage Questions

### Why am I not finding any matches?

Possible reasons:
1. **No peers online**: ISC is early-stage; try different times
2. **Generic description**: Be more specific about your thinking
3. **Model mismatch**: Ensure you're using the default model
4. **Network issues**: Check your connection, refresh the page

### How do I create multiple channels?

1. Go to the **Compose** tab
2. Create a new channel with a different name
3. Switch between channels using the channel header (desktop) or channel switcher (mobile)

Each channel maintains independent matches and conversations.

### Can I edit my channel after creating it?

Yes. Go to **Compose**, select the channel you want to edit, modify the description or relations, and save. The new embedding will be announced to the DHT within seconds.

### How do I block someone?

1. Open the chat with the person
2. Click the menu (⋮) in the chat header
3. Select **Block User**

Blocked users cannot message you or appear in your match results.

### Can I use ISC offline?

Yes! ISC is offline-first:
- Create channels offline
- Draft messages offline
- View cached matches and conversations
- Actions sync automatically when you reconnect

### What are "relations" in channels?

Relations add contextual binding to your channel:
- `in_location`: Geographic or virtual location
- `during_time`: Temporal context
- `with_mood`: Emotional or tonal context
- `under_domain`: Subject area or discipline
- `causes_effect`: Causal relationships
- And 5 more relation types

Relations create "fused distributions" that enable more nuanced matching.

---

## Video Calls

### How do video calls work?

Video calls use WebRTC for direct browser-to-browser video:
1. **Signaling**: Call invitations via DHT
2. **Connection**: Direct WebRTC peer connection
3. **Media**: Encrypted video/audio streams
4. **Controls**: Mute, video toggle, screen sharing

### Why is my video not working?

Common issues:
- **Permissions**: Grant camera/microphone access in browser
- **In use**: Another app may be using the camera
- **Hardware**: Check if camera is connected and working
- **Browser**: Try a different browser (Chrome recommended)

### How many people can join a video call?

Maximum 8 participants per call. For larger groups, consider creating a community audio space.

### Is video call quality adjustable?

Yes. Go to **Settings** → **Video** and select:
- **Low**: 480p, 15fps (best for slow connections)
- **Medium**: 720p, 30fps (default)
- **High**: 1080p, 30fps (best quality, more bandwidth)

---

## Troubleshooting

### The app won't load

1. Clear browser cache: `Ctrl+Shift+Delete` → Clear cache
2. Try incognito/private mode
3. Check browser console for errors (`F12`)
4. Ensure JavaScript is enabled
5. Try a different browser

### Messages aren't sending

1. Check network connection
2. Verify peer is still online
3. Refresh the page
4. Check browser console for errors

### Matches aren't appearing

1. Create a more specific channel description
2. Wait a few minutes for DHT propagation
3. Refresh the Discover tab
4. Check if DHT is connected (Settings → Network)

### Video calls fail to connect

1. Grant camera/microphone permissions
2. Check firewall settings (WebRTC ports)
3. Try with a different peer
4. Check browser console for WebRTC errors

### The app is slow

1. Close unused channels
2. Clear message history (Settings → Data)
3. Lower video quality (Settings → Video)
4. Reduce number of open tabs

---

## Development Questions

### How can I contribute?

ISC is open source! Ways to contribute:
- **Code**: Submit PRs on GitHub
- **Documentation**: Improve docs
- **Testing**: Report bugs, write tests
- **Community**: Help other users

### Can I self-host ISC?

Yes! ISC can be deployed anywhere static files are served:
- GitHub Pages
- Netlify
- Vercel
- IPFS
- Your own server

See `docs/DEPLOYMENT.md` for deployment instructions.

### How do I run a supernode?

Supernodes assist low-power devices with computation:
1. Have a high-tier device (4+ cores, 4+ GB RAM)
2. Run the browser app with `?supernode=true`
3. Keep the tab open to advertise capabilities
4. Earn reputation for helping peers

### What's the roadmap?

See [ROADMAP.md](../ROADMAP.md) for the complete development timeline:
- **Phase 1** (Q1-Q2 2026): Core reliability
- **Phase 2** (Q3-Q4 2026): Scale & safety
- **Phase 3** (2027): Social layer
- **Phase 4** (2028+): Ecosystem

---

## Still Have Questions?

- **Documentation**: Browse [docs/](../docs/)
- **Issues**: Report bugs on GitHub
- **Discussions**: Ask questions in GitHub Discussions
- **Security**: Report vulnerabilities via security@isc.example

---

**ISC routes by semantic geometry, not topic labels.**
