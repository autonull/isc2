package network.isc.ui;

import javax.swing.*;
import javax.swing.text.DefaultCaret;
import java.awt.*;
import java.awt.event.ActionListener;
import java.text.SimpleDateFormat;
import java.util.Date;

public class ChatPanel extends JPanel {
    private final JEditorPane feedArea;
    private final StringBuilder feedHtml = new StringBuilder();
    private final JTextArea composeArea;
    private final JLabel headerLabel;
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm");
    private final JButton sendButton;
    private final JButton attachButton;

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
        feedArea = new JEditorPane();
        feedArea.setContentType("text/html");
        feedArea.setEditable(false);
        feedArea.setMargin(new Insets(10, 10, 10, 10));

        feedHtml.append("<html><body style='font-family: sans-serif; font-size: 14pt; margin: 0; padding: 0;'>");
        feedArea.setText(feedHtml.toString() + "</body></html>");

        // Try to auto-scroll when new HTML is appended
        feedArea.addPropertyChangeListener("page", e -> {
            SwingUtilities.invokeLater(() -> {
                JScrollPane sp = (JScrollPane) feedArea.getParent().getParent();
                JScrollBar vertical = sp.getVerticalScrollBar();
                vertical.setValue(vertical.getMaximum());
            });
        });

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

        attachButton = new JButton("📎 Attach");
        attachButton.setFocusPainted(false);
        buttonPanel.add(attachButton);

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
        attachButton.setEnabled(false);
    }

    public void setChannelName(String name, String description) {
        headerLabel.setText(String.format("<html><div style='text-align: center;'><b># %s</b><br><span style='font-size: 10px; font-weight: normal; color: #666;'>%s</span></div></html>", name, description));
        composeArea.setEnabled(true);
        sendButton.setEnabled(true);
        attachButton.setEnabled(true);
        composeArea.requestFocusInWindow();

        feedHtml.setLength(0); // Clear builder
        feedHtml.append("<html><body style='font-family: sans-serif; font-size: 12pt; margin: 0; padding: 0;'>");
        feedHtml.append("<div style='color: gray; margin-bottom: 10px;'>Joined #").append(name).append("</div>");
        feedArea.setText(feedHtml.toString() + "</body></html>");
    }

    public void disableInput() {
        composeArea.setEnabled(false);
        sendButton.setEnabled(false);
        attachButton.setEnabled(false);
    }

    public void appendMessage(String sender, String message, long timestamp, String avatarBase64) {
        appendMessage(sender, message, timestamp, avatarBase64, null, 0, 0);
    }

    public void appendMessage(String sender, String message, long timestamp, String avatarBase64, String postId, int likes, int reposts) {
        String time = timeFormat.format(new Date(timestamp));

        // HTML Escaping First
        String formattedMsg = message
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;");

        // Then Markdown replacement (matching the escaped strings if necessary, e.g., ^&gt; for blockquote)
        formattedMsg = formattedMsg
            .replaceAll("(?m)^&gt;\\s+(.*?)$", "<blockquote style='border-left: 3px solid #ccc; margin: 0; padding-left: 10px; color: #555;'>$1</blockquote>")
            .replaceAll("(?m)^-\\s+(.*?)$", "<ul><li style='margin-left: -20px;'>$1</li></ul>")
            .replaceAll("</ul>\n<ul>", "") // Merge adjacent lists
            .replaceAll("\\*\\*(.*?)\\*\\*", "<b>$1</b>")
            .replaceAll("\\*(.*?)\\*", "<i>$1</i>")
            .replaceAll("__(.*?)__", "<u>$1</u>")
            .replaceAll("`(.*?)`", "<code style='background-color: #f0f0f0; padding: 2px 4px; border-radius: 4px; font-family: monospace;'>$1</code>")
            .replaceAll("\\[FILE: (.*?)\\]", "<a href='file://$1' style='color: #1d9bf0; text-decoration: none;'>📎 Attachment: $1</a>")
            .replaceAll("\n", "<br>");

        String imgSrc = "";
        if (avatarBase64 != null && !avatarBase64.isEmpty()) {
            imgSrc = "<img src='data:image/png;base64," + avatarBase64 + "' width='32' height='32' style='vertical-align: middle; border-radius: 16px; margin-right: 8px;'/>";
        } else {
            // Identicon placeholder logic could go here, or just a default box
            imgSrc = "<span style='display:inline-block; width:32px; height:32px; background-color:#ccc; border-radius:16px; text-align:center; line-height:32px; margin-right:8px; vertical-align: middle;'>" + sender.substring(0, Math.min(1, sender.length())) + "</span>";
        }

        String socialHtml = "";
        if (postId != null) {
             socialHtml = String.format("<div style='font-size: 9pt; color: #888; margin-top: 4px;'>" +
                                        "<a href='like://%s' style='color: #e0245e; text-decoration: none;'>❤️ %d</a> &nbsp;&nbsp;" +
                                        "<a href='repost://%s' style='color: #17bf63; text-decoration: none;'>🔁 %d</a>" +
                                        "</div>", postId, likes, postId, reposts);
        }

        feedHtml.append("<div style='margin-bottom: 15px; display: flex; align-items: flex-start;'>")
                .append(imgSrc)
                .append("<div>")
                .append("<span style='color: gray; font-size: 10pt;'>[").append(time).append("] </span>")
                .append("<b>").append(sender).append(":</b> <br>")
                .append(formattedMsg)
                .append(socialHtml)
                .append("</div></div>");

        feedArea.setText(feedHtml.toString() + "</body></html>");
    }

    public void setSocialActionHandler(java.util.function.Consumer<String> actionHandler) {
        feedArea.addHyperlinkListener(e -> {
            if (e.getEventType() == javax.swing.event.HyperlinkEvent.EventType.ACTIVATED) {
                String desc = e.getDescription();
                if (desc.startsWith("like://") || desc.startsWith("repost://") || desc.startsWith("file://")) {
                    actionHandler.accept(desc);
                }
            }
        });
    }

    public void refreshChatDisplay() {
        // Required when social states update. This simple panel would ideally just re-render the whole list.
        // For now, this is a marker that a controller can call to re-render.
    }

    public void addSendListener(ActionListener listener) {
        // Since composeArea is a JTextArea, we'll only attach to the Send button.
        // Or we could attach a KeyListener for Enter without Shift.
        sendButton.addActionListener(listener);
    }

    public void addAttachListener(ActionListener listener) {
        attachButton.addActionListener(listener);
    }

    public void appendToInput(String text) {
        String current = composeArea.getText();
        if (!current.isEmpty() && !current.endsWith(" ")) {
            composeArea.append(" ");
        }
        composeArea.append(text);
    }

    public String getAndClearInput() {
        String text = composeArea.getText().trim();
        composeArea.setText("");
        return text;
    }
}
