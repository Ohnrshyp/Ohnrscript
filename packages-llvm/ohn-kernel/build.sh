#!/usr/bin/env bash
# build.sh — Ohnrscript Kernel Build Script
#
# Pipeline:
#   kernel.ohn → [Ohnrscript LLVM generator] → kernel.ll
#   kernel.ll  → [clang -O2 -target x86_64-elf] → kernel.o
#   boot.c     → [clang -O2 -target x86_64-elf] → boot.o
#   kernel.o + boot.o → [ld -T linker.ld] → kernel.elf
#
# Requirements:
#   - Node.js >= 18
#   - clang with x86_64-elf cross-compilation support
#     (on macOS: brew install llvm, use /usr/local/opt/llvm/bin/clang)
#   - lld or ld with ELF support
#   - qemu-system-x86_64 (for running)
#   - llvm-as (for IR validation)
#
# Usage:
#   ./build.sh          — build the kernel ELF
#   ./build.sh run      — build and boot in QEMU
#   ./build.sh clean    — remove dist/ artifacts

set -e

export REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KERNEL_DIR="$(cd "$(dirname "$0")" && pwd)"
export SRC="${KERNEL_DIR}/src/kernel.ohn"
BOOT_C="${KERNEL_DIR}/boot/boot.c"
LINKER="${KERNEL_DIR}/boot/linker.ld"
DIST="${KERNEL_DIR}/dist"

COMPILER_FRONTEND="${REPO_ROOT}/compiler/src/frontend/parser.ohn"
COMPILER_BACKEND="${REPO_ROOT}/compiler/src/codegen/generator-llvm.ohn"

export LL_OUT="${DIST}/kernel.ll"
KERNEL_OBJ="${DIST}/kernel.o"
BOOT_OBJ="${DIST}/boot.o"
ELF_OUT="${DIST}/kernel.elf"

# Detect clang — prefer LLVM from homebrew on macOS
if command -v /usr/local/opt/llvm/bin/clang &>/dev/null; then
    CLANG="/usr/local/opt/llvm/bin/clang"
elif command -v /opt/homebrew/opt/llvm/bin/clang &>/dev/null; then
    CLANG="/opt/homebrew/opt/llvm/bin/clang"
elif command -v clang &>/dev/null; then
    CLANG="clang"
else
    echo "ERROR: clang not found. Install with: brew install llvm"
    exit 1
fi

if command -v /usr/local/opt/llvm/bin/llvm-as &>/dev/null; then
    LLVM_AS="/usr/local/opt/llvm/bin/llvm-as"
elif command -v /opt/homebrew/opt/llvm/bin/llvm-as &>/dev/null; then
    LLVM_AS="/opt/homebrew/opt/llvm/bin/llvm-as"
else
    LLVM_AS="llvm-as"
fi

if [ "$1" = "clean" ]; then
    rm -rf "${DIST}"
    echo "Cleaned dist/"
    exit 0
fi

mkdir -p "${DIST}"

echo "═══════════════════════════════════════════════════════════════"
echo "  Ohnrscript Kernel Build"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Compile kernel.ohn → kernel.ll ──────────────────────────────
echo "  [1/5] Compiling kernel.ohn → LLVM IR..."
node --input-type=module << 'EOF'
import { createRequire } from 'module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

const REPO_ROOT = process.env.REPO_ROOT;
const SRC = process.env.SRC;
const LL_OUT = process.env.LL_OUT;

// Clear require cache
Object.keys(require.cache)
    .filter(k => k.includes('generator') || k.includes('parser'))
    .forEach(k => delete require.cache[k]);

const parser = require(path.join(REPO_ROOT, 'compiler/src/frontend/parser.ohn'));
const generator = require(path.join(REPO_ROOT, 'compiler/src/codegen/generator-llvm.ohn'));

const src = readFileSync(SRC);
const rootIndex = parser.parse(new Uint8Array(src));

generator.generate(
    parser.get_ast_nodes(),
    parser.get_ast_extra(),
    parser.get_intern_pool(),
    rootIndex,
    LL_OUT
);
EOF

# Simpler Node.js invocation (fallback for older Node versions)
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

console.log('  Done → ' + LL_OUT);
" 2>&1

# ── Step 2: Validate LLVM IR ─────────────────────────────────────────────
echo ""
echo "  [2/5] Validating kernel.ll with llvm-as..."
"${LLVM_AS}" "${LL_OUT}" -o /dev/null
echo "  PASS ✓"

# ── Step 3: Check for unsupported constructs ─────────────────────────────
UNSUPPORTED=$(grep -c '; UNSUPPORTED' "${LL_OUT}" || true)
if [ "${UNSUPPORTED}" -gt "0" ]; then
    echo "  WARNING: ${UNSUPPORTED} UNSUPPORTED constructs found in kernel.ll"
    grep '; UNSUPPORTED' "${LL_OUT}"
    echo "  These will emit dummy zero values — check kernel.ohn for unsupported syntax"
else
    echo "  Zero UNSUPPORTED constructs ✓"
fi

# ── Step 4: Compile both objects ─────────────────────────────────────────
echo ""
echo "  [3/5] Compiling kernel.ll → kernel.o (x86_64-elf freestanding)..."
"${CLANG}" \
    -target x86_64-elf \
    -ffreestanding \
    -fno-builtin \
    -fno-stack-protector \
    -O2 \
    -c "${LL_OUT}" \
    -o "${KERNEL_OBJ}"
echo "  Done → ${KERNEL_OBJ}"

echo ""
echo "  [4/5] Compiling boot.c → boot.o (x86_64-elf freestanding)..."
"${CLANG}" \
    -target x86_64-elf \
    -ffreestanding \
    -fno-builtin \
    -fno-stack-protector \
    -O2 \
    -c "${BOOT_C}" \
    -o "${BOOT_OBJ}"
echo "  Done → ${BOOT_OBJ}"

# ── Step 5: Link into ELF ────────────────────────────────────────────────
echo ""
echo "  [5/5] Linking → kernel.elf..."
ld.lld \
    -T "${LINKER}" \
    "${KERNEL_OBJ}" "${BOOT_OBJ}" \
    -o "${ELF_OUT}"

ELF_SIZE=$(wc -c < "${ELF_OUT}")
echo "  Done → ${ELF_OUT} (${ELF_SIZE} bytes)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  BUILD COMPLETE"
echo "  ELF: ${ELF_OUT}"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$1" = "run" ]; then
    echo "  Booting in QEMU..."
    echo "  (Close QEMU window or press Ctrl+C to stop)"
    echo ""
    qemu-system-x86_64 \
        -kernel "${ELF_OUT}" \
        -m 32M \
        -display curses \
        -no-reboot \
        -no-shutdown
fi
