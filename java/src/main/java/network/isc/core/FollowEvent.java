package network.isc.core;

public class FollowEvent {
    private String follower;
    private String followee;
    private long timestamp;
    private byte[] signature;

    public FollowEvent() {}

    public FollowEvent(String follower, String followee, long timestamp, byte[] signature) {
        this.follower = follower;
        this.followee = followee;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    public String getFollower() { return follower; }
    public void setFollower(String follower) { this.follower = follower; }

    public String getFollowee() { return followee; }
    public void setFollowee(String followee) { this.followee = followee; }

    public long getTimestamp() { return timestamp; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }

    public byte[] getSignature() { return signature; }
    public void setSignature(byte[] signature) { this.signature = signature; }
}
