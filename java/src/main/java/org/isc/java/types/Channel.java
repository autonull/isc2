package org.isc.java.types;

import java.util.Date;
import java.util.List;

/**
 * Represents a channel in the ISC system
 */
public class Channel {
    private String id;
    private String name;
    private String description;
    private Double spread;
    private List<Relation> relations;
    private Long createdAt;
    private Long updatedAt;
    private Boolean active;
    private List<Distribution> distributions;

    public Channel() {}

    public Channel(String id, String name, String description, Double spread, 
                   List<Relation> relations, Long createdAt, Long updatedAt, 
                   Boolean active, List<Distribution> distributions) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.spread = spread;
        this.relations = relations;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.active = active;
        this.distributions = distributions;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Double getSpread() {
        return spread;
    }

    public void setSpread(Double spread) {
        this.spread = spread;
    }

    public List<Relation> getRelations() {
        return relations;
    }

    public void setRelations(List<Relation> relations) {
        this.relations = relations;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public Long getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Long updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public List<Distribution> getDistributions() {
        return distributions;
    }

    public void setDistributions(List<Distribution> distributions) {
        this.distributions = distributions;
    }

    @Override
    public String toString() {
        return "Channel{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", description='" + description + '\'' +
                ", spread=" + spread +
                ", relations=" + relations +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                ", active=" + active +
                ", distributions=" + distributions +
                '}';
    }
}