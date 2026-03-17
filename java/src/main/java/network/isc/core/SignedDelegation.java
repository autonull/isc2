package network.isc.core;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Base64;

public class SignedDelegation {
    private final String masterKey;
    private final String ephemeralKey;
    private final long expiresAt;
    private final byte[] signature; // Master key signing (ephemeralKey + expiresAt)

    @JsonCreator
    public SignedDelegation(@JsonProperty("masterKey") String masterKey,
                            @JsonProperty("ephemeralKey") String ephemeralKey,
                            @JsonProperty("expiresAt") long expiresAt,
                            @JsonProperty("signature") byte[] signature) {
        this.masterKey = masterKey;
        this.ephemeralKey = ephemeralKey;
        this.expiresAt = expiresAt;
        this.signature = signature;
    }

    public String getMasterKey() {
        return masterKey;
    }

    public String getEphemeralKey() {
        return ephemeralKey;
    }

    public long getExpiresAt() {
        return expiresAt;
    }

    public byte[] getSignature() {
        return signature;
    }

    public String getSignatureBase64() {
        return signature != null ? Base64.getEncoder().encodeToString(signature) : null;
    }
}
