package org.isc.java.util;

import com.google.gson.*;
import java.lang.reflect.Type;
import java.util.Base64;
import java.math.BigInteger;

/**
 * Encoding utilities for JSON serialization with byte array support
 * Similar to the TypeScript @isc/encoding functionality
 */
public class Encoding {

    private static final Gson GSON = new GsonBuilder()
            .registerTypeAdapter(byte[].class, new ByteArraySerializer())
            .registerTypeAdapter(byte[].class, new ByteArrayDeserializer())
            .create();

    /**
     * Encode an object to JSON bytes
     */
    public static byte[] encode(Object obj) {
        String json = GSON.toJson(obj);
        return json.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * Decode JSON bytes to an object
     */
    public static Object decode(byte[] data) {
        String json = new String(data, java.nio.charset.StandardCharsets.UTF_8);
        return GSON.fromJson(json, Object.class);
    }

    /**
     * Decode JSON bytes to a specific class type
     */
    public static <T> T decodeAs(byte[] data, Class<T> clazz) {
        String json = new String(data, java.nio.charset.StandardCharsets.UTF_8);
        return GSON.fromJson(json, clazz);
    }

    /**
     * Encode a string to bytes
     */
    public static byte[] encodeString(String str) {
        return str.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * Decode bytes to a string
     */
    public static String decodeString(byte[] data) {
        return new String(data, java.nio.charset.StandardCharsets.UTF_8);
    }

    /**
     * Generate a UUID-like string (simplified)
     */
    public static String generateUUID() {
        return java.util.UUID.randomUUID().toString();
    }

    /**
     * Base58 encoding (used for key fingerprints)
     */
    public static String base58Encode(byte[] input) {
        final char[] ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".toCharArray();
        
        BigInteger bi = new BigInteger(1, input);
        StringBuilder sb = new StringBuilder();
        
        // Count leading zeros
        int leadingZeros = 0;
        for (byte b : input) {
            if (b == 0) {
                leadingZeros++;
            } else {
                break;
            }
        }
        
        while (bi.compareTo(BigInteger.ZERO) > 0) {
            BigInteger[] results = bi.divideAndRemainder(BigInteger.valueOf(58));
            bi = results[0];
            int remainder = results[1].intValue();
            sb.insert(0, ALPHABET[remainder]);
        }
        
        for (int i = 0; i < leadingZeros; i++) {
            sb.insert(0, '1');
        }
        
        return sb.toString();
    }

    /**
     * Serializer for byte arrays to Base64 strings
     */
    private static class ByteArraySerializer implements JsonSerializer<byte[]> {
        @Override
        public JsonElement serialize(byte[] src, Type typeOfSrc, JsonSerializationContext context) {
            return new JsonPrimitive(Base64.getEncoder().encodeToString(src));
        }
    }

    /**
     * Deserializer for Base64 strings to byte arrays
     */
    private static class ByteArrayDeserializer implements JsonDeserializer<byte[]> {
        @Override
        public byte[] deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context) throws JsonParseException {
            return Base64.getDecoder().decode(json.getAsString());
        }
    }
}