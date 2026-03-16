package network.isc;

import network.isc.adapters.EmbeddingAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.adapters.StorageAdapter;
import network.isc.core.Channel;
import network.isc.core.CryptoUtils;
import network.isc.ui.MainFrame;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import java.io.File;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import io.libp2p.core.crypto.PrivKey;
import io.libp2p.core.crypto.KeyKt;
import io.libp2p.core.crypto.KeyType;

public class ISCApplication {
    private static final Logger log = LoggerFactory.getLogger(ISCApplication.class);

    private NetworkAdapter network;
    private EmbeddingAdapter embedding;
    private StorageAdapter storage;
    private CryptoUtils.Keypair keypair;
    private MainFrame mainFrame;
    private List<Channel> channels;
    private Channel activeChannel;

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

        // Network key generation via built-in jvm-libp2p tools
        PrivKey libp2pKey = KeyKt.generateKeyPair(KeyType.ED25519).component1();

        // Network
        network = new NetworkAdapter(libp2pKey, 0, this::handleNetworkMessage);
        network.start().join();

        // Storage
        String appDir = System.getProperty("user.home") + "/.isc-java";
        storage = new StorageAdapter(appDir + "/channels.json");
        channels = storage.loadChannels();

        // Download/Copy minimal models for ONNX Runtime to test
        File modelFile = new File("model/model_quantized.onnx");
        File tokenizerFile = new File("model/tokenizer.json");

        if (modelFile.exists() && tokenizerFile.exists()) {
            try {
                embedding = new EmbeddingAdapter(modelFile.getAbsolutePath(), tokenizerFile.getAbsolutePath());
                log.info("Embedding adapter initialized.");
            } catch (Exception e) {
                log.warn("Failed to init ONNX runtime. Embeddings will be mocked.", e);
            }
        } else {
            log.warn("Model files not found at ./model/. Embeddings will be mocked for demo.");
        }

        // UI
        mainFrame = new MainFrame();
        mainFrame.setChannels(channels);

        mainFrame.setOnCreateChannel(this::handleCreateChannel);
        mainFrame.setOnChannelSelected(this::handleChannelSelected);

        mainFrame.getChatPanel().addSendListener(e -> {
            String msg = mainFrame.getChatPanel().getAndClearInput();
            if (!msg.isEmpty() && activeChannel != null) {
                // Render locally
                mainFrame.getChatPanel().appendMessage("You", msg, System.currentTimeMillis());

                // Broadcast over network
                String payload = String.format("{\"channelID\":\"%s\",\"msg\":\"%s\"}", activeChannel.getId(), msg);
                network.broadcastChat(payload);
                log.info("Message sent in channel {}: {}", activeChannel.getName(), msg);
            }
        });

        // Add a "Connect to Peer" option in UI for MVP demo
        JMenuBar menuBar = new JMenuBar();
        JMenu p2pMenu = new JMenu("Network");
        JMenuItem connectItem = new JMenuItem("Dial Peer...");
        connectItem.addActionListener(e -> {
            String multiaddr = JOptionPane.showInputDialog(mainFrame, "Enter Multiaddr (e.g., /ip4/127.0.0.1/tcp/4001/p2p/Qm...):");
            if (multiaddr != null && !multiaddr.isEmpty()) {
                network.dialPeer(multiaddr).exceptionally(ex -> {
                    JOptionPane.showMessageDialog(mainFrame, "Dial failed: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    return null;
                });
            }
        });
        p2pMenu.add(connectItem);
        menuBar.add(p2pMenu);
        mainFrame.setJMenuBar(menuBar);

        mainFrame.setVisible(true);
    }

    private void handleNetworkMessage(String payload) {
        SwingUtilities.invokeLater(() -> {
            // For MVP, simplistic JSON parsing. Real impl uses Jackson parsing.
            if (payload.contains("\"msg\":\"")) {
                String msg = payload.split("\"msg\":\"")[1].split("\"")[0];
                mainFrame.getChatPanel().appendMessage("Peer", msg, System.currentTimeMillis());
            }
        });
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
                        } else {
                            log.info("Mock Embedded channel {}", name);
                        }
                    } catch (Exception ex) {
                        log.error("Embedding failed", ex);
                    }
                }).start();
            }
        }
    }

    private void handleChannelSelected(Channel c) {
        activeChannel = c;
        mainFrame.getChatPanel().setChannelName(c.getName());
        mainFrame.getChatPanel().appendMessage("System", "Joined channel space: " + c.getDescription(), System.currentTimeMillis());
        log.info("Switched to channel {} (DHT announce loop would start here)", c.getId());
    }
}
