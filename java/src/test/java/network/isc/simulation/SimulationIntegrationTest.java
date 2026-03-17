package network.isc.simulation;

import org.junit.jupiter.api.Test;

import java.io.File;
import java.nio.file.Files;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertTrue;

public class SimulationIntegrationTest {

    @Test
    public void testMiniHeadlessSimulation() throws Exception {
        SimulationConfig config = new SimulationConfig(
            3, // small peer count for speed
            10, // short duration for CI
            false, // no GUI
            999L,
            true,
            false,
            false,
            false,
            false
        );

        SimulationManager manager = new SimulationManager(config);
        manager.runSimulation();

        // Check if metrics file was produced
        File metrics = new File("simulation-metrics.json");
        assertTrue(metrics.exists(), "Metrics file should be created");

        String content = Files.readString(metrics.toPath());
        assertTrue(content.contains("\"numPeers\": 3"), "Metrics should contain correct peer count");

        // Clean up
        metrics.delete();
    }
}