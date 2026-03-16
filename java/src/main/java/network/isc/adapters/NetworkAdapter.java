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
import network.isc.protocol.ChatProtocol;
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
    private final List<ChatProtocol.ChatController> activeChats = new ArrayList<>();

    public NetworkAdapter(PrivKey privKey, int port, Consumer<String> onMessageReceived) {
        this.chatProtocol = new ChatProtocol(onMessageReceived);

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

    public CompletableFuture<Void> stop() {
        return host.stop();
    }

    public CompletableFuture<Void> dialPeer(String multiaddrStr) {
        Multiaddr target = new Multiaddr(multiaddrStr);
        String protocolId = ProtocolConstants.PROTOCOL_CHAT;

        return host.getNetwork().connect(target).thenCompose(conn -> {
            log.info("Connected to peer: {}", conn.remoteAddress());
            return host.newStream(Collections.singletonList(protocolId), conn).getController();
        }).thenAccept(controller -> {
            log.info("Chat stream established.");
            synchronized (activeChats) {
                activeChats.add((ChatProtocol.ChatController) controller);
            }
        });
    }

    public void broadcastChat(String message) {
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

    public Host getHost() {
        return host;
    }
}
