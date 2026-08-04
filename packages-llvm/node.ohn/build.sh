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

COMPILER_FRONTEND="${REPO_ROOT}/compiler/src/frontend/parser.ohn"
COMPILER_BACKEND="${REPO_ROOT}/compiler/src/codegen/generator-llvm.ohn"

if [ ! -f "$COMPILER_FRONTEND" ]; then
    echo "ERROR: Compiler frontend not found at: $COMPILER_FRONTEND"
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


# ── 3. Vendored mbedTLS ──
MBED_DIR="$PKG_DIR/vendor/mbedtls"

if [ ! -f "$MBED_DIR/library/libmbedtls.a" ]; then
    echo "▶ Compiling vendored mbedTLS (this will take a moment)..."
    cd "$MBED_DIR"
    make lib CFLAGS="-O2"
    cd "$PKG_DIR"
fi

MBED_CFLAGS="-I${MBED_DIR}/include"
MBED_LDFLAGS="-L${MBED_DIR}/library -lmbedtls -lmbedx509 -lmbedcrypto"

# The self-hosted compiler takes the combined source.
echo "▶ Combining Ohnrscript sources..."
cat "$SRC_DIR/http.ohn" "$SRC_DIR/router.ohn" "$SRC_DIR/mpsc.ohn" "$SRC_DIR/outbound.ohn" "$SRC_DIR/timeout.ohn" "$SRC_DIR/loop.ohn" "$SRC_DIR/server.ohn" > "$OUT_DIR/combined.ohn"

echo "▶ Compiling combined.ohn → server.ll (via self-hosted compiler)..."
node -e "
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = '${REPO_ROOT}';
const SRC = '${OUT_DIR}/combined.ohn';
const LL_OUT = '${OUT_DIR}/server.ll';

Object.keys(require.cache)
    .filter(k => k.includes('generator') || k.includes('parser'))
    .forEach(k => delete require.cache[k]);

const parser = require(path.join(REPO_ROOT, 'compiler/src/frontend/parser.ohn'));
const generator = require(path.join(REPO_ROOT, 'compiler/src/codegen/generator-llvm.ohn'));

const src = fs.readFileSync(SRC);
const rootIndex = parser.parse(new Uint8Array(src));

generator.generate(
    parser.get_ast_nodes(),
    parser.get_ast_extra(),
    parser.get_intern_pool(),
    rootIndex,
    LL_OUT
);
" 2>&1

# ── 4. Link LLVM IR + C ABI Shim via clang ──
echo "▶ Linking server.ll + bindings.c → node.ohn binary..."
 if ! $CLANG -O3 $MBED_CFLAGS -o "$OUT_DIR/node.ohn" "$OUT_DIR/server.ll" "$PKG_DIR/src/bindings.c" "$REPO_ROOT/compiler/src/shim/ohnrscript-runtime.c" -lm $MBED_LDFLAGS; then
    echo "ERROR: Linking failed."
    exit 1
fi
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
