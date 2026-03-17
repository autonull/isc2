package network.isc.simulation;

import network.isc.core.SignedAnnouncement;

import java.util.List;

public interface DHT {
    void announce(SignedAnnouncement announcement);
    List<SignedAnnouncement> query(String[] hashes);
}