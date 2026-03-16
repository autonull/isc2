package network.isc.core;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

public class Channel {
    private final String id;
    private final String name;
    private final String description;
    private final double spread;
    private final List<Relation> relations;
    private final long createdAt;
    private final long updatedAt;
    private final boolean isGroup;
    private final List<String> groupPeers;

    @JsonCreator
    public Channel(@JsonProperty("id") String id,
                   @JsonProperty("name") String name,
                   @JsonProperty("description") String description,
                   @JsonProperty("spread") Double spread,
                   @JsonProperty("relations") List<Relation> relations,
                   @JsonProperty("createdAt") Long createdAt,
                   @JsonProperty("updatedAt") Long updatedAt,
                   @JsonProperty("isGroup") Boolean isGroup,
                   @JsonProperty("groupPeers") List<String> groupPeers) {
        this.id = id != null ? id : "ch_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        this.name = name;
        this.description = description;
        this.spread = spread != null ? spread : 0.15;
        this.relations = relations != null ? new ArrayList<>(relations) : new ArrayList<>();
        long now = System.currentTimeMillis();
        this.createdAt = createdAt != null ? createdAt : now;
        this.updatedAt = updatedAt != null ? updatedAt : now;
        this.isGroup = isGroup != null ? isGroup : false;
        this.groupPeers = groupPeers != null ? new ArrayList<>(groupPeers) : new ArrayList<>();
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public double getSpread() { return spread; }
    public List<Relation> getRelations() { return new ArrayList<>(relations); }
    public long getCreatedAt() { return createdAt; }
    public long getUpdatedAt() { return updatedAt; }
    public boolean isGroup() { return isGroup; }
    public List<String> getGroupPeers() { return new ArrayList<>(groupPeers); }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Channel channel = (Channel) o;
        return Double.compare(channel.spread, spread) == 0 &&
                createdAt == channel.createdAt &&
                updatedAt == channel.updatedAt &&
                Objects.equals(id, channel.id) &&
                Objects.equals(name, channel.name) &&
                Objects.equals(description, channel.description) &&
                Objects.equals(relations, channel.relations) &&
                isGroup == channel.isGroup &&
                Objects.equals(groupPeers, channel.groupPeers);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, name, description, spread, relations, createdAt, updatedAt, isGroup, groupPeers);
    }
}
