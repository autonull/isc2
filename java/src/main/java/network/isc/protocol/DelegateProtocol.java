package network.isc.protocol;

import io.libp2p.core.Stream;
import io.libp2p.core.multistream.ProtocolBinding;
import io.libp2p.core.multistream.ProtocolDescriptor;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import com.fasterxml.jackson.databind.ObjectMapper;
import network.isc.core.SignedDelegation;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class DelegateProtocol implements ProtocolBinding<DelegateProtocol.DelegateController> {
    private static final Logger log = LoggerFactory.getLogger(DelegateProtocol.class);

    private final Consumer<SignedDelegation> onDelegationReceived;
    private final ObjectMapper mapper = network.isc.adapters.JsonUtils.createMapper();

    public DelegateProtocol(Consumer<SignedDelegation> onDelegationReceived) {
        this.onDelegationReceived = onDelegationReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_DELEGATE);
    }

    @NotNull
    @Override
    public CompletableFuture<DelegateController> initChannel(@NotNull io.libp2p.core.P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<DelegateController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        DelegateController controller = new DelegateController(stream, mapper);

        stream.pushHandler(new io.netty.handler.codec.LineBasedFrameDecoder(65536));
        stream.pushHandler(new io.netty.handler.codec.string.StringDecoder(java.nio.charset.StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.handler.codec.string.StringEncoder(java.nio.charset.StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof String str) {
                    try {
                        var delMsg = mapper.readValue(str, SignedDelegation.class);
                        if (onDelegationReceived != null) {
                            onDelegationReceived.accept(delMsg);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse delegation message", e);
                    }
                } else {
                    ctx.fireChannelRead(msg);
                }
            }

            @Override
            public void exceptionCaught(io.netty.channel.ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in delegate stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class DelegateController {
        private final Stream stream;
        private final ObjectMapper mapper;

        public DelegateController(Stream stream, ObjectMapper mapper) {
            this.stream = stream;
            this.mapper = mapper;
        }

        public CompletableFuture<Void> send(SignedDelegation message) {
            CompletableFuture<Void> cf = new CompletableFuture<>();
            try {
                var json = mapper.writeValueAsString(message) + "\n";
                stream.writeAndFlush(json);
                cf.complete(null);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
            return cf;
        }
    }
}
