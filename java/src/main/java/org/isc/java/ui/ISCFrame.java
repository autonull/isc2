package org.isc.java.ui;

import org.isc.java.channels.Channel;
import org.isc.java.channels.ChannelManager;
import org.isc.java.posts.PostService;
import org.isc.java.types.Post;

import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.util.List;

/**
 * Main application window for ISC Java client
 * IRC-inspired layout with sidebar, feed, and compose panel
 */
public class ISCFrame extends JFrame {
    private final ChannelManager channelManager;
    private final PostService postService;
    
    private JTabbedPane tabbedPane;
    private JPanel nowPanel;
    private JPanel discoverPanel;
    private JPanel chatsPanel;
    private JPanel settingsPanel;
    private JPanel composePanel;
    
    private JList<Channel> channelList;
    private DefaultListModel<Channel> channelListModel;
    private JTextArea feedArea;
    private JTextArea composeArea;
    private JLabel connectionStatusLabel;
    
    private String activeChannelId = null;

    public ISCFrame() {
        this.channelManager = new ChannelManager();
        this.postService = new PostService();
        
        initializeUI();
        loadSampleData();
    }

    private void initializeUI() {
        setTitle("ISC - Interoperable Social Communication");
        setSize(1200, 800);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLocationRelativeTo(null);
        
        // Create main split pane
        JSplitPane mainSplitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        mainSplitPane.setDividerLocation(250);
        
        // Create sidebar
        JPanel sidebar = createSidebar();
        mainSplitPane.setLeftComponent(sidebar);
        
        // Create main content area
        tabbedPane = new JTabbedPane();
        mainSplitPane.setRightComponent(createMainContent());
        
        add(mainSplitPane, BorderLayout.CENTER);
        
        // Create status bar
        JPanel statusBar = createStatusBar();
        add(statusBar, BorderLayout.SOUTH);
        
        // Add menu bar
        setJMenuBar(createMenuBar());
    }

    private JPanel createSidebar() {
        JPanel sidebar = new JPanel(new BorderLayout());
        sidebar.setPreferredSize(new Dimension(250, 800));
        sidebar.setBackground(new Color(245, 245, 250));
        sidebar.setBorder(BorderFactory.createEmptySpacing(10, 10, 10, 10));
        
        // Brand/connection indicator
        JPanel brandPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        brandPanel.setBackground(new Color(245, 245, 250));
        
        JLabel brandLabel = new JLabel("ISC");
        brandLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        brandPanel.add(brandLabel);
        
        connectionStatusLabel = new JLabel("●");
        connectionStatusLabel.setForeground(Color.GREEN);
        connectionStatusLabel.setToolTipText("Connection: Online");
        brandPanel.add(connectionStatusLabel);
        
        sidebar.add(brandPanel, BorderLayout.NORTH);
        
        // Tabs
        JPanel tabsPanel = new JPanel();
        tabsPanel.setLayout(new BoxLayout(tabsPanel, BoxLayout.Y_AXIS));
        tabsPanel.setBackground(new Color(245, 245, 250));
        
        String[] tabNames = {"Now", "Discover", "Chats", "Settings"};
        String[] tabIcons = {"🏠", "📡", "💬", "⚙️"};
        
        for (int i = 0; i < tabNames.length; i++) {
            JPanel tabPanel = createTabPanel(tabNames[i], tabIcons[i]);
            tabsPanel.add(tabPanel);
        }
        
        sidebar.add(tabsPanel, BorderLayout.CENTER);
        
        // Compose button (special)
        JPanel composePanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        composePanel.setBackground(new Color(245, 245, 250));
        
        JButton composeButton = new JButton("➕ New Match");
        composeButton.setFont(new Font("SansSerif", Font.BOLD, 14));
        composeButton.setBackground(new Color(29, 161, 242));
        composeButton.setForeground(Color.WHITE);
        composeButton.setFocusPainted(false);
        composeButton.setBorderPainted(false);
        composeButton.addActionListener(e -> switchToTab("Compose"));
        composePanel.add(composeButton);
        
        sidebar.add(composePanel, BorderLayout.SOUTH);
        
        // Channels header and list
        JPanel channelsHeader = new JPanel(new FlowLayout(FlowLayout.LEFT));
        channelsHeader.setBackground(new Color(245, 245, 250));
        JLabel channelsLabel = new JLabel("Channels");
        channelsLabel.setFont(new Font("SansSerif", Font.BOLD, 14));
        channelsHeader.add(channelsLabel);
        sidebar.add(channelsHeader, BorderLayout.SOUTH);
        
        // Channel list
        channelListModel = new DefaultListModel<>();
        channelList = new JList<>(channelListModel);
        channelList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        channelList.setBackground(new Color(255, 255, 255));
        channelList.setBorder(BorderFactory.createLineBorder(new Color(230, 230, 235)));
        channelList.addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting()) {
                Channel selected = channelList.getSelectedValue();
                if (selected != null) {
                    activeChannelId = selected.getId();
                    loadChannelFeed(selected);
                }
            }
        });
        
        JScrollPane channelScrollPane = new JScrollPane(channelList);
        channelScrollPane.setPreferredSize(new Dimension(230, 200));
        sidebar.add(channelScrollPane, BorderLayout.SOUTH);
        
        return sidebar;
    }

    private JPanel createTabPanel(String name, String icon) {
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 5, 0));
        panel.setBackground(new Color(245, 245, 250));
        panel.setCursor(new Cursor(Cursor.HAND_CURSOR));
        panel.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        
        JLabel iconLabel = new JLabel(icon);
        iconLabel.setFont(new Font("SansSerif", Font.PLAIN, 16));
        panel.add(iconLabel);
        
        JLabel textLabel = new JLabel(name);
        textLabel.setFont(new Font("SansSerif", Font.PLAIN, 14));
        panel.add(textLabel);
        
        // Add click listener
        panel.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                switchToTab(name.toLowerCase());
            }
            
            @Override
            public void mouseEntered(MouseEvent e) {
                panel.setBackground(new Color(230, 230, 235));
            }
            
            @Override
            public void mouseExited(MouseEvent e) {
                panel.setBackground(new Color(245, 245, 250));
            }
        });
        
        return panel;
    }

    private JPanel createMainContent() {
        JPanel mainContent = new JPanel(new CardLayout());
        
        // Now tab
        nowPanel = createNowPanel();
        mainContent.add(nowPanel, "now");
        
        // Discover tab
        discoverPanel = createDiscoverPanel();
        mainContent.add(discoverPanel, "discover");
        
        // Chats tab
        chatsPanel = createChatsPanel();
        mainContent.add(chatsPanel, "chats");
        
        // Settings tab
        settingsPanel = createSettingsPanel();
        mainContent.add(settingsPanel, "settings");
        
        // Compose tab
        composePanel = createComposePanel();
        mainContent.add(composePanel, "compose");
        
        return mainContent;
    }

    private JPanel createNowPanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        JLabel titleLabel = new JLabel("Now Feed");
        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        panel.add(titleLabel, BorderLayout.NORTH);
        
        feedArea = new JTextArea();
        feedArea.setEditable(false);
        feedArea.setLineWrap(true);
        feedArea.setWrapStyleWord(true);
        feedArea.setFont(new Font("SansSerif", Font.PLAIN, 14));
        
        JScrollPane scrollPane = new JScrollPane(feedArea);
        panel.add(scrollPane, BorderLayout.CENTER);
        
        // Initial content
        feedArea.setText("Welcome to ISC! Select a channel from the sidebar to see posts here.\n\n" +
                         "Create channels and start posting to build your decentralized social network.");
        
        return panel;
    }

    private JPanel createDiscoverPanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        JLabel titleLabel = new JLabel("Discover");
        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        panel.add(titleLabel, BorderLayout.NORTH);
        
        JTextArea discoverArea = new JTextArea();
        discoverArea.setEditable(false);
        discoverArea.setText("Discover new channels and peers on the network.\n" +
                            "This feature will be implemented in a future version.");
        discoverArea.setFont(new Font("SansSerif", Font.PLAIN, 14));
        
        JScrollPane scrollPane = new JScrollPane(discoverArea);
        panel.add(scrollPane, BorderLayout.CENTER);
        
        return panel;
    }

    private JPanel createChatsPanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        JLabel titleLabel = new JLabel("Chats");
        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        panel.add(titleLabel, BorderLayout.NORTH);
        
        JTextArea chatsArea = new JTextArea();
        chatsArea.setEditable(false);
        chatsArea.setText("Direct messages and group chats will be implemented in a future version.");
        chatsArea.setFont(new Font("SansSerif", Font.PLAIN, 14));
        
        JScrollPane scrollPane = new JScrollPane(chatsArea);
        panel.add(scrollPane, BorderLayout.CENTER);
        
        return panel;
    }

    private JPanel createSettingsPanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        JLabel titleLabel = new JLabel("Settings");
        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        panel.add(titleLabel, BorderLayout.NORTH);
        
        JTextArea settingsArea = new JTextArea();
        settingsArea.setEditable(false);
        settingsArea.setText("Application settings and identity management will be implemented in a future version.");
        settingsArea.setFont(new Font("SansSerif", Font.PLAIN, 14));
        
        JScrollPane scrollPane = new JScrollPane(settingsArea);
        panel.add(scrollPane, BorderLayout.CENTER);
        
        return panel;
    }

    private JPanel createComposePanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        
        JPanel headerPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        headerPanel.setBorder(BorderFactory.createEmptyBorder(0, 0, 10, 0));
        
        JLabel titleLabel = new JLabel("Create Post");
        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        headerPanel.add(titleLabel);
        
        JLabel channelLabel = new JLabel("Channel: ");
        channelLabel.setFont(new Font("SansSerif", Font.PLAIN, 14));
        headerPanel.add(channelLabel);
        
        JLabel channelValueLabel = new JLabel("No channel selected");
        channelValueLabel.setFont(new Font("SansSerif", Font.PLAIN, 14));
        channelValueLabel.setForeground(new Color(100, 100, 100));
        headerPanel.add(channelValueLabel);
        
        panel.add(headerPanel, BorderLayout.NORTH);
        
        composeArea = new JTextArea();
        composeArea.setLineWrap(true);
        composeArea.setWrapStyleWord(true);
        composeArea.setFont(new Font("SansSerif", Font.PLAIN, 14));
        composeArea.setBorder(BorderFactory.createLineBorder(new Color(230, 230, 235)));
        
        JScrollPane composeScrollPane = new JScrollPane(composeArea);
        panel.add(composeScrollPane, BorderLayout.CENTER);
        
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        JButton postButton = new JButton("Post");
        postButton.setFont(new Font("SansSerif", Font.BOLD, 14));
        postButton.setBackground(new Color(29, 161, 242));
        postButton.setForeground(Color.WHITE);
        postButton.setFocusPainted(false);
        postButton.setBorderPainted(false);
        postButton.addActionListener(e -> handlePost());
        buttonPanel.add(postButton);
        
        JButton clearButton = new JButton("Clear");
        clearButton.setFont(new Font("SansSerif", Font.PLAIN, 14));
        clearButton.addActionListener(e -> composeArea.setText(""));
        buttonPanel.add(clearButton);
        
        panel.add(buttonPanel, BorderLayout.SOUTH);
        
        return panel;
    }

    private JPanel createStatusBar() {
        JPanel statusBar = new JPanel(new FlowLayout(FlowLayout.LEFT));
        statusBar.setBackground(new Color(240, 240, 245));
        statusBar.setPreferredSize(new Dimension(getWidth(), 25));
        
        JLabel statusLabel = new JLabel("Ready");
        statusLabel.setFont(new Font("SansSerif", Font.PLAIN, 12));
        statusBar.add(statusLabel);
        
        return statusBar;
    }

    private JMenuBar createMenuBar() {
        JMenuBar menuBar = new JMenuBar();
        
        JMenu fileMenu = new JMenu("File");
        JMenuItem exitItem = new JMenuItem("Exit");
        exitItem.addActionListener(e -> System.exit(0));
        fileMenu.add(exitItem);
        menuBar.add(fileMenu);
        
        JMenu channelMenu = new JMenu("Channel");
        JMenuItem createChannelItem = new JMenuItem("Create Channel");
        createChannelItem.addActionListener(e -> handleCreateChannel());
        channelMenu.add(createChannelItem);
        menuBar.add(channelMenu);
        
        return menuBar;
    }

    private void switchToTab(String tabName) {
        CardLayout cl = (CardLayout) ((JPanel) tabbedPane.getSelectedComponent()).getParent().getLayout();
        cl.show((JPanel) tabbedPane.getSelectedComponent(), tabName);
        
        // Update tab appearance (simplified)
        // In a full implementation, we would update the sidebar tab highlights
    }

    private void loadSampleData() {
        // Create some sample channels
        Channel general = channelManager.createChannel(
            "general", 
            "General discussion channel for all topics", 
            0.1, 
            List.of()
        );
        
        Channel tech = channelManager.createChannel(
            "technology", 
            "Discussion about technology, programming, and innovation", 
            0.2, 
            List.of(
                new Relation("tech", "", 1.0),
                new Relation("programming", "", 0.8)
            )
        );
        
        Channel social = channelManager.createChannel(
            "social", 
            "Social interactions and community building", 
            0.15, 
            List.of(
                new Relation("community", "", 1.0),
                new Relation("discussion", "", 0.9)
            )
        );
        
        // Add to channel list
        channelListModel.addElement(general);
        channelListModel.addElement(tech);
        channelListModel.addElement(social);
        
        // Select first channel by default
        channelList.setSelectedIndex(0);
        activeChannelId = general.getId();
        loadChannelFeed(general);
    }

    private void loadChannelFeed(Channel channel) {
        // Update compose panel channel label
        SwingUtilities.invokeLater(() -> {
            Component[] components = composePanel.getComponents();
            for (Component comp : components) {
                if (comp instanceof JPanel) {
                    JPanel panel = (JPanel) comp;
                    Component[] panelComps = panel.getComponents();
                    for (Component panelComp : panelComps) {
                        if (panelComp instanceof JLabel && 
                            ((JLabel) panelComp).getText().startsWith("Channel: ")) {
                            ((JLabel) panelComp).setText("Channel: #" + channel.getName());
                            break;
                        }
                    }
                }
            }
        });
        
        // Load posts for this channel
        List<Post> posts = postService.getAllPosts(channel.getId());
        StringBuilder feedText = new StringBuilder();
        feedText.append("Posts in #").append(channel.getName()).append(":\n\n");
        
        if (posts.isEmpty()) {
            feedText.append("No posts yet. Be the first to post!");
        } else {
            for (Post post : posts) {
                feedText.append("[").append(formatTime(post.getTimestamp())).append("] ")
                        .append(post.getAuthor().substring(0, Math.min(8, post.getAuthor().length())))
                        .append(": ").append(post.getContent()).append("\n\n");
            }
        }
        
        SwingUtilities.invokeLater(() -> feedArea.setText(feedText.toString()));
    }

    private String formatTime(long timestamp) {
        java.util.Date date = new java.util.Date(timestamp);
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("HH:mm");
        return sdf.format(date);
    }

    private void handleCreateChannel() {
        JTextField nameField = new JTextField(20);
        JTextField descField = new JTextField(20);
        
        JPanel panel = new JPanel(new GridLayout(2, 2));
        panel.add(new JLabel("Channel Name (3+ chars):"));
        panel.add(nameField);
        panel.add(new JLabel("Description (10+ chars):"));
        panel.add(descField);
        
        int result = JOptionPane.showConfirmDialog(this, panel, "Create Channel", 
                JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        
        if (result == JOptionPane.OK_OPTION) {
            String name = nameField.getText().trim();
            String description = descField.getText().trim();
            
            if (name.length() < 3) {
                JOptionPane.showMessageDialog(this, "Channel name must be at least 3 characters", 
                        "Error", JOptionPane.ERROR_MESSAGE);
                return;
            }
            
            if (description.length() < 10) {
                JOptionPane.showMessageDialog(this, "Channel description must be at least 10 characters", 
                        "Error", JOptionPane.ERROR_MESSAGE);
                return;
            }
            
            try {
                Channel newChannel = channelManager.createChannel(name, description, 0.1, List.of());
                channelListModel.addElement(newChannel);
                JOptionPane.showMessageDialog(this, "Channel created successfully!", 
                        "Success", JOptionPane.INFORMATION_MESSAGE);
            } catch (Exception e) {
                JOptionPane.showMessageDialog(this, "Error creating channel: " + e.getMessage(), 
                        "Error", JOptionPane.ERROR_MESSAGE);
            }
        }
    }

    private void handlePost() {
        String content = composeArea.getText().trim();
        if (content.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Post content cannot be empty", 
                    "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }
        
        if (activeChannelId == null) {
            JOptionPane.showMessageDialog(this, "Please select a channel first", 
                    "Error", JOptionPane.ERROR_MESSAGE);
            return;
        }
        
        try {
            Post post = postService.createPost(content, activeChannelId);
            composeArea.setText("");
            loadChannelFeed(channelManager.getChannel(activeChannelId));
            JOptionPane.showMessageDialog(this, "Posted successfully!", 
                    "Success", JOptionPane.INFORMATION_MESSAGE);
        } catch (Exception e) {
            JOptionPane.showMessageDialog(this, "Error posting: " + e.getMessage(), 
                    "Error", JOptionPane.ERROR_MESSAGE);
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            ISCFrame frame = new ISCFrame();
            frame.setVisible(true);
        });
    }
}