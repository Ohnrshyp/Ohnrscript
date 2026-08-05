#!/bin/bash
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "======================================"
echo "        GO (Cleanroom Test)           "
echo "======================================"

cd go-server
go build -o server main.go
CMD="./server"

$CMD &
PID=$!
START=$(python3 -c 'import time; print(int(time.time() * 1000))')
while true; do
    if curl -s http://127.0.0.1:8080 > /dev/null; then
        END=$(python3 -c 'import time; print(int(time.time() * 1000))')
        echo "Cold Start TTFB: $((END-START)) ms"
        break
    fi
done
kill -9 $PID
sleep 2

/usr/bin/time -l $CMD &
PID=$!
sleep 2
wrk -t12 -c400 -d10s http://127.0.0.1:8080/
kill -15 $PID
sleep 1
