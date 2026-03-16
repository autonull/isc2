package org.isc.java.types;

import java.util.Base64;

/**
 * Represents a signed announcement for channel discovery
 */
public class SignedAnnouncement {
    private String peerID;
    private String channelID;
    private String model;
    private double[] vec;
    private String relTag;
    private int ttl;
    private long updatedAt;
    private byte[] signature;

    public SignedAnnouncement() {}

    public SignedAnnouncement(String peerID, String channelID, String model, double[] vec, 
                              String relTag, int ttl, long updatedAt, byte[] signature) {
        this.peerID = peerID;
        this.channelID = channelID;
        this.model = model;
        this.vec = vec;
        this.relTag = relTag;
        this.ttl = ttl;
        this.updatedAt = updatedAt;
        this.signature = signature;
    }

    public String getPeerID() {
        return peerID;
    }

    public void setPeerID(String peerID) {
        this.peerID = peerID;
    }

    public String getChannelID() {
        return channelID;
    }

    public void setChannelID(String channelID) {
        this.channelID = channelID;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public double[] getVec() {
        return vec;
    }

    public void setVec(double[] vec) {
        this.vec = vec;
    }

    public String getRelTag() {
        return relTag;
    }

    public void setRelTag(String relTag) {
        this.relTag = relTag;
    }

    public int getTtl() {
        return ttl;
    }

    public void setTtl(int ttl) {
        this.ttl = ttl;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(long updatedAt) {
        this.updatedAt = updatedAt;
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
        return "SignedAnnouncement{" +
                "peerID='" + peerID + '\'' +
                ", channelID='" + channelID + '\'' +
                ", model='" + model + '\'' +
                ", vec=" + Arrays.toString(vec) +
                ", relTag='" + relTag + '\'' +
                ", ttl=" + ttl +
                ", updatedAt=" + updatedAt +
                ", signature=" + (signature != null ? signature.length + " bytes" : "null") +
                '}';
    }
}