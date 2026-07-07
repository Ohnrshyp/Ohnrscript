# ═══════════════════════════════════════════════════════════════
#  Ohnrscript Kernel — Docker Build & Boot
#
#  Build:   docker build -t ohn-kernel .
#  Run:     docker run -it --rm -p 8080:8080 ohn-kernel
#  Test:    curl http://localhost:8080
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Build Environment ───────────────────────────────
# Compiles .ohn → LLVM IR → .o → kernel.elf
# Uses Bookworm (Debian 12) for LLVM 16+ support (opaque ptr type)
FROM node:20-bookworm AS builder

# Install LLVM 16 toolchain (required for opaque pointer / ptr type)
RUN apt-get update && apt-get install -y --no-install-recommends \
    clang-16 \
    lld-16 \
    llvm-16 \
    && ln -sf /usr/bin/clang-16 /usr/bin/clang \
    && ln -sf /usr/bin/ld.lld-16 /usr/bin/ld.lld \
    && ln -sf /usr/bin/llvm-as-16 /usr/bin/llvm-as \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/ohnrscript

# Copy package files first (Docker layer caching)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy the full source tree (see .dockerignore for exclusions)
COPY . .

# Build the kernel
RUN cd packages-llvm/ohn-kernel && bash build.sh

# ── Stage 2: Minimal Runtime ─────────────────────────────────
# Only QEMU + the compiled ELF — no Node.js, no source code
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    qemu-system-x86 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /kernel

# Copy only the compiled kernel ELF from the builder stage
COPY --from=builder /usr/src/ohnrscript/packages-llvm/ohn-kernel/dist/kernel.elf .

EXPOSE 8080

# Boot the kernel in QEMU with port forwarding
# -nographic: no GUI window (runs in terminal)
# -serial stdio: kernel debug output to docker logs
# hostfwd: maps container port 8080 → kernel port 80
CMD ["qemu-system-i386", \
     "-kernel", "kernel.elf", \
     "-append", "VLAN=1000", \
     "-m", "32M", \
     "-netdev", "user,id=vnet,hostfwd=tcp::8080-:80", \
     "-device", "virtio-net,netdev=vnet", \
     "-nographic", \
     "-no-reboot", \
     "-no-shutdown"]
