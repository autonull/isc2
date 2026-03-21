package network.isc.simulation;

import network.isc.core.SignedAnnouncement;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import network.isc.core.SemanticMath;
import network.isc.protocol.ProtocolConstants;

public class InMemoryDHT implements DHT {

    private final Map<String, List<SignedAnnouncement>> hashToAnnouncements = new ConcurrentHashMap<>();

    @Override
    public void announce(SignedAnnouncement announcement) {
        List<String> hashes = SemanticMath.lshHash(announcement.getVec(), announcement.getModel(), ProtocolConstants.TIER_NUM_HASHES);
        for (String hash : hashes) {
            hashToAnnouncements.computeIfAbsent(hash, k -> new ArrayList<>()).add(announcement);
        }
    }

    @Override
    public List<SignedAnnouncement> query(String[] hashes) {
        List<SignedAnnouncement> results = new ArrayList<>();
        for (String hash : hashes) {
            List<SignedAnnouncement> found = hashToAnnouncements.get(hash);
            if (found != null) {
                results.addAll(found);
            }
        }
        return results.stream().distinct().collect(Collectors.toList());
    }
}
