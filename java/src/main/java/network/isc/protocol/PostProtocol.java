package network.isc.protocol;

import io.libp2p.core.Stream;
import io.libp2p.core.multistream.ProtocolBinding;
import io.libp2p.core.multistream.ProtocolDescriptor;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class PostProtocol implements ProtocolBinding<PostProtocol.PostController> {
    private static final Logger log = LoggerFactory.getLogger(PostProtocol.class);

    private final Consumer<ChatMessage> onHistoricalPostReceived;
    private final ObjectMapper mapper = new ObjectMapper();

    public PostProtocol(Consumer<ChatMessage> onHistoricalPostReceived) {
        this.onHistoricalPostReceived = onHistoricalPostReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_POST);
    }

    @NotNull
    @Override
    public CompletableFuture<PostController> initChannel(@NotNull io.libp2p.core.P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<PostController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        PostController controller = new PostController(stream, mapper);

        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof ByteBuf) {
                    ByteBuf buf = (ByteBuf) msg;
                    byte[] bytes = new byte[buf.readableBytes()];
                    buf.readBytes(bytes);

                    try {
                        ChatMessage postMsg = mapper.readValue(bytes, ChatMessage.class);
                        if (onHistoricalPostReceived != null) {
                            onHistoricalPostReceived.accept(postMsg);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse historical post message", e);
                    }
                }
                ctx.fireChannelRead(msg);
            }

            @Override
            public void exceptionCaught(io.netty.channel.ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in post history stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class PostController {
        private final Stream stream;
        private final ObjectMapper mapper;

        public PostController(Stream stream, ObjectMapper mapper) {
            this.stream = stream;
            this.mapper = mapper;
        }

        public CompletableFuture<Void> send(ChatMessage message) {
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
