package network.isc.protocol;

import io.libp2p.core.P2PChannel;
import io.libp2p.core.Stream;
import io.libp2p.core.multistream.ProtocolBinding;
import io.libp2p.core.multistream.ProtocolDescriptor;
import io.netty.buffer.ByteBuf;
import io.netty.buffer.Unpooled;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInboundHandlerAdapter;
import io.netty.handler.codec.LengthFieldBasedFrameDecoder;
import io.netty.handler.codec.LengthFieldPrepender;
import org.jetbrains.annotations.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;

public class FileProtocol implements ProtocolBinding<FileProtocol.FileController> {
    private static final Logger log = LoggerFactory.getLogger(FileProtocol.class);

    // Callback when file chunks are received.
    // The first argument is the Stream so we know who sent it and can reply if needed
    // The second argument is the byte[] chunk
    private final BiConsumer<Stream, byte[]> onChunkReceived;

    public FileProtocol(BiConsumer<Stream, byte[]> onChunkReceived) {
        this.onChunkReceived = onChunkReceived;
    }

    @NotNull
    @Override
    public ProtocolDescriptor getProtocolDescriptor() {
        return new ProtocolDescriptor(ProtocolConstants.PROTOCOL_FILE);
    }

    @NotNull
    @Override
    public CompletableFuture<FileController> initChannel(@NotNull P2PChannel ch, @NotNull String selectedProtocol) {
        CompletableFuture<FileController> future = new CompletableFuture<>();
        Stream stream = (Stream) ch;
        FileController controller = new FileController(stream);

        // Max frame size: 10MB, length field offset: 0, length field bytes: 4
        stream.pushHandler(new LengthFieldBasedFrameDecoder(10 * 1024 * 1024, 0, 4, 0, 4));
        stream.pushHandler(new LengthFieldPrepender(4));

        stream.pushHandler(new ChannelInboundHandlerAdapter() {
            @Override
            public void channelRead(ChannelHandlerContext ctx, Object msg) {
                if (msg instanceof ByteBuf) {
                    ByteBuf buf = (ByteBuf) msg;
                    byte[] bytes = new byte[buf.readableBytes()];
                    buf.readBytes(bytes);

                    if (onChunkReceived != null) {
                        try {
                            onChunkReceived.accept(stream, bytes);
                        } catch (Exception e) {
                            log.error("Error processing file chunk", e);
                        }
                    }
                }
                ctx.fireChannelRead(msg);
            }

            @Override
            public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) {
                log.error("Error in file stream", cause);
                ctx.close();
            }
        });

        future.complete(controller);
        return future;
    }

    public static class FileController {
        private final Stream stream;

        public FileController(Stream stream) {
            this.stream = stream;
        }

        public Stream getStream() {
            return stream;
        }

        public CompletableFuture<Void> send(byte[] chunk) {
            CompletableFuture<Void> cf = new CompletableFuture<>();
            try {
                ByteBuf buf = Unpooled.wrappedBuffer(chunk);
                stream.writeAndFlush(buf);
                cf.complete(null);
            } catch (Exception e) {
                cf.completeExceptionally(e);
            }
            return cf;
        }
    }
}
