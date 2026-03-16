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

public class ChatProtocol implements ProtocolBinding<ChatProtocol.ChatController> {
    private static final Logger log = LoggerFactory.getLogger(ChatProtocol.class);

    private final Consumer<ChatMessage> onMessageReceived;
    private final ObjectMapper mapper = new ObjectMapper();

    public ChatProtocol(Consumer<ChatMessage> onMessageReceived) {
        this.onMessageReceived = onMessageReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_CHAT);
    }

    @NotNull
    @Override
    public CompletableFuture<ChatController> initChannel(@NotNull io.libp2p.core.P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<ChatController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        ChatController controller = new ChatController(stream, mapper);

        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof ByteBuf) {
                    ByteBuf buf = (ByteBuf) msg;
                    byte[] bytes = new byte[buf.readableBytes()];
                    buf.readBytes(bytes);

                    try {
                        ChatMessage chatMsg = mapper.readValue(bytes, ChatMessage.class);
                        if (onMessageReceived != null) {
                            onMessageReceived.accept(chatMsg);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse chat message", e);
                    }
                }
                ctx.fireChannelRead(msg);
            }

            @Override
            public void exceptionCaught(io.netty.channel.ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in chat stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class ChatController {
        private final Stream stream;
        private final ObjectMapper mapper;

        public ChatController(Stream stream, ObjectMapper mapper) {
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
