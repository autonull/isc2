package network.isc.core;

import org.bouncycastle.crypto.AsymmetricCipherKeyPair;
import org.bouncycastle.crypto.generators.Ed25519KeyPairGenerator;
import org.bouncycastle.crypto.params.Ed25519KeyGenerationParameters;
import org.bouncycastle.crypto.params.Ed25519PrivateKeyParameters;
import org.bouncycastle.crypto.params.Ed25519PublicKeyParameters;
import org.bouncycastle.crypto.signers.Ed25519Signer;

import java.security.SecureRandom;

public class CryptoUtils {

    public static class Keypair {
        public final Ed25519PrivateKeyParameters privateKey;
        public final Ed25519PublicKeyParameters publicKey;

        public Keypair(Ed25519PrivateKeyParameters privateKey, Ed25519PublicKeyParameters publicKey) {
            this.privateKey = privateKey;
            this.publicKey = publicKey;
        }
    }

    public static Keypair generateKeypair() {
        Ed25519KeyPairGenerator keyPairGenerator = new Ed25519KeyPairGenerator();
        keyPairGenerator.init(new Ed25519KeyGenerationParameters(new SecureRandom()));
        AsymmetricCipherKeyPair kp = keyPairGenerator.generateKeyPair();
        return new Keypair(
            (Ed25519PrivateKeyParameters) kp.getPrivate(),
            (Ed25519PublicKeyParameters) kp.getPublic()
        );
    }

    public static byte[] sign(byte[] message, Ed25519PrivateKeyParameters privateKey) {
        Ed25519Signer signer = new Ed25519Signer();
        signer.init(true, privateKey);
        signer.update(message, 0, message.length);
        return signer.generateSignature();
    }

    public static boolean verify(byte[] message, byte[] signature, Ed25519PublicKeyParameters publicKey) {
        Ed25519Signer signer = new Ed25519Signer();
        signer.init(false, publicKey);
        signer.update(message, 0, message.length);
        return signer.verifySignature(signature);
    }
}
