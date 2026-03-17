package network.isc;

import network.isc.adapters.EmbeddingAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.adapters.StorageAdapter;
import network.isc.adapters.MapDBStorageAdapter;
import network.isc.adapters.P2PFileTransferAdapter;
import network.isc.adapters.ModelDownloader;
import network.isc.controllers.ChatController;
import network.isc.controllers.DirectMessageController;
import network.isc.controllers.DiscoveryController;
import network.isc.core.Channel;
import network.isc.core.Post;
import network.isc.core.PostService;
import network.isc.core.CryptoUtils;
import network.isc.core.SignedAnnouncement;
import network.isc.core.SemanticMath;
import network.isc.protocol.ProtocolConstants;
import network.isc.protocol.ChatMessage;
import network.isc.ui.MainFrame;
import network.isc.ui.DownloadDialog;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import java.io.File;
import java.util.List;
import java.util.Arrays;
import java.util.Map;
import java.util.HashMap;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.util.concurrent.CompletableFuture;
import java.awt.SystemTray;
import java.awt.Image;
import java.awt.Toolkit;
import java.awt.TrayIcon;
import java.awt.PopupMenu;
import java.awt.MenuItem;
import java.awt.AWTException;

import io.libp2p.core.crypto.PrivKey;
import io.libp2p.core.crypto.KeyKt;
import io.libp2p.core.crypto.KeyType;

public class ISCApplication {
    private static final Logger log = LoggerFactory.getLogger(ISCApplication.class);

    private NetworkAdapter network;
    private EmbeddingAdapter embedding;
    private MapDBStorageAdapter storage;
    private P2PFileTransferAdapter fileTransfer;
    private PrivKey libp2pKey;
    private MainFrame mainFrame;
    private PostService postService;
    private List<Channel> channels;
    private Channel activeChannel;
    private String localAvatarBase64 = "";

    private final Map<String, SignedAnnouncement> mockDht = new HashMap<>();

    private ChatController chatController;
    private DirectMessageController dmController;
    private DiscoveryController discoveryController;

    private boolean serverMode = false;
    private int port = 4001;
    private String[] bootstrapNodes = new String[0];
    private String dbPath = "isc-data.db";

    public static void main(String[] args) {
        List<String> argList = Arrays.asList(args);
        boolean serverMode = argList.contains("--server");

        ISCApplication app = new ISCApplication();
        app.serverMode = serverMode;

        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--port") && i + 1 < args.length) {
                app.port = Integer.parseInt(args[i + 1]);
            } else if (args[i].equals("--bootstrap-nodes") && i + 1 < args.length) {
                app.bootstrapNodes = args[i + 1].split(",");
            } else if (args[i].equals("--db-path") && i + 1 < args.length) {
                app.dbPath = args[i + 1];
            }
        }

        if (serverMode) {
            log.info("Starting ISC in SERVER mode (Headless)");
            try {
                app.initialize();
            } catch (Exception e) {
                log.error("Failed to start application in server mode", e);
                System.exit(1);
            }
        } else {
            SwingUtilities.invokeLater(() -> {
                try {
                    UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
                    app.initialize();
                } catch (Exception e) {
                    log.error("Failed to start application", e);
                    JOptionPane.showMessageDialog(null, "Initialization Error: " + e.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            });
        }
    }

    private void setupSystemTray() {
        if (!SystemTray.isSupported()) return;

        SystemTray tray = SystemTray.getSystemTray();
        Image image = Toolkit.getDefaultToolkit().createImage(new byte[0]); // Transparent placeholder if no real icon
        TrayIcon trayIcon = new TrayIcon(image, "ISC Java Client");
        trayIcon.setImageAutoSize(true);

        PopupMenu popup = new PopupMenu();
        MenuItem openItem = new MenuItem("Open ISC");
        openItem.addActionListener(e -> {
            mainFrame.setVisible(true);
            mainFrame.setExtendedState(JFrame.NORMAL);
        });

        MenuItem exitItem = new MenuItem("Exit");
        exitItem.addActionListener(e -> System.exit(0));

        popup.add(openItem);
        popup.add(exitItem);
        trayIcon.setPopupMenu(popup);

        trayIcon.addActionListener(e -> {
            mainFrame.setVisible(true);
            mainFrame.setExtendedState(JFrame.NORMAL);
        });

        try {
            tray.add(trayIcon);
        } catch (AWTException e) {
            log.warn("TrayIcon could not be added.", e);
        }
    }

    private void initialize() throws Exception {
        log.info("Initializing ISC Java Client...");

        String appDir = System.getProperty("user.home") + "/.isc-java";
        File dir = new File(appDir);
        if (!dir.exists()) dir.mkdirs();

        storage = new MapDBStorageAdapter(appDir + "/" + this.dbPath);

        // Try to load existing keypair
        String savedKeyBase64 = storage.loadConfig("privateKey");
        if (savedKeyBase64 != null && !savedKeyBase64.isEmpty()) {
            try {
                byte[] keyBytes = java.util.Base64.getDecoder().decode(savedKeyBase64);
                libp2pKey = KeyKt.unmarshalPrivateKey(keyBytes);
                log.info("Loaded existing Ed25519 identity from storage.");
            } catch (Exception e) {
                log.error("Failed to load saved key, generating new one", e);
                libp2pKey = KeyKt.generateKeyPair(KeyType.ED25519).component1();
                storage.saveConfig("privateKey", java.util.Base64.getEncoder().encodeToString(libp2pKey.bytes()));
            }
        } else {
            log.info("Generating new Ed25519 identity...");
            libp2pKey = KeyKt.generateKeyPair(KeyType.ED25519).component1();
            storage.saveConfig("privateKey", java.util.Base64.getEncoder().encodeToString(libp2pKey.bytes()));
        }

        // Load profile
        String savedAvatar = storage.loadConfig("avatar");
        if (savedAvatar != null) localAvatarBase64 = savedAvatar;

        postService = new PostService();
        postService.initializeIdentity(libp2pKey);

        // Network
        network = new NetworkAdapter(libp2pKey, this.port,
            msg -> { if (chatController != null) chatController.handleNetworkMessage(msg); else handleNetworkMessageHeadless(msg); },
            sync -> { if (chatController != null) chatController.handleHistoricalPostSync(sync); else handleHistoricalPostSyncHeadless(sync); },
            dm -> { if (dmController != null) dmController.handleDirectMessage(dm); else log.info("Received DM in server mode"); },
            ann -> { if (discoveryController != null) discoveryController.handleAnnouncement(ann); else handleAnnouncementHeadless(ann); },
            query -> { if (discoveryController != null) discoveryController.handleQuery(query); else handleQueryHeadless(query); },
            this::handleDelegation);

        fileTransfer = new P2PFileTransferAdapter(network);
        network.setOnFileProtocolChunkReceived(fileTransfer::handleIncomingChunk);

        network.setOnSocialEventReceived(event -> {
            if (chatController != null) {
                chatController.handleSocialEvent(event);
            } else {
                log.info("Received social event in server mode: " + event.getClass().getSimpleName());
            }
        });

        network.start().join();

        for (String peer : this.bootstrapNodes) {
            if (peer != null && !peer.trim().isEmpty()) {
                log.info("Connecting to explicit bootstrap node: {}", peer);
                network.dialPeer(peer).exceptionally(ex -> {
                    log.error("Failed to connect to bootstrap node {}: {}", peer, ex.getMessage());
                    return null;
                });
            }
        }

        // Storage
        // (Storage is already initialized using appDir earlier)
        channels = storage.loadChannels();

        postService.setDatabaseAdapter(storage);

        if (!serverMode) {
            mainFrame = new MainFrame();
            setupSystemTray();
        }

        // Model Downloading & Loading
        String modelDir = appDir + "/models";
        File modelFile = new File(modelDir, "model_quantized.onnx");
        File tokenizerFile = new File(modelDir, "tokenizer.json");

        if (!modelFile.exists() || !tokenizerFile.exists()) {
            if (serverMode) {
                log.info("Models missing. Starting headless download...");
                ModelDownloader.ensureModelsExist(modelDir, progress -> {}).whenComplete((res, ex) -> {
                    if (ex != null) {
                        log.error("Failed to download models", ex);
                    } else {
                        finishInitialization(modelFile, tokenizerFile);
                    }
                });
            } else {
                DownloadDialog downloadDialog = new DownloadDialog(mainFrame);
                CompletableFuture<Void> dlFuture = ModelDownloader.ensureModelsExist(modelDir, downloadDialog::setProgress);

                dlFuture.whenComplete((res, ex) -> {
                    SwingUtilities.invokeLater(() -> {
                        downloadDialog.dispose();
                        if (ex != null) {
                            JOptionPane.showMessageDialog(mainFrame, "Failed to download models: " + ex.getMessage(), "Download Error", JOptionPane.ERROR_MESSAGE);
                        } else {
                            finishInitialization(modelFile, tokenizerFile);
                        }
                    });
                });

                downloadDialog.setVisible(true); // blocks until dispose is called
            }
        } else {
            finishInitialization(modelFile, tokenizerFile);
        }
    }

    private void handleNetworkMessageHeadless(ChatMessage chatMsg) {
        Post post = chatMsg.toPost("Peer");
        postService.storePost(post);
        log.info("Stored chat message in headless mode: {}", post.getId());
    }

    private void handleHistoricalPostSyncHeadless(ChatMessage syncMsg) {
        if ("SYNC_REQUEST".equals(syncMsg.getMsg())) {
            String channelID = syncMsg.getChannelID();
            List<Post> historical = postService.getAllPosts(channelID);
            for (Post p : historical) {
                ChatMessage hm = new ChatMessage(p.getChannelID(), p.getContent(), p.getTimestamp(), p.getSignature(), new byte[0], "");
                network.sendHistoricalPost(hm);
            }
            log.info("Sent {} historical posts for channel {} in headless mode", historical.size(), channelID);
        } else {
            Post post = syncMsg.toPost("Peer (History)");
            boolean isNew = postService.getPost(post.getId()) == null;
            if (isNew) {
                postService.storePost(post);
                log.info("Stored historical post {} in headless mode", post.getId());
            }
        }
    }

    private void handleAnnouncementHeadless(SignedAnnouncement ann) {
        log.info("Received channel announcement for channelID: {}", ann.getChannelID());
        List<String> hashes = SemanticMath.lshHash(ann.getVec(), ann.getModel(), ProtocolConstants.TIER_NUM_HASHES);
        for (String hash : hashes) {
            mockDht.put(hash, ann);
        }
    }

    private void handleQueryHeadless(String[] hashes) {
        log.info("Received query for hashes: {}", Arrays.toString(hashes));
        for (String hash : hashes) {
            if (mockDht.containsKey(hash)) {
                log.info("Query matched local mock DHT for hash {}", hash);
                network.announce(mockDht.get(hash));
            }
        }
    }

    private void finishInitialization(File modelFile, File tokenizerFile) {
        try {
            embedding = new EmbeddingAdapter(modelFile.getAbsolutePath(), tokenizerFile.getAbsolutePath());
            log.info("Embedding adapter initialized.");
        } catch (Exception e) {
            log.error("Failed to init ONNX runtime. Mocks are forbidden. The application cannot proceed.", e);
            throw new RuntimeException("Fatal Error: Embedding Initialization Failed", e);
        }

        if (serverMode) {
            log.info("Headless server initialized. Acting as relay and sync node.");
            return;
        }

        // Initialize Controllers
        chatController = new ChatController(network, postService, fileTransfer, mainFrame, libp2pKey, localAvatarBase64);
        dmController = new DirectMessageController(network, storage, fileTransfer, mainFrame, libp2pKey, localAvatarBase64);
        discoveryController = new DiscoveryController(network, embedding, mainFrame, mockDht);

        mainFrame.setChannels(channels);

        mainFrame.setOnCreateChannel(this::handleCreateChannel);
        mainFrame.setOnCreateGroup(this::handleCreateGroup);
        mainFrame.setOnChannelSelected(this::handleChannelSelected);

        // Settings Panel
        mainFrame.getSettingsPanel().setPeerId(network.getHost().getPeerId().toString());
        mainFrame.setOnSaveMessagesToggled(enabled -> storage.setPostsEnabled(enabled));
        mainFrame.setOnProfileUpdated(profile -> {
            String name = profile[0];
            String bio = profile[1];
            if (profile.length > 2) {
                localAvatarBase64 = profile[2];
                storage.saveConfig("avatar", localAvatarBase64);
            }
            storage.saveConfig("name", name);
            storage.saveConfig("bio", bio);
            log.info("Saved local identity. Name: {}, Bio: {}", name, bio);
        });

        // Initialize Settings Panel with saved values
        String savedName = storage.loadConfig("name");
        String savedBio = storage.loadConfig("bio");
        if (savedName != null) {
            mainFrame.getSettingsPanel().setProfile(savedName, savedBio != null ? savedBio : "", localAvatarBase64);
        }

        // Network Panel
        List<String> addrs = network.getHost().listenAddresses().stream().map(a -> a.toString()).toList();
        mainFrame.getNetworkPanel().setMyAddresses(addrs);
        network.setOnPeerConnected(peer -> {
            mainFrame.getNetworkPanel().addPeer(peer);

            // Extract peerID from multiaddr to populate DM list
            String[] parts = peer.split("/");
            if (parts.length > 0) {
                String peerIdStr = parts[parts.length - 1];
                mainFrame.getDmPanel().addPeer(peerIdStr);
            }
        });

        mainFrame.setOnDialRequested(() -> {
            String multiaddr = JOptionPane.showInputDialog(mainFrame, "Enter Multiaddr (e.g., /ip4/127.0.0.1/tcp/4001/p2p/Qm...):");
            if (multiaddr != null && !multiaddr.isEmpty()) {
                network.dialPeer(multiaddr).exceptionally(ex -> {
                    JOptionPane.showMessageDialog(mainFrame, "Dial failed: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    return null;
                });
            }
        });

        // Discover Panel Join handling
        mainFrame.setOnJoinRequested(ann -> {
            Channel newChan = new Channel(ann.getChannelID(), "Discovered Channel", "Discovered from " + ann.getPeerID(), null, null, null, null, false, null);
            boolean exists = channels.stream().anyMatch(c -> c.getId().equals(newChan.getId()));
            if (!exists) {
                channels.add(newChan);
                storage.saveChannels(channels);
                mainFrame.setChannels(channels);
                JOptionPane.showMessageDialog(mainFrame, "Channel added to your workspace!");
            } else {
                JOptionPane.showMessageDialog(mainFrame, "You already have this channel.", "Info", JOptionPane.INFORMATION_MESSAGE);
            }
        });

        JMenuBar menuBar = new JMenuBar();
        JMenu fileMenu = new JMenu("File");
        JMenuItem queryItem = new JMenuItem("Query Proximal Peers for Current Channel");
        queryItem.addActionListener(e -> {
            if (activeChannel != null) {
                new Thread(() -> {
                    try {
                        float[] vector = embedding.embed(activeChannel.getDescription());
                        List<String> hashes = SemanticMath.lshHash(vector, "Xenova/all-MiniLM-L6-v2", ProtocolConstants.TIER_NUM_HASHES);
                        network.query(hashes.toArray(new String[0]));
                        log.info("Sent query for hashes: {}", hashes);
                    } catch (Exception ex) {
                        log.error("Failed to query", ex);
                    }
                }).start();
            } else {
                 JOptionPane.showMessageDialog(mainFrame, "Must select a channel.", "Query Error", JOptionPane.ERROR_MESSAGE);
            }
        });
        fileMenu.add(queryItem);
        fileMenu.addSeparator();
        JMenuItem exitItem = new JMenuItem("Exit");
        exitItem.addActionListener(e -> System.exit(0));
        fileMenu.add(exitItem);
        menuBar.add(fileMenu);

        mainFrame.setJMenuBar(menuBar);
        mainFrame.setVisible(true);
    }

    private void handleDelegation(network.isc.core.SignedDelegation delegation) {
        log.info("Received Key Delegation from Master Key: {} to Ephemeral Key: {}", delegation.getMasterKey(), delegation.getEphemeralKey());
    }

    private void handleCreateGroup() {
        JTextField nameField = new JTextField();
        JTextField descField = new JTextField();
        JTextField peersField = new JTextField();
        Object[] message = {
            "Group Name:", nameField,
            "Description (Topic):", descField,
            "Peer IDs (comma separated):", peersField
        };

        int option = JOptionPane.showConfirmDialog(mainFrame, message, "New Group", JOptionPane.OK_CANCEL_OPTION);
        if (option == JOptionPane.OK_OPTION) {
            String name = nameField.getText().trim();
            String desc = descField.getText().trim();
            String peersStr = peersField.getText().trim();

            if (!name.isEmpty() && !desc.isEmpty() && !peersStr.isEmpty()) {
                CompletableFuture.runAsync(() -> {
                    try {
                        java.util.List<String> peersList = java.util.Arrays.asList(peersStr.split(","));
                        for (int i = 0; i < peersList.size(); i++) {
                            peersList.set(i, peersList.get(i).trim());
                        }

                        Channel c = new Channel(null, name, desc, 0.15, java.util.Collections.emptyList(), null, null, true, peersList);
                        channels.add(c);
                        storage.saveChannels(channels);

                        SwingUtilities.invokeLater(() -> {
                            mainFrame.setChannels(channels);
                            JOptionPane.showMessageDialog(mainFrame, "Group created.");
                        });

                    } catch (Exception ex) {
                        log.error("Failed creating group", ex);
                        SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(mainFrame, "Error: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE));
                    }
                });
            }
        }
    }

    private void handleCreateChannel() {
        JTextField nameField = new JTextField();
        JTextField descField = new JTextField();
        JTextField tagsField = new JTextField();
        Object[] message = {
            "Channel Name:", nameField,
            "Description (Thoughts):", descField,
            "Tags/Relations (e.g. tech,social):", tagsField
        };

        int option = JOptionPane.showConfirmDialog(mainFrame, message, "New Channel", JOptionPane.OK_CANCEL_OPTION);
        if (option == JOptionPane.OK_OPTION) {
            String name = nameField.getText().trim();
            String desc = descField.getText().trim();
            String tags = tagsField.getText().trim();

            if (!name.isEmpty() && !desc.isEmpty()) {
                java.util.List<network.isc.core.Relation> relations = new java.util.ArrayList<>();
                if (!tags.isEmpty()) {
                    for (String t : tags.split(",")) {
                        relations.add(new network.isc.core.Relation(t.trim(), "", 1.0));
                    }
                }
                Channel c = new Channel(null, name, desc, null, relations, null, null, false, null);
                channels.add(c);
                storage.saveChannels(channels);
                mainFrame.setChannels(channels);

                new Thread(() -> {
                    try {
                        float[] vector = embedding.embed(desc);
                        log.info("Embedded channel {} successfully. Vector dim: {}", name, vector.length);
                        broadcastAnnouncement(c, vector);
                    } catch (Exception ex) {
                        log.error("Embedding failed", ex);
                    }
                }).start();
            }
        }
    }

    private void broadcastAnnouncement(Channel c, float[] vector) {
        long ttl = 300; // 5 mins
        long now = System.currentTimeMillis();

        ByteBuffer buffer = ByteBuffer.allocate(vector.length * 4);
        for (float v : vector) buffer.putFloat(v);
        byte[] sig = libp2pKey.sign(buffer.array());

        // Serialize primary relation tag if exists
        String relTag = "root";
        if (c.getRelations() != null && !c.getRelations().isEmpty()) {
            relTag = c.getRelations().get(0).getTag();
        }

        SignedAnnouncement ann = new SignedAnnouncement(
            network.getHost().getPeerId().toString(),
            c.getId(),
            "Xenova/all-MiniLM-L6-v2",
            vector,
            relTag,
            ttl,
            now,
            sig
        );

        network.announce(ann);
    }

    private void handleChannelSelected(Channel c) {
        activeChannel = c;
        chatController.setActiveChannel(c);
        log.info("Switched to channel {}", c.getId());

        new Thread(() -> {
            try {
                float[] vector = embedding.embed(c.getDescription());
                broadcastAnnouncement(c, vector);
            } catch (Exception e) {
                log.error("Failed to embed on switch", e);
            }
        }).start();
    }
}
