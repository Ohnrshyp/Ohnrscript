#!/bin/bash
# build.sh — workers.ohn Build Script
# Compiles Ohnrscript source → LLVM IR → Native Binary
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

if command -v clang &>/dev/null; then
    CLANG="clang"
elif [ -f /opt/homebrew/opt/llvm/bin/clang ]; then
    CLANG="/opt/homebrew/opt/llvm/bin/clang"
elif [ -f /usr/local/opt/llvm/bin/clang ]; then
    CLANG="/usr/local/opt/llvm/bin/clang"
else
    echo "ERROR: clang not found. Install LLVM."
    exit 1
fi

echo "────────────────────────────────────────────────────────"
echo "  workers.ohn — Threading & Message Passing Test"
echo "────────────────────────────────────────────────────────"

echo "▶ Combining Ohnrscript sources..."
cat "$SRC_DIR/worker.ohn" "$SRC_DIR/main.ohn" > "$OUT_DIR/combined.ohn"

echo "▶ Compiling combined.ohn → workers.ll (via self-hosted compiler)..."
node -e "
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = '${REPO_ROOT}';
const SRC = '${OUT_DIR}/combined.ohn';
const LL_OUT = '${OUT_DIR}/workers.ll';

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

echo "▶ Linking workers.ll + bindings.c → workers.ohn binary..."
# Note: we need -lpthread on Linux, usually automatic on macOS
if ! $CLANG -O3 -o "$OUT_DIR/workers.ohn" "$OUT_DIR/workers.ll" "$PKG_DIR/src/bindings.c" "$REPO_ROOT/compiler/src/shim/ohnrscript-runtime.c" -lpthread -lm; then
    echo "ERROR: Linking failed."
    exit 1
fi

echo ""
echo "────────────────────────────────────────────────────────"
echo "  ✓ Build Complete: dist/workers.ohn"
echo "────────────────────────────────────────────────────────"
