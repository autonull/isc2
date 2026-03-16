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
        Distribution myRoot = myDists.get(0);
        Distribution peerRoot = peerDists.get(0);
        double rootSim = cosineSimilarity(myRoot.getMu(), peerRoot.getMu());

        if (myDists.size() == 1 || peerDists.size() == 1) {
            return rootSim;
        }

        // Simplification for Java: average matching relations
        double sumSim = rootSim;
        int matches = 1;

        for (int i = 1; i < myDists.size(); i++) {
            Distribution myRel = myDists.get(i);
            Distribution bestMatch = null;
            double bestSim = 0.0;

            for (int j = 1; j < peerDists.size(); j++) {
                Distribution peerRel = peerDists.get(j);
                if (myRel.getTag().equals(peerRel.getTag())) {
                    double sim = cosineSimilarity(myRel.getMu(), peerRel.getMu());
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
        List<String> hashes = new ArrayList<>(numHashes);
        SeededRng rng = new SeededRng(seed);
        int hashLen = 32;

        for (int i = 0; i < numHashes; i++) {
            StringBuilder hashBits = new StringBuilder();
            for (int h = 0; h < hashLen; h++) {
                float[] proj = new float[vec.length];
                for (int j = 0; j < vec.length; j++) {
                    proj[j] = (float) (rng.next() * 2 - 1);
                }

                double dotProduct = 0.0;
                for (int j = 0; j < vec.length; j++) {
                    dotProduct += vec[j] * proj[j];
                }
                hashBits.append(dotProduct > 0 ? '1' : '0');
            }
            hashes.add(hashBits.toString());
        }
        return hashes;
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
