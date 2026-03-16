package network.isc.protocol;

public class ProtocolConstants {
    public static final String PROTOCOL_CHAT = "/isc/chat/1.0";
    public static final String PROTOCOL_DELEGATE = "/isc/delegate/1.0";
    public static final String PROTOCOL_DM = "/isc/dm/1.0";
    public static final String PROTOCOL_ANNOUNCE = "/isc/announce/1.0";
    public static final String PROTOCOL_POST = "/isc/post/1.0";
    public static final String PROTOCOL_QUERY = "/isc/query/1.0";
    public static final String PROTOCOL_FILE = "/isc/file/1.0";

    // Tier-specific defaults for High tier (Desktop)
    public static final int TIER_NUM_HASHES = 20;
    public static final int TIER_CANDIDATE_CAP = 100;
    public static final long TIER_REFRESH_INTERVAL = 300000; // 5 min in ms
}
