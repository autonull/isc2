package network.isc.simulation;

public record SimulationConfig(
    int numPeers,
    int durationSeconds,
    boolean guiMode,
    long seed,
    boolean useRealEmbeddings,
    boolean useRealDHT,
    boolean simulateDMs,
    boolean simulateFileTransfers,
    boolean simulateSocialEvents
) {}