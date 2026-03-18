package network.isc.services;

import network.isc.core.OfflineAction;
import network.isc.adapters.MapDBStorageAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.core.PostService;
import network.isc.protocol.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
 * @see network.isc.core.OfflineAction
 * @see network.isc.adapters.MapDBStorageAdapter#enqueueAction(OfflineAction)
 */
public class OfflineQueueService {
    private static final Logger log = LoggerFactory.getLogger(OfflineQueueService.class);

    private final MapDBStorageAdapter storage;
    private final NetworkAdapter network;
    private final PostService postService;
    private final ScheduledExecutorService scheduler;
    private final Map<OfflineAction.ActionType, ActionProcessor> processors;
    private final List<Runnable> processedListeners = new CopyOnWriteArrayList<>();

    @FunctionalInterface
    public interface ActionProcessor {
        boolean process(OfflineAction action) throws Exception;
    }

    public void addQueueProcessedListener(Runnable listener) {
        processedListeners.add(listener);
    }

    private void notifyQueueProcessed() {
        for (Runnable listener : processedListeners) {
            listener.run();
        }
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
                notifyQueueProcessed();
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
