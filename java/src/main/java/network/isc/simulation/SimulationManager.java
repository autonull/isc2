package network.isc.simulation;

import network.isc.core.Channel;
import network.isc.core.Relation;
import network.isc.core.SignedAnnouncement;
import network.isc.protocol.ProtocolConstants;
import network.isc.core.SemanticMath;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import javax.swing.SwingUtilities;
import java.awt.Dimension;
import java.awt.Toolkit;

public class SimulationManager {
    private static final Logger log = LoggerFactory.getLogger(SimulationManager.class);

    private final SimulationConfig config;
    private final List<SimulatedPeer> peers = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService scheduler;
    private final Random random;

    private SimulatedPeer bootstrapPeer;

    private final AtomicInteger totalAnnounces = new AtomicInteger();
    private final AtomicInteger totalQueries = new AtomicInteger();
    private final AtomicInteger totalMatches = new AtomicInteger();
    private final AtomicInteger totalDMs = new AtomicInteger();
    private final AtomicInteger totalFiles = new AtomicInteger();

    private SimulatorUI simulatorUI;

    private static final String[] REALISTIC_TOPICS = {
        "Java Development", "Machine Learning", "Cats", "Decentralized Systems",
        "Photography", "Space Exploration", "Cooking Recipes", "Gaming",
        "Fitness & Health", "Open Source Software", "Music Production", "Blockchain",
        "Digital Art", "Home Automation", "Gardening Tips", "Travel Adventures"
    };

    private static final String[] REALISTIC_DESCRIPTIONS = {
        "Let's discuss advanced topics and frameworks.",
        "Sharing research papers and practical applications.",
        "A place for cute pictures and training tips.",
        "Talking about P2P protocols and distributed tech.",
        "Tips for lighting, lenses, and composition.",
        "News from NASA, SpaceX, and the universe.",
        "Share your favorite meals and baking secrets.",
        "Looking for players for co-op and competitive matches.",
        "Workout routines, nutrition, and wellness.",
        "Collaborating on projects and discussing licenses.",
        "Synths, DAWs, and mixing techniques.",
        "Smart contracts, consensus, and crypto news.",
        "Sharing techniques for drawing and painting digitally.",
        "Automating lights, HVAC, and security systems.",
        "How to grow your own vegetables and flowers.",
        "Stories and tips from around the world."
    };

    private static final String[] REALISTIC_MESSAGES = {
        "Hello everyone!", "Does anyone know how to fix this bug?", "Check out this cool article I found.",
        "I completely agree.", "What are your thoughts on this?", "I've been working on this all day.",
        "That's really interesting.", "Can someone explain this concept?", "Have a great weekend!",
        "I'm new here, nice to meet you all.", "Just deployed a new version.", "Look at this adorable photo!",
        "Has anyone tried the new update?", "I'm having trouble with the installation.", "Thanks for the help!",
        "I'm so excited for this project.", "Can't wait to see the results.", "This is a great community."
    };

    public SimulationManager(SimulationConfig config) {
        this.config = config;
        this.scheduler = new ScheduledThreadPoolExecutor(config.numPeers() + 2);
        this.random = new Random(config.seed());
    }

    public void runSimulation() throws Exception {
        log.info("--- Starting ISC Integration Simulation ---");
        log.info("Config: {}", config);

        boolean useSimGui = true;

        if (useSimGui) {
            try {
                SwingUtilities.invokeAndWait(() -> {
                    simulatorUI = new SimulatorUI("ISC Network Simulator");
                    simulatorUI.setVisible(true);
                });
            } catch (Exception e) {
                log.error("Failed to start Simulator UI", e);
            }
        }

        if (config.guiMode() && config.numPeers() <= 4 && simulatorUI != null) {
            log.info("Using standard GUI side-by-side mode in addition to Sim Graph");
            simulatorUI.setSize(800, 600); simulatorUI.setLocation(800, 0); simulatorUI.toFront();
        }

        // 1. Start bootstrap node
        int basePort = 12000;
        log.info("Starting Bootstrap Node (Peer 0)...");
        bootstrapPeer = new SimulatedPeer(0, basePort, null);
        if (config.guiMode() && config.numPeers() <= 4) bootstrapPeer.getApp().setServerMode(false);
        bootstrapPeer.start();
        peers.add(bootstrapPeer);

        // Wait for bootstrap to be ready
        Thread.sleep(2000);
        String bootstrapMultiaddr = bootstrapPeer.getFirstListenAddress() + "/p2p/" + bootstrapPeer.getPeerId();
        log.info("Bootstrap node running at: {}", bootstrapMultiaddr);

        if (simulatorUI != null) {
            simulatorUI.addNode(bootstrapPeer.getPeerId(), "Bootstrap");
        }

        // 2. Start other peers
        log.info("Starting {} additional peers...", config.numPeers() - 1);
        for (int i = 1; i < config.numPeers(); i++) {
            SimulatedPeer peer = new SimulatedPeer(i, basePort, bootstrapMultiaddr);
            if (config.guiMode() && config.numPeers() <= 4) peer.getApp().setServerMode(false);
            peer.start();
            peers.add(peer);

            if (simulatorUI != null) {
                simulatorUI.addNode(peer.getPeerId(), "Peer " + i);
                simulatorUI.addConnection(peer.getPeerId(), bootstrapPeer.getPeerId());

                // Wire up organic network visualization listener
                peer.getApp().getNetwork().setNetworkActivityListener((fromPeer, toPeer, protocol) -> {
                    java.awt.Color color = java.awt.Color.WHITE;
                    if ("ANNOUNCE".equals(protocol)) color = java.awt.Color.CYAN;
                    else if ("QUERY".equals(protocol)) color = java.awt.Color.GREEN;
                    else if ("CHAT".equals(protocol)) color = java.awt.Color.ORANGE;

                    simulatorUI.animateEvent(fromPeer, toPeer, protocol, color);
                });

                // Poll channels and messages for HUD
                scheduler.scheduleAtFixedRate(() -> {
                    try {
                        List<String> chanNames = new ArrayList<>();
                        for (Channel c : peer.getApp().getStorage().loadChannels()) chanNames.add(c.getName());
                        simulatorUI.updateNodeChannels(peer.getPeerId(), chanNames);
                        simulatorUI.repaint();
                    } catch (Exception e) {}
                }, 1, 2, TimeUnit.SECONDS);
            }

            // Randomly stagger starts slightly to avoid thundering herd
            Thread.sleep(random.nextInt(200));
        }

        if (simulatorUI != null) {
            bootstrapPeer.getApp().getNetwork().setNetworkActivityListener((fromPeer, toPeer, protocol) -> {
                java.awt.Color color = java.awt.Color.WHITE;
                if ("ANNOUNCE".equals(protocol)) color = java.awt.Color.CYAN;
                else if ("QUERY".equals(protocol)) color = java.awt.Color.GREEN;
                else if ("CHAT".equals(protocol)) color = java.awt.Color.ORANGE;

                simulatorUI.animateEvent(fromPeer, toPeer, protocol, color);
            });

            scheduler.scheduleAtFixedRate(() -> {
                try {
                    List<String> chanNames = new ArrayList<>();
                    for (Channel c : bootstrapPeer.getApp().getStorage().loadChannels()) chanNames.add(c.getName());
                    simulatorUI.updateNodeChannels(bootstrapPeer.getPeerId(), chanNames);
                    simulatorUI.repaint();
                } catch (Exception e) {}
            }, 1, 2, TimeUnit.SECONDS);

            // Poll for received messages to display on the HUD
            scheduler.scheduleAtFixedRate(() -> {
                try {
                    for (SimulatedPeer peer : peers) {
                        java.util.List<Channel> channels = peer.getApp().getStorage().loadChannels();
                        if (!channels.isEmpty()) {
                            // Find latest posts across all channels
                            for (Channel c : channels) {
                                java.util.List<network.isc.core.Post> posts = peer.getApp().getPostService().getAllPosts(c.getId());
                                if (posts != null && !posts.isEmpty()) {
                                    // Just show the very latest post received
                                    network.isc.core.Post latest = posts.get(posts.size() - 1);
                                    // Ensure we don't continually append the same message
                                    String shortMsg = latest.getContent().length() > 15 ? latest.getContent().substring(0, 15) + "..." : latest.getContent();

                                    // A small trick: append timestamp to ensure uniqueness visually, or just rely on SimulatorUI fixed length
                                    simulatorUI.addNodeMessage(peer.getPeerId(), "< " + shortMsg);
                                    simulatorUI.repaint();
                                }
                            }
                        }
                    }
                } catch (Exception e) {}
            }, 1, 2, TimeUnit.SECONDS);
        }

        log.info("All nodes started. Waiting for connections to stabilize...");
        Thread.sleep(5000);

        if (config.guiMode() && config.numPeers() <= 4) {
            tileWindows(simulatorUI != null);
        }

        // 3. Inject behaviors (Simulated user activity)
        injectBehaviors();

        // 4. Run for duration
        long endTime = System.currentTimeMillis() + (config.durationSeconds() * 1000L);
        while (System.currentTimeMillis() < endTime) {
            Thread.sleep(1000);
        }

        // 5. Output Metrics and Shutdown
        log.info("Simulation completed. Shutting down...");
        outputMetrics();

        scheduler.shutdown();
        for (SimulatedPeer peer : peers) {
            peer.stop();
        }

        log.info("Simulation shutdown complete.");
    }

    private void tileWindows(boolean hasSimGui) {
        SwingUtilities.invokeLater(() -> {
            Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
            int width = hasSimGui ? 800 : screenSize.width / 2;
            int height = hasSimGui ? 600 : screenSize.height / 2;

            for (int i = 0; i < peers.size(); i++) {
                SimulatedPeer peer = peers.get(i);
                if (peer.getApp().getMainFrame() != null) {
                    peer.getApp().getMainFrame().setSize(width, height);
                    int x = hasSimGui ? 0 : (i % 2) * width;
                    int y = hasSimGui ? 0 : (i / 2) * height;
                    peer.getApp().getMainFrame().setLocation(x, y);
                    peer.getApp().getMainFrame().setTitle(peer.getPeerName() + " - " + peer.getPeerId().substring(0, 8) + "...");
                }
            }
        });
    }

    private void injectBehaviors() {
        for (SimulatedPeer peer : peers) {
            scheduler.scheduleWithFixedDelay(() -> simulateUserActivity(peer),
                    random.nextInt(5), 10 + random.nextInt(10), TimeUnit.SECONDS);
        }
    }

    private void simulateUserActivity(SimulatedPeer peer) {
        try {
            int action = random.nextInt(100);

            if (action < 40) {
                // Broadcast an announcement
                createAndAnnounceChannel(peer);
            } else if (action < 60) {
                // Query for channels
                queryChannels(peer);
            } else if (action < 95) {
                // Chat in known channel
                java.util.List<Channel> channels = peer.getApp().getStorage().loadChannels();
                if (!channels.isEmpty()) {
                    Channel c = channels.get(random.nextInt(channels.size()));
                    String chatText = REALISTIC_MESSAGES[random.nextInt(REALISTIC_MESSAGES.length)];
                    network.isc.protocol.ChatMessage msg = new network.isc.protocol.ChatMessage(c.getId(), chatText, System.currentTimeMillis(), new byte[0], new byte[0], peer.getPeerName());
                    peer.getApp().getNetwork().broadcastChat(msg);
                    if (simulatorUI != null) {
                        simulatorUI.addNodeMessage(peer.getPeerId(), "> " + msg.getMsg());
                    }
                }
            } else {
                // Idle or other behavior
            }
        } catch (Exception e) {
            log.error("Error in peer activity loop", e);
        }
    }

    private void createAndAnnounceChannel(SimulatedPeer peer) throws Exception {
        int topicIndex = random.nextInt(REALISTIC_TOPICS.length);
        String topic = REALISTIC_TOPICS[topicIndex];
        String desc = REALISTIC_DESCRIPTIONS[topicIndex];

        List<Relation> relations = new ArrayList<>();
        relations.add(new Relation("sim", "", 1.0));

        Channel c = new Channel(null, "Channel " + topic, desc, null, relations, null, null, false, null);
        peer.getApp().getStorage().saveChannels(java.util.Collections.singletonList(c));

        // Use real embeddings to test ONNX throughput
        float[] vector = peer.getApp().getEmbedding().embed(desc);

        long now = System.currentTimeMillis();
        ByteBuffer buffer = ByteBuffer.allocate(vector.length * 4);
        for (float v : vector) buffer.putFloat(v);
        byte[] sig = peer.getApp().getNetwork().getHost().getPrivKey().sign(buffer.array());

        SignedAnnouncement ann = new SignedAnnouncement(
            peer.getPeerId(),
            c.getId(),
            "Xenova/all-MiniLM-L6-v2",
            vector,
            "sim",
            300,
            now,
            sig
        );

        peer.getApp().getNetwork().announce(ann);
        totalAnnounces.incrementAndGet();
        log.info("{} announced {}", peer.getPeerName(), c.getName());
    }

    private void queryChannels(SimulatedPeer peer) throws Exception {
        String queryText = "Looking for discussions about topic " + random.nextInt(100);
        float[] vector = peer.getApp().getEmbedding().embed(queryText);

        List<String> hashes = SemanticMath.lshHash(vector, "Xenova/all-MiniLM-L6-v2", ProtocolConstants.TIER_NUM_HASHES);
        peer.getApp().getNetwork().query(hashes.toArray(new String[0]));
        totalQueries.incrementAndGet();
        log.debug("{} sent query", peer.getPeerName());
    }

    // Additional behaviors could include simulated posts and DMs but the primary function for now is network routing verification.
    // The simulated peer relies on `network.announce` and `network.query`.

    private void outputMetrics() {
        System.out.println("\n=================================");
        System.out.println("       SIMULATION METRICS        ");
        System.out.println("=================================");
        System.out.println("Total Peers: " + config.numPeers());
        System.out.println("Duration: " + config.durationSeconds() + "s");
        System.out.println("Total Announces: " + totalAnnounces.get());
        System.out.println("Total Queries: " + totalQueries.get());
        System.out.println("=================================\n");

        try {
            java.io.File metricsFile = new java.io.File("simulation-metrics.json");
            String json = "{\n" +
                "  \"numPeers\": " + config.numPeers() + ",\n" +
                "  \"durationSeconds\": " + config.durationSeconds() + ",\n" +
                "  \"totalAnnounces\": " + totalAnnounces.get() + ",\n" +
                "  \"totalQueries\": " + totalQueries.get() + "\n" +
                "}";
            java.nio.file.Files.writeString(metricsFile.toPath(), json);
            log.info("Saved metrics to simulation-metrics.json");
        } catch (Exception e) {
            log.error("Failed to write metrics file", e);
        }
    }
}