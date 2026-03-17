package network.isc.adapters;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

import java.io.IOException;

public class Uint8ArraySerializer extends StdSerializer<byte[]> {

    public Uint8ArraySerializer() {
        this(null);
    }

    public Uint8ArraySerializer(Class<byte[]> t) {
        super(t);
    }

    @Override
    public void serialize(byte[] value, JsonGenerator gen, SerializerProvider provider) throws IOException {
        gen.writeStartObject();
        gen.writeStringField("__type", "Uint8Array");
        gen.writeArrayFieldStart("data");
        for (byte b : value) {
            gen.writeNumber(b & 0xFF); // write as unsigned integer 0-255
        }
        gen.writeEndArray();
        gen.writeEndObject();
    }
}
