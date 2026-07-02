#!/usr/bin/env bash
set -e

export REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="${PKG_DIR}/dist"
SRC_DIR="${PKG_DIR}/src"

export SRC="${DIST}/combined.ohn"
export LL_OUT="${DIST}/ohnrbuffs.ll"

BENCH_C="${SRC_DIR}/bench.c"
OHNR_OBJ="${DIST}/ohnrbuffs.o"
BENCH_OBJ="${DIST}/bench.o"
EXEC_OUT="${DIST}/bench.out"

if [ "$1" = "clean" ]; then
    rm -rf "${DIST}"
    echo "Cleaned dist/"
    exit 0
fi

mkdir -p "${DIST}"

CLANG="clang"

echo "  [1/4] Combining .ohn files..."
cat "${SRC_DIR}/ohnrbuffs.ohn" "${SRC_DIR}/payload.ohn" > "${SRC}"

echo "  [2/4] Compiling combined.ohn → LLVM IR..."
node -e "
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = '${REPO_ROOT}';
const SRC = '${SRC}';
const LL_OUT = '${LL_OUT}';

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

echo "  [3/4] Compiling LLVM IR to native object..."
"${CLANG}" -O3 -c "${LL_OUT}" -o "${OHNR_OBJ}"

echo "  [4/4] Compiling bench.c and linking executable..."
"${CLANG}" -O3 "${BENCH_C}" "${OHNR_OBJ}" -o "${EXEC_OUT}"

echo "  Done → ${EXEC_OUT}"

if [ "$1" = "run" ]; then
    echo "  Running benchmark..."
    "${EXEC_OUT}"
fi
