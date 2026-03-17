package network.isc.core;

import java.util.List;

public class Profile {
    private String peerID;
    private String bio;
    private List<Channel> channels;
    private long updatedAt;

    public Profile() {}

    public Profile(String peerID, String bio, List<Channel> channels, long updatedAt) {
        this.peerID = peerID;
        this.bio = bio;
        this.channels = channels;
        this.updatedAt = updatedAt;
    }

    public String getPeerID() { return peerID; }
    public void setPeerID(String peerID) { this.peerID = peerID; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public List<Channel> getChannels() { return channels; }
    public void setChannels(List<Channel> channels) { this.channels = channels; }

    public long getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(long updatedAt) { this.updatedAt = updatedAt; }
}
