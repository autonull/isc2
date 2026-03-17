package network.isc.simulation;

public interface NetworkActivityListener {
    void onNetworkActivity(String fromPeerId, String toPeerId, String protocol);
}
