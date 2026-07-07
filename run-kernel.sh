#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Ohnrscript Kernel Demo
#
#  This script builds and boots the Ohn Kernel in Docker.
#  Once running, test with: curl http://localhost:8080
# ═══════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  Ohnrscript Kernel — Build & Boot"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Build the Docker image (compiles .ohn → LLVM IR → kernel.elf)
echo "  [1/2] Building kernel image..."
docker build -t ohn-kernel .

echo ""
echo "  [2/2] Booting kernel in QEMU..."
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │  Kernel is booting. Once you see the VGA shell prompt,  │"
echo "  │  open a new terminal and run:                           │"
echo "  │                                                         │"
echo "  │    curl http://localhost:8080                            │"
echo "  │                                                         │"
echo "  │  Press Ctrl+C to stop the kernel.                       │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""

docker run -it --rm -p 8080:8080 ohn-kernel
