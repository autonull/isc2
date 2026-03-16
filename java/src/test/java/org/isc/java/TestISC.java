package org.isc.java;

import org.isc.java.channels.ChannelManager;
import org.isc.java.crypto.Keypair;
import org.isc.java.posts.PostService;
import org.isc.java.types.Channel;
import org.isc.java.types.Post;
import org.isc.java.types.Relation;

import java.util.List;

/**
 * Simple test to verify basic ISC Java functionality
 */
public class TestISC {
    public static void main(String[] args) {
        System.out.println("Testing ISC Java Implementation...");
        
        // Test Channel Manager
        ChannelManager channelManager = new ChannelManager();
        Channel general = channelManager.createChannel(
            "general", 
            "General discussion channel", 
            0.1, 
            List.of()
        );
        System.out.println("Created channel: " + general.getName());
        
        Channel tech = channelManager.createChannel(
            "technology", 
            "Technology discussion", 
            0.2, 
            List.of(
                new Relation("tech", "", 1.0),
                new Relation("programming", "", 0.8)
            )
        );
        System.out.println("Created channel: " + tech.getName());
        
        // Test Post Service
        PostService postService = new PostService();
        postService.initializeIdentity(); // Initialize identity for testing
        
        Post post1 = postService.createPost("Hello, ISC Java!", general.getId());
        System.out.println("Created post: " + post1.getContent());
        
        Post post2 = postService.createPost("Testing decentralized social networking", tech.getId());
        System.out.println("Created post: " + post2.getContent());
        
        // Verify we can retrieve posts
        List<Post> generalPosts = postService.getPostsByChannel(general.getId());
        System.out.println("Found " + generalPosts.size() + " posts in general channel");
        
        List<Post> techPosts = postService.getPostsByChannel(tech.getId());
        System.out.println("Found " + techPosts.size() + " posts in technology channel");
        
        // Test Crypto
        Keypair keypair = new Keypair();
        System.out.println("Generated keypair with fingerprint: " + keypair.getFingerprint());
        
        System.out.println("ISC Java Implementation test completed successfully!");
    }
}