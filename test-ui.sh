#!/bin/bash
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
XVFB_PID=$!
sleep 2

cd java
mvn exec:java -Dexec.mainClass="network.isc.ISCApplication" > /tmp/app_log.txt 2>&1 &
APP_PID=$!

sleep 10
import -window root /app/java-ui.png

kill $APP_PID
kill $XVFB_PID
