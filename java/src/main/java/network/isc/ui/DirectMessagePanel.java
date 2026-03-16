package network.isc.ui;

import javax.swing.*;
import javax.swing.text.DefaultCaret;
import java.awt.*;
import java.awt.event.ActionListener;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.function.Consumer;

public class DirectMessagePanel extends JPanel {
    private final DefaultListModel<String> peersListModel;
    private final JList<String> peersList;
    private final JEditorPane chatArea;
    private final StringBuilder chatHtml = new StringBuilder();
    private final JTextArea inputArea;
    private final JButton sendButton;
    private final JLabel headerLabel;

    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm");
    private String activePeer;

    public DirectMessagePanel(Consumer<String> onPeerSelected) {
        setLayout(new BorderLayout());

        // First instantiate variables to avoid compilation errors on lambda reference
        headerLabel = new JLabel(" Select a peer to start messaging", SwingConstants.CENTER);
        headerLabel.setFont(headerLabel.getFont().deriveFont(Font.BOLD, 16f));

        chatArea = new JEditorPane();
        chatArea.setContentType("text/html");
        chatArea.setEditable(false);
        chatArea.setMargin(new Insets(10, 10, 10, 10));

        chatHtml.append("<html><body style='font-family: sans-serif; font-size: 14pt; margin: 0; padding: 0;'>");
        chatArea.setText(chatHtml.toString() + "</body></html>");

        chatArea.addPropertyChangeListener("page", e -> {
            SwingUtilities.invokeLater(() -> {
                JScrollPane sp = (JScrollPane) chatArea.getParent().getParent();
                JScrollBar vertical = sp.getVerticalScrollBar();
                vertical.setValue(vertical.getMaximum());
            });
        });

        inputArea = new JTextArea(3, 20);
        inputArea.setLineWrap(true);
        inputArea.setEnabled(false);

        sendButton = new JButton("Send");
        sendButton.setEnabled(false);
        sendButton.setBackground(new Color(29, 161, 242));
        sendButton.setForeground(Color.WHITE);

        // Sidebar for Peers
        JPanel sidebar = new JPanel(new BorderLayout());
        sidebar.setPreferredSize(new Dimension(200, 0));
        sidebar.setBorder(BorderFactory.createMatteBorder(0, 0, 0, 1, Color.LIGHT_GRAY));

        JLabel peersHeader = new JLabel(" Direct Messages", SwingConstants.LEFT);
        peersHeader.setFont(peersHeader.getFont().deriveFont(Font.BOLD, 14f));
        peersHeader.setBorder(BorderFactory.createEmptyBorder(10, 5, 10, 5));
        sidebar.add(peersHeader, BorderLayout.NORTH);

        peersListModel = new DefaultListModel<>();
        peersList = new JList<>(peersListModel);
        peersList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        peersList.addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting() && peersList.getSelectedValue() != null) {
                activePeer = peersList.getSelectedValue();
                headerLabel.setText("DM with " + activePeer);
                inputArea.setEnabled(true);
                sendButton.setEnabled(true);

                chatHtml.setLength(0);
                chatHtml.append("<html><body style='font-family: sans-serif; font-size: 12pt; margin: 0; padding: 0;'>");
                chatHtml.append("<div style='color: gray; margin-bottom: 10px;'>Opened chat with ").append(activePeer).append("</div>");
                chatArea.setText(chatHtml.toString() + "</body></html>");

                onPeerSelected.accept(activePeer);
            }
        });
        sidebar.add(new JScrollPane(peersList), BorderLayout.CENTER);

        // Chat Workspace
        JPanel workspace = new JPanel(new BorderLayout(0, 10));
        workspace.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        workspace.add(headerLabel, BorderLayout.NORTH);
        workspace.add(new JScrollPane(chatArea), BorderLayout.CENTER);

        JPanel inputPanel = new JPanel(new BorderLayout(10, 10));
        inputPanel.add(new JScrollPane(inputArea), BorderLayout.CENTER);
        inputPanel.add(sendButton, BorderLayout.EAST);
        workspace.add(inputPanel, BorderLayout.SOUTH);

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, sidebar, workspace);
        splitPane.setDividerLocation(200);
        splitPane.setDividerSize(1);
        splitPane.setBorder(null);

        add(splitPane, BorderLayout.CENTER);
    }

    public void addPeer(String peerId) {
        SwingUtilities.invokeLater(() -> {
            if (!peersListModel.contains(peerId)) {
                peersListModel.addElement(peerId);
            }
        });
    }

    public void appendMessage(String sender, String message, long timestamp, String avatarBase64) {
        String time = timeFormat.format(new Date(timestamp));

        // Basic Markdown replacement
        String formattedMsg = message
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replaceAll("\\*\\*(.*?)\\*\\*", "<b>$1</b>")
            .replaceAll("\\*(.*?)\\*", "<i>$1</i>")
            .replaceAll("__(.*?)__", "<u>$1</u>")
            .replaceAll("`(.*?)`", "<code style='background-color: #f0f0f0; padding: 2px 4px; border-radius: 4px;'>$1</code>")
            .replaceAll("\\[FILE: (.*?)\\]", "<a href='$1' style='color: #1d9bf0; text-decoration: none;'>📎 Attachment: $1</a>")
            .replaceAll("\n", "<br>");

        String imgSrc = "";
        if (avatarBase64 != null && !avatarBase64.isEmpty()) {
            imgSrc = "<img src='data:image/png;base64," + avatarBase64 + "' width='32' height='32' style='vertical-align: middle; border-radius: 16px; margin-right: 8px;'/>";
        } else {
            imgSrc = "<span style='display:inline-block; width:32px; height:32px; background-color:#ccc; border-radius:16px; text-align:center; line-height:32px; margin-right:8px; vertical-align: middle;'>" + sender.substring(0, Math.min(1, sender.length())) + "</span>";
        }

        chatHtml.append("<div style='margin-bottom: 15px; display: flex; align-items: flex-start;'>")
                .append(imgSrc)
                .append("<div>")
                .append("<span style='color: gray; font-size: 10pt;'>[").append(time).append("] </span>")
                .append("<b>").append(sender).append(":</b> <br>")
                .append(formattedMsg)
                .append("</div></div>");

        chatArea.setText(chatHtml.toString() + "</body></html>");
    }

    public String getActivePeer() {
        return activePeer;
    }

    public void addSendListener(ActionListener listener) {
        sendButton.addActionListener(listener);
    }

    public String getAndClearInput() {
        String text = inputArea.getText().trim();
        inputArea.setText("");
        return text;
    }
}
