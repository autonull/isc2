package network.isc.adapters;

import io.libp2p.core.Host;
import io.libp2p.core.crypto.PrivKey;
import io.libp2p.core.dsl.Builder;
import io.libp2p.core.dsl.Builder.Defaults;
import io.libp2p.core.multiformats.Multiaddr;
import io.libp2p.transport.tcp.TcpTransport;
import io.libp2p.transport.ws.WsTransport;
import io.libp2p.security.noise.NoiseXXSecureChannel;
import io.libp2p.mux.mplex.MplexStreamMuxer;
import io.libp2p.mux.yamux.YamuxStreamMuxer;
import io.libp2p.core.mux.StreamMuxerProtocol;
import network.isc.core.SignedAnnouncement;
import network.isc.protocol.AnnounceProtocol;
import network.isc.protocol.ChatProtocol;
import network.isc.protocol.ChatMessage;
import network.isc.protocol.QueryProtocol;
import network.isc.protocol.ProtocolConstants;

import kotlin.Unit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;

public class NetworkAdapter {
    private static final Logger log = LoggerFactory.getLogger(NetworkAdapter.class);

    private final Host host;
    private final ChatProtocol chatProtocol;
    private final AnnounceProtocol announceProtocol;
    private final QueryProtocol queryProtocol;

    private final List<ChatProtocol.ChatController> activeChats = new ArrayList<>();
    private final List<AnnounceProtocol.AnnounceController> activeAnnouncers = new ArrayList<>();
    private final List<QueryProtocol.QueryController> activeQueries = new ArrayList<>();

    private Consumer<String> onPeerConnected;

    public NetworkAdapter(PrivKey privKey, int port,
                          Consumer<ChatMessage> onMessageReceived,
                          Consumer<SignedAnnouncement> onAnnounceReceived,
                          Consumer<String[]> onQueryReceived) {
        this.chatProtocol = new ChatProtocol(onMessageReceived);
        this.announceProtocol = new AnnounceProtocol(onAnnounceReceived);
        this.queryProtocol = new QueryProtocol(onQueryReceived);

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
                return Unit.INSTANCE;
            })
            .protocols(p -> {
                p.add(chatProtocol);
                p.add(announceProtocol);
                p.add(queryProtocol);
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
        });
    }

    public void setOnPeerConnected(Consumer<String> onPeerConnected) {
        this.onPeerConnected = onPeerConnected;
    }

    public CompletableFuture<Void> stop() {
        return host.stop();
    }

    public CompletableFuture<Void> dialPeer(String multiaddrStr) {
        Multiaddr target = new Multiaddr(multiaddrStr);
        String chatPid = ProtocolConstants.PROTOCOL_CHAT;
        String annPid = ProtocolConstants.PROTOCOL_ANNOUNCE;
        String queryPid = ProtocolConstants.PROTOCOL_QUERY;

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

            host.newStream(Collections.singletonList(annPid), conn).getController().thenAccept(c -> {
                synchronized (activeAnnouncers) {
                    activeAnnouncers.add((AnnounceProtocol.AnnounceController) c);
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
