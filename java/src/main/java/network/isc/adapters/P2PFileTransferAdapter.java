package network.isc.adapters;

import network.isc.protocol.FileProtocol;
import io.libp2p.core.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiConsumer;

/**
 * Implements FileTransferManager using the custom P2P File protocol.
 * Stores staged files locally, and serves them upon request over libp2p.
 */
public class P2PFileTransferAdapter implements FileTransferManager {

    private static final Logger log = LoggerFactory.getLogger(P2PFileTransferAdapter.class);
    private final File storageDir;

    // Track file streams we're downloading
    private final ConcurrentHashMap<String, FileOutputStream> incomingDownloads = new ConcurrentHashMap<>();
    // Track which stream is downloading which file
    private final ConcurrentHashMap<Stream, String> streamToHash = new ConcurrentHashMap<>();
    // Track pending futures for downloads
    private final ConcurrentHashMap<String, CompletableFuture<File>> downloadFutures = new ConcurrentHashMap<>();

    private final NetworkAdapter network;

    public P2PFileTransferAdapter(NetworkAdapter network) {
        this.network = network;
        this.storageDir = new File(System.getProperty("java.io.tmpdir"), "isc-p2p-files");
        if (!storageDir.exists()) {
            storageDir.mkdirs();
        }
    }

    /**
     * Compute a SHA-256 hash for the file to use as its network handle.
     */
    private String computeHash(File file) throws IOException, NoSuchAlgorithmException {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream is = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) > 0) {
                digest.update(buffer, 0, read);
            }
        }
        byte[] hash = digest.digest();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    }

    @Override
    public CompletableFuture<String> stageFile(File file) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String hash = computeHash(file);
                File dest = new File(storageDir, hash);
                Files.copy(file.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
                log.info("Staged file locally with hash: {}", hash);
                return hash;
            } catch (Exception e) {
                log.error("Failed to stage file", e);
                throw new RuntimeException("Failed to stage file", e);
            }
        });
    }

    @Override
    public CompletableFuture<File> downloadFile(String fileHash, String destinationPath) {
        CompletableFuture<File> future = new CompletableFuture<>();

        // Check if we already have it locally
        File localFile = new File(storageDir, fileHash);
        if (localFile.exists()) {
            try {
                File dest = new File(destinationPath);
                Files.copy(localFile.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
                future.complete(dest);
                return future;
            } catch (IOException e) {
                log.error("Failed to copy cached file", e);
            }
        }

        // Otherwise, we need to request it from the network
        // For simplicity in this implementation, we broadcast a request for the file hash
        // The request is just the hash string as UTF-8 bytes

        try {
            File destTemp = new File(storageDir, fileHash + ".downloading");
            FileOutputStream fos = new FileOutputStream(destTemp);
            incomingDownloads.put(fileHash, fos);

            // We need a wrapper to finalize when done
            CompletableFuture<File> transferFuture = new CompletableFuture<>();
            transferFuture.whenComplete((f, ex) -> {
                incomingDownloads.remove(fileHash);
                if (ex == null && f != null) {
                    try {
                        File dest = new File(destinationPath);
                        Files.copy(f.toPath(), dest.toPath(), StandardCopyOption.REPLACE_EXISTING);
                        future.complete(dest);
                    } catch (IOException e) {
                        future.completeExceptionally(e);
                    }
                } else {
                    future.completeExceptionally(ex);
                }
            });

            downloadFutures.put(fileHash, transferFuture);

            // Send request to all active file streams and track the association
            byte[] requestPayload = ("REQ:" + fileHash).getBytes(StandardCharsets.UTF_8);
            network.broadcastFileProtocolData(requestPayload, stream -> {
                streamToHash.put(stream, fileHash);
            });
            log.info("Broadcasted request for file hash: {}", fileHash);

            // Timeout handling could be added here

        } catch (IOException e) {
            future.completeExceptionally(e);
        }

        return future;
    }

    private boolean isValidHash(String hash) {
        // Base64Url string check (no slashes, no dots, etc)
        return hash != null && hash.matches("^[A-Za-z0-9_-]+$");
    }

    /**
     * Handles incoming data chunks over the /isc/file/1.0 protocol.
     * Can be either a REQ for a file, or actual file DATA.
     */
    public void handleIncomingChunk(Stream stream, byte[] data) {
        // Check if this chunk is a control message (REQ/EOF)
        // With LengthFieldBasedFrameDecoder, we get whole frames. We can use a simple heuristic
        // or a prefix byte to differentiate, but since our control messages are short UTF-8 strings:
        if (data.length < 256) {
            String msg = new String(data, StandardCharsets.UTF_8);
            if (msg.startsWith("REQ:")) {
                String requestedHash = msg.substring(4);
                if (isValidHash(requestedHash)) {
                    serveFileToStream(stream, requestedHash);
                } else {
                    log.warn("Invalid file request hash format: {}", requestedHash);
                }
                return;
            } else if (msg.startsWith("EOF:")) {
                String finishedHash = msg.substring(4);
                if (!isValidHash(finishedHash)) return;

                streamToHash.remove(stream);
                FileOutputStream fos = incomingDownloads.remove(finishedHash);
                if (fos != null) {
                    try {
                        fos.close();
                        File downloadedFile = new File(storageDir, finishedHash + ".downloading");
                        File finalFile = new File(storageDir, finishedHash);
                        downloadedFile.renameTo(finalFile);

                        CompletableFuture<File> future = downloadFutures.remove(finishedHash);
                        if (future != null) {
                            future.complete(finalFile);
                        }
                        log.info("Successfully downloaded file: {}", finishedHash);
                    } catch (IOException e) {
                        log.error("Failed closing download stream for " + finishedHash, e);
                    }
                }
                return;
            }
        }

        // It's raw file data for a download we requested.
        // Resolve the hash from the stream that sent it
        String hash = streamToHash.get(stream);
        if (hash != null) {
            FileOutputStream fos = incomingDownloads.get(hash);
            if (fos != null) {
                try {
                    fos.write(data);
                } catch (IOException e) {
                    log.error("Error writing incoming chunk for " + hash, e);
                }
            }
        } else {
            log.warn("Received raw data chunk from stream but no download is mapped to it.");
        }
    }

    private void serveFileToStream(Stream stream, String hash) {
        File file = new File(storageDir, hash);

        try {
            // Extra safety to ensure canonical path is inside storageDir
            if (!file.getCanonicalPath().startsWith(storageDir.getCanonicalPath())) {
                log.warn("Attempted directory traversal: {}", hash);
                return;
            }
        } catch (IOException e) {
            log.error("Failed to resolve file path", e);
            return;
        }

        if (file.exists()) {
            log.info("Serving file {} to remote peer", hash);
            network.sendFileData(stream, file).thenRun(() -> {
                // Send EOF marker
                byte[] eof = ("EOF:" + hash).getBytes(StandardCharsets.UTF_8);
                try {
                    network.sendFileProtocolData(stream, eof);
                } catch (Exception e) {
                    log.error("Failed to send EOF", e);
                }
            });
        } else {
            log.warn("Requested file {} not found locally", hash);
        }
    }

    @Override
    public void start() {
        log.info("P2P File Transfer Manager started");
    }

    @Override
    public void stop() {
        log.info("P2P File Transfer Manager stopped");
        for (FileOutputStream fos : incomingDownloads.values()) {
            try {
                fos.close();
            } catch (IOException e) {
                // Ignore
            }
        }
        incomingDownloads.clear();
        downloadFutures.clear();
        streamToHash.clear();
    }
}
