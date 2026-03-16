package network.isc.ui;

import network.isc.core.SignedAnnouncement;

import javax.swing.*;
import java.awt.*;
import java.util.function.Consumer;

public class DiscoverPanel extends JPanel {
    private final DefaultListModel<String> discoveriesModel;
    private final JList<String> discoveriesList;
    private final java.util.Map<String, SignedAnnouncement> announcementMap = new java.util.HashMap<>();
    private final JButton joinButton;

    public DiscoverPanel(Consumer<SignedAnnouncement> onJoinRequested) {
        setLayout(new BorderLayout(10, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JLabel titleLabel = new JLabel("Discovered Channels (DHT)");
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 18f));
        add(titleLabel, BorderLayout.NORTH);

        discoveriesModel = new DefaultListModel<>();
        discoveriesList = new JList<>(discoveriesModel);
        discoveriesList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        add(new JScrollPane(discoveriesList), BorderLayout.CENTER);

        JPanel bottomPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        joinButton = new JButton("Join / Add Channel");
        joinButton.setEnabled(false);
        joinButton.addActionListener(e -> {
            String selected = discoveriesList.getSelectedValue();
            if (selected != null && announcementMap.containsKey(selected)) {
                onJoinRequested.accept(announcementMap.get(selected));
            }
        });
        bottomPanel.add(joinButton);
        add(bottomPanel, BorderLayout.SOUTH);

        discoveriesList.addListSelectionListener(e -> {
            joinButton.setEnabled(!discoveriesList.isSelectionEmpty());
        });
    }

    public void addDiscovery(SignedAnnouncement ann) {
        SwingUtilities.invokeLater(() -> {
            String displayText = "Channel ID: " + ann.getChannelID() + " (Peer: " + ann.getPeerID() + ")";
            if (!announcementMap.containsKey(displayText)) {
                announcementMap.put(displayText, ann);
                discoveriesModel.addElement(displayText);
            }
        });
    }
}
