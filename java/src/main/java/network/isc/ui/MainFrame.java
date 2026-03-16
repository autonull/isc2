package network.isc.ui;

import network.isc.core.Channel;
import network.isc.core.Post;
import network.isc.core.PostService;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.List;
import java.util.function.Consumer;

public class MainFrame extends JFrame {
    private final DefaultListModel<String> channelListModel;
    private final JList<String> channelList;
    private final ChatPanel chatPanel;

    private JPanel nowPanel;
    private DiscoverPanel discoverPanel;
    private NetworkPanel networkPanel;
    private SettingsPanel settingsPanel;

    private List<Channel> activeChannels;
    private Consumer<Channel> onChannelSelected;
    private Runnable onCreateChannel;

    private Channel activeChannel;

    public MainFrame() {
        setTitle("ISC - Interoperable Social Communication");
        setSize(1200, 800);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLocationRelativeTo(null);

        // Sidebar
        channelListModel = new DefaultListModel<>();
        channelList = new JList<>(channelListModel);
        channelList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        channelList.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 14));
        channelList.setFixedCellHeight(30);
        channelList.setBorder(new EmptyBorder(5, 5, 5, 5));

        channelList.addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting() && channelList.getSelectedIndex() != -1 && activeChannels != null) {
                int index = channelList.getSelectedIndex();
                if (index < activeChannels.size()) {
                    activeChannel = activeChannels.get(index);
                    if (onChannelSelected != null) {
                        onChannelSelected.accept(activeChannel);
                    }
                    switchToTab("now");
                }
            }
        });

        JScrollPane sidebarScroll = new JScrollPane(channelList);
        sidebarScroll.setBorder(BorderFactory.createEmptyBorder());

        JPanel sidebarPanel = new JPanel(new BorderLayout());
        sidebarPanel.setBackground(Color.WHITE);
        sidebarPanel.setBorder(BorderFactory.createMatteBorder(0, 0, 0, 1, Color.LIGHT_GRAY));

        // Create sidebar tabs and compose button
        JPanel topSidebarPanel = new JPanel(new BorderLayout());
        topSidebarPanel.setBackground(Color.WHITE);

        // Brand/connection indicator
        JPanel brandPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        brandPanel.setBackground(Color.WHITE);

        JLabel brandLabel = new JLabel("ISC");
        brandLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        brandPanel.add(brandLabel);

        JLabel connectionStatusLabel = new JLabel("●");
        connectionStatusLabel.setForeground(Color.GREEN);
        connectionStatusLabel.setToolTipText("Connection: Online");
        brandPanel.add(connectionStatusLabel);

        topSidebarPanel.add(brandPanel, BorderLayout.NORTH);

        // Navigation Tabs
        JPanel tabsPanel = new JPanel();
        tabsPanel.setLayout(new BoxLayout(tabsPanel, BoxLayout.Y_AXIS));
        tabsPanel.setBackground(Color.WHITE);

        String[] tabNames = {"Now", "Discover", "Network", "Settings"};
        String[] tabIcons = {"🏠", "📡", "🌐", "⚙️"};

        for (int i = 0; i < tabNames.length; i++) {
            JPanel tabPanel = createTabPanel(tabNames[i], tabIcons[i]);
            tabsPanel.add(tabPanel);
        }

        topSidebarPanel.add(tabsPanel, BorderLayout.CENTER);

        sidebarPanel.add(topSidebarPanel, BorderLayout.NORTH);

        // Channels header and list
        JPanel channelsSection = new JPanel(new BorderLayout());
        channelsSection.setBackground(Color.WHITE);

        JLabel channelsLabel = new JLabel(" My Channels", SwingConstants.LEFT);
        channelsLabel.setFont(channelsLabel.getFont().deriveFont(Font.BOLD, 14f));
        channelsLabel.setBorder(BorderFactory.createEmptyBorder(15, 10, 5, 10));
        channelsSection.add(channelsLabel, BorderLayout.NORTH);
        channelsSection.add(sidebarScroll, BorderLayout.CENTER);

        sidebarPanel.add(channelsSection, BorderLayout.CENTER);

        // Bottom section with Create Channel button
        JPanel bottomSidebarPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        bottomSidebarPanel.setBackground(Color.WHITE);

        JButton createButton = new JButton("+ New Channel");
        createButton.setFont(createButton.getFont().deriveFont(Font.BOLD));
        createButton.setBackground(new Color(240, 240, 240));
        createButton.setFocusPainted(false);
        createButton.setBorder(BorderFactory.createEmptyBorder(10, 15, 10, 15));
        createButton.addActionListener(e -> {
            if (onCreateChannel != null) onCreateChannel.run();
        });
        bottomSidebarPanel.add(createButton);
        sidebarPanel.add(bottomSidebarPanel, BorderLayout.SOUTH);

        // Chat Workspace / Main Content
        chatPanel = new ChatPanel();

        JPanel mainContent = createMainContent();

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, sidebarPanel, mainContent);
        splitPane.setDividerLocation(250);
        splitPane.setDividerSize(1);
        splitPane.setBorder(null);

        add(splitPane);
        switchToTab("now");
    }

    private JPanel createTabPanel(String name, String icon) {
        JPanel panel = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 5));
        panel.setBackground(Color.WHITE);
        panel.setCursor(new Cursor(Cursor.HAND_CURSOR));
        panel.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        JLabel iconLabel = new JLabel(icon);
        iconLabel.setFont(new Font("SansSerif", Font.PLAIN, 16));
        panel.add(iconLabel);

        JLabel textLabel = new JLabel(name);
        textLabel.setFont(new Font("SansSerif", Font.PLAIN, 14));
        panel.add(textLabel);

        panel.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                switchToTab(name.toLowerCase());
            }
            @Override
            public void mouseEntered(MouseEvent e) {
                panel.setBackground(new Color(245, 245, 250));
            }
            @Override
            public void mouseExited(MouseEvent e) {
                panel.setBackground(Color.WHITE);
            }
        });

        return panel;
    }

    private JPanel createMainContent() {
        JPanel mainContent = new JPanel(new CardLayout());

        // Now tab uses the updated ChatPanel logic
        nowPanel = chatPanel;
        mainContent.add(nowPanel, "now");

        // Discover tab
        discoverPanel = new DiscoverPanel(ann -> {
            if (onJoinRequested != null) onJoinRequested.accept(ann);
        });
        mainContent.add(discoverPanel, "discover");

        // Network tab
        networkPanel = new NetworkPanel(() -> {
            if (onDialRequested != null) onDialRequested.run();
        });
        mainContent.add(networkPanel, "network");

        // Settings tab
        settingsPanel = new SettingsPanel(enabled -> {
            if (onSaveMessagesToggled != null) onSaveMessagesToggled.accept(enabled);
        });
        mainContent.add(settingsPanel, "settings");

        return mainContent;
    }

    private Consumer<network.isc.core.SignedAnnouncement> onJoinRequested;
    private Runnable onDialRequested;
    private Consumer<Boolean> onSaveMessagesToggled;

    public void setOnJoinRequested(Consumer<network.isc.core.SignedAnnouncement> onJoinRequested) {
        this.onJoinRequested = onJoinRequested;
    }

    public void setOnDialRequested(Runnable onDialRequested) {
        this.onDialRequested = onDialRequested;
    }

    public void setOnSaveMessagesToggled(Consumer<Boolean> onSaveMessagesToggled) {
        this.onSaveMessagesToggled = onSaveMessagesToggled;
    }

    public DiscoverPanel getDiscoverPanel() { return discoverPanel; }
    public NetworkPanel getNetworkPanel() { return networkPanel; }
    public SettingsPanel getSettingsPanel() { return settingsPanel; }

    private JPanel createPlaceholderPanel(String title, String text) {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JLabel titleLabel = new JLabel(title);
        titleLabel.setFont(new Font("SansSerif", Font.BOLD, 18));
        panel.add(titleLabel, BorderLayout.NORTH);

        JTextArea area = new JTextArea();
        area.setEditable(false);
        area.setText(text);
        area.setFont(new Font("SansSerif", Font.PLAIN, 14));

        JScrollPane scrollPane = new JScrollPane(area);
        panel.add(scrollPane, BorderLayout.CENTER);

        return panel;
    }

    private void switchToTab(String tabName) {
        CardLayout cl = (CardLayout) nowPanel.getParent().getLayout();
        cl.show(nowPanel.getParent(), tabName);
    }

    public void setChannels(List<Channel> channels) {
        this.activeChannels = channels;
        channelListModel.clear();
        for (Channel c : channels) {
            channelListModel.addElement("# " + c.getName());
        }
    }

    public void setOnChannelSelected(Consumer<Channel> onChannelSelected) {
        this.onChannelSelected = onChannelSelected;
    }

    public void setOnCreateChannel(Runnable onCreateChannel) {
        this.onCreateChannel = onCreateChannel;
    }

    public ChatPanel getChatPanel() {
        return chatPanel;
    }
}
