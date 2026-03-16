package network.isc.ui;

import javax.swing.*;
import javax.swing.text.DefaultCaret;
import java.awt.*;
import java.awt.event.ActionListener;
import java.text.SimpleDateFormat;
import java.util.Date;

public class ChatPanel extends JPanel {
    private final JTextArea feedArea;
    private final JTextArea composeArea;
    private final JLabel headerLabel;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm");
    private final JButton sendButton;

    public ChatPanel() {
        setLayout(new BorderLayout(0, 10));
        setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        // Header
        JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(new Color(245, 245, 245));
        headerPanel.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, Color.LIGHT_GRAY));

        headerLabel = new JLabel(" Select a channel to view the feed.", SwingConstants.CENTER);
        headerLabel.setBorder(BorderFactory.createEmptyBorder(15, 10, 15, 10));
        headerLabel.setFont(headerLabel.getFont().deriveFont(Font.BOLD, 16f));
        headerPanel.add(headerLabel, BorderLayout.CENTER);
        add(headerPanel, BorderLayout.NORTH);

        // Feed Area (like "Now Feed")
        feedArea = new JTextArea();
        feedArea.setEditable(false);
        feedArea.setLineWrap(true);
        feedArea.setWrapStyleWord(true);
        feedArea.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
        feedArea.setMargin(new Insets(10, 10, 10, 10));

        DefaultCaret caret = (DefaultCaret) feedArea.getCaret();
        caret.setUpdatePolicy(DefaultCaret.ALWAYS_UPDATE);

        JScrollPane scrollPane = new JScrollPane(feedArea);
        scrollPane.setBorder(BorderFactory.createLineBorder(Color.LIGHT_GRAY));
        add(scrollPane, BorderLayout.CENTER);

        // Input Area (Compose Panel style)
        JPanel composePanel = new JPanel(new BorderLayout(10, 10));

        composeArea = new JTextArea(3, 20); // Multi-line input
        composeArea.setLineWrap(true);
        composeArea.setWrapStyleWord(true);
        composeArea.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));

        JScrollPane composeScroll = new JScrollPane(composeArea);
        composeScroll.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(Color.LIGHT_GRAY),
            BorderFactory.createEmptyBorder(5, 5, 5, 5)
        ));
        composePanel.add(composeScroll, BorderLayout.CENTER);

        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        sendButton = new JButton("Post");
        sendButton.setFont(sendButton.getFont().deriveFont(Font.BOLD));
        sendButton.setBackground(new Color(29, 161, 242)); // Brand blue
        sendButton.setForeground(Color.WHITE);
        sendButton.setFocusPainted(false);
        sendButton.setBorder(BorderFactory.createEmptyBorder(8, 20, 8, 20));
        buttonPanel.add(sendButton);

        composePanel.add(buttonPanel, BorderLayout.SOUTH);

        add(composePanel, BorderLayout.SOUTH);

        composeArea.setEnabled(false);
        sendButton.setEnabled(false);
    }

    public void setChannelName(String name, String description) {
        headerLabel.setText(String.format("<html><div style='text-align: center;'><b># %s</b><br><span style='font-size: 10px; font-weight: normal; color: #666;'>%s</span></div></html>", name, description));
        composeArea.setEnabled(true);
        sendButton.setEnabled(true);
        composeArea.requestFocusInWindow();
        feedArea.setText("Joined #" + name + "\n\n");
    }

    public void disableInput() {
        composeArea.setEnabled(false);
        sendButton.setEnabled(false);
    }

    public void appendMessage(String sender, String message, long timestamp) {
        String time = timeFormat.format(new Date(timestamp));
        feedArea.append(String.format("[%s] %s: %s\n\n", time, sender, message));
    }

    public void addSendListener(ActionListener listener) {
        // Since composeArea is a JTextArea, we'll only attach to the Send button.
        // Or we could attach a KeyListener for Enter without Shift.
        sendButton.addActionListener(listener);
    }

    public String getAndClearInput() {
        String text = composeArea.getText().trim();
        composeArea.setText("");
        return text;
    }
}
