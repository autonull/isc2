package network.isc.services;

import network.isc.core.OfflineAction;
import network.isc.adapters.MapDBStorageAdapter;
import network.isc.adapters.NetworkAdapter;
import network.isc.core.PostService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for OfflineQueueService
 */
class OfflineQueueServiceTest {
    @Mock
    private MapDBStorageAdapter storage;

    @Mock
    private NetworkAdapter network;

    @Mock
    private PostService postService;

    private OfflineQueueService queueService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testEnqueueAction() {
        queueService = new OfflineQueueService(storage, network, postService);

        var action = OfflineAction.message("ch1", "test");
        queueService.enqueueAction(action);

        verify(storage).enqueueAction(action);
    }

    @Test
    void testProcessQueue_whenOnline() throws Exception {
        when(network.isOnline()).thenReturn(true);
        when(storage.getQueuedActions()).thenReturn(
            java.util.List.of(OfflineAction.post("test", "ch1"))
        );
        when(postService.createPost(anyString(), anyString())).thenReturn(new network.isc.core.Post(
                "p1", "ch1", "test", "author", System.currentTimeMillis(), new byte[0]
        ));

        queueService = new OfflineQueueService(storage, network, postService);
        queueService.processQueue();

        verify(storage).removeAction(any());
    }

    @Test
    void testProcessQueue_whenOffline() {
        when(network.isOnline()).thenReturn(false);

        queueService = new OfflineQueueService(storage, network, postService);
        queueService.processQueue();

        verify(storage, never()).getQueuedActions();
    }

    @Test
    void testRetry_onFailure() throws Exception {
        when(network.isOnline()).thenReturn(true);
        var action = OfflineAction.post("test", "ch1");
        when(storage.getQueuedActions()).thenReturn(java.util.List.of(action));

        // Throw exception to trigger failure
        when(postService.createPost(anyString(), anyString())).thenThrow(new RuntimeException("Test exception"));
        when(storage.incrementRetry(any())).thenReturn(action);

        queueService = new OfflineQueueService(storage, network, postService);
        queueService.processQueue();

        verify(storage).incrementRetry(action.getId());
        verify(storage, never()).removeAction(action.getId());
    }
}
