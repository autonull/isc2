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
    private final ObjectMapper mapper = new ObjectMapper();

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

        stream.pushHandler(new io.netty.channel.ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(io.netty.channel.ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof ByteBuf) {
                    ByteBuf buf = (ByteBuf) msg;
                    byte[] bytes = new byte[buf.readableBytes()];
                    buf.readBytes(bytes);

                    try {
                        String[] hashes = mapper.readValue(bytes, String[].class);
                        if (onQueryReceived != null) {
                            onQueryReceived.accept(hashes);
                        }
                    } catch (Exception e) {
                        log.warn("Failed to parse query hashes", e);
                    }
                }
                ctx.fireChannelRead(msg);
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
                byte[] bytes = mapper.writeValueAsBytes(hashes);
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
