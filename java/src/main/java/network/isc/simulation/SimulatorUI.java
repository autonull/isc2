package network.isc.simulation;

import javax.swing.*;
import java.awt.*;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.awt.FontMetrics;

public class SimulatorUI extends JFrame {
    private final NetworkPanel networkPanel;

    // Core data structures for visualization
    private final List<SimNode> nodes = new CopyOnWriteArrayList<>();
    private final List<SimEdge> edges = new CopyOnWriteArrayList<>();
    private final List<SimEvent> events = new CopyOnWriteArrayList<>();

    // Track node positions to try and arrange them nicely (e.g. circle layout)
    private final Map<String, SimNode> nodeMap = new ConcurrentHashMap<>();

    public SimulatorUI(String title) {
        super(title);
        setSize(800, 600);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        networkPanel = new NetworkPanel();
        add(networkPanel, BorderLayout.CENTER);

        // Setup animation timer (60fps)
        Timer timer = new Timer(16, e -> networkPanel.repaint());
        timer.start();
    }

    public void addNode(String peerId, String name) {
        SimNode node = new SimNode(peerId, name);
        nodes.add(node);
        nodeMap.put(peerId, node);
        layoutNodesInCircle();
    }

    public void addConnection(String peerId1, String peerId2) {
        SimNode n1 = nodeMap.get(peerId1);
        SimNode n2 = nodeMap.get(peerId2);
        if (n1 != null && n2 != null) {
            edges.add(new SimEdge(n1, n2));
        }
    }

    public void animateEvent(String fromPeerId, String toPeerId, String type, Color color) {
        SimNode from = nodeMap.get(fromPeerId);
        SimNode to = nodeMap.get(toPeerId);
        if (from != null && to != null) {
            System.out.println("SimulatorUI Rendering Animation: " + type + " from " + fromPeerId + " to " + toPeerId);
            events.add(new SimEvent(from, to, type, color, System.currentTimeMillis()));
        }
    }

    // Broadcast event to all connected peers visually
    public void animateBroadcast(String fromPeerId, String type, Color color) {
        SimNode from = nodeMap.get(fromPeerId);
        if (from == null) return;

        for (SimEdge edge : edges) {
            if (edge.n1 == from) {
                events.add(new SimEvent(from, edge.n2, type, color, System.currentTimeMillis()));
            } else if (edge.n2 == from) {
                events.add(new SimEvent(from, edge.n1, type, color, System.currentTimeMillis()));
            }
        }
    }

    public void updateNodeChannels(String peerId, List<String> channels) {
        SimNode node = nodeMap.get(peerId);
        if (node != null) {
            node.channels.clear();
            node.channels.addAll(channels);
            networkPanel.repaint();
        }
    }

    public void addNodeMessage(String peerId, String message) {
        SimNode node = nodeMap.get(peerId);
        if (node != null) {
            if (!node.messages.isEmpty() && node.messages.get(node.messages.size() - 1).equals(message)) {
                return; // Don't add duplicate sequential messages from polling
            }
            node.messages.add(message);
            if (node.messages.size() > 4) {
                node.messages.remove(0); // Keep last 4
            }
        }
    }

    private void layoutNodesInCircle() {
        int cx = 400;
        int cy = 300;
        int r = 200;
        int count = nodes.size();
        for (int i = 0; i < count; i++) {
            double angle = 2 * Math.PI * i / count;
            SimNode node = nodes.get(i);
            node.x = cx + (int)(r * Math.cos(angle));
            node.y = cy + (int)(r * Math.sin(angle));
        }
    }

    private class NetworkPanel extends JPanel {
        public NetworkPanel() {
            setBackground(Color.DARK_GRAY);
        }

        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2 = (Graphics2D) g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

            // Draw edges
            g2.setColor(new Color(100, 100, 100));
            g2.setStroke(new BasicStroke(1));
            for (SimEdge edge : edges) {
                g2.drawLine(edge.n1.x, edge.n1.y, edge.n2.x, edge.n2.y);
            }

            // Draw animated events
            long now = System.currentTimeMillis();
            List<SimEvent> toRemove = new ArrayList<>();
            for (SimEvent event : events) {
                float progress = (now - event.startTime) / (float) event.durationMs;
                if (progress >= 1.0f) {
                    toRemove.add(event);
                } else {
                    int ex = (int) (event.from.x + (event.to.x - event.from.x) * progress);
                    int ey = (int) (event.from.y + (event.to.y - event.from.y) * progress);
                    g2.setColor(event.color);
                    g2.fillOval(ex - 6, ey - 6, 12, 12);
                    g2.setColor(Color.WHITE);
                    g2.drawString(event.type, ex + 10, ey);
                }
            }
            events.removeAll(toRemove);

            // Draw nodes
            for (SimNode node : nodes) {
                g2.setColor(new Color(50, 150, 250));
                g2.fillOval(node.x - 15, node.y - 15, 30, 30);
                g2.setColor(Color.WHITE);
                g2.drawOval(node.x - 15, node.y - 15, 30, 30);

                FontMetrics fm = g2.getFontMetrics();
                int tw = fm.stringWidth(node.name);
                g2.drawString(node.name, node.x - tw / 2, node.y - 20);

                // Draw Channels
                g2.setColor(new Color(150, 250, 150));
                int ty = node.y + 30;
                for (String chan : node.channels) {
                    int cw = fm.stringWidth("#" + chan);
                    g2.drawString("#" + chan, node.x - cw / 2, ty);
                    ty += 15;
                }

                // Draw Messages
                g2.setColor(new Color(220, 220, 220));
                for (String msg : node.messages) {
                    int mw = fm.stringWidth(msg);
                    g2.drawString(msg, node.x - mw / 2, ty);
                    ty += 15;
                }
            }
        }
    }

    private static class SimNode {
        String id;
        String name;
        int x, y;
        List<String> channels = new ArrayList<>();
        List<String> messages = new ArrayList<>();
        SimNode(String id, String name) { this.id = id; this.name = name; }
    }

    private static class SimEdge {
        SimNode n1, n2;
        SimEdge(SimNode n1, SimNode n2) { this.n1 = n1; this.n2 = n2; }
    }

    private static class SimEvent {
        SimNode from, to;
        String type;
        Color color;
        long startTime;
        long durationMs = 1000;

        SimEvent(SimNode from, SimNode to, String type, Color color, long startTime) {
            this.from = from; this.to = to; this.type = type; this.color = color; this.startTime = startTime;
        }
    }
}
