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
    private final JTextArea chatArea;
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

        chatArea = new JTextArea();
        chatArea.setEditable(false);
        chatArea.setLineWrap(true);
        chatArea.setWrapStyleWord(true);
        chatArea.setMargin(new Insets(10, 10, 10, 10));
        DefaultCaret caret = (DefaultCaret) chatArea.getCaret();
        caret.setUpdatePolicy(DefaultCaret.ALWAYS_UPDATE);

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
                chatArea.setText("Opened chat with " + activePeer + "\n\n");
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

    public void appendMessage(String sender, String message, long timestamp) {
        String time = timeFormat.format(new Date(timestamp));
        chatArea.append(String.format("[%s] %s: %s\n\n", time, sender, message));
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
