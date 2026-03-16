package org.isc.java.network;

import org.isc.java.crypto.Keypair;
import org.isc.java.types.Channel;
import org.isc.java.types.Post;
import org.isc.java.types.SignedAnnouncement;
import org.isc.java.util.Encoding;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.Base64;

/**
 * Relay client for decentralized interoperation with remote instances
 * Communicates via HTTP/JSON with TypeScript implementation
 */
public class RelayClient {
    private final String relayUrl;
    private final String peerId;
    private final Keypair identityKeypair;

    public RelayClient(String relayUrl, String peerId, Keypair identityKeypair) {
        this.relayUrl = relayUrl.endsWith("/") ? relayUrl.substring(0, relayUrl.length() - 1) : relayUrl;
        this.peerId = peerId;
        this.identityKeypair = identityKeypair;
    }

    /**
     * Announce a channel to the relay network
     */
    public void announceChannel(Channel channel, List<double[]> distributions) {
        try {
            SignedAnnouncement announcement = createSignedAnnouncement(channel, distributions);
            String json = Encoding.encode(announcement).toString();
            
            URL url = new URL(relayUrl + "/announce");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            
            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = json.getBytes("utf-8");
                os.write(input, 0, input.length);
            }
            
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("Failed to announce channel: HTTP " + responseCode);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to announce channel", e);
        }
    }

    /**
     * Deactivate a channel in the relay network
     */
    public void deactivateChannel(String channelId) {
        try {
            Map<String, String> payload = new HashMap<>();
            payload.put("peerID", peerId);
            payload.put("channelID", channelId);
            
            String json = Encoding.encode(payload).toString();
            
            URL url = new URL(relayUrl + "/deactivate");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            
            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = json.getBytes("utf-8");
                os.write(input, 0, input.length);
            }
            
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("Failed to deactivate channel: HTTP " + responseCode);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to deactivate channel", e);
        }
    }

    /**
     * Get announcements from the relay network
     */
    public List<SignedAnnouncement> getAnnouncements() {
        try {
            URL url = new URL(relayUrl + "/announcements");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");
            
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("Failed to get announcements: HTTP " + responseCode);
            }
            
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(connection.getInputStream(), "utf-8"))) {
                StringBuilder response = new StringBuilder();
                String responseLine;
                while ((responseLine = br.readLine()) != null) {
                    response.append(responseLine.trim());
                }
                
                // Parse JSON array of announcements
                // In a real implementation, we'd use proper JSON parsing
                // For now, return empty list as placeholder
                return Collections.emptyList();
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to get announcements", e);
        }
    }

    /**
     * Post a message to the relay network
     */
    public void postMessage(Post post) {
        try {
            String json = Encoding.encode(post).toString();
            
            URL url = new URL(relayUrl + "/posts");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setDoOutput(true);
            
            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = json.getBytes("utf-8");
                os.write(input, 0, input.length);
            }
            
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("Failed to post message: HTTP " + responseCode);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to post message", e);
        }
    }

    /**
     * Get posts from the relay network
     */
    public List<Post> getPosts(String channelId) {
        try {
            String urlStr = relayUrl + "/posts";
            if (channelId != null && !channelId.isEmpty()) {
                urlStr += "?channelId=" + channelId;
            }
            
            URL url = new URL(urlStr);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("Accept", "application/json");
            
            int responseCode = connection.getResponseCode();
            if (responseCode != HttpURLConnection.HTTP_OK) {
                throw new IOException("Failed to get posts: HTTP " + responseCode);
            }
            
            // Parse JSON response - placeholder implementation
            return Collections.emptyList();
        } catch (IOException e) {
            throw new RuntimeException("Failed to get posts", e);
        }
    }

    /**
     * Create a signed announcement for a channel
     */
    private SignedAnnouncement createSignedAnnouncement(Channel channel, List<double[]> distributions) {
        SignedAnnouncement announcement = new SignedAnnouncement();
        announcement.setPeerID(peerId);
        announcement.setChannelID(channel.getId());
        announcement.setModel("isc-java-1.0");
        
        // Use first distribution's mu as vector, or empty if none
        List<Double> vec = new ArrayList<>();
        if (distributions != null && !distributions.isEmpty() && 
            distributions.get(0) != null && !distributions.get(0).isEmpty()) {
            vec = distributions.get(0);
        }
        // Convert List<Double> to double[] for the announcement
        double[] vecArray = new double[vec.size()];
        for (int i = 0; i < vec.size(); i++) {
            vecArray[i] = vec.get(i);
        }
        announcement.setVec(vecArray);
        
        announcement.setRelTag(""); // Optional
        announcement.setTtl(3600); // 1 hour TTL
        announcement.setUpdatedAt(System.currentTimeMillis());
        
        // Sign the announcement
        byte[] encoded = Encoding.encode(announcement);
        byte[] signature = identityKeypair.sign(encoded);
        announcement.setSignature(signature);
        
        return announcement;
    }
}