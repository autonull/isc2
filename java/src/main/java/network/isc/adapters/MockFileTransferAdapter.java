package network.isc.adapters;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/**
 * A simple mock implementation of FileTransferManager that copies files to a local temp directory
 * instead of transferring over IPFS or custom P2P streams.
 * Represents the abstract boundary ready for future extension.
 */
public class MockFileTransferAdapter implements FileTransferManager {

    private final File mockStorageDir;

    public MockFileTransferAdapter() {
        mockStorageDir = new File(System.getProperty("java.io.tmpdir"), "isc-mock-files");
        if (!mockStorageDir.exists()) {
            mockStorageDir.mkdirs();
        }
    }

    @Override
    public CompletableFuture<String> stageFile(File file) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String hash = "local_" + UUID.randomUUID().toString().substring(0, 8) + "_" + file.getName();
                File dest = new File(mockStorageDir, hash);
                Files.copy(file.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
                return hash;
            } catch (Exception e) {
                throw new RuntimeException("Failed to stage mock file", e);
            }
        });
    }

    @Override
    public CompletableFuture<File> downloadFile(String fileHash, String destinationPath) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                File source = new File(mockStorageDir, fileHash);
                if (!source.exists()) {
                    throw new RuntimeException("File not found in mock storage: " + fileHash);
                }

                File dest = new File(destinationPath);
                Files.copy(source.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
                return dest;
            } catch (Exception e) {
                throw new RuntimeException("Failed to download mock file", e);
            }
        });
    }

    @Override
    public void start() {
        // Nothing to start for mock
    }

    @Override
    public void stop() {
        // Nothing to stop for mock
    }
}
