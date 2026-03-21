package network.isc.simulation;

public class SimulationRunner {
    public static void main(String[] args) {
        int peers = 4;
        int duration = 30;
        boolean gui = true;

        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--peers") && i + 1 < args.length) {
                peers = Integer.parseInt(args[i + 1]);
            } else if (args[i].equals("--duration") && i + 1 < args.length) {
                duration = Integer.parseInt(args[i + 1]);
            } else if (args[i].equals("--gui")) {
                gui = true;
            } else if (args[i].equals("--headless")) {
                gui = false;
            }
        }

        SimulationConfig config = new SimulationConfig(
            peers, duration, gui, 12345L, true, false, true, true, true
        );

        SimulationManager manager = new SimulationManager(config);
        try {
            manager.runSimulation();
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }
}