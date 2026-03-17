package network.isc.controllers;

import network.isc.adapters.EmbeddingAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.core.SignedAnnouncement;
import network.isc.core.SemanticMath;
import network.isc.protocol.ProtocolConstants;
import network.isc.ui.DiscoverPanel;
import network.isc.ui.MainFrame;

import javax.swing.*;
import java.util.List;
import java.util.Map;
import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.libp2p.core.crypto.PrivKey;

public class DiscoveryController {
    private static final Logger log = LoggerFactory.getLogger(DiscoveryController.class);

    private final NetworkAdapter network;
    private final EmbeddingAdapter embedding;
    private final MainFrame mainFrame;
    private final DiscoverPanel discoverPanel;
    private final Map<String, SignedAnnouncement> localDht;
    private final PrivKey libp2pKey;

    public DiscoveryController(NetworkAdapter network, EmbeddingAdapter embedding, MainFrame mainFrame, Map<String, SignedAnnouncement> localDht, PrivKey libp2pKey) {
        this.network = network;
        this.embedding = embedding;
        this.mainFrame = mainFrame;
        this.discoverPanel = mainFrame.getDiscoverPanel();
        this.localDht = localDht;
        this.libp2pKey = libp2pKey;

        initListeners();
    }

    private void initListeners() {
        mainFrame.setOnFollowRequested(peerId -> {
            try {
                var myId = java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes());
                var ts = System.currentTimeMillis();
                var payload = myId + peerId + ts;
                var sig = libp2pKey.sign(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));

                var follow = new network.isc.core.FollowEvent(myId, peerId, ts, sig);
                network.broadcastSocialEvent(follow);
                JOptionPane.showMessageDialog(mainFrame, "Sent follow event to network for peer: " + peerId);
            } catch (Exception ex) {
                log.error("Failed to follow peer", ex);
            }
        });

        mainFrame.setOnSearchRequested(query -> {
            if (embedding != null) {
                new Thread(() -> {
                    try {
                        var vector = embedding.embed(query);
                        discoverPanel.setCurrentSearchVector(vector);

                        var hashes = SemanticMath.lshHash(vector, "Xenova/all-MiniLM-L6-v2", ProtocolConstants.TIER_NUM_HASHES);
                        log.info("Searching network for hashes: {}", hashes);
                        network.query(hashes.toArray(new String[0]));

                        for (var hash : hashes) {
                            if (localDht.containsKey(hash)) {
                                discoverPanel.addDiscovery(localDht.get(hash));
                            }
                        }
                    } catch (Exception ex) {
                        log.error("Failed to query DHT", ex);
                        JOptionPane.showMessageDialog(mainFrame, "Search failed: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    }
                }).start();
            } else {
                JOptionPane.showMessageDialog(mainFrame, "Embeddings not initialized yet.", "Wait", JOptionPane.WARNING_MESSAGE);
            }
        });
    }

    public void handleAnnouncement(SignedAnnouncement ann) {
        log.info("Received channel announcement for channelID: {}", ann.getChannelID());
        var hashes = SemanticMath.lshHash(ann.getVec(), ann.getModel(), ProtocolConstants.TIER_NUM_HASHES);
        for (var hash : hashes) {
            localDht.put(hash, ann);
        }

        SwingUtilities.invokeLater(() -> {
            // Check if active channel logic applies
            discoverPanel.addDiscovery(ann);
        });
    }

    public void handleQuery(String[] hashes) {
        log.info("Received query for hashes: {}", Arrays.toString(hashes));
        for (var hash : hashes) {
            if (localDht.containsKey(hash)) {
                log.info("Query matched local DHT for hash {}", hash);
                network.announce(localDht.get(hash));
            }
        }
    }
}
