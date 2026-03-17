package network.isc.protocol;

import io.libp2p.core.Stream;
import io.libp2p.core.multistream.ProtocolBinding;
import io.libp2p.core.multistream.ProtocolDescriptor;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import network.isc.core.SignedAnnouncement;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class AnnounceProtocol implements ProtocolBinding<AnnounceProtocol.AnnounceController> {
    private static final Logger log = LoggerFactory.getLogger(AnnounceProtocol.class);

    private final Consumer<SignedAnnouncement> onAnnouncementReceived;
    private final ObjectMapper mapper = network.isc.adapters.JsonUtils.createMapper();

    public AnnounceProtocol(Consumer<SignedAnnouncement> onAnnouncementReceived) {
        this.onAnnouncementReceived = onAnnouncementReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_ANNOUNCE);
    }

    @NotNull
    @Override
    public CompletableFuture<AnnounceController> initChannel(@NotNull io.libp2p.core.P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<AnnounceController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        AnnounceController controller = new AnnounceController(stream, mapper);

        stream.pushHandler(new io.netty.handler.codec.LineBasedFrameDecoder(65536));
        stream.pushHandler(new io.netty.handler.codec.string.StringDecoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.handler.codec.string.StringEncoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof String str) {
                    try {
                        var ann = mapper.readValue(str, SignedAnnouncement.class);
                        if (onAnnouncementReceived != null) {
                            onAnnouncementReceived.accept(ann);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse announcement", e);
                    }
                } else {
                    ctx.fireChannelRead(msg);
                }
            }

            @Override
            public void exceptionCaught(io.netty.channel.ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in announce stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class AnnounceController {
        private final Stream stream;
        private final ObjectMapper mapper;

        public AnnounceController(Stream stream, ObjectMapper mapper) {
            this.stream = stream;
            this.mapper = mapper;
        }

        public CompletableFuture<Void> send(SignedAnnouncement ann) {
            CompletableFuture<Void> cf = new CompletableFuture<>();
            try {
                var json = mapper.writeValueAsString(ann) + "\n";
                stream.writeAndFlush(json);
                cf.complete(null);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
            return cf;
        }
    }
}
