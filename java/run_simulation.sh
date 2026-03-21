#!/bin/bash
ps aux | grep exec:java | grep -v grep | awk '{print $2}' | xargs -r kill -9
rm -f simulation_result.png node_output.log
mvn -f java/pom.xml compile
DISPLAY=:99 mvn -f java/pom.xml exec:java -Dexec.mainClass="network.isc.simulation.RunTwoWindows"
