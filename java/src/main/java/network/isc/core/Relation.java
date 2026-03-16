package network.isc.core;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Objects;

public class Relation {
    private final String tag;
    private final String object;
    private final double weight;

    @JsonCreator
    public Relation(@JsonProperty("tag") String tag,
                    @JsonProperty("object") String object,
                    @JsonProperty("weight") Double weight) {
        this.tag = tag;
        this.object = object;
        this.weight = weight != null ? weight : 1.0;
    }

    public String getTag() { return tag; }
    public String getObject() { return object; }
    public double getWeight() { return weight; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Relation relation = (Relation) o;
        return Double.compare(relation.weight, weight) == 0 &&
                Objects.equals(tag, relation.tag) &&
                Objects.equals(object, relation.object);
    }

    @Override
    public int hashCode() {
        return Objects.hash(tag, object, weight);
    }
}
