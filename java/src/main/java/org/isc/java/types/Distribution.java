package org.isc.java.types;

import java.util.List;

/**
 * Represents a probability distribution for channel embeddings
 */
public class Distribution {
    private List<Double> mu;
    private Double sigma;
    private String tag;
    private Double weight;

    public Distribution() {}

    public Distribution(List<Double> mu, Double sigma) {
        this.mu = mu;
        this.sigma = sigma;
    }

    public Distribution(List<Double> mu, Double sigma, String tag, Double weight) {
        this.mu = mu;
        this.sigma = sigma;
        this.tag = tag;
        this.weight = weight;
    }

    public List<Double> getMu() {
        return mu;
    }

    public void setMu(List<Double> mu) {
        this.mu = mu;
    }

    public Double getSigma() {
        return sigma;
    }

    public void setSigma(Double sigma) {
        this.sigma = sigma;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    @Override
    public String toString() {
        return "Distribution{" +
                "mu=" + mu +
                ", sigma=" + sigma +
                ", tag='" + tag + '\'' +
                ", weight=" + weight +
                '}';
    }
}