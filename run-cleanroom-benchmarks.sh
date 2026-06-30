#!/bin/bash
echo "======================================================="
echo "  OHNRSCRIPT CLEAN-ROOM BENCHMARKS (UBUNTU LINUX VM)   "
echo "======================================================="
echo ""
echo "=== 1. Running Standard Library Packages Benchmarks ==="
node benchmarks/run-all-benchmarks.js
echo ""
echo "=== 2. Running Protobuf vs Ohnrscript Architecture Benchmark ==="
node benchmarks/benchmark-protobuf-vs-ohnrscript.js
echo ""
echo "=== 3. Running Heavy Payload Registration Benchmark ==="
node benchmarks/benchmark-registration.js
echo ""
echo "======================================================="
echo "  CLEAN-ROOM EXECUTION COMPLETE                        "
echo "======================================================="
