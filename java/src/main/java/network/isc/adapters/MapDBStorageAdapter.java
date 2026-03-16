package network.isc.adapters;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import network.isc.core.Channel;
import org.mapdb.DB;
import org.mapdb.DBMaker;
import org.mapdb.Serializer;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentMap;

public class MapDBStorageAdapter extends StorageAdapter {

    private final DB db;
    private final ConcurrentMap<String, String> map;
    private final ObjectMapper mapper;
    private static final String CHANNELS_KEY = "channels";

    public MapDBStorageAdapter(String filepath) {
        // Call super with a dummy filepath to maintain compatibility if StorageAdapter is a concrete class.
        // It's better to make StorageAdapter an interface, but we don't want to break other things unnecessarily.
        super(filepath);
        File dbFile = new File(filepath);
        if (!dbFile.getParentFile().exists()) {
            dbFile.getParentFile().mkdirs();
        }

        db = DBMaker.fileDB(dbFile)
                .transactionEnable()
                .closeOnJvmShutdown()
                .make();

        map = db.hashMap("isc_data", Serializer.STRING, Serializer.STRING).createOrOpen();
        mapper = new ObjectMapper();
    }

    @Override
    public List<Channel> loadChannels() {
        String json = map.get(CHANNELS_KEY);
        if (json == null || json.isEmpty()) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(json, new TypeReference<List<Channel>>() {});
        } catch (JsonProcessingException e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    @Override
    public void saveChannels(List<Channel> channels) {
        try {
            String json = mapper.writeValueAsString(channels);
            map.put(CHANNELS_KEY, json);
            db.commit();
        } catch (JsonProcessingException e) {
            e.printStackTrace();
        }
    }

    public void close() {
        if (db != null && !db.isClosed()) {
            db.close();
        }
    }
}
