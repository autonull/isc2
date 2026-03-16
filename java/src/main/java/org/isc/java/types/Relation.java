package org.isc.java.types;

/**
 * Represents a relation between a channel and a concept/tag
 */
public class Relation {
    private String tag;
    private String object;
    private Double weight;

    public Relation() {}

    public Relation(String tag, String object, Double weight) {
        this.tag = tag;
        this.object = object;
        this.weight = weight;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public String getObject() {
        return object;
    }

    public void setObject(String object) {
        this.object = object;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    @Override
    public String toString() {
        return "Relation{" +
                "tag='" + tag + '\'' +
                ", object='" + object + '\'' +
                ", weight=" + weight +
                '}';
    }
}