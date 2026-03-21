package network.isc.ui;

import javax.swing.*;
import java.awt.*;

/**
 * First-time user onboarding dialog
 *
 * @see network.isc.ISCApplication#initialize()
 */
public class OnboardingDialog extends JDialog {
    private final JTextField nameField;
    private final JTextArea bioArea;
    private boolean completed = false;

    public OnboardingDialog(Frame parent) {
        super(parent, "Welcome to ISC", true); // Modal
        setSize(500, 400);
        setLocationRelativeTo(parent);
        setLayout(new BorderLayout(10, 10));
        setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);

        addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosing(java.awt.event.WindowEvent e) {
                if (!completed) {
                    System.exit(0);
                }
            }
        });

        // Welcome panel
        JPanel welcomePanel = new JPanel();
        welcomePanel.setLayout(new BoxLayout(welcomePanel, BoxLayout.Y_AXIS));
        welcomePanel.add(Box.createVerticalStrut(20));

        JLabel welcomeLabel = new JLabel("👋 Welcome to ISC - Internet Semantic Connect");
        welcomeLabel.setFont(new Font("SansSerif", Font.BOLD, 16));
        welcomePanel.add(welcomeLabel);

        JLabel infoLabel = new JLabel("<html><center>Create your identity and first channel to get started.</center></html>");
        infoLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        welcomePanel.add(infoLabel);
        welcomePanel.add(Box.createVerticalStrut(20));

        add(welcomePanel, BorderLayout.NORTH);

        // Form panel
        JPanel formPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(5, 5, 5, 5);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;

        gbc.gridx = 0; gbc.gridy = 0;
        formPanel.add(new JLabel("Display Name:"), gbc);
        gbc.gridx = 1;
        nameField = new JTextField(20);
        formPanel.add(nameField, gbc);

        gbc.gridx = 0; gbc.gridy = 1;
        formPanel.add(new JLabel("Bio:"), gbc);
        gbc.gridx = 1;
        bioArea = new JTextArea(3, 20);
        bioArea.setLineWrap(true);
        formPanel.add(new JScrollPane(bioArea), gbc);

        add(formPanel, BorderLayout.CENTER);

        // Button panel
        JPanel buttonPanel = new JPanel();
        JButton completeButton = new JButton("Complete Setup");
        completeButton.addActionListener(e -> {
            if (nameField.getText().trim().isEmpty()) {
                JOptionPane.showMessageDialog(this, "Please enter a name", "Validation Error", JOptionPane.ERROR_MESSAGE);
                return;
            }
            completed = true;
            dispose();
        });
        buttonPanel.add(completeButton);
        add(buttonPanel, BorderLayout.SOUTH);
    }

    public String getName() { return nameField.getText().trim(); }
    public String getBio() { return bioArea.getText().trim(); }
    public boolean isCompleted() { return completed; }
}
