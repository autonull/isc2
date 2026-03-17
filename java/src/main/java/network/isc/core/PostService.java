package network.isc.core;

import io.libp2p.core.crypto.PrivKey;
import network.isc.core.Post;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Post Service - Business logic layer for post operations
 * Adapted for network.isc to use libp2p PrivKey for signing.
 */
public class PostService {
    private final Map<String, Post> postStore = new ConcurrentHashMap<>();
    // Social state stores
    private final Map<String, Set<String>> postLikes = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> postReposts = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> userFollowers = new ConcurrentHashMap<>();

    private PrivKey identityKeypair;
    private boolean identityInitialized = false;
    private network.isc.adapters.MapDBStorageAdapter dbAdapter;

    public PostService() {
        // Default to in-memory store
    }

    public void setDatabaseAdapter(network.isc.adapters.MapDBStorageAdapter dbAdapter) {
        this.dbAdapter = dbAdapter;
        loadSocialState();
    }

    private void loadSocialState() {
        if (dbAdapter == null) return;
        java.util.concurrent.ConcurrentMap<String, String> map = dbAdapter.getRawMap();
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            String likesJson = map.get("social_likes");
            if (likesJson != null) {
                Map<String, Set<String>> loaded = mapper.readValue(likesJson, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Set<String>>>() {});
                postLikes.putAll(loaded);
            }
            String repostsJson = map.get("social_reposts");
            if (repostsJson != null) {
                Map<String, Set<String>> loaded = mapper.readValue(repostsJson, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Set<String>>>() {});
                postReposts.putAll(loaded);
            }
            String followersJson = map.get("social_followers");
            if (followersJson != null) {
                Map<String, Set<String>> loaded = mapper.readValue(followersJson, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Set<String>>>() {});
                userFollowers.putAll(loaded);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void saveSocialState() {
        if (dbAdapter == null) return;
        java.util.concurrent.ConcurrentMap<String, String> map = dbAdapter.getRawMap();
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            map.put("social_likes", mapper.writeValueAsString(postLikes));
            map.put("social_reposts", mapper.writeValueAsString(postReposts));
            map.put("social_followers", mapper.writeValueAsString(userFollowers));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * Create a new post
     */
    public Post createPost(String content, String channelId) {
        // Validate input
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Post content cannot be empty");
        }

        if (content.length() > 500) {
            throw new IllegalArgumentException("Post content must be less than 500 characters");
        }

        if (channelId == null || channelId.isEmpty()) {
            throw new IllegalArgumentException("Channel ID is required");
        }

        if (!identityInitialized || identityKeypair == null) {
            throw new IllegalStateException("Identity not initialized");
        }

        // Create post object (without signature)
        Post postWithoutSig = new Post();
        postWithoutSig.setId("post_" + UUID.randomUUID().toString());
        // For author, use a derived ID or just "Me" if not easily extractable
        postWithoutSig.setAuthor(java.util.Base64.getEncoder().encodeToString(identityKeypair.publicKey().bytes()));
        postWithoutSig.setContent(content.trim());
        postWithoutSig.setChannelID(channelId);
        postWithoutSig.setTimestamp(System.currentTimeMillis());

        // Sign the post
        byte[] signature = signPost(postWithoutSig);
        postWithoutSig.setSignature(signature);

        // Store locally
        postStore.put(postWithoutSig.getId(), postWithoutSig);
        if (dbAdapter != null) {
            dbAdapter.savePost(postWithoutSig);
        }

        return postWithoutSig;
    }

    /**
     * Store an external post (received from network)
     */
    public void storePost(Post post) {
        if (post != null && post.getId() != null) {
            postStore.put(post.getId(), post);
            if (dbAdapter != null) {
                dbAdapter.savePost(post);
            }
        }
    }

    /**
     * Get post by ID
     */
    public Post getPost(String id) {
        Post p = postStore.get(id);
        if (p == null && dbAdapter != null && dbAdapter.isEnabled()) {
            p = dbAdapter.getPost(id);
        }
        return p;
    }

    /**
     * Social Interactions
     */
    public void addLike(String postId, String likerId) {
        postLikes.computeIfAbsent(postId, k -> ConcurrentHashMap.newKeySet()).add(likerId);
        saveSocialState();
    }

    public void removeLike(String postId, String likerId) {
        Set<String> likers = postLikes.get(postId);
        if (likers != null) {
            likers.remove(likerId);
            saveSocialState();
        }
    }

    public int getLikeCount(String postId) {
        Set<String> likers = postLikes.get(postId);
        return likers != null ? likers.size() : 0;
    }

    public boolean hasLiked(String postId, String likerId) {
        Set<String> likers = postLikes.get(postId);
        return likers != null && likers.contains(likerId);
    }

    public void addRepost(String postId, String reposterId) {
        postReposts.computeIfAbsent(postId, k -> ConcurrentHashMap.newKeySet()).add(reposterId);
        saveSocialState();
    }

    public int getRepostCount(String postId) {
        Set<String> reposters = postReposts.get(postId);
        return reposters != null ? reposters.size() : 0;
    }

    public void addFollower(String followeeId, String followerId) {
        userFollowers.computeIfAbsent(followeeId, k -> ConcurrentHashMap.newKeySet()).add(followerId);
        saveSocialState();
    }

    public int getFollowerCount(String followeeId) {
        Set<String> followers = userFollowers.get(followeeId);
        return followers != null ? followers.size() : 0;
    }

    /**
     * Get all posts, optionally filtered by channel
     */
    public List<Post> getAllPosts(String channelId) {
        if (dbAdapter != null && dbAdapter.isEnabled() && channelId != null && !channelId.isEmpty()) {
            // Retrieve from persistent store if configured
            // Our DB returns them in DESC order (newest first), which is what we want.
            return dbAdapter.getPostsByChannel(channelId);
        }

        List<Post> posts = new ArrayList<>(postStore.values());

        // Filter by channel if specified
        if (channelId != null && !channelId.isEmpty()) {
            posts.removeIf(post -> !channelId.equals(post.getChannelID()));
        }

        // Sort by timestamp (newest first)
        posts.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
        return posts;
    }

    /**
     * Sign post content with user's keypair
     */
    private byte[] signPost(Post postWithoutSig) {
        if (identityKeypair == null) {
            throw new IllegalStateException("Cannot sign post: identity not initialized");
        }

        // Align payload with ChatMessage verification
        String payload = postWithoutSig.getChannelID() + postWithoutSig.getContent() + postWithoutSig.getTimestamp();

        byte[] encoded = payload.getBytes(StandardCharsets.UTF_8);
        return identityKeypair.sign(encoded);
    }

    /**
     * Initialize identity
     */
    public void initializeIdentity(PrivKey key) {
        this.identityKeypair = key;
        this.identityInitialized = true;
    }

    public boolean isIdentityInitialized() {
        return identityInitialized;
    }

    public PrivKey getIdentityKeypair() {
        return identityKeypair;
    }
}
