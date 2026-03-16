package network.isc.core;

import org.junit.jupiter.api.Test;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;

class SemanticMathTest {

    @Test
    void testCosineSimilarity_Identical() {
        float[] v1 = {1.0f, 2.0f, 3.0f};
        float[] v2 = {1.0f, 2.0f, 3.0f};

        double sim = SemanticMath.cosineSimilarity(v1, v2);
        assertEquals(1.0, sim, 0.0001, "Identical vectors should have similarity of 1.0");
    }

    @Test
    void testCosineSimilarity_Orthogonal() {
        float[] v1 = {1.0f, 0.0f};
        float[] v2 = {0.0f, 1.0f};

        double sim = SemanticMath.cosineSimilarity(v1, v2);
        assertEquals(0.0, sim, 0.0001, "Orthogonal vectors should have similarity of 0.0");
    }

    @Test
    void testCosineSimilarity_Opposite() {
        float[] v1 = {1.0f, 2.0f};
        float[] v2 = {-1.0f, -2.0f};

        double sim = SemanticMath.cosineSimilarity(v1, v2);
        assertEquals(-1.0, sim, 0.0001, "Opposite vectors should have similarity of -1.0");
    }

    @Test
    void testLshHash_Deterministic() {
        float[] v1 = {0.5f, -0.2f, 0.8f, -0.9f};
        String seed = "test-model-v1";

        List<String> hashes1 = SemanticMath.lshHash(v1, seed, 3);
        List<String> hashes2 = SemanticMath.lshHash(v1, seed, 3);

        assertEquals(3, hashes1.size(), "Should return requested number of hashes");
        assertEquals(hashes1, hashes2, "Same vector and seed should produce identical hashes");
    }
}
