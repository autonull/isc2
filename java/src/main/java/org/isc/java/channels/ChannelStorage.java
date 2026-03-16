package org.isc.java.channels;

import org.isc.java.types.Channel;

import java.util.List;

/**
 * Storage adapter for channels
 */
public interface ChannelStorage {
    List<Channel> getAll();
    Channel get(String id);
    void save(Channel channel);
    void delete(String id);
}