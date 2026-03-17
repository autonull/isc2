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

    public SimulationManager(SimulationConfig config) {
        this.config = config;
        this.scheduler = new ScheduledThreadPoolExecutor(config.numPeers() + 2);
        this.random = new Random(config.seed());
    }

    public void runSimulation() throws Exception {
        log.info("--- Starting ISC Integration Simulation ---");
        log.info("Config: {}", config);

        boolean useGui = config.guiMode() && config.numPeers() <= 4;
        boolean useSimGui = config.guiMode();

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

        if (useGui && simulatorUI != null) {
            log.info("Using standard GUI side-by-side mode in addition to Sim Graph");
        }

        // 1. Start bootstrap node
        int basePort = 12000;
        log.info("Starting Bootstrap Node (Peer 0)...");
        bootstrapPeer = new SimulatedPeer(0, basePort, null);
        if (useGui) bootstrapPeer.getApp().setServerMode(false);
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
            if (useGui) peer.getApp().setServerMode(false);
            peer.start();
            peers.add(peer);

            if (simulatorUI != null) {
                simulatorUI.addNode(peer.getPeerId(), "Peer " + i);
                simulatorUI.addConnection(peer.getPeerId(), bootstrapPeer.getPeerId());
            }

            // Randomly stagger starts slightly to avoid thundering herd
            Thread.sleep(random.nextInt(200));
        }

        log.info("All nodes started. Waiting for connections to stabilize...");
        Thread.sleep(5000);

        if (useGui) {
            tileWindows();
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

    private void tileWindows() {
        SwingUtilities.invokeLater(() -> {
            Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
            int width = screenSize.width / 2;
            int height = screenSize.height / 2;

            for (int i = 0; i < peers.size(); i++) {
                SimulatedPeer peer = peers.get(i);
                if (peer.getApp().getMainFrame() != null) {
                    peer.getApp().getMainFrame().setSize(width, height);
                    int x = (i % 2) * width;
                    int y = (i / 2) * height;
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
            } else if (action < 80) {
                // Query for channels
                queryChannels(peer);
            } else if (action < 95 && config.simulateDMs()) {
                // Send DM
                // sendDM(peer);
            } else {
                // Idle or other behavior
            }
        } catch (Exception e) {
            log.error("Error in peer activity loop", e);
        }
    }

    private void createAndAnnounceChannel(SimulatedPeer peer) throws Exception {
        String topic = "Simulated topic " + random.nextInt(100);
        String desc = "I am interested in learning about " + topic + " and finding peers who also like it.";

        List<Relation> relations = new ArrayList<>();
        relations.add(new Relation("sim", "", 1.0));

        Channel c = new Channel(null, "Channel " + topic, desc, null, relations, null, null, false, null);

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
        if (simulatorUI != null) {
            simulatorUI.animateBroadcast(peer.getPeerId(), "ANNOUNCE", java.awt.Color.CYAN);
        }
    }

    private void queryChannels(SimulatedPeer peer) throws Exception {
        String queryText = "Looking for discussions about topic " + random.nextInt(100);
        float[] vector = peer.getApp().getEmbedding().embed(queryText);

        List<String> hashes = SemanticMath.lshHash(vector, "Xenova/all-MiniLM-L6-v2", ProtocolConstants.TIER_NUM_HASHES);
        peer.getApp().getNetwork().query(hashes.toArray(new String[0]));
        totalQueries.incrementAndGet();
        log.debug("{} sent query", peer.getPeerName());
        if (simulatorUI != null) {
            simulatorUI.animateBroadcast(peer.getPeerId(), "QUERY", java.awt.Color.GREEN);
        }
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