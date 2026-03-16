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
    private PrivKey identityKeypair;
    private boolean identityInitialized = false;
    private network.isc.adapters.JsonPostAdapter dbAdapter;

    public PostService() {
        // Default to in-memory store
    }

    public void setDatabaseAdapter(network.isc.adapters.JsonPostAdapter dbAdapter) {
        this.dbAdapter = dbAdapter;
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
        postWithoutSig.setAuthor(identityKeypair.publicKey().toString());
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
        return postStore.get(id);
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
