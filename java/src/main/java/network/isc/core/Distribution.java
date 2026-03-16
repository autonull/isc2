package network.isc.core;

import java.util.Arrays;

public class Distribution {
    private final float[] mu;
    private final double sigma;
    private final String tag;

    public Distribution(float[] mu, double sigma, String tag) {
        this.mu = Arrays.copyOf(mu, mu.length);
        this.sigma = sigma;
        this.tag = tag;
    }

    public float[] getMu() { return Arrays.copyOf(mu, mu.length); }
    public double getSigma() { return sigma; }
    public String getTag() { return tag; }
}
