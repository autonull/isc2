package network.isc.ui;

import javax.swing.*;
import java.awt.*;

public class DownloadDialog extends JDialog {
    private final JProgressBar progressBar;
    private final JLabel statusLabel;

    public DownloadDialog(JFrame parent) {
        super(parent, "Downloading Models...", true);
        setSize(400, 150);
        setLocationRelativeTo(parent);
        setDefaultCloseOperation(JDialog.DO_NOTHING_ON_CLOSE);
        setLayout(new BorderLayout(10, 10));

        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));

        statusLabel = new JLabel("Fetching semantic models (approx 22MB)...", SwingConstants.CENTER);
        panel.add(statusLabel, BorderLayout.NORTH);

        progressBar = new JProgressBar(0, 100);
        progressBar.setStringPainted(true);
        panel.add(progressBar, BorderLayout.CENTER);

        add(panel, BorderLayout.CENTER);
    }

    public void setProgress(int percent) {
        SwingUtilities.invokeLater(() -> {
            progressBar.setValue(percent);
            if (percent >= 100) {
                statusLabel.setText("Download complete! Initializing...");
            }
        });
    }

    public void setStatus(String status) {
        SwingUtilities.invokeLater(() -> statusLabel.setText(status));
    }
}
