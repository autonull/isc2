package org.isc.java.channels;

import org.isc.java.types.Channel;
import org.isc.java.types.Relation;
import org.isc.java.types.Distribution;

import java.util.*;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.UUID;

/**
 * Channel Manager - Manages channel lifecycle and operations
 * Environment-agnostic core functionality
 */
public class ChannelManager {
    private static final int MAX_ACTIVE_CHANNELS = 5;
    private static final int MAX_RELATIONS = 5;

    private final ChannelStorage storage;
    private final EmbeddingProvider embedding;
    private ChannelNetwork network;
    private final Set<String> activeChannels = new CopyOnWriteArraySet<>();

    public ChannelManager() {
        this.storage = new DefaultChannelStorage();
        this.embedding = new DefaultEmbeddingProvider();
        this.network = null;
    }

    public ChannelManager(ChannelStorage storage, EmbeddingProvider embedding, ChannelNetwork network) {
        this.storage = storage;
        this.embedding = embedding;
        this.network = network;
    }

    /**
     * Set network adapter for DHT operations
     */
    public void setNetwork(ChannelNetwork network) {
        this.network = network;
    }

    /**
     * Set embedding provider
     */
    public void setEmbedding(EmbeddingProvider embedding) {
        this.embedding = embedding;
    }

    /**
     * Create a new channel
     */
    public Channel createChannel(String name, String description, double spread, List<Relation> relations) {
        // Validate input
        if (name == null || name.trim().length() < 3) {
            throw new IllegalArgumentException("Channel name must be at least 3 characters");
        }
        
        if (description == null || description.trim().length() < 10) {
            throw new IllegalArgumentException("Channel description must be at least 10 characters");
        }
        
        if (spread < 0 || spread > 0.3) {
            throw new IllegalArgumentException("Spread must be between 0 and 0.3");
        }
        
        if (relations == null) {
            relations = Collections.emptyList();
        }
        
        if (relations.size() > MAX_RELATIONS) {
            relations = relations.subList(0, MAX_RELATIONS);
        }

        Channel channel = new Channel();
        channel.setId("ch_" + UUID.randomUUID().toString());
        channel.setName(name.trim());
        channel.setDescription(description.trim());
        channel.setSpread(Math.max(0, Math.min(0.3, spread)));
        channel.setRelations(new ArrayList<>(relations));
        channel.setCreatedAt(System.currentTimeMillis());
        channel.setUpdatedAt(System.currentTimeMillis());
        channel.setActive(false);

        storage.save(channel);
        return channel;
    }

    /**
     * Get channel by ID
     */
    public Channel getChannel(String id) {
        return storage.get(id);
    }

    /**
     * Get all channels
     */
    public List<Channel> getAllChannels() {
        List<Channel> channels = storage.getAll();
        channels.sort((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()));
        return channels;
    }

    /**
     * Update channel
     */
    public Channel updateChannel(String id, Map<String, Object> updates) {
        Channel channel = storage.get(id);
        if (channel == null) {
            return null;
        }

        boolean relationsUpdated = false;
        
        for (Map.Entry<String, Object> entry : updates.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            
            switch (key) {
                case "name":
                    if (value instanceof String) {
                        channel.setName((String) value);
                    }
                    break;
                case "description":
                    if (value instanceof String) {
                        channel.setDescription((String) value);
                    }
                    break;
                case "spread":
                    if (value instanceof Number) {
                        double spread = ((Number) value).doubleValue();
                        channel.setSpread(Math.max(0, Math.min(0.3, spread)));
                    }
                    break;
                case "relations":
                    if (value instanceof List) {
                        List<?> relationsList = (List<?>) value;
                        List<Relation> relations = new ArrayList<>();
                        for (Object obj : relationsList) {
                            if (obj instanceof Relation) {
                                relations.add((Relation) obj);
                            }
                        }
                        if (relations.size() > MAX_RELATIONS) {
                            relations = relations.subList(0, MAX_RELATIONS);
                        }
                        channel.setRelations(relations);
                        relationsUpdated = true;
                    }
                    break;
                default:
                    // Ignore unknown fields
                    break;
            }
        }

        channel.setUpdatedAt(System.currentTimeMillis());
        
        // Deactivate if active and relations changed (embeddings changed)
        if (relationsUpdated && activeChannels.contains(id) && network != null) {
            deactivateChannel(id);
        }
        
        storage.save(channel);
        return channel;
    }

    /**
     * Delete channel
     */
    public void deleteChannel(String id) {
        if (activeChannels.contains(id) && network != null) {
            deactivateChannel(id);
        }
        storage.delete(id);
    }

    /**
     * Activate channel with distributions
     */
    public void activateChannel(String id, List<Distribution> distributions) {
        Channel channel = storage.get(id);
        if (channel == null) {
            throw new IllegalArgumentException("Channel not found: " + id);
        }

        if (activeChannels.contains(id)) {
            return;
        }

        if (activeChannels.size() >= MAX_ACTIVE_CHANNELS) {
            throw new IllegalStateException("Maximum " + MAX_ACTIVE_CHANNELS + " active channels allowed");
        }

        if (network == null) {
            throw new IllegalStateException("Network not configured");
        }

        // In a real implementation, this would announce to DHT
        // network.announceChannel(channel, distributions);
        activeChannels.add(id);
        
        channel.setActive(true);
        channel.setUpdatedAt(System.currentTimeMillis());
        storage.save(channel);
    }

    /**
     * Deactivate channel
     */
    public void deactivateChannel(String id) {
        if (!activeChannels.contains(id)) {
            return;
        }

        if (network != null) {
            // network.deactivateChannel(id);
        }
        activeChannels.remove(id);

        Channel channel = storage.get(id);
        if (channel != null) {
            channel.setActive(false);
            channel.setUpdatedAt(System.currentTimeMillis());
            storage.save(channel);
        }
    }

    /**
     * Fork channel (create copy)
     */
    public Channel forkChannel(String id) {
        Channel original = storage.get(id);
        if (original == null) {
            return null;
        }

        Channel forked = new Channel();
        forked.setId("ch_" + UUID.randomUUID().toString());
        forked.setName(original.getName() + " (fork)");
        forked.setDescription(original.getDescription());
        forked.setSpread(original.getSpread());
        forked.setRelations(new ArrayList<>(original.getRelations()));
        forked.setCreatedAt(System.currentTimeMillis());
        forked.setUpdatedAt(System.currentTimeMillis());
        forked.setActive(false);
        forked.setDistributions(new ArrayList<>(original.getDistributions()));

        storage.save(forked);
        return forked;
    }

    /**
     * Archive channel (deactivate without deleting)
     */
    public void archiveChannel(String id) {
        deactivateChannel(id);
        
        Channel channel = storage.get(id);
        if (channel != null) {
            channel.setUpdatedAt(System.currentTimeMillis());
            storage.save(channel);
        }
    }

    /**
     * Get active channel count
     */
    public int getActiveChannelCount() {
        return activeChannels.size();
    }

    /**
     * Check if channel is active
     */
    public boolean isActive(String id) {
        return activeChannels.contains(id);
    }

    /**
     * Get active channel (first active or first available)
     */
    public Channel getActiveChannel() {
        List<Channel> channels = getAllChannels();
        for (Channel channel : channels) {
            if (channel.getActive() != null && channel.getActive()) {
                return channel;
            }
        }
        return channels.isEmpty() ? null : channels.get(0);
    }

    /**
     * Default in-memory storage (for environments without persistent storage)
     */
    public static class DefaultChannelStorage implements ChannelStorage {
        private final Map<String, Channel> store = new ConcurrentHashMap<>();

        @Override
        public List<Channel> getAll() {
            return new ArrayList<>(store.values());
        }

        @Override
        public Channel get(String id) {
            return store.get(id);
        }

        @Override
        public void save(Channel channel) {
            if (channel.getId() == null || channel.getId().isEmpty()) {
                String id = "ch_" + UUID.randomUUID().toString();
                channel.setId(id);
            }
            store.put(channel.getId(), channel);
        }

        @Override
        public void delete(String id) {
            store.remove(id);
        }
    }

    /**
     * Default embedding provider (returns zero vectors - should be overridden)
     */
    public static class DefaultEmbeddingProvider implements EmbeddingProvider {
        @Override
        public List<Double> computeEmbedding(String text) {
            // Fallback: return zero vector (384 dimensions to match TypeScript)
            List<Double> zeroVector = new ArrayList<>(384);
            for (int i = 0; i < 384; i++) {
                zeroVector.add(0.0);
            }
            return zeroVector;
        }
    }

    /**
     * Storage adapter for channels
     */
    public interface ChannelStorage {
        List<Channel> getAll();
        Channel get(String id);
        void save(Channel channel);
        void delete(String id);
    }

    /**
     * Embedding provider interface
     */
    public interface EmbeddingProvider {
        List<Double> computeEmbedding(String text);
    }

    /**
     * Network adapter for DHT announcements
     */
    public interface ChannelNetwork {
        void announceChannel(Channel channel, List<Distribution> distributions);
        void deactivateChannel(String channelID);
    }
}