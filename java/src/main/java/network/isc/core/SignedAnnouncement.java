package network.isc.core;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;

public class SignedAnnouncement {
    private final String peerID;
    private final String channelID;
    private final String model;
    private final float[] vec;
    private final String relTag;
    private final long ttl;
    private final long updatedAt;
    private final byte[] signature;

    @JsonCreator
    public SignedAnnouncement(@JsonProperty("peerID") String peerID,
                              @JsonProperty("channelID") String channelID,
                              @JsonProperty("model") String model,
                              @JsonProperty("vec") float[] vec,
                              @JsonProperty("relTag") String relTag,
                              @JsonProperty("ttl") long ttl,
                              @JsonProperty("updatedAt") long updatedAt,
                              @JsonProperty("signature") byte[] signature) {
        this.peerID = peerID;
        this.channelID = channelID;
        this.model = model;
        this.vec = vec;
        this.relTag = relTag;
        this.ttl = ttl;
        this.updatedAt = updatedAt;
        this.signature = signature;
    }

    public String getPeerID() { return peerID; }
    public String getChannelID() { return channelID; }
    public String getModel() { return model; }
    public float[] getVec() { return vec; }
    public String getRelTag() { return relTag; }
    public long getTtl() { return ttl; }
    public long getUpdatedAt() { return updatedAt; }
    public byte[] getSignature() { return signature; }
}
