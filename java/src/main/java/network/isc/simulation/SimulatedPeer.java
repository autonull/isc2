package network.isc.simulation;

import network.isc.ISCApplication;
import network.isc.core.Channel;
import network.isc.core.Relation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

public class SimulatedPeer {
    private static final Logger log = LoggerFactory.getLogger(SimulatedPeer.class);

    private final String peerName;
    private final ISCApplication app;
    private final String tempAppDir;
    private final int tcpPort;
    private final int wsPort;

    public SimulatedPeer(int id, int portBase, String sharedBootstrapNode) throws Exception {
        this.peerName = "Peer_" + id;
        this.tcpPort = portBase + id * 2;
        this.wsPort = tcpPort + 1;

        this.tempAppDir = new File(System.getProperty("java.io.tmpdir"), "isc-sim-" + UUID.randomUUID()).getAbsolutePath();

        app = new ISCApplication();
        app.setServerMode(true); // default to headless
        app.setPort(this.tcpPort);
        app.setAppDirOverride(this.tempAppDir);
        app.setDbPath("data.db");

        if (sharedBootstrapNode != null) {
            app.setBootstrapNodes(new String[]{sharedBootstrapNode});
        }
    }

    public void start() throws Exception {
        log.info("{} starting on port {} (TCP), dir {}", peerName, tcpPort, tempAppDir);
        app.start();

        // Give the node a name in storage
        app.getStorage().saveConfig("name", peerName);
        app.getStorage().saveConfig("bio", "Simulated peer running in integration test.");
    }

    public void stop() {
        log.info("{} stopping.", peerName);
        try {
            app.stop();
        } catch (Exception e) {
            log.error("Failed to stop " + peerName, e);
        }

        deleteDir(new File(this.tempAppDir));
    }

    private void deleteDir(File dir) {
        if (dir.exists()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.isDirectory()) {
                        deleteDir(f);
                    } else {
                        f.delete();
                    }
                }
            }
            dir.delete();
        }
    }

    public ISCApplication getApp() {
        return app;
    }

    public String getPeerName() {
        return peerName;
    }

    public String getFirstListenAddress() {
        List<String> addrs = app.getNetwork().getHost().listenAddresses().stream().map(Object::toString).toList();
        return addrs.isEmpty() ? null : addrs.get(0);
    }

    public String getPeerId() {
        return app.getNetwork().getHost().getPeerId().toString();
    }
}
