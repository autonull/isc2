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

import io.libp2p.core.crypto.PubKey;
import io.libp2p.core.crypto.KeyKt;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class ChatProtocol implements ProtocolBinding<ChatProtocol.ChatController> {
    private static final Logger log = LoggerFactory.getLogger(ChatProtocol.class);

    private final Consumer<ChatMessage> onMessageReceived;
    private final ObjectMapper mapper = network.isc.adapters.JsonUtils.createMapper();

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

        stream.pushHandler(new io.netty.handler.codec.LineBasedFrameDecoder(65536));
        stream.pushHandler(new io.netty.handler.codec.string.StringDecoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.handler.codec.string.StringEncoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof String str) {
                    try {
                        var chatMsg = mapper.readValue(str, ChatMessage.class);

                        // Verify signature
                        if (chatMsg.getSignature() != null && chatMsg.getPublicKey() != null) {
                            try {
                                var pubKey = KeyKt.unmarshalPublicKey(chatMsg.getPublicKey());
                                var rawPayload = (chatMsg.getChannelID() + chatMsg.getMsg() + chatMsg.getTimestamp()).getBytes(StandardCharsets.UTF_8);

                                if (pubKey.verify(rawPayload, chatMsg.getSignature())) {
                                    if (onMessageReceived != null) {
                                        onMessageReceived.accept(chatMsg);
                                    }
                                } else {
                                    log.warn("Signature verification failed for chat message in channel {}", chatMsg.getChannelID());
                                }
                            } catch (Exception ex) {
                                log.error("Error verifying signature", ex);
                            }
                        } else {
                            log.warn("Message missing signature or public key. Dropping.");
                        }

                    } catch (Exception e) {
                        log.warn("Failed to parse chat message", e);
                    }
                } else {
                    ctx.fireChannelRead(msg);
                }
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
                var json = mapper.writeValueAsString(message) + "\n";
                stream.writeAndFlush(json);
                cf.complete(null);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
            return cf;
        }

        public String getRemotePeerId() {
            return stream.getConnection().secureSession().getRemoteId().toBase58();
        }
    }
}
