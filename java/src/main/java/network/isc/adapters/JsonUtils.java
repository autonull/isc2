package network.isc.adapters;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;

public class JsonUtils {
    public static ObjectMapper createMapper() {
        ObjectMapper mapper = new ObjectMapper();
        SimpleModule module = new SimpleModule();
        module.addSerializer(byte[].class, new Uint8ArraySerializer());
        module.addDeserializer(byte[].class, new Uint8ArrayDeserializer());
        mapper.registerModule(module);
        return mapper;
    }
}
