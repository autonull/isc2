package network.isc.ui;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionListener;
import java.text.SimpleDateFormat;
import java.util.Date;

public class ChatPanel extends JPanel {
    private final JTextArea chatArea;
    private final JTextField inputField;
    private final JLabel headerLabel;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss");

    public ChatPanel() {
        setLayout(new BorderLayout());

        headerLabel = new JLabel(" Select a channel to start chatting.", SwingConstants.CENTER);
        headerLabel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        headerLabel.setFont(headerLabel.getFont().deriveFont(Font.BOLD, 14f));
        add(headerLabel, BorderLayout.NORTH);

        chatArea = new JTextArea();
        chatArea.setEditable(false);
        chatArea.setLineWrap(true);
        chatArea.setWrapStyleWord(true);

        JScrollPane scrollPane = new JScrollPane(chatArea);
        add(scrollPane, BorderLayout.CENTER);

        JPanel inputPanel = new JPanel(new BorderLayout());
        inputField = new JTextField();
        inputPanel.add(inputField, BorderLayout.CENTER);

        JButton sendButton = new JButton("Send");
        inputPanel.add(sendButton, BorderLayout.EAST);

        add(inputPanel, BorderLayout.SOUTH);

        inputField.setEnabled(false);
        sendButton.setEnabled(false);
    }

    public void setChannelName(String name) {
        headerLabel.setText(" # " + name);
        inputField.setEnabled(true);
        inputField.requestFocusInWindow();
        Component[] components = ((JPanel)getComponent(2)).getComponents();
        for (Component c : components) {
            c.setEnabled(true);
        }
    }

    public void disableInput() {
        inputField.setEnabled(false);
        Component[] components = ((JPanel)getComponent(2)).getComponents();
        for (Component c : components) {
            c.setEnabled(false);
        }
    }

    public void appendMessage(String sender, String message, long timestamp) {
        String time = timeFormat.format(new Date(timestamp));
        chatArea.append(String.format("[%s] <%s> %s\n", time, sender, message));
        chatArea.setCaretPosition(chatArea.getDocument().getLength());
    }

    public void addSendListener(ActionListener listener) {
        inputField.addActionListener(listener);
        Component[] components = ((JPanel)getComponent(2)).getComponents();
        for (Component c : components) {
            if (c instanceof JButton) {
                ((JButton)c).addActionListener(listener);
            }
        }
    }

    public String getAndClearInput() {
        String text = inputField.getText().trim();
        inputField.setText("");
        return text;
    }
}
