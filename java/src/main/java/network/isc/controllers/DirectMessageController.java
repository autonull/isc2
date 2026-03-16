package network.isc.controllers;

import network.isc.adapters.NetworkAdapter;
import network.isc.protocol.ChatMessage;
import network.isc.ui.DirectMessagePanel;
import network.isc.ui.MainFrame;

import javax.swing.*;
import java.awt.TrayIcon;
import java.nio.charset.StandardCharsets;
import io.libp2p.core.crypto.PrivKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DirectMessageController {
    private static final Logger log = LoggerFactory.getLogger(DirectMessageController.class);

    private final NetworkAdapter network;
    private final MainFrame mainFrame;
    private final DirectMessagePanel dmPanel;
    private final PrivKey libp2pKey;
    private final String getLocalAvatarBase64;

    public DirectMessageController(NetworkAdapter network, MainFrame mainFrame, PrivKey libp2pKey, String getLocalAvatarBase64) {
        this.network = network;
        this.mainFrame = mainFrame;
        this.dmPanel = mainFrame.getDmPanel();
        this.libp2pKey = libp2pKey;
        this.getLocalAvatarBase64 = getLocalAvatarBase64;

        initListeners();
    }

    private void initListeners() {
        dmPanel.addSendListener(e -> {
            String msg = dmPanel.getAndClearInput();
            String targetPeer = dmPanel.getActivePeer();

            if (!msg.isEmpty() && targetPeer != null) {
                try {
                    long ts = System.currentTimeMillis();
                    byte[] rawPayload = (targetPeer + msg + ts).getBytes(StandardCharsets.UTF_8);
                    byte[] sig = libp2pKey.sign(rawPayload);
                    byte[] pubKey = libp2pKey.publicKey().bytes();

                    ChatMessage chatMsg = new ChatMessage(targetPeer, msg, ts, sig, pubKey, getLocalAvatarBase64);
                    network.sendDirectMessage(targetPeer, chatMsg);

                    dmPanel.appendMessage("You", msg, ts, getLocalAvatarBase64);
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(mainFrame, "Failed to send DM: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                }
            }
        });
    }

    public void handleDirectMessage(ChatMessage chatMsg) {
        SwingUtilities.invokeLater(() -> {
            dmPanel.appendMessage("Peer", chatMsg.getMsg(), chatMsg.getTimestamp(), chatMsg.getAvatarBase64());
            mainFrame.displayTrayNotification("New Direct Message", "You received a new DM.", TrayIcon.MessageType.INFO);
        });
    }
}
