package org.isc.java.channels;

import org.isc.java.types.Channel;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Default in-memory storage implementation for channels
 */
public class DefaultChannelStorage implements ChannelStorage {
    private final Map<String, Channel> store = new ConcurrentHashMap<>();

    @Override
    public List<Channel> getAll() {
        return new ArrayList<>(store.values());
    }

    @Override
    public Channel get(String id) {
        return store.get(id);
    }

    @Override
    public void save(Channel channel) {
        if (channel.getId() == null || channel.getId().isEmpty()) {
            // Generate ID if not present
            String id = "ch_" + java.util.UUID.randomUUID().toString();
            channel.setId(id);
        }
        store.put(channel.getId(), channel);
    }

    @Override
    public void delete(String id) {
        store.remove(id);
    }
}