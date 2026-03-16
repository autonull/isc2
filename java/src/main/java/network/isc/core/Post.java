package network.isc.core;

import java.util.Base64;

/**
 * Represents a post in the ISC system
 */
public class Post {
    private String id;
    private String author;
    private String content;
    private String channelID;
    private Long timestamp;
    private byte[] signature;

    public Post() {}

    public Post(String id, String author, String content, String channelID, 
                Long timestamp, byte[] signature) {
        this.id = id;
        this.author = author;
        this.content = content;
        this.channelID = channelID;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getChannelID() {
        return channelID;
    }

    public void setChannelID(String channelID) {
        this.channelID = channelID;
    }

    public Long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Long timestamp) {
        this.timestamp = timestamp;
    }

    public byte[] getSignature() {
        return signature;
    }

    public void setSignature(byte[] signature) {
        this.signature = signature;
    }

    /**
     * Get signature as Base64 encoded string for JSON serialization
     */
    public String getSignatureBase64() {
        return signature != null ? Base64.getEncoder().encodeToString(signature) : null;
    }

    /**
     * Set signature from Base64 encoded string
     */
    public void setSignatureBase64(String signatureBase64) {
        this.signature = signatureBase64 != null ? Base64.getDecoder().decode(signatureBase64) : null;
    }

    @Override
    public String toString() {
        return "Post{" +
                "id='" + id + '\'' +
                ", author='" + author + '\'' +
                ", content='" + content + '\'' +
                ", channelID='" + channelID + '\'' +
                ", timestamp=" + timestamp +
                ", signature=" + (signature != null ? signature.length + " bytes" : "null") +
                '}';
    }
}
