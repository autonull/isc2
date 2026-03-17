package network.isc.protocol;

import io.libp2p.core.P2PChannel;
import io.libp2p.core.Stream;
import io.libp2p.core.multistream.ProtocolBinding;
import io.libp2p.core.multistream.ProtocolDescriptor;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.LineBasedFrameDecoder;
import io.netty.handler.codec.string.StringDecoder;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import network.isc.core.LikeEvent;
import network.isc.core.RepostEvent;
import network.isc.core.FollowEvent;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public class SocialProtocol implements ProtocolBinding<SocialProtocol.SocialController> {
    private static final Logger log = LoggerFactory.getLogger(SocialProtocol.class);

    private final Consumer<Object> onSocialEventReceived;
    private final ObjectMapper mapper = network.isc.adapters.JsonUtils.createMapper();

    public SocialProtocol(Consumer<Object> onSocialEventReceived) {
        this.onSocialEventReceived = onSocialEventReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_SOCIAL);
    }

    @NotNull
    @Override
    public CompletableFuture<SocialController> initChannel(@NotNull P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<SocialController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        SocialController controller = new SocialController(stream, mapper);

        // Add line-based framing to prevent JSON coalescing/fragmentation
        stream.pushHandler(new LineBasedFrameDecoder(65536));
        stream.pushHandler(new StringDecoder(StandardCharsets.UTF_8));

        stream.pushHandler(new ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof String) {
                    String jsonString = (String) msg;

                    if (onSocialEventReceived != null) {
                        try {
                            // Support TS-encoded objects. In TS, Uint8Arrays are encoded as:
                            // { "__type": "Uint8Array", "data": [1, 2, 3] }
                            // Jackson will handle most of this naturally if signature maps to byte[] or JsonNode.
                            JsonNode node = mapper.readTree(jsonString);

                            // Naive type inference based on unique properties from TS definitions
                            Object parsedEvent = null;
                            if (node.has("liker") && node.has("postID")) {
                                parsedEvent = mapper.treeToValue(node, LikeEvent.class);
                            } else if (node.has("reposter") && node.has("postID")) {
                                parsedEvent = mapper.treeToValue(node, RepostEvent.class);
                            } else if (node.has("follower") && node.has("followee")) {
                                parsedEvent = mapper.treeToValue(node, FollowEvent.class);
                            } else {
                                log.warn("Unknown social event received over /isc/social/1.0");
                            }

                            if (parsedEvent != null) {
                                onSocialEventReceived.accept(parsedEvent);
                            }
                        } catch (Exception e) {
                            log.error("Error parsing social event", e);
                        }
                    }
                }
                ctx.fireChannelRead(msg);
            }

            @Override
            public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in social stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class SocialController {
        private final Stream stream;
        private final ObjectMapper mapper;

        public SocialController(Stream stream, ObjectMapper mapper) {
            this.stream = stream;
            this.mapper = mapper;
        }

        public Stream getStream() {
            return stream;
        }

        public CompletableFuture<Void> send(Object event) {
            CompletableFuture<Void> cf = new CompletableFuture<>();
            try {
                // We serialize the POJO to JSON and append a newline for framing.
                // Note: The TS implementation expects JSON for these objects.
                // Any `byte[]` in Java (like signature) will be serialized as Base64 by Jackson by default.
                String jsonStr = mapper.writeValueAsString(event);
                byte[] bytes = (jsonStr + "\n").getBytes(StandardCharsets.UTF_8);
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
