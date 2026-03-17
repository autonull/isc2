package network.isc.controllers;

import network.isc.adapters.NetworkAdapter;
import network.isc.core.Channel;
import network.isc.core.Post;
import network.isc.core.PostService;
import network.isc.protocol.ChatMessage;
import network.isc.adapters.FileTransferManager;
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
    private final FileTransferManager fileTransfer;
    private Channel activeChannel;

    public ChatController(NetworkAdapter network, PostService postService, FileTransferManager fileTransfer, MainFrame mainFrame, PrivKey libp2pKey, String getLocalAvatarBase64) {
        this.network = network;
        this.postService = postService;
        this.fileTransfer = fileTransfer;
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
                    chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), getLocalAvatarBase64, post.getId(), 0, 0);

                    byte[] pubKey = libp2pKey.publicKey().bytes();
                    ChatMessage chatMsg = new ChatMessage(post.getChannelID(), post.getContent(), post.getTimestamp(), post.getSignature(), pubKey, getLocalAvatarBase64);

                    if (activeChannel.isGroup()) {
                        network.sendGroupMessage(activeChannel.getGroupPeers(), chatMsg);
                        log.info("Message sent to group {}: {}", activeChannel.getName(), msg);
                    } else {
                        network.broadcastChat(chatMsg);
                        log.info("Message sent in channel {}: {}", activeChannel.getName(), msg);
                    }
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(mainFrame, "Failed to post message: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        });

        chatPanel.setSocialActionHandler(action -> {
            if (action.startsWith("like://")) {
                String postId = action.substring("like://".length());
                String myId = libp2pKey.publicKey().toString();

                if (!postService.hasLiked(postId, myId)) {
                    postService.addLike(postId, myId);
                    long ts = System.currentTimeMillis();
                    String payload = myId + postId + ts;
                    byte[] sig = libp2pKey.sign(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));

                    network.isc.core.LikeEvent like = new network.isc.core.LikeEvent(myId, postId, ts, sig);
                    network.broadcastSocialEvent(like);
                    refreshChatDisplayOnly();
                }
            } else if (action.startsWith("repost://")) {
                String postId = action.substring("repost://".length());
                String myId = libp2pKey.publicKey().toString();
                postService.addRepost(postId, myId);

                long ts = System.currentTimeMillis();
                String payload = myId + postId + ts;
                byte[] sig = libp2pKey.sign(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));

                network.isc.core.RepostEvent repost = new network.isc.core.RepostEvent(myId, postId, ts, sig);
                network.broadcastSocialEvent(repost);
                refreshChatDisplayOnly();
            } else if (action.startsWith("file://")) {
                String fileHash = action.substring("file://".length());
                JFileChooser fileChooser = new JFileChooser();
                fileChooser.setDialogTitle("Save Downloaded File");
                int userSelection = fileChooser.showSaveDialog(mainFrame);

                if (userSelection == JFileChooser.APPROVE_OPTION) {
                    java.io.File dest = fileChooser.getSelectedFile();
                    fileTransfer.downloadFile(fileHash, dest.getAbsolutePath()).thenAccept(f -> {
                        SwingUtilities.invokeLater(() -> {
                            JOptionPane.showMessageDialog(mainFrame, "File downloaded successfully to: " + f.getAbsolutePath());
                        });
                    }).exceptionally(ex -> {
                        SwingUtilities.invokeLater(() -> {
                            JOptionPane.showMessageDialog(mainFrame, "Failed to download file: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                        });
                        return null;
                    });
                }
            }
        });

        chatPanel.addAttachListener(e -> {
            JFileChooser fileChooser = new JFileChooser();
            int option = fileChooser.showOpenDialog(mainFrame);
            if (option == JFileChooser.APPROVE_OPTION) {
                java.io.File file = fileChooser.getSelectedFile();
                if (file != null && file.exists()) {
                    fileTransfer.stageFile(file).thenAccept(hash -> {
                        SwingUtilities.invokeLater(() -> {
                            chatPanel.appendToInput("[FILE: " + hash + "]");
                        });
                    }).exceptionally(ex -> {
                        SwingUtilities.invokeLater(() -> {
                            JOptionPane.showMessageDialog(mainFrame, "Failed to stage file: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                        });
                        return null;
                    });
                }
            }
        });
    }

    private void refreshChatDisplayOnly() {
        if (activeChannel == null) return;
        chatPanel.setChannelName(activeChannel.getName(), activeChannel.getDescription());
        java.util.List<Post> pastPosts = postService.getAllPosts(activeChannel.getId());
        for (int i = pastPosts.size() - 1; i >= 0; i--) {
            Post p = pastPosts.get(i);
            int likes = postService.getLikeCount(p.getId());
            int reposts = postService.getRepostCount(p.getId());
            chatPanel.appendMessage(p.getAuthor(), p.getContent(), p.getTimestamp(), "", p.getId(), likes, reposts);
        }
    }

    public void setActiveChannel(Channel channel) {
        if (channel == null) return;
        this.activeChannel = channel;
        refreshChatDisplayOnly();
        network.requestHistoricalPosts(channel.getId());
    }

    public void handleNetworkMessage(ChatMessage chatMsg) {
        Post post = chatMsg.toPost("Peer");
        postService.storePost(post);
        SwingUtilities.invokeLater(() -> {
            if (activeChannel != null && chatMsg.getChannelID().equals(activeChannel.getId())) {
                int likes = postService.getLikeCount(post.getId());
                int reposts = postService.getRepostCount(post.getId());
                chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), chatMsg.getAvatarBase64(), post.getId(), likes, reposts);
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
                        int likes = postService.getLikeCount(post.getId());
                        int reposts = postService.getRepostCount(post.getId());
                        chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), syncMsg.getAvatarBase64(), post.getId(), likes, reposts);
                    }
                });
            }
        }
    }

    public void handleSocialEvent(Object event) {
        SwingUtilities.invokeLater(() -> {
            if (event instanceof network.isc.core.LikeEvent) {
                network.isc.core.LikeEvent like = (network.isc.core.LikeEvent) event;
                postService.addLike(like.getPostID(), like.getLiker());
                log.info("Received like for post {}", like.getPostID());

                Post p = postService.getPost(like.getPostID());
                if (p != null && p.getAuthor().equals(libp2pKey.publicKey().toString())) {
                    mainFrame.displayTrayNotification("New Like", "Someone liked your post.", TrayIcon.MessageType.INFO);
                }

                if (activeChannel != null) refreshChatDisplayOnly();
            } else if (event instanceof network.isc.core.RepostEvent) {
                network.isc.core.RepostEvent repost = (network.isc.core.RepostEvent) event;
                postService.addRepost(repost.getPostID(), repost.getReposter());
                log.info("Received repost for post {}", repost.getPostID());

                Post p = postService.getPost(repost.getPostID());
                if (p != null && p.getAuthor().equals(libp2pKey.publicKey().toString())) {
                    mainFrame.displayTrayNotification("New Repost", "Someone reposted your post.", TrayIcon.MessageType.INFO);
                }

                if (activeChannel != null) refreshChatDisplayOnly();
            } else if (event instanceof network.isc.core.FollowEvent) {
                network.isc.core.FollowEvent follow = (network.isc.core.FollowEvent) event;
                if (follow.getFollowee().equals(libp2pKey.publicKey().toString())) {
                    postService.addFollower(follow.getFollowee(), follow.getFollower());
                    mainFrame.displayTrayNotification("New Follower", "Someone started following you.", TrayIcon.MessageType.INFO);
                    log.info("Received follow event from {}", follow.getFollower());
                }
            }
        });
    }
}
