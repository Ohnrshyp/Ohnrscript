#!/bin/bash
# build.sh — node.ohn Build Script
# Compiles Ohnrscript source → LLVM IR → Native Binary (macOS/Linux)
# Self-hosted: uses the Ohnrscript compiler to compile itself.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$PKG_DIR/src"
OUT_DIR="$PKG_DIR/dist"

mkdir -p "$OUT_DIR"

# ── 1. Locate the self-hosted Ohnrscript compiler ──
OHN_COMPILER="$REPO_ROOT/compiler/src/main.ohn"
if [ ! -f "$OHN_COMPILER" ]; then
    echo "ERROR: Self-hosted Ohnrscript compiler not found at: $OHN_COMPILER"
    exit 1
fi

# ── 2. Locate clang (LLVM) ──
if command -v clang &>/dev/null; then
    CLANG="clang"
elif [ -f /opt/homebrew/opt/llvm/bin/clang ]; then
    CLANG="/opt/homebrew/opt/llvm/bin/clang"
elif [ -f /usr/local/opt/llvm/bin/clang ]; then
    CLANG="/usr/local/opt/llvm/bin/clang"
else
    echo "ERROR: clang not found. Install LLVM: brew install llvm"
    exit 1
fi

echo "────────────────────────────────────────────────────────"
echo "  node.ohn — Native Web Server Build"
echo "  Compiler : Self-hosted Ohnrscript"
echo "  Backend  : LLVM → $(uname -m)"
echo "────────────────────────────────────────────────────────"

# ── 3. Compile Ohnrscript sources → LLVM IR ──
# The self-hosted compiler concatenates all .ohn sources and emits a single .ll file.
echo "▶ Compiling loop.ohn → loop.ll (via self-hosted compiler)..."
node "$OHN_COMPILER" "$SRC_DIR/loop.ohn" --target llvm --output "$OUT_DIR/loop.ll"

echo "▶ Compiling server.ohn → server.ll (via self-hosted compiler)..."
node "$OHN_COMPILER" "$SRC_DIR/server.ohn" --target llvm --output "$OUT_DIR/server.ll"

# ── 4. Link LLVM IR + C ABI Shim via clang ──
echo "▶ Linking server.ll + loop.ll + bindings.c → node.ohn binary..."
$CLANG \
    -O3 \
    -march=native \
    "$OUT_DIR/server.ll" \
    "$OUT_DIR/loop.ll" \
    "$SRC_DIR/bindings.c" \
    -o "$OUT_DIR/node.ohn" \
    -lm

echo ""
echo "────────────────────────────────────────────────────────"
echo "  ✓ Build Complete: dist/node.ohn"
echo ""
echo "  Run:"
echo "    ./dist/node.ohn"
echo ""
echo "  Test:"
echo "    curl http://localhost:8080"
echo ""
echo "  Load test (requires wrk):"
echo "    wrk -t4 -c10000 -d30s http://localhost:8080"
echo ""
echo "  Graceful shutdown:"
echo "    kill -15 \$(lsof -ti :8080)"
echo "────────────────────────────────────────────────────────"
