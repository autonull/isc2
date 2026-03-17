package network.isc.simulation;

import network.isc.ISCApplication;
import network.isc.core.Channel;
import network.isc.core.SignedAnnouncement;

import javax.swing.*;
import java.util.concurrent.CountDownLatch;
import java.awt.Dimension;
import java.awt.Point;
import java.util.Collections;
import java.io.File;
import java.nio.file.Paths;
import java.lang.reflect.Field;
import java.util.function.Consumer;

public class RunTwoWindows {
    public static void main(String[] args) throws Exception {
        System.out.println("Cleaning up old data...");
        deleteDirectory(Paths.get(System.getProperty("user.dir") + "/target/nodeA").toFile());
        deleteDirectory(Paths.get(System.getProperty("user.dir") + "/target/nodeB").toFile());

        System.out.println("Starting Node A...");
        ISCApplication appA = new ISCApplication();
        appA.setServerMode(false);
        appA.setPort(4101); // Use different ports to avoid conflicts
        appA.setDbPath("nodeA.db");
        appA.setAppDirOverride(System.getProperty("user.dir") + "/target/nodeA");
        appA.start();

        System.out.println("Node A addresses:");
        appA.getNetwork().getHost().listenAddresses().forEach(addr -> System.out.println(addr));

        String nodeAMultiaddr = null;
        for (io.libp2p.core.multiformats.Multiaddr addr : appA.getNetwork().getHost().listenAddresses()) {
            if (addr.toString().contains("127.0.0.1") && addr.toString().contains("tcp")) {
                nodeAMultiaddr = addr.toString() + "/p2p/" + appA.getNetwork().getHost().getPeerId().toString();
                break;
            }
        }
        if (nodeAMultiaddr == null) {
            nodeAMultiaddr = appA.getNetwork().getHost().listenAddresses().get(0).toString() + "/p2p/" + appA.getNetwork().getHost().getPeerId().toString();
        }
        System.out.println("Node A multiaddr for bootstrap: " + nodeAMultiaddr);

        System.out.println("Starting Node B...");
        ISCApplication appB = new ISCApplication();
        appB.setServerMode(false);
        appB.setPort(4103); // Use different port
        appB.setDbPath("nodeB.db");
        appB.setAppDirOverride(System.getProperty("user.dir") + "/target/nodeB");
        appB.setBootstrapNodes(new String[]{nodeAMultiaddr});
        appB.start();

        System.out.println("Waiting for windows to appear...");
        Thread.sleep(10000);

        // Position windows side-by-side
        SwingUtilities.invokeAndWait(() -> {
            try {
                if (appA.getMainFrame() != null) {
                    appA.getMainFrame().setSize(new Dimension(800, 600));
                    appA.getMainFrame().setLocation(new Point(0, 0));
                    appA.getMainFrame().setTitle("Node A");
                }
                if (appB.getMainFrame() != null) {
                    appB.getMainFrame().setSize(new Dimension(800, 600));
                    appB.getMainFrame().setLocation(new Point(810, 0));
                    appB.getMainFrame().setTitle("Node B");
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        System.out.println("Setting names...");
        appA.getMainFrame().getSettingsPanel().setProfile("Alice", "I like cats", "");
        appB.getMainFrame().getSettingsPanel().setProfile("Bob", "I like felines", "");
        appA.getStorage().saveConfig("name", "Alice");
        appB.getStorage().saveConfig("name", "Bob");

        System.out.println("Overriding onJoinRequested to bypass blocking UI dialogs...");
        // Re-implement the handler for AppA
        appA.getMainFrame().setOnJoinRequested((SignedAnnouncement ann) -> {
            java.util.List<Channel> currentChannels = new java.util.ArrayList<>(appA.getStorage().loadChannels());
            Channel newChan = new Channel(ann.getChannelID(), "Discovered Channel", "Discovered from " + ann.getPeerID(), null, null, null, null, false, null);
            boolean exists = currentChannels.stream().anyMatch(c -> c.getId().equals(newChan.getId()));
            if (!exists) {
                currentChannels.add(newChan);
                appA.getStorage().saveChannels(currentChannels);
                SwingUtilities.invokeLater(() -> appA.getMainFrame().setChannels(currentChannels));
                System.out.println("AppA organically discovered and joined channel: " + ann.getChannelID());
            }
        });

        // Re-implement the handler for AppB
        appB.getMainFrame().setOnJoinRequested((SignedAnnouncement ann) -> {
            java.util.List<Channel> currentChannels = new java.util.ArrayList<>(appB.getStorage().loadChannels());
            Channel newChan = new Channel(ann.getChannelID(), "Discovered Channel", "Discovered from " + ann.getPeerID(), null, null, null, null, false, null);
            boolean exists = currentChannels.stream().anyMatch(c -> c.getId().equals(newChan.getId()));
            if (!exists) {
                currentChannels.add(newChan);
                appB.getStorage().saveChannels(currentChannels);
                SwingUtilities.invokeLater(() -> appB.getMainFrame().setChannels(currentChannels));
                System.out.println("AppB organically discovered and joined channel: " + ann.getChannelID());
            }
        });

        System.out.println("Creating channels organically through the MainFrame triggers...");
        // Have Node A create a channel
        Channel chanA = new Channel("chan-A-123", "Cats", "I love cats", null, null, null, null, false, null);
        java.util.List<Channel> initialA = new java.util.ArrayList<>();
        initialA.add(chanA);
        appA.getStorage().saveChannels(initialA);
        SwingUtilities.invokeAndWait(() -> appA.getMainFrame().setChannels(initialA));

        // Let the Embedding Thread embed the channel
        new Thread(() -> {
            try {
                float[] vector = appA.getEmbedding().embed(chanA.getDescription());
                java.lang.reflect.Method broadcastMethod = ISCApplication.class.getDeclaredMethod("broadcastAnnouncement", Channel.class, float[].class);
                broadcastMethod.setAccessible(true);
                broadcastMethod.invoke(appA, chanA, vector);
            } catch (Exception ex) { ex.printStackTrace(); }
        }).start();

        // Have Node B create a similar channel
        Channel chanB = new Channel("chan-B-456", "Felines", "I love felines", null, null, null, null, false, null);
        java.util.List<Channel> initialB = new java.util.ArrayList<>();
        initialB.add(chanB);
        appB.getStorage().saveChannels(initialB);
        SwingUtilities.invokeAndWait(() -> appB.getMainFrame().setChannels(initialB));

        // Let the Embedding Thread embed the channel
        new Thread(() -> {
            try {
                float[] vector = appB.getEmbedding().embed(chanB.getDescription());
                java.lang.reflect.Method broadcastMethod = ISCApplication.class.getDeclaredMethod("broadcastAnnouncement", Channel.class, float[].class);
                broadcastMethod.setAccessible(true);
                broadcastMethod.invoke(appB, chanB, vector);
            } catch (Exception ex) { ex.printStackTrace(); }
        }).start();

        System.out.println("Wait for query and announcement to propagate...");
        Thread.sleep(8000);

        System.out.println("Selecting channels...");
        SwingUtilities.invokeAndWait(() -> {
            try {
                Field onChannelSelectedField = appA.getMainFrame().getClass().getDeclaredField("onChannelSelected");
                onChannelSelectedField.setAccessible(true);
                Consumer<Channel> cbA = (Consumer<Channel>) onChannelSelectedField.get(appA.getMainFrame());
                if (cbA != null) cbA.accept(chanA);

                Consumer<Channel> cbB = (Consumer<Channel>) onChannelSelectedField.get(appB.getMainFrame());
                if (cbB != null) cbB.accept(chanB);
            } catch (Exception e) { e.printStackTrace(); }
        });

        System.out.println("Waiting a bit...");
        Thread.sleep(2000);

        System.out.println("Executing DHT Query for proximal channels...");
        SwingUtilities.invokeLater(() -> {
            try {
                // Bob queries for matching channels organically via UI menu trigger
                JMenuBar menuBarB = appB.getMainFrame().getJMenuBar();
                JMenu fileMenuB = menuBarB.getMenu(0);
                JMenuItem queryItemB = fileMenuB.getItem(0);
                queryItemB.doClick();

                JMenuBar menuBarA = appA.getMainFrame().getJMenuBar();
                JMenu fileMenuA = menuBarA.getMenu(0);
                JMenuItem queryItemA = fileMenuA.getItem(0);
                queryItemA.doClick();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        Thread.sleep(8000);

        // Make both select the SAME discovered channel to chat organically
        System.out.println("Selecting organically shared channel...");
        SwingUtilities.invokeAndWait(() -> {
            try {
                Field onChannelSelectedField = appA.getMainFrame().getClass().getDeclaredField("onChannelSelected");
                onChannelSelectedField.setAccessible(true);
                Consumer<Channel> cbA = (Consumer<Channel>) onChannelSelectedField.get(appA.getMainFrame());
                if (cbA != null) cbA.accept(chanB); // A selects B's channel!

                Consumer<Channel> cbB = (Consumer<Channel>) onChannelSelectedField.get(appB.getMainFrame());
                if (cbB != null) cbB.accept(chanB); // B selects B's channel!
            } catch (Exception e) { e.printStackTrace(); }
        });

        Thread.sleep(2000);

        SwingUtilities.invokeLater(() -> {
            try {
                Field composeAreaField = appA.getMainFrame().getChatPanel().getClass().getDeclaredField("composeArea");
                composeAreaField.setAccessible(true);
                JTextArea composeAreaA = (JTextArea) composeAreaField.get(appA.getMainFrame().getChatPanel());
                composeAreaA.setText("Hello from Alice!");

                Field sendButtonField = appA.getMainFrame().getChatPanel().getClass().getDeclaredField("sendButton");
                sendButtonField.setAccessible(true);
                JButton sendButtonA = (JButton) sendButtonField.get(appA.getMainFrame().getChatPanel());
                sendButtonA.doClick();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        Thread.sleep(2000);

        SwingUtilities.invokeLater(() -> {
            try {
                Field composeAreaField = appB.getMainFrame().getChatPanel().getClass().getDeclaredField("composeArea");
                composeAreaField.setAccessible(true);
                JTextArea composeAreaB = (JTextArea) composeAreaField.get(appB.getMainFrame().getChatPanel());
                composeAreaB.setText("Hi from Bob! The organic semantic matching via DHT found you.");

                Field sendButtonField = appB.getMainFrame().getChatPanel().getClass().getDeclaredField("sendButton");
                sendButtonField.setAccessible(true);
                JButton sendButtonB = (JButton) sendButtonField.get(appB.getMainFrame().getChatPanel());
                sendButtonB.doClick();
            } catch (Exception e) {
                e.printStackTrace();
            }
        });

        Thread.sleep(4000);

        System.out.println("Taking final screenshot...");
        new ProcessBuilder("import", "-window", "root", "simulation_result.png").start().waitFor();

        System.out.println("Simulation fully complete. Shutting down.");
        // Give time for exit to be clean
        Thread.sleep(2000);
        appA.stop();
        appB.stop();
        System.exit(0);
    }

    private static void deleteDirectory(File dir) {
        if (dir.exists()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isDirectory()) {
                        deleteDirectory(file);
                    } else {
                        file.delete();
                    }
                }
            }
            dir.delete();
        }
    }
}
