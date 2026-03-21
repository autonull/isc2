package network.isc.simulation;

import network.isc.core.OfflineAction;
import network.isc.adapters.MapDBStorageAdapter;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for offline queue functionality
 */
class OfflineIntegrationTest {
    @Test
    void testOfflineQueuePersistence() throws Exception {
        var tempDb = Files.createTempFile("isc-test-", ".db").toFile();
        tempDb.delete();
        tempDb.deleteOnExit();
        var storage = new MapDBStorageAdapter(tempDb.getAbsolutePath());

        var action = OfflineAction.message("test-channel", "Offline message");
        storage.enqueueAction(action);

        assertEquals(1, storage.getQueueCount());
        assertTrue(storage.hasPendingActions());

        var actions = storage.getQueuedActions();
        assertEquals(1, actions.size());
        assertEquals(action.getId(), actions.get(0).getId());
        assertEquals(OfflineAction.ActionType.MESSAGE, actions.get(0).getType());

        storage.removeAction(action.getId());
        assertEquals(0, storage.getQueueCount());
        storage.close();
    }

    @Test
    void testRetryIncrement() throws Exception {
        var tempDb = Files.createTempFile("isc-test-", ".db").toFile();
        tempDb.delete();
        tempDb.deleteOnExit();
        var storage = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        var action = OfflineAction.message("ch1", "test");
        storage.enqueueAction(action);

        assertNotNull(storage.incrementRetry(action.getId())); // 1
        assertNotNull(storage.incrementRetry(action.getId())); // 2
        assertNull(storage.incrementRetry(action.getId())); // 3 - removed
        assertEquals(0, storage.getQueueCount());
        storage.close();
    }

    @Test
    void testQueueSurvivesRestart() throws Exception {
        var tempDb = Files.createTempFile("isc-test-", ".db").toFile();
        tempDb.delete();
        tempDb.deleteOnExit();

        var storage1 = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        storage1.enqueueAction(OfflineAction.message("ch1", "persistent"));
        storage1.close();

        var storage2 = new MapDBStorageAdapter(tempDb.getAbsolutePath());
        assertEquals(1, storage2.getQueueCount());
        var actions = storage2.getQueuedActions();
        assertEquals(1, actions.size());
        assertTrue(new String(actions.get(0).getPayload()).contains("persistent"));
        storage2.close();
    }
}
