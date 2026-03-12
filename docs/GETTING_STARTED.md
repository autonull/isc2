# ISC - Internet Semantic Chat
## Getting Started Guide

**Version**: 0.1.0  
**Last Updated**: March 12, 2026

---

## Welcome to ISC! 👋

ISC (Internet Semantic Chat) is a decentralized, peer-to-peer social platform that connects you with people thinking similar thoughts—no accounts, no servers, no tracking.

---

## Quick Start

### 1. Create Your First Channel

A **channel** represents a thought or topic you want to explore. It's how you express what's on your mind.

1. Click the **Compose** button (➕)
2. Enter a **Channel Name** (e.g., "AI Ethics")
3. Write a **Description** describing your thoughts in detail
4. Adjust **specificity** if needed (precise ←→ exploratory)
5. Optionally add **context** (location, time, mood, domain, etc.)
6. Click **Save**

> 💡 **Tip**: The more detailed your description, the better the semantic matching will find like-minded peers.

---

### 2. Discover Thought Neighbors

Once you have an active channel, ISC will find peers with semantically similar thoughts.

1. Click the **Discover** tab (📡)
2. Wait for matches to load (first time may take 30s while AI model downloads)
3. Browse matches grouped by similarity:
   - **Very Close** (85%+ similarity)
   - **Nearby** (70-85% similarity)
   - **Orbiting** (55-70% similarity)

> 🎯 **Matching**: Uses real AI embeddings (all-MiniLM-L6-v2) to understand semantic meaning, not just keywords.

---

### 3. Start a Conversation

Found an interesting match? Start chatting!

1. Click **Start Chat** on a match card
2. Your message will be sent via WebRTC (direct peer-to-peer)
3. Watch for delivery status:
   - ⏳ **Pending** - Sending...
   - ✓ **Sent** - Delivered to network
   - ✓✓ **Delivered** - Received by peer (green)
   - ⚠️ **Failed** - Retry or check connection

> 💬 **Typing indicators**: See "Peer is typing..." when they're composing a message.

---

## Key Features

### 🔒 Privacy by Design
- **No accounts** - Your identity is cryptographic, not tied to email/phone
- **No servers** - All data is peer-to-peer via libp2p DHT
- **No tracking** - We don't collect or store your data
- **Ephemeral** - Messages are transient; no permanent storage

### 🧠 Semantic Matching
- Real AI embeddings understand **meaning**, not keywords
- "AI ethics" and "machine learning morality" will match
- Adjustable specificity for precise or exploratory matching

### 📬 Notifications
- Browser notifications for new messages (when tab not focused)
- Badge count shows unread messages
- Click notification to jump to conversation

**Enable notifications**: Settings → Privacy → Notifications → Toggle On

### 🎥 Video Calls
- Direct peer-to-peer video calls
- Group calls within channels
- Screen sharing support
- Mute/video/screen controls

---

## Tips for Best Experience

### Writing Good Channel Descriptions
✅ **Good**: "Exploring the ethical implications of autonomous AI systems in healthcare decision-making, particularly around patient consent and algorithmic bias."

❌ **Too vague**: "AI stuff"

### Finding Better Matches
- Keep your channel **active** (it re-announces automatically)
- Edit your description to refine matching
- Try different specificity levels

### Chat Etiquette
- First message suggestion: "Hey, our thoughts are proximal!"
- Respect that peers can disconnect anytime (it's P2P!)
- Messages may not persist if both parties go offline

---

## Troubleshooting

### "No matches found"
- **Wait**: More peers may join over time
- **Edit your channel**: Try a more detailed or different description
- **Check specificity**: Broader topics may find more matches
- **Refresh**: Pull down to refresh the match list

### "Message not delivered"
- **Check connection**: Ensure you're online
- **Peer may be offline**: P2P means peers can disconnect
- **Retry**: Failed messages can be resent

### "Camera/microphone not working"
- **Check permissions**: Browser settings → Site permissions
- **Close other apps**: Another app may be using your camera
- **Try lower quality**: Settings may allow reducing video quality

### "App feels slow"
- **First load**: AI model downloads on first use (~22MB)
- **Subsequent loads**: Uses cached model (<3s)
- **Check network**: P2P depends on network quality

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New Channel | `N` |
| Refresh | `R` |
| Send Message | `Enter` |
| Close Chat | `Esc` |

---

## Settings

Access via **Settings** tab (⚙️)

### Appearance
- **Theme**: Light, Dark, or Auto (system)

### Privacy
- **Notifications**: Enable/disable browser notifications
- **Ephemeral Mode**: Auto-delete messages after TTL
- **Incognito Mode**: Browse without appearing in match lists

### Network
- **Allow Delegation**: Help other peers find matches (High-tier only)
- **Data Saver**: Reduce model quality on slow connections
- **Device Tier**: Override automatic detection

### Data
- **Export Data**: Download your channels and conversations
- **Clear All Data**: Reset app to fresh state

---

## FAQ

### Q: Do I need to create an account?
**A**: No! ISC is account-free. Your identity is a cryptographic keypair generated locally.

### Q: Where is my data stored?
**A**: Locally in your browser (IndexedDB + localStorage). Nothing is stored on servers.

### Q: Can I use ISC offline?
**A**: Partially. You can create channels and view cached data, but matching and chat require network connectivity.

### Q: Is ISC free?
**A**: Yes, completely free and open-source (MIT license).

### Q: How do I delete my data?
**A**: Settings → Data → Clear All Data. Or clear browser data for this site.

### Q: Can I block someone?
**A**: Yes. Click on their profile in chat and select "Block Peer".

### Q: What happens if I close the app?
**A**: Your channels remain saved locally. You'll need to re-announce them when you return to appear in match lists.

---

## Support

- **Documentation**: See `docs/` folder for detailed guides
- **Issues**: Report bugs on GitHub
- **Community**: Join the discussion (when we have a forum!)

---

## What's Next?

ISC is in active development. Coming soon:
- Improved onboarding for first-time users
- Performance optimizations for faster matching
- Enhanced security features
- Mobile app optimizations

Thank you for trying ISC! 🚀
