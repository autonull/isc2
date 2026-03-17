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
import io.libp2p.core.crypto.PubKey;
import io.libp2p.core.crypto.KeyKt;
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
            var msg = chatPanel.getAndClearInput();
            if (!msg.isEmpty() && activeChannel != null) {
                try {
                    var post = postService.createPost(msg, activeChannel.getId());
                    chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), getLocalAvatarBase64, post.getId(), 0, 0);

                    var pubKey = libp2pKey.publicKey().bytes();
                    var chatMsg = new ChatMessage(post.getChannelID(), post.getContent(), post.getTimestamp(), post.getSignature(), pubKey, getLocalAvatarBase64);

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
                var postId = action.substring("like://".length());
                var myId = java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes());

                if (!postService.hasLiked(postId, myId)) {
                    postService.addLike(postId, myId);
                    var ts = System.currentTimeMillis();
                    var payload = myId + postId + ts;
                    var sig = libp2pKey.sign(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));

                    var like = new network.isc.core.LikeEvent(myId, postId, ts, sig);
                    network.broadcastSocialEvent(like);
                    refreshChatDisplayOnly();
                }
            } else if (action.startsWith("repost://")) {
                var postId = action.substring("repost://".length());
                var myId = java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes());
                postService.addRepost(postId, myId);

                var ts = System.currentTimeMillis();
                var payload = myId + postId + ts;
                var sig = libp2pKey.sign(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8));

                var repost = new network.isc.core.RepostEvent(myId, postId, ts, sig);
                network.broadcastSocialEvent(repost);
                refreshChatDisplayOnly();
            } else if (action.startsWith("file://")) {
                var fileHash = action.substring("file://".length());
                var fileChooser = new JFileChooser();
                fileChooser.setDialogTitle("Save Downloaded File");
                var userSelection = fileChooser.showSaveDialog(mainFrame);

                if (userSelection == JFileChooser.APPROVE_OPTION) {
                    var dest = fileChooser.getSelectedFile();
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
            var fileChooser = new JFileChooser();
            var option = fileChooser.showOpenDialog(mainFrame);
            if (option == JFileChooser.APPROVE_OPTION) {
                var file = fileChooser.getSelectedFile();
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
        var pastPosts = postService.getAllPosts(activeChannel.getId());
        for (int i = pastPosts.size() - 1; i >= 0; i--) {
            var p = pastPosts.get(i);
            var likes = postService.getLikeCount(p.getId());
            var reposts = postService.getRepostCount(p.getId());
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
        var post = chatMsg.toPost("Peer");
        postService.storePost(post);
        SwingUtilities.invokeLater(() -> {
            if (activeChannel != null && chatMsg.getChannelID().equals(activeChannel.getId())) {
                var likes = postService.getLikeCount(post.getId());
                var reposts = postService.getRepostCount(post.getId());
                chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), chatMsg.getAvatarBase64(), post.getId(), likes, reposts);
            }

            var myPubKeyStr = java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes());
            if (chatMsg.getMsg().contains("@" + myPubKeyStr) || chatMsg.getMsg().contains("@Me")) {
                mainFrame.displayTrayNotification("New Mention", "You were mentioned in a channel.", TrayIcon.MessageType.INFO);
            }
        });
    }

    public void handleHistoricalPostSync(ChatMessage syncMsg) {
        if ("SYNC_REQUEST".equals(syncMsg.getMsg())) {
            var channelID = syncMsg.getChannelID();
            var historical = postService.getAllPosts(channelID);
            for (var p : historical) {
                var hm = new ChatMessage(p.getChannelID(), p.getContent(), p.getTimestamp(), p.getSignature(), new byte[0], "");
                network.sendHistoricalPost(hm);
            }
        } else {
            var post = syncMsg.toPost("Peer (History)");
            var isNew = postService.getPost(post.getId()) == null;
            if (isNew) {
                postService.storePost(post);
                SwingUtilities.invokeLater(() -> {
                    if (activeChannel != null && syncMsg.getChannelID().equals(activeChannel.getId())) {
                        var likes = postService.getLikeCount(post.getId());
                        var reposts = postService.getRepostCount(post.getId());
                        chatPanel.appendMessage(post.getAuthor(), post.getContent(), post.getTimestamp(), syncMsg.getAvatarBase64(), post.getId(), likes, reposts);
                    }
                });
            }
        }
    }

    public void handleSocialEvent(Object event) {
        SwingUtilities.invokeLater(() -> {
            if (event instanceof network.isc.core.LikeEvent) {
                var like = (network.isc.core.LikeEvent) event;
                if (!verifySocialSignature(like.getLiker(), like.getLiker() + like.getPostID() + like.getTimestamp(), like.getSignature())) {
                    log.warn("Invalid signature on LikeEvent for post {}", like.getPostID());
                    return;
                }
                postService.addLike(like.getPostID(), like.getLiker());
                log.info("Received like for post {}", like.getPostID());

                var p = postService.getPost(like.getPostID());
                if (p != null && p.getAuthor().equals(java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes()))) {
                    mainFrame.displayTrayNotification("New Like", "Someone liked your post.", TrayIcon.MessageType.INFO);
                }

                if (activeChannel != null) refreshChatDisplayOnly();
            } else if (event instanceof network.isc.core.RepostEvent) {
                var repost = (network.isc.core.RepostEvent) event;
                if (!verifySocialSignature(repost.getReposter(), repost.getReposter() + repost.getPostID() + repost.getTimestamp(), repost.getSignature())) {
                    log.warn("Invalid signature on RepostEvent for post {}", repost.getPostID());
                    return;
                }
                postService.addRepost(repost.getPostID(), repost.getReposter());
                log.info("Received repost for post {}", repost.getPostID());

                var p = postService.getPost(repost.getPostID());
                if (p != null && p.getAuthor().equals(java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes()))) {
                    mainFrame.displayTrayNotification("New Repost", "Someone reposted your post.", TrayIcon.MessageType.INFO);
                }

                if (activeChannel != null) refreshChatDisplayOnly();
            } else if (event instanceof network.isc.core.FollowEvent) {
                var follow = (network.isc.core.FollowEvent) event;
                if (!verifySocialSignature(follow.getFollower(), follow.getFollower() + follow.getFollowee() + follow.getTimestamp(), follow.getSignature())) {
                    log.warn("Invalid signature on FollowEvent for followee {}", follow.getFollowee());
                    return;
                }
                if (follow.getFollowee().equals(java.util.Base64.getEncoder().encodeToString(libp2pKey.publicKey().bytes()))) {
                    postService.addFollower(follow.getFollowee(), follow.getFollower());
                    mainFrame.displayTrayNotification("New Follower", "Someone started following you.", TrayIcon.MessageType.INFO);
                    log.info("Received follow event from {}", follow.getFollower());
                }
            } else {
                log.debug("Unhandled social event type");
            }
        });
    }

    private boolean verifySocialSignature(String pubKeyBase64, String payload, byte[] signature) {
        if (signature == null || signature.length == 0) return false;
        try {
            // We expect the pubKey string (the liker/reposter/follower ID) to be the Base64 representation of the public key bytes
            // This allows us to reconstruct the PubKey object and verify the signature.
            byte[] pkBytes = java.util.Base64.getDecoder().decode(pubKeyBase64);
            PubKey pubKey = io.libp2p.core.crypto.KeyKt.unmarshalPublicKey(pkBytes);
            return pubKey.verify(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8), signature);
        } catch (Exception e) {
            log.warn("Failed to decode public key or verify signature. The ID may be using a legacy string format.", e);
            // In a strict implementation, this would return false. For transitional compatibility with legacy toString(), we might return true
            // but log a warning. We'll return false here to enforce security correctly.
            return false;
        }
    }
}
