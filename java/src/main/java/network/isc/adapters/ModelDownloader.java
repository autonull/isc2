package network.isc.adapters;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class ModelDownloader {
    private static final Logger log = LoggerFactory.getLogger(ModelDownloader.class);

    private static final String MODEL_URL = "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx";
    private static final String TOKENIZER_URL = "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json";

    public static CompletableFuture<Void> ensureModelsExist(String targetDir, Consumer<Integer> progressCallback) {
        return CompletableFuture.runAsync(() -> {
            File dir = new File(targetDir);
            if (!dir.exists()) {
                dir.mkdirs();
            }

            File modelFile = new File(dir, "model_quantized.onnx");
            File tokenizerFile = new File(dir, "tokenizer.json");

            if (!modelFile.exists()) {
                log.info("Downloading ONNX model to {}", modelFile.getAbsolutePath());
                downloadFile(MODEL_URL, modelFile, progressCallback);
            }

            if (!tokenizerFile.exists()) {
                log.info("Downloading Tokenizer to {}", tokenizerFile.getAbsolutePath());
                downloadFile(TOKENIZER_URL, tokenizerFile, null);
            }
        });
    }

    private static void downloadFile(String fileUrl, File targetFile, Consumer<Integer> progressCallback) {
        try {
            URL url = new URL(fileUrl);
            URLConnection conn = url.openConnection();
            conn.setRequestProperty("User-Agent", "ISC-Java-Client/1.0");
            int contentLength = conn.getContentLength();

            try (InputStream is = conn.getInputStream();
                 FileOutputStream fos = new FileOutputStream(targetFile)) {

                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalRead = 0;

                while ((bytesRead = is.read(buffer)) != -1) {
                    fos.write(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                    if (contentLength > 0 && progressCallback != null) {
                        int percent = (int) ((totalRead * 100) / contentLength);
                        progressCallback.accept(percent);
                    }
                }
            }
        } catch (IOException e) {
            log.error("Failed to download file from {}", fileUrl, e);
            throw new RuntimeException("Download failed for " + fileUrl, e);
        }
    }
}
