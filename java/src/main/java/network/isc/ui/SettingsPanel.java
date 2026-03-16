package network.isc.ui;

import javax.swing.*;
import java.awt.*;
import java.util.function.Consumer;

public class SettingsPanel extends JPanel {
    private final JLabel peerIdLabel;
    private final JCheckBox saveMessagesCheckbox;

    public SettingsPanel(Consumer<Boolean> onSaveMessagesToggled) {
        setLayout(new BorderLayout(10, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JLabel titleLabel = new JLabel("Settings & Identity");
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 18f));
        add(titleLabel, BorderLayout.NORTH);

        JPanel contentPanel = new JPanel();
        contentPanel.setLayout(new BoxLayout(contentPanel, BoxLayout.Y_AXIS));

        // Identity Section
        JPanel identityPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        identityPanel.setBorder(BorderFactory.createTitledBorder("My Identity"));
        peerIdLabel = new JLabel("Peer ID: Loading...");
        peerIdLabel.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 12));
        identityPanel.add(peerIdLabel);
        contentPanel.add(identityPanel);

        // Data Storage Section
        JPanel storagePanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        storagePanel.setBorder(BorderFactory.createTitledBorder("Data Storage"));
        saveMessagesCheckbox = new JCheckBox("Save Messages Locally (SQLite)", true);
        saveMessagesCheckbox.addActionListener(e -> onSaveMessagesToggled.accept(saveMessagesCheckbox.isSelected()));
        storagePanel.add(saveMessagesCheckbox);
        contentPanel.add(storagePanel);

        add(contentPanel, BorderLayout.CENTER);
    }

    public void setPeerId(String peerId) {
        SwingUtilities.invokeLater(() -> peerIdLabel.setText("Peer ID: " + peerId));
    }
}
