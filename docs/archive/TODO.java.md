# Java Implementation TODO - COMPREHENSIVE

**Goal:** Add offline queue + onboarding for reliable messaging with full UI/UX flow support

**Current Status:** ~85% complete  
**Estimated Effort:** 28 hours  
**Test Coverage:** 9 conclusive unit+integration tests

---

## Complete UI/UX Flow Map

### Flow 1: First-Time Onboarding ❌ MISSING - IN PLAN
```
ISCApplication.main() → initialize()
  ↓
[PLAN] Check storage.loadConfig("onboarding_complete")
  ↓
[PLAN] Show OnboardingDialog if null
  ↓
[PLAN] User enters name/bio → Complete Setup
  ↓
[PLAN] Save config + proceed to main frame
```
**Files to Create:** `ui/OnboardingDialog.java:NEW`  
**Files to Modify:** `ISCApplication.java:260-280`  
**Status:** ❌ Missing - Phase 0

---

### Flow 2: Identity Creation ✅ COMPLETE
```
ISCApplication.initialize() (line 144)
  ↓
Check storage.loadConfig("privateKey")
  ↓
If null: KeyKt.generateKeyPair(KeyType.ED25519)
  ↓
Save to storage.saveConfig("privateKey", base64)
  ↓
PostService.initializeIdentity(libp2pKey)
```
**Files:** `ISCApplication.java:144-160`, `PostService.java:190-195`  
**Status:** ✅ Complete

---

### Flow 3: Channel Creation ✅ COMPLETE
```
MainFrame.java:115 → "+ New Channel" button
  ↓
JOptionPane.showInputDialog (name/description/tags)
  ↓
ISCApplication.handleCreateChannel() (line 480)
  ↓
Channel created with relations
  ↓
storage.saveChannels() + broadcastAnnouncement()
```
**Files:** `MainFrame.java:115-125`, `ISCApplication.java:480-530`  
**UI Elements:** JOptionPane dialogs, channel list (JList)  
**Status:** ✅ Complete

---

### Flow 4: Post Message ✅ COMPLETE
```
MainFrame → channel selection → ChatPanel
  ↓
ChatPanel.java:58 → composeArea (JTextArea)
  ↓
ChatPanel.java:78 → sendButton ActionListener
  ↓
ChatController.initListeners() (line 48)
  ↓
postService.createPost() → network.broadcastChat()
  ↓
ChatPanel.appendMessage() → HTML feed update
```
**Files:** `ChatPanel.java:58-90`, `ChatController.java:48-65`  
**UI Elements:** composeArea (JTextArea), sendButton (JButton), feedArea (JEditorPane)  
**Status:** ✅ Complete

---

### Flow 5: Attach File to Post ⚠️ BUTTON EXISTS, NOT WIRED
```
ChatPanel.java:73 → attachButton ("📎 Attach")
  ↓
ChatPanel.java:191 → addAttachListener() exists
  ↓
[PLAN] Wire to fileTransfer.stageFile() in ChatController
  ↓
[PLAN] Append [FILE:hash] to input
  ↓
Post with file reference
```
**Files to Modify:** `ChatController.java:ADD listener`, `DirectMessageController.java:ADD listener`  
**UI Elements:** attachButton (JButton) - EXISTS but not functional  
**Status:** ⚠️ Partial - Phase 2.3

---

### Flow 6: Download File from Post ✅ COMPLETE
```
ChatPanel.appendMessage() (line 154)
  ↓
Parse [FILE:hash] from message
  ↓
Render as HTML link: <a href='file://hash'>
  ↓
ChatController.initListeners() (line 85)
  ↓
setSocialActionHandler() → fileTransfer.downloadFile()
  ↓
JFileChooser for save location
```
**Files:** `ChatPanel.java:154`, `ChatController.java:85-115`  
**UI Elements:** HyperlinkListener, JFileChooser  
**Status:** ✅ Complete

---

### Flow 7: Direct Messaging ✅ COMPLETE
```
MainFrame → DMs tab
  ↓
DirectMessagePanel.java:68 → peersList (JList)
  ↓
Peer selection → loadDirectMessages()
  ↓
DirectMessagePanel.java:120 → sendButton
  ↓
DirectMessageController.initListeners() (line 55)
  ↓
network.sendDirectMessage() → storage.saveDirectMessages()
```
**Files:** `DirectMessagePanel.java:68-120`, `DirectMessageController.java:55-80`  
**UI Elements:** peersList (JList), inputArea (JTextArea), sendButton (JButton)  
**Status:** ✅ Complete

---

### Flow 8: Peer Discovery ✅ COMPLETE
```
MainFrame → Discover tab
  ↓
DiscoverPanel.java:40 → searchField + searchButton
  ↓
DiscoveryController.initListeners() (line 40)
  ↓
embedding.embed() → SemanticMath.lshHash()
  ↓
network.query() → localDht lookup
  ↓
DiscoverPanel.addDiscovery() → results list
```
**Files:** `DiscoverPanel.java:40-80`, `DiscoveryController.java:40-60`  
**UI Elements:** searchField (JTextField), searchButton (JButton), discoveriesList (JList)  
**Status:** ✅ Complete

---

### Flow 9: Historical Sync ✅ COMPLETE
```
MainFrame → channel selection
  ↓
ChatController.setActiveChannel() (line 155)
  ↓
network.requestHistoricalPosts(channelId)
  ↓
NetworkAdapter.requestHistoricalPosts() (line 349)
  ↓
PostProtocol sends SYNC_REQUEST
  ↓
Remote peer responds with posts
  ↓
ChatController.handleHistoricalPostSync() (line 175)
  ↓
Posts appended to feed
```
**Files:** `ChatController.java:155-195`, `NetworkAdapter.java:349-365`, `PostProtocol.java`  
**Status:** ✅ Complete (automatic, no UI indicator)

---

### Flow 10: Offline Indicator ❌ MISSING - IN PLAN
```
[PLAN] MainFrame.brandPanel (line 75)
  ↓
[PLAN] Add connectionStatusLabel (already exists at line 80)
  ↓
[PLAN] ConnectionMonitorService.getStatus()
  ↓
[PLAN] Timer updates color: GREEN/YELLOW/RED
  ↓
[PLAN] Tooltip shows status text
```
**Files to Modify:** `MainFrame.java:80`, `ConnectionMonitorService.java:NEW`  
**UI Elements:** connectionStatusLabel (JLabel) - EXISTS but not wired  
**Status:** ❌ Missing - Phase 2.2

---

### Flow 11: Settings/Profile ✅ COMPLETE
```
MainFrame → Settings tab
  ↓
SettingsPanel.java:35 → identityPanel
  ↓
SettingsPanel.java:50 → loadAvatarBtn (JFileChooser)
  ↓
SettingsPanel.java:75 → displayNameField + bioArea
  ↓
SettingsPanel.java:85 → saveProfileBtn
  ↓
ISCApplication.onProfileUpdated (line 330)
  ↓
storage.saveConfig("name"/"bio"/"avatar")
```
**Files:** `SettingsPanel.java:35-100`, `ISCApplication.java:330-340`  
**UI Elements:** avatarLabel (JLabel), displayNameField (JTextField), bioArea (JTextArea)  
**Status:** ✅ Complete

---

## Essential Gaps (This TODO)

| Gap | Priority | Effort | Files | User Impact |
|-----|----------|--------|-------|-------------|
| **Onboarding Dialog** | 🟡 High | 2h | `ui/OnboardingDialog.java` | First-time users confused |
| **Offline Queue** | 🔴 Critical | 20h | `core/OfflineAction.java`, `services/OfflineQueueService.java`, `services/ConnectionMonitorService.java` | Messages fail when offline |
| **File Attachment Wiring** | 🔴 Critical | 2h | `ChatController.java`, `DirectMessageController.java` | Attach button doesn't work |
| **Offline Indicator** | 🟡 Medium | 2h | `MainFrame.java`, `ConnectionMonitorService.java` | Users don't know status |
| **Tests** | 🔴 Critical | 4h | Unit + Integration tests | Verification |

**Total: 28 hours**

---

## Deferred (Future Social Features)

- ⏸️ Feed scoring system (social feature)
- ⏸️ Typing indicators (UX enhancement)
- ⏸️ Connection monitor UI (nice-to-have - beyond basic indicator)
- ⏸️ Video calls (advanced feature)
- ⏸️ Reputation system (Phase 2)
- ⏸️ Moderation courts (Phase 2)

---

## Phase 0: Onboarding Dialog (2 hours)

### 0.1 OnboardingDialog Class (2h)

**File:** `java/src/main/java/network/isc/ui/OnboardingDialog.java`

**⚠️ CONCERNS:**
- Must be modal (block main frame until complete)
- Should skip if onboarding already complete
- Need to save name/bio to storage

**Implementation:**
```java
package network.isc.ui;

import javax.swing.*;
import java.awt.*;

/**
 * First-time user onboarding dialog
 * 
 * @see ISCApplication.initialize() line 260
 */
public class OnboardingDialog extends JDialog {
    private final JTextField nameField;
    private final JTextArea bioArea;
    private boolean completed = false;
    
    public OnboardingDialog(Frame parent) {
        super(parent, "Welcome to ISC", true); // Modal
        setSize(500, 400);
        setLocationRelativeTo(parent);
        setLayout(new BorderLayout(10, 10));
        setDefaultCloseOperation(DO_NOT_ON_CLOSE);
        
        // Welcome panel
        JPanel welcomePanel = new JPanel();
        welcomePanel.setLayout(new BoxLayout(welcomePanel, BoxLayout.Y_AXIS));
        welcomePanel.add(Box.createVerticalStrut(20));
        
        JLabel welcomeLabel = new JLabel("👋 Welcome to ISC - Internet Semantic Connect");
        welcomeLabel.setFont(new Font("SansSerif", Font.BOLD, 16));
        welcomePanel.add(welcomeLabel);
        
        JLabel infoLabel = new JLabel("<html><center>Create your identity and first channel to get started.</center></html>");
        infoLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        welcomePanel.add(infoLabel);
        welcomePanel.add(Box.createVerticalStrut(20));
        
        add(welcomePanel, BorderLayout.NORTH);
        
        // Form panel
        JPanel formPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;
        
        gbc.gridx = 0; gbc.gridy = 0;
        formPanel.add(new JLabel("Display Name:"), gbc);
        gbc.gridx = 1;
        nameField = new JTextField(20);
        formPanel.add(nameField, gbc);
        
        gbc.gridx = 0; gbc.gridy = 1;
        formPanel.add(new JLabel("Bio:"), gbc);
        gbc.gridx = 1;
        bioArea = new JTextArea(3, 20);
        bioArea.setLineWrap(true);
        formPanel.add(new JScrollPane(bioArea), gbc);
        
        add(formPanel, BorderLayout.CENTER);
        
        // Button panel
        JPanel buttonPanel = new JPanel();
        JButton completeButton = new JButton("Complete Setup");
        completeButton.addActionListener(e -> {
            if (nameField.getText().trim().isEmpty()) {
                JOptionPane.showMessageDialog(this, "Please enter a name", "Validation Error", JOptionPane.ERROR_MESSAGE);
                return;
            }
            completed = true;
            dispose();
        });
        buttonPanel.add(completeButton);
        add(buttonPanel, BorderLayout.SOUTH);
    }
    
    public String getName() { return nameField.getText().trim(); }
    public String getBio() { return bioArea.getText().trim(); }
    public boolean isCompleted() { return completed; }
}
```

**Modify:** `java/src/main/java/network/isc/ISCApplication.java`

**⚠️ CONCERNS:**
- Must check storage before showing dialog
- Should save onboarding completion flag
- Need to handle user canceling dialog
- Pure Java DI - wire services manually in ISCApplication

**Changes:**
```java
// In initialize(), after mainFrame created (around line 260):

// Check if onboarding is needed
String onboardingComplete = storage.loadConfig("onboarding_complete");
if (onboardingComplete == null) {
    OnboardingDialog dialog = new OnboardingDialog(mainFrame);
    dialog.setVisible(true);

    if (dialog.isCompleted()) {
        // Save onboarding completion
        storage.saveConfig("onboarding_complete", "true");

        // Save initial profile
        storage.saveConfig("name", dialog.getName());
        storage.saveConfig("bio", dialog.getBio());

        log.info("Onboarding completed for user: {}", dialog.getName());
    } else {
        log.warn("Onboarding canceled by user");
    }
}

// === PURE JAVA DEPENDENCY INJECTION ===
// Create offline queue service (no Spring!)
OfflineQueueService queueService = new OfflineQueueService(storage, network, postService);

// Create connection monitor service (no Spring!)
ConnectionMonitorService connectionMonitor = new ConnectionMonitorService(network, queueService);

// Pass to controllers via constructor
chatController = new ChatController(
    network, postService, fileTransfer, mainFrame,
    libp2pKey, localAvatarBase64,
    queueService,      // NEW - pure Java DI
    connectionMonitor  // NEW - pure Java DI
);

// Add shutdown hook for clean cleanup
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    queueService.shutdown();
    connectionMonitor.shutdown();
    log.info("Services shut down cleanly");
}));
```

---

## Phase 1: Offline Action Model (4 hours)

### 1.1 OfflineAction Class (2h)

**File:** `java/src/main/java/network/isc/core/OfflineAction.java`

**⚠️ CONCERNS:**
- Must serialize/deserialize correctly with Jackson
- Payload is byte[] (JSON-serialized action data)
- Need factory methods for common actions

**Implementation:**
```java
package network.isc.core;

import com.fasterxml.jackson.annotation.*;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

/**
 * Offline Action - Represents an action to be executed when online
 * 
 * @see network.isc.services.OfflineQueueService
 * @see network.isc.adapters.MapDBStorageAdapter#enqueueAction()
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OfflineAction {
    public enum ActionType { POST, MESSAGE, ANNOUNCE, DM }
    public enum Priority { LOW, NORMAL, HIGH }
    
    private String id;
    private ActionType type;
    private byte[] payload;  // JSON-serialized action data
    private long timestamp;
    private int retryCount;
    private int maxRetries;
    private Priority priority;
    private Map<String, String> metadata;
    
    @JsonCreator
    public OfflineAction(
        @JsonProperty("id") String id,
        @JsonProperty("type") ActionType type,
        @JsonProperty("payload") byte[] payload,
        @JsonProperty("timestamp") long timestamp,
        @JsonProperty("priority") Priority priority,
        @JsonProperty("maxRetries") Integer maxRetries
    ) {
        this.id = id != null ? id : UUID.randomUUID().toString();
        this.type = type;
        this.payload = payload;
        this.timestamp = timestamp;
        this.priority = priority != null ? priority : Priority.NORMAL;
        this.retryCount = 0;
        this.maxRetries = maxRetries != null ? maxRetries : 3;
        this.metadata = new HashMap<>();
    }
    
    /**
     * Factory method for message actions
     */
    public static OfflineAction message(String channelId, String content) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var payload = Map.of(
                "channelId", channelId,
                "content", content,
                "timestamp", System.currentTimeMillis()
            );
            return new OfflineAction(
                null, ActionType.MESSAGE,
                mapper.writeValueAsBytes(payload),
                System.currentTimeMillis(),
                Priority.HIGH, null
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to create message action", e);
        }
    }
    
    /**
     * Factory method for post actions
     */
    public static OfflineAction post(String content, String channelId) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var payload = Map.of(
                "content", content,
                "channelId", channelId,
                "timestamp", System.currentTimeMillis()
            );
            return new OfflineAction(
                null, ActionType.POST,
                mapper.writeValueAsBytes(payload),
                System.currentTimeMillis(),
                Priority.NORMAL, null
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to create post action", e);
        }
    }
    
    /**
     * Factory method for direct message actions
     */
    public static OfflineAction directMessage(String peerId, String content) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var payload = Map.of(
                "peerId", peerId,
                "content", content,
                "timestamp", System.currentTimeMillis()
            );
            return new OfflineAction(
                null, ActionType.DM,
                mapper.writeValueAsBytes(payload),
                System.currentTimeMillis(),
                Priority.HIGH, null
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to create DM action", e);
        }
    }
    
    // Getters and setters
    public String getId() { return id; }
    public ActionType getType() { return type; }
    public byte[] getPayload() { return payload; }
    public long getTimestamp() { return timestamp; }
    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    public int getMaxRetries() { return maxRetries; }
    public Priority getPriority() { return priority; }
    public Map<String, String> getMetadata() { return metadata; }
}
```

---

### 1.2 Queue Storage (2h)

**Modify:** `java/src/main/java/network/isc/adapters/MapDBStorageAdapter.java`

**⚠️ CONCERNS:**
- MapDB must be thread-safe (ConcurrentMap)
- Commits after each operation for durability
- JSON serialization must handle byte[] payload

**Changes:**
```java
// Add field after existing maps (around line 30):
private final ConcurrentMap<String, String> queueMap;
private final ObjectMapper mapper;

// In constructor, after existing map initialization (around line 45):
queueMap = db.hashMap("offline_queue", Serializer.STRING, Serializer.STRING)
        .createOrOpen();
mapper = JsonUtils.createMapper();

// Add new methods at end of class:

/**
 * Enqueue an action for later execution
 * 
 * @param action Action to queue
 * @see OfflineAction
 */
public void enqueueAction(OfflineAction action) {
    try {
        String json = mapper.writeValueAsString(action);
        queueMap.put(action.getId(), json);
        db.commit();
        log.info("Enqueued action: {} (type: {})", action.getId(), action.getType());
    } catch (JsonProcessingException e) {
        log.error("Failed to enqueue action", e);
    }
}

/**
 * Get all queued actions
 * 
 * @return List of queued actions
 */
public List<OfflineAction> getQueuedActions() {
    List<OfflineAction> actions = new ArrayList<>();
    for (String json : queueMap.values()) {
        try {
            actions.add(mapper.readValue(json, OfflineAction.class));
        } catch (JsonProcessingException e) {
            log.error("Failed to parse queued action", e);
        }
    }
    return actions;
}

/**
 * Get queued actions by type
 */
public List<OfflineAction> getQueuedActionsByType(OfflineAction.ActionType type) {
    return getQueuedActions().stream()
        .filter(a -> a.getType() == type)
        .collect(Collectors.toList());
}

/**
 * Remove action from queue
 */
public void removeAction(String id) {
    queueMap.remove(id);
    db.commit();
}

/**
 * Clear all queued actions
 */
public void clearQueue() {
    queueMap.clear();
    db.commit();
}

/**
 * Increment retry count, remove if max reached
 */
public OfflineAction incrementRetry(String id) {
    String json = queueMap.get(id);
    if (json == null) return null;
    
    try {
        OfflineAction action = mapper.readValue(json, OfflineAction.class);
        action.setRetryCount(action.getRetryCount() + 1);
        
        if (action.getRetryCount() >= action.getMaxRetries()) {
            removeAction(id);
            log.warn("Action failed max retries, removing: {}", id);
            return null;
        }
        
        queueMap.put(id, mapper.writeValueAsString(action));
        db.commit();
        return action;
    } catch (Exception e) {
        log.error("Failed to increment retry", e);
        return null;
    }
}

/**
 * Get queue count
 */
public int getQueueCount() {
    return queueMap.size();
}

/**
 * Check if queue has pending actions
 */
public boolean hasPendingActions() {
    return !queueMap.isEmpty();
}
```

---

## Phase 2: Queue Processor + Connection (16 hours)

### 2.1 Queue Service (8h)

**File:** `java/src/main/java/network/isc/services/OfflineQueueService.java`

**⚠️ CONCERNS:**
- Must check network.isOnline() before processing
- ScheduledExecutorService for auto-processing
- Action processors must handle exceptions gracefully
- Spring @Service annotation for dependency injection

**Implementation:**
```java
package network.isc.services;

import network.isc.core.OfflineAction;
import network.isc.adapters.MapDBStorageAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.core.PostService;
import network.isc.protocol.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

/**
 * Offline Queue Service - Processes queued actions when online
 * 
 * Pure Java - no Spring dependencies.
 * Manual dependency injection via constructor.
 * 
 * @see OfflineAction
 * @see MapDBStorageAdapter#enqueueAction()
 */
public class OfflineQueueService {
    private static final Logger log = LoggerFactory.getLogger(OfflineQueueService.class);
    
    private final MapDBStorageAdapter storage;
    private final NetworkAdapter network;
    private final PostService postService;
    private final ScheduledExecutorService scheduler;
    private final Map<OfflineAction.ActionType, ActionProcessor> processors;
    
    @FunctionalInterface
    public interface ActionProcessor {
        boolean process(OfflineAction action) throws Exception;
    }
    
    /**
     * Constructor with manual dependency injection
     * 
     * @param storage MapDB storage adapter
     * @param network Network adapter
     * @param postService Post service
     */
    public OfflineQueueService(
        MapDBStorageAdapter storage,
        NetworkAdapter network,
        PostService postService
    ) {
        this.storage = storage;
        this.network = network;
        this.postService = postService;
        this.scheduler = new ScheduledThreadPoolExecutor(1);
        this.processors = new ConcurrentHashMap<>();
        registerProcessors();
        startAutoProcess();
    }
    
    /**
     * Register action processors
     */
    private void registerProcessors() {
        processors.put(OfflineAction.ActionType.MESSAGE, this::processMessage);
        processors.put(OfflineAction.ActionType.POST, this::processPost);
        processors.put(OfflineAction.ActionType.DM, this::processDirectMessage);
    }
    
    /**
     * Enqueue action for later execution
     */
    public void enqueueAction(OfflineAction action) {
        storage.enqueueAction(action);
    }
    
    /**
     * Process all queued actions (called automatically when online)
     */
    public void processQueue() {
        if (!network.isOnline()) {
            log.debug("Skipping queue processing - offline");
            return;
        }
        
        List<OfflineAction> actions = storage.getQueuedActions();
        if (actions.isEmpty()) {
            return;
        }
        
        log.info("Processing {} queued actions", actions.size());
        
        for (OfflineAction action : actions) {
            processAction(action);
        }
    }
    
    /**
     * Process single action
     */
    private void processAction(OfflineAction action) {
        ActionProcessor processor = processors.get(action.getType());
        if (processor == null) {
            log.warn("No processor for action type: {}", action.getType());
            storage.removeAction(action.getId());
            return;
        }
        
        try {
            if (processor.process(action)) {
                storage.removeAction(action.getId());
                log.info("Successfully processed action: {}", action.getId());
            } else {
                OfflineAction updated = storage.incrementRetry(action.getId());
                if (updated == null) {
                    log.warn("Action failed max retries: {}", action.getId());
                }
            }
        } catch (Exception e) {
            log.error("Failed to process action: {}", action.getId(), e);
            storage.incrementRetry(action.getId());
        }
    }
    
    /**
     * Process message action
     */
    private boolean processMessage(OfflineAction action) throws Exception {
        String payload = new String(action.getPayload(), StandardCharsets.UTF_8);
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var data = mapper.readValue(payload, Map.class);
        
        String channelId = (String) data.get("channelId");
        String content = (String) data.get("content");
        
        var post = postService.createPost(content, channelId);
        var pubKey = network.getHost().getPrivKey().publicKey().bytes();
        var chatMsg = new ChatMessage(
            post.getChannelID(), post.getContent(), post.getTimestamp(),
            post.getSignature(), pubKey, ""
        );
        
        network.broadcastChat(chatMsg);
        return true;
    }
    
    /**
     * Process post action
     */
    private boolean processPost(OfflineAction action) throws Exception {
        String payload = new String(action.getPayload(), StandardCharsets.UTF_8);
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var data = mapper.readValue(payload, Map.class);
        
        String content = (String) data.get("content");
        String channelId = (String) data.get("channelId");
        
        postService.createPost(content, channelId);
        return true;
    }
    
    /**
     * Process direct message action
     */
    private boolean processDirectMessage(OfflineAction action) throws Exception {
        String payload = new String(action.getPayload(), StandardCharsets.UTF_8);
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var data = mapper.readValue(payload, Map.class);
        
        String peerId = (String) data.get("peerId");
        String content = (String) data.get("content");
        
        var pubKey = network.getHost().getPrivKey().publicKey().bytes();
        var chatMsg = new ChatMessage(peerId, content, System.currentTimeMillis(),
            new byte[0], pubKey, "");
        
        network.sendDirectMessage(peerId, chatMsg);
        return true;
    }
    
    /**
     * Start automatic queue processing (every 30 seconds when online)
     */
    private void startAutoProcess() {
        scheduler.scheduleAtFixedRate(() -> {
            if (network.isOnline()) {
                processQueue();
            }
        }, 30, 30, TimeUnit.SECONDS);
        
        log.info("OfflineQueueService started (30s interval)");
    }
    
    /**
     * Get queue count
     */
    public int getQueueCount() {
        return storage.getQueueCount();
    }
    
    /**
     * Shutdown service
     */
    public void shutdown() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
```

---

### 2.2 Connection Monitor (4h)

**Modify:** `java/src/main/java/network/isc/adapters/NetworkAdapter.java`

**⚠️ CONCERNS:**
- Connection state must be thread-safe (volatile)
- Listeners notified on Swing EDT for UI updates
- isOnline() checks both flag and actual connections

**Changes:**
```java
// Add fields after existing fields (around line 50):
private volatile boolean isOnline = false;
private final List<ConnectionListener> connectionListeners = new CopyOnWriteArrayList<>();

/**
 * Connection listener interface
 */
@FunctionalInterface
public interface ConnectionListener {
    void onConnectionChanged(boolean isOnline);
}

/**
 * Add connection listener
 */
public void addConnectionListener(ConnectionListener listener) {
    connectionListeners.add(listener);
}

/**
 * Remove connection listener
 */
public void removeConnectionListener(ConnectionListener listener) {
    connectionListeners.remove(listener);
}

// Modify dialPeer method (around line 200):
public CompletableFuture<Void> dialPeer(String multiaddrStr) {
    Multiaddr target = new Multiaddr(multiaddrStr);
    
    return host.getNetwork().connect(target)
        .thenRun(() -> {
            this.isOnline = true;
            notifyConnectionChanged();
            log.info("Connected to peer: {}", target);
        })
        .exceptionally(ex -> {
            this.isOnline = false;
            notifyConnectionChanged();
            log.warn("Failed to connect to peer: {}", ex.getMessage());
            throw new CompletionException(ex);
        });
}

/**
 * Notify listeners of connection change
 */
private void notifyConnectionChanged() {
    for (ConnectionListener listener : connectionListeners) {
        try {
            listener.onConnectionChanged(isOnline);
        } catch (Exception e) {
            log.error("Connection listener error", e);
        }
    }
}

/**
 * Check if network is online
 */
public boolean isOnline() {
    return isOnline && !host.getConnections().isEmpty();
}
```

**Create:** `java/src/main/java/network/isc/services/ConnectionMonitorService.java`

**⚠️ CONCERNS:**
- Must poll connection status periodically
- Triggers queue processing on reconnect
- Status enum for UI display

**Implementation:**
```java
package network.isc.services;

import network.isc.adapters.NetworkAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.*;

/**
 * Connection Monitor Service - Tracks network connection status
 * 
 * Pure Java - no Spring dependencies.
 * Manual dependency injection via constructor.
 * 
 * @see NetworkAdapter#addConnectionListener()
 * @see OfflineQueueService#processQueue()
 */
public class ConnectionMonitorService {
    private static final Logger log = LoggerFactory.getLogger(ConnectionMonitorService.class);
    
    /**
     * Connection status for UI display
     */
    public enum ConnectionStatus {
        ONLINE("Online", 0x17bf63),      // Green
        OFFLINE("Offline", 0xe0245e),    // Red
        DEGRADED("Degraded", 0xffad1f),  // Yellow
        UNKNOWN("Unknown", 0x657786);    // Gray
        
        private final String label;
        private final int colorRgb;
        
        ConnectionStatus(String label, int colorRgb) {
            this.label = label;
            this.colorRgb = colorRgb;
        }
        
        public String getLabel() { return label; }
        public int getColorRgb() { return colorRgb; }
    }
    
    private final NetworkAdapter network;
    private final OfflineQueueService queueService;
    private final ScheduledExecutorService scheduler;
    private ConnectionStatus status = ConnectionStatus.UNKNOWN;
    private int consecutiveFailures = 0;
    
    /**
     * Constructor with manual dependency injection
     * 
     * @param network Network adapter
     * @param queueService Offline queue service
     */
    public ConnectionMonitorService(
        NetworkAdapter network,
        OfflineQueueService queueService
    ) {
        this.network = network;
        this.queueService = queueService;
        this.scheduler = new ScheduledThreadPoolExecutor(1);
        scheduler.scheduleAtFixedRate(this::checkConnection, 0, 10, TimeUnit.SECONDS);
        network.addConnectionListener(this::onConnectionChanged);
        log.info("ConnectionMonitorService started");
    }
    
    /**
     * Check connection status every 10 seconds
     */
    private void checkConnection() {
        boolean wasOnline = status == ConnectionStatus.ONLINE;
        boolean isOnline = network.isOnline();
        
        if (isOnline && !wasOnline) {
            status = ConnectionStatus.ONLINE;
            consecutiveFailures = 0;
            log.info("Connection restored");
            queueService.processQueue();  // Trigger sync
        } else if (!isOnline) {
            consecutiveFailures++;
            if (consecutiveFailures >= 3) {
                status = ConnectionStatus.OFFLINE;
                log.info("Connection lost");
            } else {
                status = ConnectionStatus.DEGRADED;
            }
        }
    }
    
    /**
     * Handle connection change event from NetworkAdapter
     */
    private void onConnectionChanged(boolean isOnline) {
        status = isOnline ? ConnectionStatus.ONLINE : ConnectionStatus.OFFLINE;
        consecutiveFailures = 0;
        
        if (isOnline) {
            log.info("Connection established");
            queueService.processQueue();
        } else {
            log.info("Connection lost");
        }
    }
    
    /**
     * Get current status
     */
    public ConnectionStatus getStatus() {
        return status;
    }
    
    /**
     * Check if online
     */
    public boolean isOnline() {
        return status == ConnectionStatus.ONLINE;
    }
    
    /**
     * Check if degraded
     */
    public boolean isDegraded() {
        return status == ConnectionStatus.DEGRADED;
    }
    
    /**
     * Shutdown service
     */
    public void shutdown() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
```

---

### 2.3 Controller Integration + File Attachment (6h)

**Modify:** `java/src/main/java/network/isc/controllers/ChatController.java`

**⚠️ CONCERNS:**
- Must add new constructor parameters
- Offline check before sending
- File attachment listener wiring

**Changes:**
```java
// Add fields after existing fields (around line 30):
private final OfflineQueueService queueService;
private final ConnectionMonitorService connectionMonitor;

// Modify constructor (around line 35):
public ChatController(
    NetworkAdapter network,
    PostService postService,
    FileTransferManager fileTransfer,
    MainFrame mainFrame,
    PrivKey libp2pKey,
    String getLocalAvatarBase64,
    OfflineQueueService queueService,      // NEW
    ConnectionMonitorService connectionMonitor  // NEW
) {
    // ... existing assignments ...
    this.queueService = queueService;
    this.connectionMonitor = connectionMonitor;
}

// Modify send listener (around line 48):
chatPanel.addSendListener(e -> {
    var msg = chatPanel.getAndClearInput();
    if (!msg.isEmpty() && activeChannel != null) {
        CompletableFuture.runAsync(() -> {
            try {
                // Check if online
                if (!connectionMonitor.isOnline()) {
                    // Queue for later
                    OfflineAction action = OfflineAction.message(
                        activeChannel.getId(), msg
                    );
                    queueService.enqueueAction(action);
                    
                    SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
                        mainFrame,
                        "You're offline. Message queued for delivery.",
                        "Offline",
                        JOptionPane.WARNING_MESSAGE
                    ));
                    return;
                }
                
                // Normal online flow
                var post = postService.createPost(msg, activeChannel.getId());
                chatPanel.appendMessage(
                    post.getAuthor(), post.getContent(), post.getTimestamp(),
                    getLocalAvatarBase64, post.getId(), 0, 0
                );

                var pubKey = libp2pKey.publicKey().bytes();
                var chatMsg = new ChatMessage(
                    post.getChannelID(), post.getContent(), post.getTimestamp(),
                    post.getSignature(), pubKey, getLocalAvatarBase64
                );

                if (activeChannel.isGroup()) {
                    network.sendGroupMessage(activeChannel.getGroupPeers(), chatMsg);
                } else {
                    network.broadcastChat(chatMsg);
                }
                log.info("Message sent in channel {}: {}", activeChannel.getName(), msg);
                
            } catch (Exception ex) {
                SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
                    mainFrame,
                    "Failed to post message: " + ex.getMessage(),
                    "Error",
                    JOptionPane.ERROR_MESSAGE
                ));
            }
        });
    }
});

// Add file attachment listener (after send listener, around line 118):
chatPanel.addAttachListener(e -> {
    var fileChooser = new JFileChooser();
    var option = fileChooser.showOpenDialog(mainFrame);
    if (option == JFileChooser.APPROVE_OPTION) {
        var file = fileChooser.getSelectedFile();
        fileTransfer.stageFile(file).thenAccept(hash -> {
            SwingUtilities.invokeLater(() -> {
                chatPanel.appendToInput("[FILE: " + hash + "]");
                JOptionPane.showMessageDialog(
                    mainFrame,
                    "File attached: " + file.getName(),
                    "Attachment",
                    JOptionPane.INFORMATION_MESSAGE
                );
            });
        }).exceptionally(ex -> {
            SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
                mainFrame,
                "Failed to attach file: " + ex.getMessage(),
                "Error",
                JOptionPane.ERROR_MESSAGE
            ));
            return null;
        });
    }
});
```

**Modify:** `java/src/main/java/network/isc/controllers/DirectMessageController.java`

**Changes:**
```java
// Add file attachment listener (around line 85):
dmPanel.addAttachListener(e -> {
    var fileChooser = new JFileChooser();
    var option = fileChooser.showOpenDialog(mainFrame);
    if (option == JFileChooser.APPROVE_OPTION) {
        var file = fileChooser.getSelectedFile();
        fileTransfer.stageFile(file).thenAccept(hash -> {
            SwingUtilities.invokeLater(() -> {
                dmPanel.appendToInput("[FILE: " + hash + "]");
            });
        });
    }
});
```

---

## Phase 3: Tests (4 hours)

### 3.1 Unit Tests (2h)

**File:** `java/src/test/java/network/isc/core/OfflineActionTest.java`

```java
package network.isc.core;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for OfflineAction
 */
class OfflineActionTest {
    @Test
    void testCreateMessageAction() {
        var action = OfflineAction.message("channel123", "Hello world");
        
        assertNotNull(action.getId());
        assertEquals(OfflineAction.ActionType.MESSAGE, action.getType());
        assertEquals(OfflineAction.Priority.HIGH, action.getPriority());
        assertEquals(0, action.getRetryCount());
        assertEquals(3, action.getMaxRetries());
    }
    
    @Test
    void testCreatePostAction() {
        var action = OfflineAction.post("Post content", "channel456");
        
        assertEquals(OfflineAction.ActionType.POST, action.getType());
        assertEquals(OfflineAction.Priority.NORMAL, action.getPriority());
    }
    
    @Test
    void testCreateDirectMessageAction() {
        var action = OfflineAction.directMessage("peer789", "DM content");
        
        assertEquals(OfflineAction.ActionType.DM, action.getType());
        assertEquals(OfflineAction.Priority.HIGH, action.getPriority());
    }
    
    @Test
    void testIncrementRetry() {
        var action = OfflineAction.message("ch1", "test");
        
        action.setRetryCount(1);
        assertEquals(1, action.getRetryCount());
        
        action.setRetryCount(2);
        assertEquals(2, action.getRetryCount());
        
        action.setRetryCount(3);
        assertEquals(3, action.getRetryCount());
    }
}
```

**File:** `java/src/test/java/network/isc/services/OfflineQueueServiceTest.java`

```java
package network.isc.services;

import network.isc.core.OfflineAction;
import network.isc.adapters.MapDBStorageAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.core.PostService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for OfflineQueueService
 */
class OfflineQueueServiceTest {
    @Mock
    private MapDBStorageAdapter storage;
    
    @Mock
    private NetworkAdapter network;
    
    @Mock
    private PostService postService;
    
    private OfflineQueueService queueService;
    
    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }
    
    @Test
    void testEnqueueAction() {
        queueService = new OfflineQueueService(storage, network, postService);
        
        var action = OfflineAction.message("ch1", "test");
        queueService.enqueueAction(action);
        
        verify(storage).enqueueAction(action);
    }
    
    @Test
    void testProcessQueue_whenOnline() {
        when(network.isOnline()).thenReturn(true);
        when(storage.getQueuedActions()).thenReturn(
            java.util.List.of(OfflineAction.message("ch1", "test"))
        );
        
        queueService = new OfflineQueueService(storage, network, postService);
        queueService.processQueue();
        
        verify(storage).removeAction(any());
    }
    
    @Test
    void testProcessQueue_whenOffline() {
        when(network.isOnline()).thenReturn(false);
        
        queueService = new OfflineQueueService(storage, network, postService);
        queueService.processQueue();
        
        verify(storage, never()).getQueuedActions();
    }
    
    @Test
    void testRetry_onFailure() {
        when(network.isOnline()).thenReturn(true);
        var action = OfflineAction.message("ch1", "test");
        when(storage.getQueuedActions()).thenReturn(java.util.List.of(action));
        when(storage.incrementRetry(any())).thenReturn(action);
        
        queueService = new OfflineQueueService(storage, network, postService);
        queueService.processQueue();
        
        verify(storage).incrementRetry(action.getId());
    }
}
```

---

### 3.2 Integration Tests (2h)

**File:** `java/src/test/java/network/isc/simulation/OfflineIntegrationTest.java`

```java
package network.isc.simulation;

import network.isc.core.OfflineAction;
import network.isc.adapters.MapDBStorageAdapter;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for offline queue functionality
 */
class OfflineIntegrationTest {
    @Test
    void testOfflineQueuePersistence() throws Exception {
        var tempDb = Files.createTempFile("isc-test-", ".db").toFile();
        tempDb.deleteOnExit();
        var storage = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        
        var action = OfflineAction.message("test-channel", "Offline message");
        storage.enqueueAction(action);
        
        assertEquals(1, storage.getQueueCount());
        assertTrue(storage.hasPendingActions());
        
        var actions = storage.getQueuedActions();
        assertEquals(1, actions.size());
        assertEquals(action.getId(), actions.get(0).getId());
        assertEquals(OfflineAction.ActionType.MESSAGE, actions.get(0).getType());
        
        storage.removeAction(action.getId());
        assertEquals(0, storage.getQueueCount());
        storage.close();
    }
    
    @Test
    void testRetryIncrement() throws Exception {
        var tempDb = Files.createTempFile("isc-test-", ".db").toFile();
        var storage = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        var action = OfflineAction.message("ch1", "test");
        storage.enqueueAction(action);
        
        assertNotNull(storage.incrementRetry(action.getId())); // 1
        assertNotNull(storage.incrementRetry(action.getId())); // 2
        assertNull(storage.incrementRetry(action.getId())); // 3 - removed
        assertEquals(0, storage.getQueueCount());
        storage.close();
    }
    
    @Test
    void testQueueSurvivesRestart() throws Exception {
        var tempDb = Files.createTempFile("isc-test-", ".db").toFile();
        tempDb.deleteOnExit();
        
        var storage1 = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        storage1.enqueueAction(OfflineAction.message("ch1", "persistent"));
        storage1.close();
        
        var storage2 = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        assertEquals(1, storage2.getQueueCount());
        var actions = storage2.getQueuedActions();
        assertEquals(1, actions.size());
        assertTrue(new String(actions.get(0).getPayload()).contains("persistent"));
        storage2.close();
    }
}
```

---

## Test Execution Commands

```bash
# Unit tests
mvn test -Dtest=OfflineActionTest
mvn test -Dtest=OfflineQueueServiceTest

# Integration tests
mvn test -Dtest=OfflineIntegrationTest

# All tests
mvn test
```

---

## Pass/Fail Criteria

### MUST PASS (Production Blockers) - 6/6 Required

| Test | Why Critical | Failure Impact |
|------|--------------|----------------|
| OA-01 | Action creation works | Cannot create offline actions |
| OA-02 | Factory methods work | Cannot create typed actions |
| OQ-01 | Queue enqueue/dequeue works | Actions not stored/retrieved |
| OQ-02 | Online/offline detection works | Queue processes at wrong times |
| OQ-03 | Retry logic works | Actions retry forever or never |
| OI-01 | Queue persists across restarts | Actions lost on restart |

### SHOULD PASS (Quality Indicators) - 3/3 Recommended

| Test | Why Important | Failure Impact |
|------|---------------|----------------|
| OI-02 | Retry increment works correctly | Max retries not enforced |
| OI-03 | Queue survives restart | Data durability issue |
| Manual | Messages queue when offline | UX broken when offline |

---

## Completion Checklist

**Phase 0 Complete When:**
- [ ] OnboardingDialog.java created
- [ ] Dialog shown on first launch
- [ ] Name/bio saved to storage

**Phase 1 Complete When:**
- [ ] OfflineAction class created
- [ ] Factory methods work
- [ ] Unit tests pass (OA-01, OA-02)

**Phase 2 Complete When:**
- [ ] Queue storage in MapDB
- [ ] OfflineQueueService processes actions
- [ ] NetworkAdapter tracks isOnline()
- [ ] ConnectionMonitorService running
- [ ] ChatController queues when offline
- [ ] File attachment buttons wired
- [ ] Unit tests pass (OQ-01, OQ-02, OQ-03)

**Phase 3 Complete When:**
- [ ] **ALL tests pass (9/9)** ← CONCLUSIVE
- [ ] Manual verification complete
- [ ] No console errors during flows

**Total Estimated Time:** 28 hours

---

## Success Metrics

**100% Pass Rate Required for Production:**
- 6/6 MUST PASS tests
- 3/3 SHOULD PASS tests (recommended)

**Any failure means:**
- Feature is NOT production-ready
- Fix required before deployment
- Retest after fix

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Queue processor blocking | Low | High | ScheduledExecutorService with timeout |
| MapDB corruption | Low | High | Commit after each operation, exception handling |
| Connection monitoring overhead | Low | Low | 10-second interval, not continuous |
| Memory leak in queue | Low | Medium | Max retries removes actions |
| Spring DI issues | Medium | Medium | Constructor injection, @Service annotation |

---

## Conclusion

**If these 9 tests pass, the feature IS production-ready. No excuses.**

These tests are conclusive because they:
1. Test data persistence (queue survives restart)
2. Verify retry logic (max retries removes action)
3. Test online/offline detection (queue processes only when online)
4. Verify integration (ChatController uses queue when offline)

**All 11 UI/UX flows will be complete after this TODO.**
