package network.isc.adapters;

import io.libp2p.core.Host;
import io.libp2p.core.crypto.PrivKey;
import io.libp2p.core.dsl.Builder;
import io.libp2p.core.dsl.Builder.Defaults;
import io.libp2p.core.multiformats.Multiaddr;
import io.libp2p.transport.tcp.TcpTransport;
import io.libp2p.transport.ws.WsTransport;
import io.libp2p.security.noise.NoiseXXSecureChannel;
import io.libp2p.mux.yamux.YamuxStreamMuxer;
import io.libp2p.core.mux.StreamMuxerProtocol;
import network.isc.core.SignedAnnouncement;
import network.isc.protocol.AnnounceProtocol;
import network.isc.protocol.ChatProtocol;
import network.isc.protocol.DirectMessageProtocol;
import network.isc.protocol.ChatMessage;
import network.isc.protocol.QueryProtocol;
import network.isc.protocol.FileProtocol;
import network.isc.protocol.SocialProtocol;
import network.isc.protocol.ProtocolConstants;
import io.libp2p.core.Stream;

import kotlin.Unit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.BiConsumer;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;

public class NetworkAdapter {
    private static final Logger log = LoggerFactory.getLogger(NetworkAdapter.class);

    private final Host host;
    private final ChatProtocol chatProtocol;
    private final DirectMessageProtocol dmProtocol;
    private final AnnounceProtocol announceProtocol;
    private final QueryProtocol queryProtocol;
    private final network.isc.protocol.PostProtocol postProtocol;
    private final network.isc.protocol.DelegateProtocol delegateProtocol;
    private final FileProtocol fileProtocol;
    private final SocialProtocol socialProtocol;

    private final List<ChatProtocol.ChatController> activeChats = new ArrayList<>();
    private final List<DirectMessageProtocol.DMController> activeDMs = new ArrayList<>();
    private final List<AnnounceProtocol.AnnounceController> activeAnnouncers = new ArrayList<>();
    private final List<QueryProtocol.QueryController> activeQueries = new ArrayList<>();
    private final List<network.isc.protocol.PostProtocol.PostController> activePosts = new ArrayList<>();
    private final List<network.isc.protocol.DelegateProtocol.DelegateController> activeDelegates = new ArrayList<>();
    private final List<FileProtocol.FileController> activeFiles = new ArrayList<>();
    private final List<SocialProtocol.SocialController> activeSocials = new ArrayList<>();

    private Consumer<String> onPeerConnected;
    private BiConsumer<Stream, byte[]> onFileProtocolChunkReceived;
    private Consumer<Object> onSocialEventReceived;

    public NetworkAdapter(PrivKey privKey, int port,
                          Consumer<ChatMessage> onMessageReceived,
                          Consumer<ChatMessage> onHistoricalPostReceived,
                          Consumer<ChatMessage> onDMReceived,
                          Consumer<SignedAnnouncement> onAnnounceReceived,
                          Consumer<String[]> onQueryReceived,
                          Consumer<network.isc.core.SignedDelegation> onDelegationReceived) {
        this.chatProtocol = new ChatProtocol(onMessageReceived);
        this.dmProtocol = new DirectMessageProtocol(onDMReceived);
        this.announceProtocol = new AnnounceProtocol(onAnnounceReceived);
        this.queryProtocol = new QueryProtocol(onQueryReceived);
        this.postProtocol = new network.isc.protocol.PostProtocol(onHistoricalPostReceived);
        this.delegateProtocol = new network.isc.protocol.DelegateProtocol(onDelegationReceived);
        this.fileProtocol = new FileProtocol((stream, bytes) -> {
            if (onFileProtocolChunkReceived != null) {
                onFileProtocolChunkReceived.accept(stream, bytes);
            }
        });
        this.socialProtocol = new SocialProtocol(event -> {
            if (onSocialEventReceived != null) {
                onSocialEventReceived.accept(event);
            }
        });

        this.host = new Builder()
            .identity(i -> {
                i.setFactory(() -> privKey);
                return Unit.INSTANCE;
            })
            .transports(t -> {
                t.add(TcpTransport::new);
                t.add(WsTransport::new);
                return Unit.INSTANCE;
            })
            .secureChannels(s -> {
                s.add(NoiseXXSecureChannel::new);
                return Unit.INSTANCE;
            })
            .muxers(m -> {
                m.add(StreamMuxerProtocol.getYamux());
                m.add(StreamMuxerProtocol.getMplex());
                return Unit.INSTANCE;
            })
            .network(n -> {
                n.listen("/ip4/0.0.0.0/tcp/" + port);
                n.listen("/ip4/0.0.0.0/tcp/" + (port + 1) + "/ws");
                return Unit.INSTANCE;
            })
            .protocols(p -> {
                p.add(chatProtocol);
                p.add(dmProtocol);
                p.add(announceProtocol);
                p.add(queryProtocol);
                p.add(postProtocol);
                p.add(delegateProtocol);
                p.add(fileProtocol);
                p.add(socialProtocol);

                return Unit.INSTANCE;
            })
            .build(Defaults.None);
    }

    public CompletableFuture<Void> start() {
        return host.start().thenAccept(v -> {
            log.info("Node started: {}", host.getPeerId());
            for (Multiaddr addr : host.listenAddresses()) {
                log.info("Listening on {}", addr);
            }

            // Bootstrap to known nodes (demo bootstrap peers)
            String[] bootstrapPeers = {
                // Examples. In production, real stable nodes would go here
                "/ip4/127.0.0.1/tcp/4001/p2p/QmBootstrapNodeExample1",
            };

            for (String peer : bootstrapPeers) {
                try {
                    log.info("Attempting bootstrap to: {}", peer);
                    dialPeer(peer).exceptionally(ex -> {
                        log.debug("Bootstrap dial failed (expected if node offline): {}", ex.getMessage());
                        return null;
                    });
                } catch (Exception e) {
                    log.debug("Invalid bootstrap peer multiaddr format: {}", peer);
                }
            }
        });
    }

    public void setOnPeerConnected(Consumer<String> onPeerConnected) {
        this.onPeerConnected = onPeerConnected;
    }

    public void setOnFileProtocolChunkReceived(BiConsumer<Stream, byte[]> onFileProtocolChunkReceived) {
        this.onFileProtocolChunkReceived = onFileProtocolChunkReceived;
    }

    public void setOnSocialEventReceived(Consumer<Object> onSocialEventReceived) {
        this.onSocialEventReceived = onSocialEventReceived;
    }

    public CompletableFuture<Void> stop() {
        return host.stop();
    }

    public CompletableFuture<Void> dialPeer(String multiaddrStr) {
        Multiaddr target = new Multiaddr(multiaddrStr);
        String chatPid = ProtocolConstants.PROTOCOL_CHAT;
        String dmPid = ProtocolConstants.PROTOCOL_DM;
        String annPid = ProtocolConstants.PROTOCOL_ANNOUNCE;
        String queryPid = ProtocolConstants.PROTOCOL_QUERY;
        String postPid = ProtocolConstants.PROTOCOL_POST;
        String delegatePid = ProtocolConstants.PROTOCOL_DELEGATE;
        String filePid = ProtocolConstants.PROTOCOL_FILE;
        String socialPid = ProtocolConstants.PROTOCOL_SOCIAL;

        return host.getNetwork().connect(target).thenCompose(conn -> {
            log.info("Connected to peer: {}", conn.remoteAddress());

            if (onPeerConnected != null) {
                onPeerConnected.accept(conn.remoteAddress().toString());
            }

            host.newStream(Collections.singletonList(chatPid), conn).getController().thenAccept(c -> {
                synchronized (activeChats) {
                    activeChats.add((ChatProtocol.ChatController) c);
                }
            });

            host.newStream(Collections.singletonList(dmPid), conn).getController().thenAccept(c -> {
                synchronized (activeDMs) {
                    activeDMs.add((DirectMessageProtocol.DMController) c);
                }
            });

            host.newStream(Collections.singletonList(annPid), conn).getController().thenAccept(c -> {
                synchronized (activeAnnouncers) {
                    activeAnnouncers.add((AnnounceProtocol.AnnounceController) c);
                }
            });

            host.newStream(Collections.singletonList(postPid), conn).getController().thenAccept(c -> {
                synchronized (activePosts) {
                    activePosts.add((network.isc.protocol.PostProtocol.PostController) c);
                }
            });

            host.newStream(Collections.singletonList(delegatePid), conn).getController().thenAccept(c -> {
                synchronized (activeDelegates) {
                    activeDelegates.add((network.isc.protocol.DelegateProtocol.DelegateController) c);
                }
            });

            host.newStream(Collections.singletonList(filePid), conn).getController().thenAccept(c -> {
                synchronized (activeFiles) {
                    activeFiles.add((FileProtocol.FileController) c);
                }
            });

            host.newStream(Collections.singletonList(socialPid), conn).getController().thenAccept(c -> {
                synchronized (activeSocials) {
                    activeSocials.add((SocialProtocol.SocialController) c);
                }
            });

            return host.newStream(Collections.singletonList(queryPid), conn).getController();

        }).thenAccept(controller -> {
            log.info("Streams established.");
            synchronized (activeQueries) {
                activeQueries.add((QueryProtocol.QueryController) controller);
            }
        });
    }

    public void broadcastFileProtocolData(byte[] data) {
        broadcastFileProtocolData(data, null);
    }

    public void broadcastFileProtocolData(byte[] data, Consumer<Stream> streamTracker) {
        synchronized (activeFiles) {
            for (FileProtocol.FileController controller : activeFiles) {
                try {
                    controller.send(data);
                    if (streamTracker != null) {
                        streamTracker.accept(controller.getStream());
                    }
                } catch (Exception e) {
                    log.error("Failed to broadcast file data to peer", e);
                }
            }
        }
    }

    public void sendGroupMessage(java.util.List<String> targetPeerIds, ChatMessage message) {
        synchronized (activeChats) {
            for (ChatProtocol.ChatController controller : activeChats) {
                if (targetPeerIds.contains(controller.getRemotePeerId())) {
                    try {
                        controller.send(message);
                    } catch (Exception e) {
                        log.error("Failed to send group message to peer {}", controller.getRemotePeerId(), e);
                    }
                }
            }
        }
    }

    public void sendFileProtocolData(Stream stream, byte[] data) {
        try {
            io.netty.buffer.ByteBuf buf = io.netty.buffer.Unpooled.wrappedBuffer(data);
            stream.writeAndFlush(buf);
        } catch (Exception e) {
            log.error("Failed to send file data to specific stream", e);
        }
    }

    public CompletableFuture<Void> sendFileData(Stream stream, java.io.File file) {
        return CompletableFuture.runAsync(() -> {
            try (java.io.InputStream is = new java.io.FileInputStream(file)) {
                byte[] buffer = new byte[8192]; // 8KB chunks
                int read;
                while ((read = is.read(buffer)) > 0) {
                    byte[] chunk = new byte[read];
                    System.arraycopy(buffer, 0, chunk, 0, read);
                    sendFileProtocolData(stream, chunk);

                    // Simple sleep to prevent immediate OOM / backpressure overwhelming on large files
                    // A proper implementation would monitor the Netty channel's writability.
                    Thread.sleep(1);
                }
            } catch (Exception e) {
                log.error("Failed sending file data chunks", e);
            }
        });
    }

    public void broadcastSocialEvent(Object event) {
        synchronized (activeSocials) {
            for (SocialProtocol.SocialController controller : activeSocials) {
                try {
                    controller.send(event);
                } catch (Exception e) {
                    log.error("Failed to broadcast social event to peer", e);
                }
            }
        }
    }

    public void broadcastChat(ChatMessage message) {
        synchronized (activeChats) {
            for (ChatProtocol.ChatController controller : activeChats) {
                try {
                    controller.send(message);
                } catch (Exception e) {
                    log.error("Failed to send message to peer", e);
                }
            }
        }
    }

    public void broadcastDelegation(network.isc.core.SignedDelegation delegation) {
        synchronized (activeDelegates) {
            for (network.isc.protocol.DelegateProtocol.DelegateController controller : activeDelegates) {
                try {
                    controller.send(delegation);
                } catch (Exception e) {
                    log.error("Failed to broadcast delegation to peer", e);
                }
            }
        }
    }

    public void requestHistoricalPosts(String channelID) {
        synchronized (activePosts) {
            // A request for historical posts can simply be a ChatMessage with a specific payload convention,
            // or an empty message just containing the channelID so the remote peer knows to sync.
            ChatMessage syncRequest = new ChatMessage(channelID, "SYNC_REQUEST", System.currentTimeMillis(), new byte[0], new byte[0], "");
            for (network.isc.protocol.PostProtocol.PostController controller : activePosts) {
                try {
                    controller.send(syncRequest);
                } catch (Exception e) {
                    log.error("Failed to request historical posts from peer", e);
                }
            }
        }
    }

    public void sendHistoricalPost(ChatMessage message) {
        synchronized (activePosts) {
            for (network.isc.protocol.PostProtocol.PostController controller : activePosts) {
                try {
                    controller.send(message);
                } catch (Exception e) {
                    log.error("Failed to send historical post to peer", e);
                }
            }
        }
    }

    public void sendDirectMessage(String targetPeerId, ChatMessage message) {
        synchronized (activeDMs) {
            for (DirectMessageProtocol.DMController controller : activeDMs) {
                if (controller.getRemotePeerId().equals(targetPeerId) || targetPeerId.equals(controller.getRemotePeerId())) {
                    try {
                        controller.send(message);
                    } catch (Exception e) {
                        log.error("Failed to send DM to peer", e);
                    }
                }
            }
        }
    }

    public void announce(SignedAnnouncement ann) {
        synchronized (activeAnnouncers) {
            for (AnnounceProtocol.AnnounceController controller : activeAnnouncers) {
                try {
                    controller.send(ann);
                } catch (Exception e) {
                    log.error("Failed to send announcement to peer", e);
                }
            }
        }
    }

    public void query(String[] hashes) {
        synchronized (activeQueries) {
            for (QueryProtocol.QueryController controller : activeQueries) {
                try {
                    controller.send(hashes);
                } catch (Exception e) {
                    log.error("Failed to send query to peer", e);
                }
            }
        }
    }

    public Host getHost() {
        return host;
    }
}
