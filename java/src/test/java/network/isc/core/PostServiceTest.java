package network.isc.core;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

import io.libp2p.core.crypto.PrivKey;
import io.libp2p.core.crypto.KeyKt;
import io.libp2p.core.crypto.KeyType;

class PostServiceTest {

    private PostService postService;
    private PrivKey mockKey;

    @BeforeEach
    void setUp() {
        postService = new PostService();
        mockKey = KeyKt.generateKeyPair(KeyType.ED25519).component1();
        postService.initializeIdentity(mockKey);
    }

    @Test
    void testCreateAndRetrievePost() {
        Post post = postService.createPost("Hello World", "channel-1");

        assertNotNull(post.getId(), "Post ID should not be null");
        assertEquals("Hello World", post.getContent());
        assertEquals("channel-1", post.getChannelID());
        assertNotNull(post.getSignature(), "Post should be signed");

        Post retrieved = postService.getPost(post.getId());
        assertEquals(post, retrieved, "Retrieved post should match created post");
    }

    @Test
    void testGetAllPostsFiltering() {
        postService.createPost("Msg 1", "channel-1");
        postService.createPost("Msg 2", "channel-2");
        postService.createPost("Msg 3", "channel-1");

        List<Post> ch1Posts = postService.getAllPosts("channel-1");
        List<Post> ch2Posts = postService.getAllPosts("channel-2");

        assertEquals(2, ch1Posts.size(), "Channel 1 should have 2 posts");
        assertEquals(1, ch2Posts.size(), "Channel 2 should have 1 post");

        // Verify sorting (newest first)
        assertTrue(ch1Posts.get(0).getTimestamp() >= ch1Posts.get(1).getTimestamp(), "Posts should be sorted DESC");
    }

    @Test
    void testStoreExternalPost() {
        Post externalPost = new Post("ext-1", "ExternalUser", "Hello from outside", "channel-1", System.currentTimeMillis(), new byte[]{1, 2, 3});
        postService.storePost(externalPost);

        Post retrieved = postService.getPost("ext-1");
        assertNotNull(retrieved, "External post should be stored and retrievable");
        assertEquals("Hello from outside", retrieved.getContent());
    }

    @Test
    void testCreatePostThrowsIfNotInitialized() {
        PostService uninitializedService = new PostService();

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            uninitializedService.createPost("Fail", "chan");
        });

        assertTrue(ex.getMessage().contains("Identity not initialized"));
    }
}
