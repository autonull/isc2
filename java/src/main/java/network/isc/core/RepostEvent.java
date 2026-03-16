package network.isc.core;

public class RepostEvent {
    private String reposter;
    private String postID;
    private long timestamp;
    private byte[] signature;

    public RepostEvent() {}

    public RepostEvent(String reposter, String postID, long timestamp, byte[] signature) {
        this.reposter = reposter;
        this.postID = postID;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    public String getReposter() { return reposter; }
    public void setReposter(String reposter) { this.reposter = reposter; }

    public String getPostID() { return postID; }
    public void setPostID(String postID) { this.postID = postID; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public byte[] getSignature() { return signature; }
    public void setSignature(byte[] signature) { this.signature = signature; }
}
