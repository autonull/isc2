# ISC - Frequently Asked Questions

**Version**: 0.1.0  
**Last Updated**: March 12, 2026

---

## General Questions

### What is ISC?

**ISC (Internet Semantic Chat)** is a decentralized, peer-to-peer social platform that connects you with people thinking similar thoughts. Unlike traditional social media:

- ❌ No accounts or signups
- ❌ No central servers
- ❌ No algorithms feeding you content
- ❌ No tracking or data collection
- ✅ Real semantic AI matching
- ✅ Direct peer-to-peer communication
- ✅ Complete privacy

---

### How does semantic matching work?

ISC uses **real AI embeddings** (specifically the `all-MiniLM-L6-v2` model) to understand the *meaning* of your thoughts, not just keywords.

**Example**:
- Your thought: "AI ethics and machine learning morality"
- Match: "Ethical implications of autonomous AI systems"
- Result: **High similarity** (even with different words!)

The AI model runs entirely in your browser—no API calls, no data sent to servers.

---

### Is ISC really free?

**Yes, 100% free.** ISC is open-source software (MIT license) with:
- No premium features
- No subscriptions
- No ads
- No hidden costs

---

## Privacy & Security

### Is my data private?

**Yes.** ISC is designed with privacy as a core principle:

1. **No accounts** - No email, phone, or personal info required
2. **Local identity** - Cryptographic keypair generated on your device
3. **P2P communication** - Messages go directly peer-to-peer via WebRTC
4. **No servers** - DHT (Distributed Hash Table) for discovery only
5. **Ephemeral by default** - Messages don't persist indefinitely

---

### What data is stored?

**Locally on your device**:
- Your cryptographic identity (keypair)
- Channels you create
- Chat conversations (until cleared)
- Cached AI model (~200MB)

**Not stored anywhere**:
- Your personal information
- Browsing history
- Message metadata
- IP addresses (beyond what's needed for P2P)

---

### Can someone impersonate me?

**No.** Your identity is a cryptographic keypair:
- Private key never leaves your device
- All messages are signed with your key
- Peers verify signatures before accepting messages
- Impersonation is cryptographically infeasible

---

### Is ISC secure?

**Yes.** Security features include:

1. **Signature verification** - All incoming data is verified
2. **XSS protection** - User content is sanitized (DOMPurify)
3. **Rate limiting** - Prevents spam and DoS attacks
4. **Peer blocking** - Abusive peers are automatically blocked
5. **Encrypted transport** - libp2p uses Noise protocol

---

## Technical Questions

### What browsers are supported?

**Recommended**:
- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 15+

**Required features**:
- WebRTC (for peer-to-peer chat)
- IndexedDB (for local storage)
- Web Crypto API (for cryptography)
- Service Workers (for PWA features)

---

### Does ISC work offline?

**Partially.** You can:
- ✅ View cached channels and conversations
- ✅ Create new channels (saved locally)
- ❌ Discover new matches (requires DHT)
- ❌ Send/receive messages (requires P2P connection)

When you reconnect, your channels re-announce automatically.

---

### How much data does ISC use?

**Initial load**: ~1MB (app) + ~22MB (AI model, first time only)

**Ongoing usage** (per hour of active use):
- DHT queries: ~100KB
- Chat messages: ~50KB (text only)
- Video calls: ~500MB (varies by quality)

**Data Saver mode** reduces AI model quality for slower connections.

---

### Where are the bootstrap peers?

ISC connects to public libp2p relay nodes:
- `/dns4/relay.libp2p.io/tcp/443/wss/p2p/...`

These are used only for initial peer discovery. After that, communication is direct peer-to-peer.

---

### Can I self-host bootstrap peers?

**Yes!** ISC uses standard libp2p protocols. To run your own bootstrap node:

```bash
# Example libp2p relay setup
docker run -p 4001:4001 libp2p/relay
```

Then configure in `apps/browser/src/network/dht.ts`.

---

## Usage Questions

### How do I create a channel?

1. Click **Compose** (➕)
2. Enter a name and detailed description
3. Adjust specificity if needed
4. Add optional context (location, time, etc.)
5. Click **Save**

Your channel is now active and announced to the DHT!

---

### Why aren't I finding matches?

**Common reasons**:
1. **New network** - Few peers online currently
2. **Vague description** - Be more specific and detailed
3. **Niche topic** - Try broader terms
4. **Offline** - Check your connection

**Solutions**:
- Edit your channel with a richer description
- Try different specificity levels
- Come back when more users are online
- Share ISC with friends!

---

### How do I start a chat?

1. Go to **Discover** tab
2. Find a match with good similarity
3. Click **Start Chat**
4. Send a greeting: "Hey, our thoughts are proximal!"
5. Wait for their response (they may be offline)

---

### What do the message status icons mean?

| Icon | Status | Meaning |
|------|--------|---------|
| ⏳ | Pending | Message is being sent |
| ✓ | Sent | Delivered to network |
| ✓✓ | Delivered | Received by peer (green) |
| ⚠️ | Failed | Delivery failed, retry |

---

### Can I delete my messages?

**Yes and no**:
- You can clear your local data (Settings → Data → Clear All)
- But P2P means the other person may have a copy
- Ephemeral mode auto-deletes after TTL (configurable)

---

### How do video calls work?

Video calls use **WebRTC** for direct peer-to-peer video:

1. Create a call from Video tab
2. Send invitation to peer (direct or group)
3. Peer accepts
4. WebRTC establishes direct connection
5. Video/audio streams directly between peers

**No servers relay your video!**

---

## Troubleshooting

### "Model loading takes forever"

**First-time download**: The AI model is ~22MB and downloads on first use.

**Solutions**:
- Wait (should complete in <30s on broadband)
- Check your connection
- Subsequent loads use cache (<3s)

---

### "Camera/microphone permission denied"

**Browser blocked access**:

**Fix**:
1. Click the 🔒 icon in address bar
2. Site settings → Camera/Microphone → Allow
3. Refresh the page

**Still not working?**
- Close other apps using camera
- Check OS-level permissions
- Try a different browser

---

### "Messages not sending"

**Possible causes**:
- Peer is offline
- Network connection lost
- Rate limit exceeded

**Solutions**:
- Check your connection
- Wait a few minutes (rate limits reset)
- Try refreshing the page

---

### "App crashes/freezes"

**Try these**:
1. Refresh the page
2. Clear browser cache
3. Try a different browser
4. Check console for errors (F12)

**Still broken?** Report a bug on GitHub!

---

## Account & Identity

### I lost my identity. Can I recover it?

**No.** Your identity is stored locally:
- If you clear browser data, it's gone
- No account = no recovery
- This is by design for privacy

**Tip**: Export your data regularly (Settings → Data → Export).

---

### Can I have multiple identities?

**Yes!** Clear your data and start fresh, or:
- Use different browsers
- Use incognito/private mode
- Use browser profiles

---

### Can I change my peer ID?

**No.** Your peer ID is derived from your cryptographic keypair. To get a new one:
1. Clear all data
2. Reload the app
3. New keypair is generated

---

## Development

### Is ISC open-source?

**Yes!** MIT license. Find us on GitHub.

### Can I contribute?

**Absolutely!** We welcome:
- Bug reports
- Feature requests
- Code contributions
- Documentation improvements

See `docs/CONTRIBUTING.md` for guidelines.

---

### How do I run ISC locally?

```bash
# Clone the repo
git clone https://github.com/your-org/isc2.git
cd isc2

# Install dependencies
pnpm install

# Run development server
pnpm dev:browser

# Open http://localhost:5173
```

See `README.md` for full setup instructions.

---

## Legal

### What license is ISC under?

**MIT License** - Free to use, modify, and distribute.

### Who is responsible for user content?

**No one.** ISC is a protocol, not a platform:
- No central server hosts content
- Users are responsible for their own content
- Content is ephemeral and peer-to-peer

---

## Still Have Questions?

Check out:
- `GETTING_STARTED.md` - User guide
- `docs/ARCHITECTURE.md` - Technical details
- `docs/CONTRIBUTING.md` - How to contribute

Or reach out via GitHub issues!
