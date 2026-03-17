package network.isc.ui;

import network.isc.core.SignedAnnouncement;

import javax.swing.*;
import java.awt.*;
import java.util.function.Consumer;

public class DiscoverPanel extends JPanel {
    private final DefaultListModel<String> discoveriesModel;
    private final JList<String> discoveriesList;
    private final java.util.Map<String, SignedAnnouncement> announcementMap = new java.util.HashMap<>();
    private float[] currentSearchVector = null; // Store query vector for similarity scoring
    private final JButton joinButton;
    private final JTextField searchField;
    private final JButton searchButton;

    public DiscoverPanel(Consumer<SignedAnnouncement> onJoinRequested, Consumer<String> onSearchRequested) {
        setLayout(new BorderLayout(10, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        discoveriesModel = new DefaultListModel<>();

        JPanel topPanel = new JPanel(new BorderLayout(10, 10));
        JLabel titleLabel = new JLabel("Discovered Channels (DHT)");
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 18f));
        topPanel.add(titleLabel, BorderLayout.NORTH);

        JPanel searchPanel = new JPanel(new BorderLayout(5, 0));
        searchField = new JTextField();
        searchField.setToolTipText("Search for semantic topics...");
        searchButton = new JButton("Search DHT");
        searchButton.addActionListener(e -> {
            String query = searchField.getText().trim();
            if (!query.isEmpty() && onSearchRequested != null) {
                discoveriesModel.clear();
                announcementMap.clear();
                onSearchRequested.accept(query);
            }
        });
        searchPanel.add(searchField, BorderLayout.CENTER);
        searchPanel.add(searchButton, BorderLayout.EAST);
        topPanel.add(searchPanel, BorderLayout.SOUTH);

        add(topPanel, BorderLayout.NORTH);
        discoveriesList = new JList<>(discoveriesModel);
        discoveriesList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        add(new JScrollPane(discoveriesList), BorderLayout.CENTER);

        JPanel bottomPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));

        JButton followButton = new JButton("Follow Peer");
        followButton.setEnabled(false);
        followButton.addActionListener(e -> {
            String selected = discoveriesList.getSelectedValue();
            if (selected != null && announcementMap.containsKey(selected)) {
                if (onFollowRequested != null) {
                    onFollowRequested.accept(announcementMap.get(selected).getPeerID());
                }
            }
        });

        joinButton = new JButton("Join / Add Channel");
        joinButton.setEnabled(false);
        joinButton.addActionListener(e -> {
            String selected = discoveriesList.getSelectedValue();
            if (selected != null && announcementMap.containsKey(selected)) {
                onJoinRequested.accept(announcementMap.get(selected));
            }
        });
        bottomPanel.add(followButton);
        bottomPanel.add(joinButton);
        add(bottomPanel, BorderLayout.SOUTH);

        discoveriesList.addListSelectionListener(e -> {
            boolean hasSelection = !discoveriesList.isSelectionEmpty();
            joinButton.setEnabled(hasSelection);
            followButton.setEnabled(hasSelection);
        });
    }

    private Consumer<String> onFollowRequested;

    public void setOnFollowRequested(Consumer<String> onFollowRequested) {
        this.onFollowRequested = onFollowRequested;
    }

    public void setCurrentSearchVector(float[] vector) {
        this.currentSearchVector = vector;
    }

    public void addDiscovery(SignedAnnouncement ann) {
        SwingUtilities.invokeLater(() -> {
            // Calculate similarity if we have an active search vector
            String matchScore = "";
            if (currentSearchVector != null && ann.getVec() != null) {
                double sim = network.isc.core.SemanticMath.cosineSimilarity(currentSearchVector, ann.getVec());
                int percentage = (int) Math.round(Math.max(0, sim) * 100);
                matchScore = " [" + percentage + "% match] ";
            }

            String displayText = "Channel ID: " + ann.getChannelID() + matchScore + " (Peer: " + ann.getPeerID() + ")";

            // To prevent duplicates but allow updates with score, remove old entry if it exists without score
            String baseKey = "Channel ID: " + ann.getChannelID();

            for (int i = 0; i < discoveriesModel.getSize(); i++) {
                String existing = discoveriesModel.getElementAt(i);
                if (existing.startsWith(baseKey)) {
                    // Update existing
                    if (!existing.equals(displayText)) {
                        announcementMap.remove(existing);
                        discoveriesModel.setElementAt(displayText, i);
                        announcementMap.put(displayText, ann);
                    }
                    return;
                }
            }

            announcementMap.put(displayText, ann);
            discoveriesModel.addElement(displayText);
        });
    }
}
