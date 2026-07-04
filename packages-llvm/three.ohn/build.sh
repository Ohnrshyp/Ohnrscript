#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$PKG_DIR/src"
OUT_DIR="$PKG_DIR/dist"

mkdir -p "$OUT_DIR"

echo "[1/3] Compiling Metal Shaders..."
xcrun -sdk macosx metal -c "$SRC_DIR/shaders.metal" -o "$OUT_DIR/shaders.air"
xcrun -sdk macosx metallib "$OUT_DIR/shaders.air" -o "$OUT_DIR/shaders.metallib"
# Copy metallib to root where executable runs
cp "$OUT_DIR/shaders.metallib" .

echo "[2/3] Compiling Ohnrscript to LLVM IR..."
node -e "
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = '${REPO_ROOT}';
const SRC = '${SRC_DIR}/main.ohn';
const LL_OUT = '${OUT_DIR}/main.ll';

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

echo "[3/3] Linking Native Executable..."
clang -O3 -march=native \
    "$OUT_DIR/main.ll" \
    "$SRC_DIR/bindings.m" \
    "${REPO_ROOT}/compiler/src/shim/ohnrscript-runtime.c" \
    -o "three.ohn" \
    -framework Metal \
    -framework MetalKit \
    -framework Cocoa \
    -framework QuartzCore

echo "Build complete. Run with: ./three.ohn"
