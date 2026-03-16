package network.isc.adapters;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import network.isc.core.Post;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class JsonPostAdapter {
    private static final Logger log = LoggerFactory.getLogger(JsonPostAdapter.class);
    private final File storageFile;
    private final ObjectMapper mapper;
    private boolean enabled = true;
    private List<Post> cache;

    public JsonPostAdapter(String filepath) {
        this.storageFile = new File(filepath);
        this.mapper = new ObjectMapper();

        if (this.storageFile.getParentFile() != null && !this.storageFile.getParentFile().exists()) {
            this.storageFile.getParentFile().mkdirs();
        }

        this.cache = loadAllPosts();
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    private List<Post> loadAllPosts() {
        if (!storageFile.exists()) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(storageFile, new TypeReference<List<Post>>() {});
        } catch (IOException e) {
            log.error("Failed to load posts from JSON", e);
            return new ArrayList<>();
        }
    }

    private synchronized void saveAllPosts() {
        if (!enabled) return;
        try {
            mapper.writeValue(storageFile, cache);
        } catch (IOException e) {
            log.error("Failed to save posts to JSON", e);
        }
    }

    public void savePost(Post post) {
        if (!enabled) return;

        synchronized (this) {
            // Remove if exists to update
            cache.removeIf(p -> p.getId().equals(post.getId()));
            cache.add(post);
            saveAllPosts();
        }
    }

    public List<Post> getPostsByChannel(String channelId) {
        synchronized (this) {
            return cache.stream()
                .filter(p -> channelId.equals(p.getChannelID()))
                .sorted((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp())) // DESC
                .collect(Collectors.toList());
        }
    }

    public void deletePost(String id) {
        synchronized (this) {
            cache.removeIf(p -> p.getId().equals(id));
            saveAllPosts();
        }
    }

    public void deleteAllPosts() {
        synchronized (this) {
            cache.clear();
            saveAllPosts();
        }
    }
}
