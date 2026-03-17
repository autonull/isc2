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

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class DirectMessageProtocol implements ProtocolBinding<DirectMessageProtocol.DMController> {
    private static final Logger log = LoggerFactory.getLogger(DirectMessageProtocol.class);

    private final Consumer<ChatMessage> onMessageReceived;
    private final ObjectMapper mapper = network.isc.adapters.JsonUtils.createMapper();

    public DirectMessageProtocol(Consumer<ChatMessage> onMessageReceived) {
        this.onMessageReceived = onMessageReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_DM);
    }

    @NotNull
    @Override
    public CompletableFuture<DMController> initChannel(@NotNull io.libp2p.core.P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<DMController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;

        String remotePeerId = stream.remotePeerId().toString();
        DMController controller = new DMController(stream, mapper, remotePeerId);

        stream.pushHandler(new io.netty.handler.codec.LineBasedFrameDecoder(65536));
        stream.pushHandler(new io.netty.handler.codec.string.StringDecoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.handler.codec.string.StringEncoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof String str) {
                    try {
                        var chatMsg = mapper.readValue(str, ChatMessage.class);
                        // Optional: Add signature verification here as well if needed
                        if (onMessageReceived != null) {
                            onMessageReceived.accept(chatMsg);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse DM message", e);
                    }
                } else {
                    ctx.fireChannelRead(msg);
                }
            }

            @Override
            public void exceptionCaught(io.netty.channel.ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in DM stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class DMController {
        private final Stream stream;
        private final ObjectMapper mapper;
        private final String remotePeerId;

        public DMController(Stream stream, ObjectMapper mapper, String remotePeerId) {
            this.stream = stream;
            this.mapper = mapper;
            this.remotePeerId = remotePeerId;
        }

        public String getRemotePeerId() {
            return remotePeerId;
        }

        public CompletableFuture<Void> send(ChatMessage message) {
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
