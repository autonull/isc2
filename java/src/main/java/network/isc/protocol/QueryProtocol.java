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

// In a real network, this replaces DHT gets. Clients send an array of LSH hashes,
// and the receiver responds with known announcements that match those hashes.
public class QueryProtocol implements ProtocolBinding<QueryProtocol.QueryController> {
    private static final Logger log = LoggerFactory.getLogger(QueryProtocol.class);

    private final Consumer<String[]> onQueryReceived;
    private final ObjectMapper mapper = network.isc.adapters.JsonUtils.createMapper();

    public QueryProtocol(Consumer<String[]> onQueryReceived) {
        this.onQueryReceived = onQueryReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_QUERY);
    }

    @NotNull
    @Override
    public CompletableFuture<QueryController> initChannel(@NotNull io.libp2p.core.P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<QueryController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        QueryController controller = new QueryController(stream, mapper);

        stream.pushHandler(new io.netty.handler.codec.LineBasedFrameDecoder(65536));
        stream.pushHandler(new io.netty.handler.codec.string.StringDecoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.handler.codec.string.StringEncoder(StandardCharsets.UTF_8));
        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof String str) {
                    try {
                        var hashes = mapper.readValue(str, String[].class);
                        if (onQueryReceived != null) {
                            onQueryReceived.accept(hashes);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse query hashes", e);
                    }
                } else {
                    ctx.fireChannelRead(msg);
                }
            }

            @Override
            public void exceptionCaught(io.netty.channel.ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in query stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class QueryController {
        private final Stream stream;
        private final ObjectMapper mapper;

        public QueryController(Stream stream, ObjectMapper mapper) {
            this.stream = stream;
            this.mapper = mapper;
        }

        public CompletableFuture<Void> send(String[] hashes) {
            CompletableFuture<Void> cf = new CompletableFuture<>();
            try {
                var json = mapper.writeValueAsString(hashes) + "\n";
                stream.writeAndFlush(json);
                cf.complete(null);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
            return cf;
        }
    }
}
