package org.isc.java.posts;

import org.isc.java.types.Post;
import org.isc.java.crypto.Keypair;
import org.isc.java.util.Encoding;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Post Service - Business logic layer for post operations
 * All posts MUST be signed - unsigned posts are rejected.
 */
public class PostService {
    private static final String DB_NAME = "isc-posts";
    private static final String POST_STORE = "posts";
    
    private final Map<String, Post> postStore = new ConcurrentHashMap<>();
    private Keypair identityKeypair;
    private boolean identityInitialized = false;

    public PostService() {
        // In-memory store for simplicity
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

        // Ensure identity is initialized
        if (!identityInitialized) {
            throw new IllegalStateException("Please complete onboarding to create posts");
        }

        if (identityKeypair == null) {
            throw new IllegalStateException("Identity not initialized");
        }

        // Create post object (without signature)
        Post postWithoutSig = new Post();
        postWithoutSig.setId("post_" + UUID.randomUUID().toString());
        postWithoutSig.setAuthor(identityKeypair.getFingerprint());
        postWithoutSig.setContent(content.trim());
        postWithoutSig.setChannelID(channelId);
        postWithoutSig.setTimestamp(System.currentTimeMillis());

        // Sign the post
        byte[] signature = signPost(postWithoutSig);
        postWithoutSig.setSignature(signature);

        // Store locally
        postStore.put(postWithoutSig.getId(), postWithoutSig);

        return postWithoutSig;
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
     * Get posts by channel
     */
    public List<Post> getPostsByChannel(String channelId) {
        return getAllPosts(channelId);
    }

    /**
     * Get posts by author
     */
    public List<Post> getPostsByAuthor(String author) {
        List<Post> posts = new ArrayList<>(postStore.values());
        posts.removeIf(post -> !author.equals(post.getAuthor()));
        posts.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
        return posts;
    }

    /**
     * Delete post
     */
    public void deletePost(String id) {
        postStore.remove(id);
    }

    /**
     * Like post
     */
    public void likePost(String postId) {
        Post post = getPost(postId);
        if (post == null) {
            throw new IllegalArgumentException("Post not found");
        }

        // For simplicity, we're not storing like counts in the post object
        // In a full implementation, we would have a separate like count field
        // For now, we'll just update the post to indicate it was liked
        // This is a simplified implementation
    }

    /**
     * Repost post
     */
    public void repostPost(String postId) {
        Post post = getPost(postId);
        if (post == null) {
            throw new IllegalArgumentException("Post not found");
        }

        // Create a repost (requires identity)
        createPost(post.getContent(), post.getChannelID());
        // In a full implementation, we would mark this as a repost
    }

    /**
     * Reply to post
     */
    public Post replyToPost(String postId, String content) {
        Post parentPost = getPost(postId);
        if (parentPost == null) {
            throw new IllegalArgumentException("Parent post not found");
        }

        // Create reply post (requires identity)
        Post reply = createPost(content, parentPost.getChannelID());
        
        // Mark as reply (in a full implementation, we would have a replyTo field)
        // For now, we just return the reply
        return reply;
    }

    /**
     * Sign post content with user's keypair
     */
    private byte[] signPost(Post postWithoutSig) {
        if (identityKeypair == null) {
            throw new IllegalStateException("Cannot sign post: identity not initialized");
        }

        // Encode the post (excluding signature) for signing
        Post postForSigning = new Post();
        postForSigning.setId(postWithoutSig.getId());
        postForSigning.setAuthor(postWithoutSig.getAuthor());
        postForSigning.setContent(postWithoutSig.getContent());
        postForSigning.setChannelID(postWithoutSig.getChannelID());
        postForSigning.setTimestamp(postWithoutSig.getTimestamp());

        byte[] encoded = Encoding.encode(postForSigning);
        return identityKeypair.sign(encoded);
    }

    /**
     * Initialize identity (called during onboarding)
     */
    public void initializeIdentity() {
        this.identityKeypair = new Keypair();
        this.identityInitialized = true;
    }

    /**
     * Check if identity is initialized
     */
    public boolean isIdentityInitialized() {
        return identityInitialized;
    }

    /**
     * Get current identity keypair
     */
    public Keypair getIdentityKeypair() {
        return identityKeypair;
    }
}