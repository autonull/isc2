package network.isc.controllers;

import network.isc.adapters.NetworkAdapter;
import network.isc.adapters.MapDBStorageAdapter;
import network.isc.adapters.FileTransferManager;
import network.isc.protocol.ChatMessage;
import network.isc.ui.DirectMessagePanel;
import network.isc.ui.MainFrame;

import java.util.List;
import java.util.ArrayList;

import javax.swing.*;
import java.awt.TrayIcon;
import java.nio.charset.StandardCharsets;
import io.libp2p.core.crypto.PrivKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DirectMessageController {
    private static final Logger log = LoggerFactory.getLogger(DirectMessageController.class);

    private final NetworkAdapter network;
    private final MapDBStorageAdapter storage;
    private final FileTransferManager fileTransfer;
    private final MainFrame mainFrame;
    private final DirectMessagePanel dmPanel;
    private final PrivKey libp2pKey;
    private final String getLocalAvatarBase64;

    public DirectMessageController(NetworkAdapter network, MapDBStorageAdapter storage, FileTransferManager fileTransfer, MainFrame mainFrame, PrivKey libp2pKey, String getLocalAvatarBase64) {
        this.network = network;
        this.storage = storage;
        this.fileTransfer = fileTransfer;
        this.mainFrame = mainFrame;
        this.dmPanel = mainFrame.getDmPanel();
        this.libp2pKey = libp2pKey;
        this.getLocalAvatarBase64 = getLocalAvatarBase64;

        initListeners();
    }

    private void initListeners() {
        dmPanel.setOnPeerSelectedListener(peerId -> {
            var history = storage.loadDirectMessages(peerId);
            for (var msg : history) {
                // If the channel ID is "Me" or our own public key, it was sent by us.
                // In DMs, channelId is often overloaded as the recipient.
                // To keep it simple, we check if the signature/pubKey matches ours.
                var sender = "Peer";
                if (msg.getPublicKey() != null && java.util.Arrays.equals(msg.getPublicKey(), libp2pKey.publicKey().bytes())) {
                    sender = "You";
                }
                dmPanel.appendMessage(sender, msg.getMsg(), msg.getTimestamp(), msg.getAvatarBase64());
            }
        });

        dmPanel.addSendListener(e -> {
            var msg = dmPanel.getAndClearInput();
            var targetPeer = dmPanel.getActivePeer();

            if (!msg.isEmpty() && targetPeer != null) {
                try {
                    var ts = System.currentTimeMillis();
                    var rawPayload = (targetPeer + msg + ts).getBytes(StandardCharsets.UTF_8);
                    var sig = libp2pKey.sign(rawPayload);
                    var pubKey = libp2pKey.publicKey().bytes();

                    var chatMsg = new ChatMessage(targetPeer, msg, ts, sig, pubKey, getLocalAvatarBase64);
                    network.sendDirectMessage(targetPeer, chatMsg);

                    dmPanel.appendMessage("You", msg, ts, getLocalAvatarBase64);

                    // Save to storage
                    var history = storage.loadDirectMessages(targetPeer);
                    history.add(chatMsg);
                    storage.saveDirectMessages(targetPeer, history);

                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(mainFrame, "Failed to send DM: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        });

        dmPanel.addAttachListener(e -> {
            var fileChooser = new JFileChooser();
            var option = fileChooser.showOpenDialog(mainFrame);
            if (option == JFileChooser.APPROVE_OPTION) {
                var file = fileChooser.getSelectedFile();
                if (file != null && file.exists()) {
                    fileTransfer.stageFile(file).thenAccept(hash -> {
                        SwingUtilities.invokeLater(() -> {
                            dmPanel.appendToInput("[FILE: " + hash + "]");
                        });
                    }).exceptionally(ex -> {
                        SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
                            mainFrame,
                            "Failed to attach file: " + ex.getMessage(),
                            "Error",
                            JOptionPane.ERROR_MESSAGE
                        ));
                        return null;
                    });
                }
            }
        });

        dmPanel.setSocialActionHandler(action -> {
            if (action.startsWith("file://")) {
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
    }

    public void handleDirectMessage(ChatMessage chatMsg) {
        // Find out who sent it. In the libp2p DM protocol context, the message comes from a peer.
        // The sender's ID isn't directly inside the simple ChatMessage unless we decode the pubKey.
        var senderPeerId = "Peer";
        try {
            if (chatMsg.getPublicKey() != null) {
                var pubKey = io.libp2p.core.crypto.KeyKt.unmarshalPublicKey(chatMsg.getPublicKey());
                senderPeerId = io.libp2p.core.PeerId.fromPubKey(pubKey).toBase58();
            }
        } catch (Exception e) {
            log.warn("Could not extract peerId from DM", e);
        }

        final var finalSender = senderPeerId;

        // Save to storage
        var history = storage.loadDirectMessages(finalSender);
        history.add(chatMsg);
        storage.saveDirectMessages(finalSender, history);

        SwingUtilities.invokeLater(() -> {
            dmPanel.addPeer(finalSender);
            if (finalSender.equals(dmPanel.getActivePeer())) {
                dmPanel.appendMessage("Peer", chatMsg.getMsg(), chatMsg.getTimestamp(), chatMsg.getAvatarBase64());
            }
            mainFrame.displayTrayNotification("New Direct Message", "You received a new DM.", TrayIcon.MessageType.INFO);
        });
    }
}
