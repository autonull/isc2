package network.isc.protocol;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import network.isc.core.Post;

public class ChatMessage {
    private final String channelID;
    private final String msg;
    private final long timestamp;
    private final byte[] signature;
    private final byte[] publicKey; // For verifying the signature

    @JsonCreator
    public ChatMessage(@JsonProperty("channelID") String channelID,
                       @JsonProperty("msg") String msg,
                       @JsonProperty("timestamp") long timestamp,
                       @JsonProperty("signature") byte[] signature,
                       @JsonProperty("publicKey") byte[] publicKey) {
        this.channelID = channelID;
        this.msg = msg;
        this.timestamp = timestamp;
        this.signature = signature;
        this.publicKey = publicKey;
    }

    public String getChannelID() { return channelID; }
    public String getMsg() { return msg; }
    public long getTimestamp() { return timestamp; }
    public byte[] getSignature() { return signature; }
    public byte[] getPublicKey() { return publicKey; }

    // Utility to convert to a Post object
    public Post toPost(String author) {
        return new Post(
            java.util.UUID.randomUUID().toString(),
            author,
            this.msg,
            this.channelID,
            this.timestamp,
            this.signature
        );
    }
}
