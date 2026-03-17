package network.isc.core;

import java.util.Arrays;

public record Distribution(float[] mu, double sigma, String tag) {
    public Distribution {
        mu = Arrays.copyOf(mu, mu.length);
    }

    @Override
    public float[] mu() {
        return Arrays.copyOf(mu, mu.length);
    }

    // Keep legacy getters for backwards compatibility if needed
    public float[] getMu() { return mu(); }
    public double getSigma() { return sigma; }
    public String getTag() { return tag; }
}
