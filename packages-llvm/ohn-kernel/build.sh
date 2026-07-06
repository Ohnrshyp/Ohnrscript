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

# ── Step 1: Compile .ohn → .ll ──────────────────────────────
echo "  [1/5] Compiling .ohn → LLVM IR..."

compile_ohn() {
    local src_file=$1
    local ll_out=$2
    echo "    Compiling $(basename ${src_file})..."
    node -e "
    const { createRequire } = require('module');
    const fs = require('fs');
    const path = require('path');

    const REPO_ROOT = '${REPO_ROOT}';
    const SRC = '${src_file}';
    const LL_OUT = '${ll_out}';

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
}

compile_ohn "${KERNEL_DIR}/src/network_parser.ohn" "${DIST}/network_parser.ll"
compile_ohn "${KERNEL_DIR}/src/tcp.ohn" "${DIST}/tcp.ll"
compile_ohn "${KERNEL_DIR}/src/kernel.ohn" "${DIST}/kernel.ll"

# Package Linker: Link external ecosystem packages
compile_ohn "${REPO_ROOT}/packages-llvm/node.ohn/src/http.ohn" "${DIST}/http.ll"
compile_ohn "${REPO_ROOT}/packages-llvm/node.ohn/src/router.ohn" "${DIST}/router.ll"
compile_ohn "${REPO_ROOT}/packages-llvm/db.ohn/src/db.ohn" "${DIST}/db.ll"

# ── Step 2: Validate LLVM IR ─────────────────────────────────────────────
echo ""
echo "  [2/5] Validating LLVM IR with llvm-as..."
"${LLVM_AS}" "${DIST}/network_parser.ll" -o /dev/null
"${LLVM_AS}" "${DIST}/tcp.ll" -o /dev/null
"${LLVM_AS}" "${DIST}/kernel.ll" -o /dev/null
"${LLVM_AS}" "${DIST}/http.ll" -o /dev/null
"${LLVM_AS}" "${DIST}/router.ll" -o /dev/null
"${LLVM_AS}" "${DIST}/db.ll" -o /dev/null
echo "  PASS ✓"

# ── Step 3: Check for unsupported constructs ─────────────────────────────
UNSUPPORTED=$(grep -hc '; UNSUPPORTED' "${DIST}"/*.ll | awk '{sum+=$1} END {print sum}' || true)
if [ "${UNSUPPORTED}" -gt "0" ]; then
    echo "  WARNING: ${UNSUPPORTED} UNSUPPORTED constructs found."
else
    echo "  Zero UNSUPPORTED constructs ✓"
fi

# ── Step 4: Compile objects ─────────────────────────────────────────
echo ""
echo "  [3/5] Compiling .ll → .o (i386-elf freestanding)..."

compile_ll() {
    local ll_file=$1
    local o_file=$2
    "${CLANG}" -target i386-elf -ffreestanding -fno-builtin -fno-stack-protector -O2 -c "${ll_file}" -o "${o_file}"
}

compile_ll "${DIST}/network_parser.ll" "${DIST}/network_parser.o"
compile_ll "${DIST}/tcp.ll" "${DIST}/tcp.o"
compile_ll "${DIST}/kernel.ll" "${DIST}/kernel.o"
compile_ll "${DIST}/http.ll" "${DIST}/http.o"
compile_ll "${DIST}/router.ll" "${DIST}/router.o"
compile_ll "${DIST}/db.ll" "${DIST}/db.o"

echo ""
echo "  [4/5] Compiling boot.c → boot.o (i386-elf freestanding)..."
"${CLANG}" \
    -target i386-elf \
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
    -m elf_i386 \
    -T "${LINKER}" \
    "${DIST}/kernel.o" "${DIST}/tcp.o" "${DIST}/network_parser.o" \
    "${DIST}/http.o" "${DIST}/router.o" "${DIST}/db.o" "${BOOT_OBJ}" \
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
    echo "  (Serial debug output will appear here. Close QEMU window or Ctrl+C to stop)"
    echo ""
    qemu-system-i386 \
        -kernel "${ELF_OUT}" \
        -append "VLAN=1000" \
        -m 32M \
        -netdev user,id=vnet,hostfwd=tcp::8080-:80 \
        -device virtio-net,netdev=vnet \
        -display curses \
        -serial stdio \
        -no-reboot \
        -no-shutdown
fi
