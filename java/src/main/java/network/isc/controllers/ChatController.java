package network.isc.controllers;

import network.isc.adapters.NetworkAdapter;
import network.isc.core.Channel;
import network.isc.core.Post;
import network.isc.core.PostService;
import network.isc.protocol.ChatMessage;
import network.isc.ui.ChatPanel;
import network.isc.ui.MainFrame;

import javax.swing.*;
import java.awt.TrayIcon;
import java.nio.charset.StandardCharsets;
import io.libp2p.core.crypto.PrivKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ChatController {
    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final NetworkAdapter network;
    private final PostService postService;
    private final MainFrame mainFrame;
    private final ChatPanel chatPanel;
    private final PrivKey libp2pKey;
    private final String getLocalAvatarBase64;
    private Channel activeChannel;

    public ChatController(NetworkAdapter network, PostService postService, MainFrame mainFrame, PrivKey libp2pKey, String getLocalAvatarBase64) {
        this.network = network;
        this.postService = postService;
        this.mainFrame = mainFrame;
        this.chatPanel = mainFrame.getChatPanel();
        this.libp2pKey = libp2pKey;
        this.getLocalAvatarBase64 = getLocalAvatarBase64;

        initListeners();
    }

    private void initListeners() {
        chatPanel.addSendListener(e -> {
            String msg = chatPanel.getAndClearInput();
            if (!msg.isEmpty() && activeChannel != null) {
                try {
                    Post post = postService.createPost(msg, activeChannel.getId());
                    chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), getLocalAvatarBase64);

                    byte[] pubKey = libp2pKey.publicKey().bytes();
                    ChatMessage chatMsg = new ChatMessage(post.getChannelID(), post.getContent(), post.getTimestamp(), post.getSignature(), pubKey, getLocalAvatarBase64);
                    network.broadcastChat(chatMsg);
                    log.info("Message sent in channel {}: {}", activeChannel.getName(), msg);
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(mainFrame, "Failed to post message: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        });
    }

    public void setActiveChannel(Channel channel) {
        this.activeChannel = channel;
        chatPanel.setChannelName(channel.getName(), channel.getDescription());

        java.util.List<Post> pastPosts = postService.getAllPosts(channel.getId());
        for (int i = pastPosts.size() - 1; i >= 0; i--) {
            Post p = pastPosts.get(i);
            chatPanel.appendMessage(p.getAuthor(), p.getContent(), p.getTimestamp(), "");
        }

        network.requestHistoricalPosts(channel.getId());
    }

    public void handleNetworkMessage(ChatMessage chatMsg) {
        Post post = chatMsg.toPost("Peer");
        postService.storePost(post);
        SwingUtilities.invokeLater(() -> {
            if (activeChannel != null && chatMsg.getChannelID().equals(activeChannel.getId())) {
                chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), chatMsg.getAvatarBase64());
            }

            String myPubKeyStr = libp2pKey.publicKey().toString();
            if (chatMsg.getMsg().contains("@" + myPubKeyStr) || chatMsg.getMsg().contains("@Me")) {
                mainFrame.displayTrayNotification("New Mention", "You were mentioned in a channel.", TrayIcon.MessageType.INFO);
            }
        });
    }

    public void handleHistoricalPostSync(ChatMessage syncMsg) {
        if ("SYNC_REQUEST".equals(syncMsg.getMsg())) {
            String channelID = syncMsg.getChannelID();
            java.util.List<Post> historical = postService.getAllPosts(channelID);
            for (Post p : historical) {
                ChatMessage hm = new ChatMessage(p.getChannelID(), p.getContent(), p.getTimestamp(), p.getSignature(), new byte[0], "");
                network.sendHistoricalPost(hm);
            }
        } else {
            Post post = syncMsg.toPost("Peer (History)");
            boolean isNew = postService.getPost(post.getId()) == null;
            if (isNew) {
                postService.storePost(post);
                SwingUtilities.invokeLater(() -> {
                    if (activeChannel != null && syncMsg.getChannelID().equals(activeChannel.getId())) {
                        chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), syncMsg.getAvatarBase64());
                    }
                });
            }
        }
    }
}
