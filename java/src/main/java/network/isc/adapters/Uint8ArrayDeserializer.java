package network.isc.adapters;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;

public class Uint8ArrayDeserializer extends StdDeserializer<byte[]> {

    public Uint8ArrayDeserializer() {
        this(null);
    }

    public Uint8ArrayDeserializer(Class<?> vc) {
        super(vc);
    }

    @Override
    public byte[] deserialize(JsonParser jp, DeserializationContext ctxt)
            throws IOException, JsonProcessingException {
        JsonNode node = jp.getCodec().readTree(jp);

        if (node.isObject() && node.has("__type") && "Uint8Array".equals(node.get("__type").asText())) {
            JsonNode dataNode = node.get("data");
            if (dataNode != null && dataNode.isArray()) {
                byte[] bytes = new byte[dataNode.size()];
                for (int i = 0; i < dataNode.size(); i++) {
                    bytes[i] = (byte) dataNode.get(i).asInt();
                }
                return bytes;
            }
        } else if (node.isBinary()) {
            return node.binaryValue();
        } else if (node.isTextual()) {
            // Jackson default is Base64 for byte arrays
            try {
                 return node.binaryValue();
            } catch (Exception e) {
                 return node.asText().getBytes(); // Fallback
            }
        }
        return null;
    }
}
