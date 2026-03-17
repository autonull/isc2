package network.isc.core;

import java.util.ArrayList;
import java.util.List;

public class SemanticMath {

    public static double cosineSimilarity(float[] a, float[] b) {
        if (a.length != b.length) {
            throw new IllegalArgumentException("Vectors must be of same length");
        }
        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;
        for (int i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        if (normA == 0.0 || normB == 0.0) return 0.0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    // Bipartite alignment relational match (simplified greedy for Java MVP)
    public static double relationalMatch(List<Distribution> myDists, List<Distribution> peerDists) {
        if (myDists.isEmpty() || peerDists.isEmpty()) return 0.0;

        // Root vs Root match
        var myRoot = myDists.get(0);
        var peerRoot = peerDists.get(0);
        var rootSim = cosineSimilarity(myRoot.mu(), peerRoot.mu());

        if (myDists.size() == 1 || peerDists.size() == 1) {
            return rootSim;
        }

        // Simplification for Java: average matching relations
        var sumSim = rootSim;
        var matches = 1;

        for (int i = 1; i < myDists.size(); i++) {
            var myRel = myDists.get(i);
            Distribution bestMatch = null;
            var bestSim = 0.0;

            for (int j = 1; j < peerDists.size(); j++) {
                var peerRel = peerDists.get(j);
                if (myRel.tag().equals(peerRel.tag())) {
                    var sim = cosineSimilarity(myRel.mu(), peerRel.mu());
                    if (sim > bestSim) {
                        bestSim = sim;
                        bestMatch = peerRel;
                    }
                }
            }
            if (bestMatch != null) {
                sumSim += bestSim;
                matches++;
            }
        }

        return sumSim / matches;
    }

    public static List<String> lshHash(float[] vec, String seed, int numHashes) {
        return lshHashTsCompatible(vec, seed, numHashes, 32);
    }

    public static List<String> lshHashTsCompatible(float[] vec, String seed, int numHashes, int hashLen) {
        var hashes = new ArrayList<String>(numHashes);
        var rng = new Mulberry32Rng(seed);

        for (int i = 0; i < numHashes; i++) {
            var hashBits = new StringBuilder();
            for (int h = 0; h < hashLen; h++) {
                var proj = generateRandomProjection(vec.length, rng);
                var dotProduct = 0.0;
                for (int j = 0; j < vec.length; j++) {
                    dotProduct += vec[j] * proj[j];
                }
                hashBits.append(dotProduct >= 0 ? '1' : '0');
            }
            hashes.add(hashBits.toString());
        }
        return hashes;
    }

    public static List<String> lshHashLegacy(float[] vec, String seed, int numHashes) {
        var hashes = new ArrayList<String>(numHashes);
        var rng = new SeededRng(seed);
        var hashLen = 32;

        for (int i = 0; i < numHashes; i++) {
            var hashBits = new StringBuilder();
            for (int h = 0; h < hashLen; h++) {
                var proj = new float[vec.length];
                for (int j = 0; j < vec.length; j++) {
                    proj[j] = (float) (rng.next() * 2 - 1);
                }

                var dotProduct = 0.0;
                for (int j = 0; j < vec.length; j++) {
                    dotProduct += vec[j] * proj[j];
                }
                hashBits.append(dotProduct > 0 ? '1' : '0');
            }
            hashes.add(hashBits.toString());
        }
        return hashes;
    }

    private static float[] generateRandomProjection(int dimensions, Mulberry32Rng rng) {
        var vec = new float[dimensions];
        var sumSq = 0.0;

        for (int i = 0; i < dimensions; i++) {
            var u1 = rng.next();
            if (u1 == 0.0) {
                u1 = 1e-10;
            }
            var u2 = rng.next();

            var z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            vec[i] = (float) z;
            sumSq += z * z;
        }

        var norm = Math.sqrt(sumSq);
        for (int i = 0; i < dimensions; i++) {
            vec[i] /= (float) norm;
        }
        return vec;
    }

    private static class Mulberry32Rng {
        private int state;

        public Mulberry32Rng(String seed) {
            this.state = fnv1aHash(seed);
        }

        private int fnv1aHash(String str) {
            int hash = 0x811c9dc5;
            for (int i = 0; i < str.length(); i++) {
                hash ^= str.charAt(i);
                // Math.imul equivalent
                hash = hash * 0x01000193;
            }
            return hash;
        }

        public double next() {
            state = (state + 0x6d2b79f5);
            int t = state ^ (state >>> 15);
            t = t * (1 | state);
            t = (t + ((t ^ (t >>> 7)) * (61 | t))) ^ t;
            long unsignedT = (t ^ (t >>> 14)) & 0xFFFFFFFFL;
            return (double) unsignedT / 4294967296.0;
        }
    }

    private static class SeededRng {
        private int state;

        public SeededRng(String seed) {
            int hash = 0;
            for (int i = 0; i < seed.length(); i++) {
                char ch = seed.charAt(i);
                hash = ((hash << 5) - hash) + ch;
                hash = hash & hash;
            }
            this.state = Math.abs(hash);
            // warm up
            next();
        }

        public double next() {
            long st = (long) state;
            st = (st * 1103515245L + 12345L) & 0x7fffffffL;
            state = (int) st;
            return (double) state / 0x7fffffffL;
        }
    }
}
