package network.isc.ui;

import network.isc.core.Channel;

import javax.swing.*;
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
        setSize(900, 600);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLocationRelativeTo(null);

        // Sidebar
        channelListModel = new DefaultListModel<>();
        channelList = new JList<>(channelListModel);
        channelList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

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
        sidebarScroll.setPreferredSize(new Dimension(200, 0));

        JPanel sidebarPanel = new JPanel(new BorderLayout());
        sidebarPanel.add(new JLabel(" Channels", SwingConstants.LEFT), BorderLayout.NORTH);
        sidebarPanel.add(sidebarScroll, BorderLayout.CENTER);

        JButton createButton = new JButton("+ New Channel");
        createButton.addActionListener(e -> {
            if (onCreateChannel != null) onCreateChannel.run();
        });
        sidebarPanel.add(createButton, BorderLayout.SOUTH);

        // Chat Workspace
        chatPanel = new ChatPanel();

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, sidebarPanel, chatPanel);
        splitPane.setDividerLocation(200);

        add(splitPane);
    }

    public void setChannels(List<Channel> channels) {
        this.activeChannels = channels;
        channelListModel.clear();
        for (Channel c : channels) {
            channelListModel.addElement(c.getName());
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
