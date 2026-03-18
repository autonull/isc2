package network.isc.services;

import network.isc.adapters.NetworkAdapter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.*;

/**
 * Connection Monitor Service - Tracks network connection status
 *
 * Pure Java - no Spring dependencies.
 * Manual dependency injection via constructor.
 *
 * @see network.isc.adapters.NetworkAdapter#addConnectionListener(NetworkAdapter.ConnectionListener)
 * @see network.isc.services.OfflineQueueService#processQueue()
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
