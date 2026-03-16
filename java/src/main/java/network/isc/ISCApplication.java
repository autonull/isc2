package network.isc;

import network.isc.adapters.EmbeddingAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.adapters.StorageAdapter;
import network.isc.adapters.JsonPostAdapter;
import network.isc.adapters.ModelDownloader;
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

import io.libp2p.core.crypto.PrivKey;
import io.libp2p.core.crypto.KeyKt;
import io.libp2p.core.crypto.KeyType;

public class ISCApplication {
    private static final Logger log = LoggerFactory.getLogger(ISCApplication.class);

    private NetworkAdapter network;
    private EmbeddingAdapter embedding;
    private StorageAdapter storage;
    private JsonPostAdapter postStorage;
    private PrivKey libp2pKey;
    private MainFrame mainFrame;
    private PostService postService;
    private List<Channel> channels;
    private Channel activeChannel;

    private final Map<String, SignedAnnouncement> mockDht = new HashMap<>();

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
                ISCApplication app = new ISCApplication();
                app.initialize();
            } catch (Exception e) {
                log.error("Failed to start application", e);
                JOptionPane.showMessageDialog(null, "Initialization Error: " + e.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
            }
        });
    }

    private void initialize() throws Exception {
        log.info("Initializing ISC Java Client...");

        libp2pKey = KeyKt.generateKeyPair(KeyType.ED25519).component1();

        postService = new PostService();
        postService.initializeIdentity(libp2pKey);

        // Network
        network = new NetworkAdapter(libp2pKey, 0, this::handleNetworkMessage, this::handleDirectMessage, this::handleAnnouncement, this::handleQuery);
        network.start().join();

        // Storage
        String appDir = System.getProperty("user.home") + "/.isc-java";
        storage = new StorageAdapter(appDir + "/channels.json");
        channels = storage.loadChannels();

        postStorage = new JsonPostAdapter(appDir + "/posts.json");
        postService.setDatabaseAdapter(postStorage);

        mainFrame = new MainFrame();

        // Model Downloading & Loading
        String modelDir = appDir + "/models";
        File modelFile = new File(modelDir, "model_quantized.onnx");
        File tokenizerFile = new File(modelDir, "tokenizer.json");

        if (!modelFile.exists() || !tokenizerFile.exists()) {
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
        } else {
            finishInitialization(modelFile, tokenizerFile);
        }
    }

    private void finishInitialization(File modelFile, File tokenizerFile) {
        try {
            embedding = new EmbeddingAdapter(modelFile.getAbsolutePath(), tokenizerFile.getAbsolutePath());
            log.info("Embedding adapter initialized.");
        } catch (Exception e) {
            log.warn("Failed to init ONNX runtime. Embeddings will be mocked.", e);
        }

        mainFrame.setChannels(channels);

        mainFrame.setOnCreateChannel(this::handleCreateChannel);
        mainFrame.setOnChannelSelected(this::handleChannelSelected);

        // Settings Panel
        mainFrame.getSettingsPanel().setPeerId(network.getHost().getPeerId().toString());
        mainFrame.setOnSaveMessagesToggled(enabled -> postStorage.setEnabled(enabled));
        mainFrame.setOnProfileUpdated(profile -> {
            String name = profile[0];
            String bio = profile[1];
            log.info("Saved local identity. Name: {}, Bio: {}", name, bio);
            // Future step: Announce profile to DHT or attach to Protocol Payload
        });

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

        // Discover Panel
        mainFrame.setOnJoinRequested(ann -> {
            Channel newChan = new Channel(ann.getChannelID(), "Discovered Channel", "Discovered from " + ann.getPeerID(), null, null, null, null);
            // Verify if exists
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

        mainFrame.getChatPanel().addSendListener(e -> {
            String msg = mainFrame.getChatPanel().getAndClearInput();
            if (!msg.isEmpty() && activeChannel != null) {
                try {
                    Post post = postService.createPost(msg, activeChannel.getId());
                    mainFrame.getChatPanel().appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp());

                    byte[] pubKey = libp2pKey.publicKey().bytes();
                    ChatMessage chatMsg = new ChatMessage(post.getChannelID(), post.getContent(), post.getTimestamp(), post.getSignature(), pubKey);
                    network.broadcastChat(chatMsg);
                    log.info("Message sent in channel {}: {}", activeChannel.getName(), msg);
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(mainFrame, "Failed to post message: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        });

        mainFrame.getDmPanel().addSendListener(e -> {
            String msg = mainFrame.getDmPanel().getAndClearInput();
            String targetPeer = mainFrame.getDmPanel().getActivePeer();

            if (!msg.isEmpty() && targetPeer != null) {
                try {
                    long ts = System.currentTimeMillis();
                    byte[] rawPayload = (targetPeer + msg + ts).getBytes(StandardCharsets.UTF_8);
                    byte[] sig = libp2pKey.sign(rawPayload);
                    byte[] pubKey = libp2pKey.publicKey().bytes();

                    ChatMessage chatMsg = new ChatMessage(targetPeer, msg, ts, sig, pubKey);
                    network.sendDirectMessage(targetPeer, chatMsg);

                    mainFrame.getDmPanel().appendMessage("You", msg, ts);
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(mainFrame, "Failed to send DM: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        });

        JMenuBar menuBar = new JMenuBar();
        JMenu fileMenu = new JMenu("File");
        JMenuItem queryItem = new JMenuItem("Query Proximal Peers for Current Channel");
        queryItem.addActionListener(e -> {
            if (activeChannel != null && embedding != null) {
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
                 JOptionPane.showMessageDialog(mainFrame, "Must select a channel and have embeddings enabled.", "Query Error", JOptionPane.ERROR_MESSAGE);
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

    private void handleNetworkMessage(ChatMessage chatMsg) {
        Post post = chatMsg.toPost("Peer");
        postService.storePost(post);
        SwingUtilities.invokeLater(() -> {
            // Only show message if it belongs to the active channel
            if (activeChannel != null && chatMsg.getChannelID().equals(activeChannel.getId())) {
                mainFrame.getChatPanel().appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp());
            }
        });
    }

    private void handleDirectMessage(ChatMessage chatMsg) {
        SwingUtilities.invokeLater(() -> {
            // Since DMs aren't tied to channels but to Peers, we'll route to DM Panel
            // Note: chatMsg.getChannelID() is overloaded to be targetPeer from sender
            mainFrame.getDmPanel().appendMessage("Peer", chatMsg.getMsg(), chatMsg.getTimestamp());
        });
    }

    private void handleAnnouncement(SignedAnnouncement ann) {
        log.info("Received channel announcement for channelID: {}", ann.getChannelID());
        List<String> hashes = SemanticMath.lshHash(ann.getVec(), ann.getModel(), ProtocolConstants.TIER_NUM_HASHES);
        for (String hash : hashes) {
            mockDht.put(hash, ann);
        }

        SwingUtilities.invokeLater(() -> {
            if (activeChannel != null) {
                mainFrame.getChatPanel().appendMessage("System", "Discovered new peer thinking about a similar topic!", System.currentTimeMillis());
            }
            mainFrame.getDiscoverPanel().addDiscovery(ann);
        });
    }

    private void handleQuery(String[] hashes) {
        log.info("Received query for hashes: {}", Arrays.toString(hashes));
        for (String hash : hashes) {
            if (mockDht.containsKey(hash)) {
                log.info("Query matched local mock DHT for hash {}", hash);
            }
        }
    }

    private void handleCreateChannel() {
        JTextField nameField = new JTextField();
        JTextField descField = new JTextField();
        Object[] message = {
            "Channel Name:", nameField,
            "Description (Thoughts):", descField
        };

        int option = JOptionPane.showConfirmDialog(mainFrame, message, "New Channel", JOptionPane.OK_CANCEL_OPTION);
        if (option == JOptionPane.OK_OPTION) {
            String name = nameField.getText().trim();
            String desc = descField.getText().trim();

            if (!name.isEmpty() && !desc.isEmpty()) {
                Channel c = new Channel(null, name, desc, null, null, null, null);
                channels.add(c);
                storage.saveChannels(channels);
                mainFrame.setChannels(channels);

                new Thread(() -> {
                    try {
                        if (embedding != null) {
                            float[] vector = embedding.embed(desc);
                            log.info("Embedded channel {} successfully. Vector dim: {}", name, vector.length);
                            broadcastAnnouncement(c, vector);
                        } else {
                            log.info("Mock Embedded channel {}", name);
                            float[] mockVector = new float[384];
                            Arrays.fill(mockVector, 0.1f);
                            broadcastAnnouncement(c, mockVector);
                        }
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

        SignedAnnouncement ann = new SignedAnnouncement(
            network.getHost().getPeerId().toString(),
            c.getId(),
            "Xenova/all-MiniLM-L6-v2",
            vector,
            "root",
            ttl,
            now,
            sig
        );

        network.announce(ann);
    }

    private void handleChannelSelected(Channel c) {
        activeChannel = c;
        mainFrame.getChatPanel().setChannelName(c.getName(), c.getDescription());

        // Load past messages for this channel
        List<Post> pastPosts = postService.getAllPosts(c.getId());
        for (Post p : pastPosts) {
            mainFrame.getChatPanel().appendMessage(p.getAuthor(), p.getContent(), p.getTimestamp());
        }

        log.info("Switched to channel {} (DHT announce loop would start here)", c.getId());

        if (embedding != null) {
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
}
