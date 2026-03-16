package network.isc.protocol;

import io.libp2p.core.Stream;
import io.libp2p.core.multistream.ProtocolBinding;
import io.libp2p.core.multistream.ProtocolDescriptor;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class ChatProtocol implements ProtocolBinding<ChatProtocol.ChatController> {
    private static final Logger log = LoggerFactory.getLogger(ChatProtocol.class);

    private final Consumer<String> onMessageReceived;

    public ChatProtocol(Consumer<String> onMessageReceived) {
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
        ChatController controller = new ChatController(stream);

        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof ByteBuf) {
                    ByteBuf buf = (ByteBuf) msg;
                    byte[] bytes = new byte[buf.readableBytes()];
                    buf.readBytes(bytes);
                    String message = new String(bytes, StandardCharsets.UTF_8);

                    if (onMessageReceived != null) {
                        onMessageReceived.accept(message);
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

        public ChatController(Stream stream) {
            this.stream = stream;
        }

        public CompletableFuture<Void> send(String message) {
            byte[] bytes = message.getBytes(StandardCharsets.UTF_8);
            ByteBuf buf = Unpooled.wrappedBuffer(bytes);

            CompletableFuture<Void> cf = new CompletableFuture<>();
            stream.writeAndFlush(buf);
            // simplify since return of writeAndFlush in libp2p Stream is void
            cf.complete(null);
            return cf;
        }
    }
}
