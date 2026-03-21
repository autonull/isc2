package network.isc.core;

import com.fasterxml.jackson.annotation.*;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

/**
 * Offline Action - Represents an action to be executed when online
 *
 * @see network.isc.services.OfflineQueueService
 * @see network.isc.adapters.MapDBStorageAdapter#enqueueAction(OfflineAction)
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OfflineAction {
    public enum ActionType { POST, MESSAGE, ANNOUNCE, DM }
    public enum Priority { LOW, NORMAL, HIGH }

    private String id;
    private ActionType type;
    private byte[] payload;  // JSON-serialized action data
    private long timestamp;
    private int retryCount;
    private int maxRetries;
    private Priority priority;
    private Map<String, String> metadata;

    @JsonCreator
    public OfflineAction(
        @JsonProperty("id") String id,
        @JsonProperty("type") ActionType type,
        @JsonProperty("payload") byte[] payload,
        @JsonProperty("timestamp") long timestamp,
        @JsonProperty("priority") Priority priority,
        @JsonProperty("maxRetries") Integer maxRetries
    ) {
        this.id = id != null ? id : UUID.randomUUID().toString();
        this.type = type;
        this.payload = payload;
        this.timestamp = timestamp;
        this.priority = priority != null ? priority : Priority.NORMAL;
        this.retryCount = 0;
        this.maxRetries = maxRetries != null ? maxRetries : 3;
        this.metadata = new HashMap<>();
    }

    /**
     * Factory method for message actions
     */
    public static OfflineAction message(String channelId, String content) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var payload = Map.of(
                "channelId", channelId,
                "content", content,
                "timestamp", System.currentTimeMillis()
            );
            return new OfflineAction(
                null, ActionType.MESSAGE,
                mapper.writeValueAsBytes(payload),
                System.currentTimeMillis(),
                Priority.HIGH, null
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to create message action", e);
        }
    }

    /**
     * Factory method for post actions
     */
    public static OfflineAction post(String content, String channelId) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var payload = Map.of(
                "content", content,
                "channelId", channelId,
                "timestamp", System.currentTimeMillis()
            );
            return new OfflineAction(
                null, ActionType.POST,
                mapper.writeValueAsBytes(payload),
                System.currentTimeMillis(),
                Priority.NORMAL, null
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to create post action", e);
        }
    }

    /**
     * Factory method for direct message actions
     */
    public static OfflineAction directMessage(String peerId, String content) {
        try {
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            var payload = Map.of(
                "peerId", peerId,
                "content", content,
                "timestamp", System.currentTimeMillis()
            );
            return new OfflineAction(
                null, ActionType.DM,
                mapper.writeValueAsBytes(payload),
                System.currentTimeMillis(),
                Priority.HIGH, null
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to create DM action", e);
        }
    }

    // Getters and setters
    public String getId() { return id; }
    public ActionType getType() { return type; }
    public byte[] getPayload() { return payload; }
    public long getTimestamp() { return timestamp; }
    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }
    public int getMaxRetries() { return maxRetries; }
    public Priority getPriority() { return priority; }
    public Map<String, String> getMetadata() { return metadata; }
}
