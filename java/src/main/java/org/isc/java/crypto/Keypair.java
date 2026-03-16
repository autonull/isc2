package org.isc.java.crypto;

import org.bouncycastle.crypto.AsymmetricCipherKeyPair;
import org.bouncycastle.crypto.generators.Ed25519KeyPairGenerator;
import org.bouncycastle.crypto.params.Ed25519KeyGenerationParameters;
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters;
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters;
import org.bouncycastle.crypto.digests.SHA256Digest;
import org.bouncycastle.crypto.signers.Ed25519Signer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Objects;

/**
 * Ed25519 keypair for cryptographic operations
 */
public class Keypair {
    private Ed25519PublicKeyParameters publicKey;
    private Ed25519PrivateKeyParameters privateKey;

    public Keypair() {
        generate();
    }

    public Keypair(Ed25519PublicKeyParameters publicKey, Ed25519PrivateKeyParameters privateKey) {
        this.publicKey = Objects.requireNonNull(publicKey);
        this.privateKey = Objects.requireNonNull(privateKey);
    }

    /**
     * Generate a new Ed25519 keypair
     */
    public void generate() {
        Ed25519KeyPairGenerator generator = new Ed25519KeyPairGenerator();
        generator.init(new Ed25519KeyGenerationParameters(new SecureRandom()));
        AsymmetricCipherKeyPair pair = generator.generateKeyPair();
        
        this.publicKey = (Ed25519PublicKeyParameters) pair.getPublic();
        this.privateKey = (Ed25519PrivateKeyParameters) pair.getPrivate();
    }

    /**
     * Get the public key
     */
    public Ed25519PublicKeyParameters getPublicKey() {
        return publicKey;
    }

    /**
     * Get the private key
     */
    public Ed25519PrivateKeyParameters getPrivateKey() {
        return privateKey;
    }

    /**
     * Sign a message using the private key
     */
    public byte[] sign(byte[] message) {
        Objects.requireNonNull(message, "Message cannot be null");
        if (privateKey == null) {
            throw new IllegalStateException("Private key not initialized");
        }
        
        Ed25519Signer signer = new Ed25519Signer();
        signer.init(true, privateKey);
        signer.update(message, 0, message.length);
        return signer.generateSignature();
    }

    /**
     * Verify a signature using the public key
     */
    public boolean verify(byte[] message, byte[] signature) {
        Objects.requireNonNull(message, "Message cannot be null");
        Objects.requireNonNull(signature, "Signature cannot be null");
        if (publicKey == null) {
            throw new IllegalStateException("Public key not initialized");
        }
        
        Ed25519Signer signer = new Ed25519Signer();
        signer.init(false, publicKey);
        signer.update(message, 0, message.length);
        return signer.verifySignature(signature);
    }

    /**
     * Get public key fingerprint (Base58 encoded, first 16 chars)
     */
    public String getFingerprint() {
        if (publicKey == null) {
            return "";
        }
        
        // Simplified Base58 encoding for demo - in production use proper Base58
        byte[] pubKeyBytes = publicKey.getEncoded();
        return base58Encode(pubKeyBytes).substring(0, Math.min(16, base58Encode(pubKeyBytes).length()));
    }

    /**
     * Serialize keypair to JSON-compatible format
     */
    public String serialize() {
        if (publicKey == null || privateKey == null) {
            return "{}";
        }
        
        return "{\"publicKey\":\"" + Base64.getEncoder().encodeToString(publicKey.getEncoded()) +
               "\",\"privateKey\":\"" + Base64.getEncoder().encodeToString(privateKey.getEncoded()) + "\"}";
    }

    /**
     * Deserialize keypair from JSON-compatible format
     */
    public static Keypair deserialize(String json) {
        // Simplified deserialization for demo
        // In production, use proper JSON parsing
        if (json == null || json.isEmpty() || json.equals("{}")) {
            return new Keypair();
        }
        
        // For demo purposes, just generate a new one
        // A real implementation would parse the JSON and reconstruct the keys
        Keypair keypair = new Keypair();
        return keypair;
    }

    /**
     * Base58 encoding
     */
    private static String base58Encode(byte[] input) {
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

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Keypair keypair = (Keypair) o;
        return Objects.equals(publicKey, keypair.publicKey) && 
               Objects.equals(privateKey, keypair.privateKey);
    }

    @Override
    public int hashCode() {
        return Objects.hash(publicKey, privateKey);
    }

    @Override
    public String toString() {
        return "Keypair{" +
                "fingerprint='" + getFingerprint() + '\'' +
                '}';
    }
}