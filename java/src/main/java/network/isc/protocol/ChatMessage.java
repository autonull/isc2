package network.isc.protocol;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;

public class ChatMessage {
    private final String channelID;
    private final String msg;
    private final long timestamp;
    private final byte[] signature;

    @JsonCreator
    public ChatMessage(@JsonProperty("channelID") String channelID,
                       @JsonProperty("msg") String msg,
                       @JsonProperty("timestamp") long timestamp,
                       @JsonProperty("signature") byte[] signature) {
        this.channelID = channelID;
        this.msg = msg;
        this.timestamp = timestamp;
        this.signature = signature;
    }

    public String getChannelID() { return channelID; }
    public String getMsg() { return msg; }
    public long getTimestamp() { return timestamp; }
    public byte[] getSignature() { return signature; }
}
