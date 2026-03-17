package network.isc.adapters;

import java.io.File;
import java.util.concurrent.CompletableFuture;

/**
 * Abstract interface for file transfer support across the network.
 */
public interface FileTransferManager {

    /**
     * Stages a file to be shared and returns a network-addressable handle/hash.
     */
    CompletableFuture<String> stageFile(File file);

    /**
     * Downloads a file from the network given its handle/hash.
     */
    CompletableFuture<File> downloadFile(String fileHash, String destinationPath);

    /**
     * Start the background services needed for file transferring.
     */
    void start();

    /**
     * Stop the background services.
     */
    void stop();
}
