package network.isc.adapters;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import network.isc.core.Channel;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class StorageAdapter {
    protected final File storageFile;
    protected final ObjectMapper mapper;

    public StorageAdapter(String filepath) {
        this.storageFile = new File(filepath);
        this.mapper = new ObjectMapper();
    }

    public List<Channel> loadChannels() {
        if (!storageFile.exists()) {
            return new ArrayList<>();
        }
        try {
            return mapper.readValue(storageFile, new TypeReference<List<Channel>>() {});
        } catch (IOException e) {
            e.printStackTrace();
            return new ArrayList<>();
        }
    }

    public void saveChannels(List<Channel> channels) {
        try {
            if (!storageFile.getParentFile().exists()) {
                storageFile.getParentFile().mkdirs();
            }
            mapper.writeValue(storageFile, channels);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
