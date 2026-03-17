package network.isc.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import network.isc.core.Channel;
import org.mapdb.DB;
import org.mapdb.DBMaker;
import org.mapdb.Serializer;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentMap;

public class MapDBStorageAdapter extends StorageAdapter {

    private final DB db;
    private final ConcurrentMap<String, String> map;
    private final ConcurrentMap<String, String> postsMap;
    private final ObjectMapper mapper;
    private static final String CHANNELS_KEY = "channels";
    private static final String DM_PREFIX = "dm:";
    private boolean postsEnabled = true;

    public MapDBStorageAdapter(String filepath) {
        // Call super with a dummy filepath to maintain compatibility if StorageAdapter is a concrete class.
        // It's better to make StorageAdapter an interface, but we don't want to break other things unnecessarily.
        super(filepath);
        File dbFile = new File(filepath);
        if (!dbFile.getParentFile().exists()) {
            dbFile.getParentFile().mkdirs();
        }

        db = DBMaker.fileDB(dbFile)
                .transactionEnable()
                .closeOnJvmShutdown()
                .make();

        map = db.hashMap("isc_data", Serializer.STRING, Serializer.STRING).createOrOpen();
        postsMap = db.hashMap("isc_posts", Serializer.STRING, Serializer.STRING).createOrOpen();
        mapper = network.isc.adapters.JsonUtils.createMapper();
    }

    public ConcurrentMap<String, String> getRawMap() {
        return map;
    }

    public void setPostsEnabled(boolean enabled) {
        this.postsEnabled = enabled;
    }

    public boolean isEnabled() {
        return postsEnabled;
    }

    public void savePost(network.isc.core.Post post) {
        if (!postsEnabled) return;

        try {
            String json = mapper.writeValueAsString(post);
            postsMap.put(post.getId(), json);
            db.commit();
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }

    public network.isc.core.Post getPost(String id) {
        String json = postsMap.get(id);
        if (json != null) {
            try {
                return mapper.readValue(json, network.isc.core.Post.class);
            } catch (JsonProcessingException e) {
                e.printStackTrace();
            }
        }
        return null;
    }

    public List<network.isc.core.Post> getPostsByChannel(String channelId) {
        List<network.isc.core.Post> channelPosts = new ArrayList<>();
        for (String json : postsMap.values()) {
            try {
                network.isc.core.Post post = mapper.readValue(json, network.isc.core.Post.class);
                if (channelId.equals(post.getChannelID())) {
                    channelPosts.add(post);
                }
            } catch (JsonProcessingException e) {
                e.printStackTrace();
            }
        }
        channelPosts.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
        return channelPosts;
    }

    public void deletePost(String id) {
        postsMap.remove(id);
        db.commit();
    }

    public void deleteAllPosts() {
        postsMap.clear();
        db.commit();
    }

    public void saveConfig(String key, String value) {
        map.put("config:" + key, value);
        db.commit();
    }

    public String loadConfig(String key) {
        return map.get("config:" + key);
    }

    @Override
    public List<Channel> loadChannels() {
        String json = map.get(CHANNELS_KEY);
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    @Override
    public void saveChannels(List<Channel> channels) {
        try {
            String json = mapper.writeValueAsString(channels);
            map.put(CHANNELS_KEY, json);
            db.commit();
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }

    public List<network.isc.protocol.ChatMessage> loadDirectMessages(String peerId) {
        String json = map.get(DM_PREFIX + peerId);
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    public void saveDirectMessages(String peerId, List<network.isc.protocol.ChatMessage> messages) {
        try {
            String json = mapper.writeValueAsString(messages);
            map.put(DM_PREFIX + peerId, json);
            db.commit();
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }

    public void close() {
        if (db != null && !db.isClosed()) {
            db.close();
        }
    }
}
