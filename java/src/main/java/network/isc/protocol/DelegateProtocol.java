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
    private final ObjectMapper mapper = new ObjectMapper();

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

        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof ByteBuf) {
                    ByteBuf buf = (ByteBuf) msg;
                    byte[] bytes = new byte[buf.readableBytes()];
                    buf.readBytes(bytes);

                    try {
                        SignedDelegation delMsg = mapper.readValue(bytes, SignedDelegation.class);
                        if (onDelegationReceived != null) {
                            onDelegationReceived.accept(delMsg);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse delegation message", e);
                    }
                }
                ctx.fireChannelRead(msg);
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
                byte[] bytes = mapper.writeValueAsBytes(message);
                ByteBuf buf = Unpooled.wrappedBuffer(bytes);
                stream.writeAndFlush(buf);
                cf.complete(null);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
            return cf;
        }
    }
}
