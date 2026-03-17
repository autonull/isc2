package network.isc.core;

import java.util.Arrays;

public class LikeEvent {
    private String liker;
    private String postID;
    private long timestamp;
    private byte[] signature;

    public LikeEvent() {}

    public LikeEvent(String liker, String postID, long timestamp, byte[] signature) {
        this.liker = liker;
        this.postID = postID;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    public String getLiker() { return liker; }
    public void setLiker(String liker) { this.liker = liker; }

    public String getPostID() { return postID; }
    public void setPostID(String postID) { this.postID = postID; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public byte[] getSignature() { return signature; }
    public void setSignature(byte[] signature) { this.signature = signature; }
}
