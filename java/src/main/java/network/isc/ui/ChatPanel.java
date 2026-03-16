package network.isc.ui;

import javax.swing.*;
import javax.swing.text.DefaultCaret;
import java.awt.*;
import java.awt.event.ActionListener;
import java.text.SimpleDateFormat;
import java.util.Date;

public class ChatPanel extends JPanel {
    private final JTextArea chatArea;
    private final JTextField inputField;
    private final JLabel headerLabel;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss");
    private final JButton sendButton;

    public ChatPanel() {
        setLayout(new BorderLayout(0, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        // Header
        JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(new Color(245, 245, 245));
        headerPanel.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, Color.LIGHT_GRAY));

        headerLabel = new JLabel(" Select a channel to start chatting.", SwingConstants.CENTER);
        headerLabel.setBorder(BorderFactory.createEmptyBorder(15, 10, 15, 10));
        headerLabel.setFont(headerLabel.getFont().deriveFont(Font.BOLD, 16f));
        headerPanel.add(headerLabel, BorderLayout.CENTER);
        add(headerPanel, BorderLayout.NORTH);

        // Chat Area
        chatArea = new JTextArea();
        chatArea.setEditable(false);
        chatArea.setLineWrap(true);
        chatArea.setWrapStyleWord(true);
        chatArea.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 14));
        chatArea.setMargin(new Insets(10, 10, 10, 10));

        // Auto-scroll
        DefaultCaret caret = (DefaultCaret) chatArea.getCaret();
        caret.setUpdatePolicy(DefaultCaret.ALWAYS_UPDATE);

        JScrollPane scrollPane = new JScrollPane(chatArea);
        scrollPane.setBorder(BorderFactory.createLineBorder(Color.LIGHT_GRAY));
        add(scrollPane, BorderLayout.CENTER);

        // Input Area
        JPanel inputPanel = new JPanel(new BorderLayout(10, 0));

        inputField = new JTextField();
        inputField.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
        inputField.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(Color.LIGHT_GRAY),
            BorderFactory.createEmptyBorder(8, 8, 8, 8)
        ));
        inputPanel.add(inputField, BorderLayout.CENTER);

        sendButton = new JButton("Send");
        sendButton.setFont(sendButton.getFont().deriveFont(Font.BOLD));
        sendButton.setBackground(new Color(66, 133, 244));
        sendButton.setForeground(Color.WHITE);
        sendButton.setFocusPainted(false);
        sendButton.setBorder(BorderFactory.createEmptyBorder(8, 16, 8, 16));
        inputPanel.add(sendButton, BorderLayout.EAST);

        add(inputPanel, BorderLayout.SOUTH);

        inputField.setEnabled(false);
        sendButton.setEnabled(false);
    }

    public void setChannelName(String name, String description) {
        headerLabel.setText(String.format("<html><div style='text-align: center;'><b># %s</b><br><span style='font-size: 10px; font-weight: normal; color: #666;'>%s</span></div></html>", name, description));
        inputField.setEnabled(true);
        sendButton.setEnabled(true);
        inputField.requestFocusInWindow();
    }

    public void disableInput() {
        inputField.setEnabled(false);
        sendButton.setEnabled(false);
    }

    public void appendMessage(String sender, String message, long timestamp) {
        String time = timeFormat.format(new Date(timestamp));
        chatArea.append(String.format("[%s] <%s> %s\n", time, sender, message));
    }

    public void addSendListener(ActionListener listener) {
        inputField.addActionListener(listener);
        sendButton.addActionListener(listener);
    }

    public String getAndClearInput() {
        String text = inputField.getText().trim();
        inputField.setText("");
        return text;
    }
}
