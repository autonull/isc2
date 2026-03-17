package network.isc.ui;

import javax.swing.*;
import java.awt.*;

public class NetworkPanel extends JPanel {
    private final DefaultListModel<String> peersModel;
    private final JList<String> peersList;
    private final JButton dialButton;
    private final JTextArea multiaddrsArea;

    public NetworkPanel(Runnable onDialRequested) {
        setLayout(new BorderLayout(10, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        // Listen Addresses section
        JPanel listenPanel = new JPanel(new BorderLayout(5, 5));
        JLabel listenLabel = new JLabel("My Listen Addresses:");
        listenLabel.setFont(listenLabel.getFont().deriveFont(Font.BOLD));
        listenPanel.add(listenLabel, BorderLayout.NORTH);

        multiaddrsArea = new JTextArea(3, 20);
        multiaddrsArea.setEditable(false);
        multiaddrsArea.setLineWrap(true);
        multiaddrsArea.setWrapStyleWord(true);
        multiaddrsArea.setBackground(new Color(245, 245, 245));
        listenPanel.add(new JScrollPane(multiaddrsArea), BorderLayout.CENTER);

        add(listenPanel, BorderLayout.NORTH);

        // Connected Peers section
        JPanel peersPanel = new JPanel(new BorderLayout(5, 5));
        JLabel peersLabel = new JLabel("Connected Peers:");
        peersLabel.setFont(peersLabel.getFont().deriveFont(Font.BOLD));
        peersPanel.add(peersLabel, BorderLayout.NORTH);

        peersModel = new DefaultListModel<>();
        peersList = new JList<>(peersModel);
        peersList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        peersPanel.add(new JScrollPane(peersList), BorderLayout.CENTER);

        // Bottom actions
        JPanel actionsPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        dialButton = new JButton("Dial Peer...");
        dialButton.addActionListener(e -> onDialRequested.run());
        actionsPanel.add(dialButton);
        peersPanel.add(actionsPanel, BorderLayout.SOUTH);

        add(peersPanel, BorderLayout.CENTER);
    }

    public void setMyAddresses(java.util.List<String> addrs) {
        multiaddrsArea.setText(String.join("\n", addrs));
    }

    public void addPeer(String peerId) {
        SwingUtilities.invokeLater(() -> {
            if (!peersModel.contains(peerId)) {
                peersModel.addElement(peerId);
            }
        });
    }

    public void removePeer(String peerId) {
        SwingUtilities.invokeLater(() -> {
            peersModel.removeElement(peerId);
        });
    }
}
