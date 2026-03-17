package network.isc.ui;

import javax.swing.*;
import java.awt.*;
import java.util.function.Consumer;

public class SettingsPanel extends JPanel {
    private final JLabel peerIdLabel;
    private final JTextField displayNameField;
    private final JTextArea bioArea;
    private final JCheckBox saveMessagesCheckbox;
    private final JLabel avatarLabel;
    private String currentAvatarBase64 = "";

    public SettingsPanel(Consumer<Boolean> onSaveMessagesToggled, Consumer<String[]> onProfileUpdated) {
        setLayout(new BorderLayout(10, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JLabel titleLabel = new JLabel("Settings & Identity");
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 18f));
        add(titleLabel, BorderLayout.NORTH);

        JPanel contentPanel = new JPanel();
        contentPanel.setLayout(new BoxLayout(contentPanel, BoxLayout.Y_AXIS));

        // Identity Section
        JPanel identityPanel = new JPanel(new GridBagLayout());
        identityPanel.setBorder(BorderFactory.createTitledBorder("My Identity"));
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;

        gbc.gridx = 0; gbc.gridy = 0;
        identityPanel.add(new JLabel("Peer ID:"), gbc);
        gbc.gridx = 1;
        peerIdLabel = new JLabel("Loading...");
        peerIdLabel.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 12));
        identityPanel.add(peerIdLabel, gbc);

        gbc.gridx = 0; gbc.gridy = 1;
        identityPanel.add(new JLabel("Avatar:"), gbc);
        gbc.gridx = 1;
        JPanel avatarPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        avatarLabel = new JLabel("[No Avatar]");
        avatarLabel.setPreferredSize(new Dimension(64, 64));
        avatarLabel.setBorder(BorderFactory.createLineBorder(Color.GRAY));
        avatarLabel.setHorizontalAlignment(SwingConstants.CENTER);
        JButton loadAvatarBtn = new JButton("Load Image...");
        loadAvatarBtn.addActionListener(e -> {
            JFileChooser fileChooser = new JFileChooser();
            int res = fileChooser.showOpenDialog(this);
            if (res == JFileChooser.APPROVE_OPTION) {
                try {
                    java.io.File file = fileChooser.getSelectedFile();
                    java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(file);
                    if (img != null) {
                        Image scaled = img.getScaledInstance(64, 64, Image.SCALE_SMOOTH);
                        avatarLabel.setIcon(new ImageIcon(scaled));
                        avatarLabel.setText("");

                        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                        javax.imageio.ImageIO.write(img, "png", baos);
                        currentAvatarBase64 = java.util.Base64.getEncoder().encodeToString(baos.toByteArray());
                    }
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(this, "Error loading image: " + ex.getMessage());
                }
            }
        });
        avatarPanel.add(avatarLabel);
        avatarPanel.add(loadAvatarBtn);
        identityPanel.add(avatarPanel, gbc);

        gbc.gridx = 0; gbc.gridy = 2;
        identityPanel.add(new JLabel("Display Name:"), gbc);
        gbc.gridx = 1;
        displayNameField = new JTextField(15);
        identityPanel.add(displayNameField, gbc);

        gbc.gridx = 0; gbc.gridy = 3;
        identityPanel.add(new JLabel("Bio:"), gbc);
        gbc.gridx = 1;
        bioArea = new JTextArea(3, 20);
        bioArea.setLineWrap(true);
        bioArea.setBorder(BorderFactory.createLineBorder(Color.LIGHT_GRAY));
        identityPanel.add(new JScrollPane(bioArea), gbc);

        gbc.gridx = 1; gbc.gridy = 4;
        JButton saveProfileBtn = new JButton("Save Profile");
        saveProfileBtn.addActionListener(e -> {
            onProfileUpdated.accept(new String[]{displayNameField.getText(), bioArea.getText(), currentAvatarBase64});
            JOptionPane.showMessageDialog(this, "Profile Saved locally.", "Success", JOptionPane.INFORMATION_MESSAGE);
        });
        identityPanel.add(saveProfileBtn, gbc);

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

    public void setProfile(String name, String bio, String avatarBase64) {
        SwingUtilities.invokeLater(() -> {
            displayNameField.setText(name);
            bioArea.setText(bio);
            if (avatarBase64 != null && !avatarBase64.isEmpty()) {
                try {
                    byte[] bytes = java.util.Base64.getDecoder().decode(avatarBase64);
                    java.io.ByteArrayInputStream bais = new java.io.ByteArrayInputStream(bytes);
                    java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(bais);
                    if (img != null) {
                        Image scaled = img.getScaledInstance(64, 64, Image.SCALE_SMOOTH);
                        avatarLabel.setIcon(new ImageIcon(scaled));
                        avatarLabel.setText("");
                        currentAvatarBase64 = avatarBase64;
                    }
                } catch (Exception e) {
                    // Ignore, fallback to no avatar
                }
            }
        });
    }
}
