package network.isc.ui;

import network.isc.core.Channel;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.util.List;
import java.util.function.Consumer;

public class MainFrame extends JFrame {
    private final DefaultListModel<String> channelListModel;
    private final JList<String> channelList;
    private final ChatPanel chatPanel;
    private List<Channel> activeChannels;
    private Consumer<Channel> onChannelSelected;
    private Runnable onCreateChannel;

    public MainFrame() {
        setTitle("ISC - Internet Semantic Chat");
        setSize(1000, 700);
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
                    if (onChannelSelected != null) {
                        onChannelSelected.accept(activeChannels.get(index));
                    }
                }
            }
        });

        JScrollPane sidebarScroll = new JScrollPane(channelList);
        sidebarScroll.setBorder(BorderFactory.createEmptyBorder());
        sidebarScroll.setPreferredSize(new Dimension(250, 0));

        JPanel sidebarPanel = new JPanel(new BorderLayout());
        sidebarPanel.setBackground(Color.WHITE);
        sidebarPanel.setBorder(BorderFactory.createMatteBorder(0, 0, 0, 1, Color.LIGHT_GRAY));

        JLabel channelsLabel = new JLabel(" My Channels", SwingConstants.LEFT);
        channelsLabel.setFont(channelsLabel.getFont().deriveFont(Font.BOLD, 14f));
        channelsLabel.setBorder(BorderFactory.createEmptyBorder(15, 10, 15, 10));
        sidebarPanel.add(channelsLabel, BorderLayout.NORTH);

        sidebarPanel.add(sidebarScroll, BorderLayout.CENTER);

        JButton createButton = new JButton("+ New Channel");
        createButton.setFont(createButton.getFont().deriveFont(Font.BOLD));
        createButton.setBackground(new Color(240, 240, 240));
        createButton.setFocusPainted(false);
        createButton.setBorder(BorderFactory.createEmptyBorder(15, 15, 15, 15));
        createButton.addActionListener(e -> {
            if (onCreateChannel != null) onCreateChannel.run();
        });
        sidebarPanel.add(createButton, BorderLayout.SOUTH);

        // Chat Workspace
        chatPanel = new ChatPanel();

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, sidebarPanel, chatPanel);
        splitPane.setDividerLocation(250);
        splitPane.setDividerSize(1);
        splitPane.setBorder(null);

        add(splitPane);
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
