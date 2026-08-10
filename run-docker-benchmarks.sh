#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "======================================================="
echo "  [1/4] PREPARING ASEPTIC CLEANROOM ENVIRONMENT        "
echo "======================================================="
echo ">>> Checking for stray containers..."
docker rm -f ohn-server-test ohn-server-1c ohn-server-8c 2>/dev/null || true

echo ">>> Verifying port 8080 is free..."
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "ERROR: Port 8080 is already in use. Please free the port before benchmarking."
    exit 1
fi
echo ">>> Port 8080 is verified free."

echo ""
echo "======================================================="
echo "  [2/4] BUILDING CLEANROOM DOCKER IMAGE                "
echo "======================================================="
docker build --no-cache -f Dockerfile.bench -t ohn-bench .

run_bench() {
  CORES=$1
  echo ""
  echo "======================================================="
  echo "  [3/4] RUNNING ${CORES}-CORE CLEANROOM BENCHMARK"
  echo "======================================================="
  
  # Start server in background with CPU limits and benchmark flag
  echo ">>> Booting container with --cpus=\"${CORES}\"..."
  docker run -d --rm --name ohn-server-${CORES}c --cpus="${CORES}" -p 8080:8080 -e OHN_BENCHMARK=1 ohn-bench
  
  # Wait for server to boot
  echo ">>> Waiting for server to initialize..."
  sleep 4
  
  echo ">>> Warmup Phase (15s) - Stabilizing TCP Stack & epoll pools..."
  docker run --rm --network container:ohn-server-${CORES}c alpine sh -c "apk add --no-cache wrk >/dev/null 2>&1 && wrk -t12 -c400 -d15s http://localhost:8080" > /dev/null
  
  echo ">>> Measured Phase (30s) - TechEmpower Plaintext Benchmark..."
  echo ">>> Executing: wrk -t12 -c400 -d30s http://localhost:8080 (via Alpine Linux container)"
  echo "-------------------------------------------------------"
  docker run --rm --network container:ohn-server-${CORES}c alpine sh -c "apk add --no-cache wrk >/dev/null 2>&1 && wrk -t12 -c400 -d30s http://localhost:8080"
  echo "-------------------------------------------------------"
  
  # Shutdown server
  echo ">>> Shutting down container..."
  docker stop ohn-server-${CORES}c
}

run_bench 1
run_bench 8

echo ""
echo "======================================================="
echo "  [4/4] CLEANROOM BENCHMARKS COMPLETE                  "
echo "======================================================="
