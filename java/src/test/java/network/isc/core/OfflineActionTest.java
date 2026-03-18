package network.isc.core;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for OfflineAction
 */
class OfflineActionTest {
    @Test
    void testCreateMessageAction() {
        var action = OfflineAction.message("channel123", "Hello world");

        assertNotNull(action.getId());
        assertEquals(OfflineAction.ActionType.MESSAGE, action.getType());
        assertEquals(OfflineAction.Priority.HIGH, action.getPriority());
        assertEquals(0, action.getRetryCount());
        assertEquals(3, action.getMaxRetries());
    }

    @Test
    void testCreatePostAction() {
        var action = OfflineAction.post("Post content", "channel456");

        assertEquals(OfflineAction.ActionType.POST, action.getType());
        assertEquals(OfflineAction.Priority.NORMAL, action.getPriority());
    }

    @Test
    void testCreateDirectMessageAction() {
        var action = OfflineAction.directMessage("peer789", "DM content");

        assertEquals(OfflineAction.ActionType.DM, action.getType());
        assertEquals(OfflineAction.Priority.HIGH, action.getPriority());
    }

    @Test
    void testIncrementRetry() {
        var action = OfflineAction.message("ch1", "test");

        action.setRetryCount(1);
        assertEquals(1, action.getRetryCount());

        action.setRetryCount(2);
        assertEquals(2, action.getRetryCount());

        action.setRetryCount(3);
        assertEquals(3, action.getRetryCount());
    }
}
