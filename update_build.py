import sys

build_path = "/Users/jordankugler/Cursor/ORBIT/ohnrscript/packages-llvm/node.ohn/build.sh"

with open(build_path, "r") as f:
    content = f.read()

mbed_block = """
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
"""

content = content.replace("# The self-hosted compiler takes the combined source.\n", mbed_block)

clang_old = """ if ! $CLANG -O3 -o "$OUT_DIR/node.ohn" "$OUT_DIR/server.ll" "$PKG_DIR/src/bindings.c" "$REPO_ROOT/compiler/src/shim/ohnrscript-runtime.c" -lm; then"""
clang_new = """ if ! $CLANG -O3 $MBED_CFLAGS -o "$OUT_DIR/node.ohn" "$OUT_DIR/server.ll" "$PKG_DIR/src/bindings.c" "$REPO_ROOT/compiler/src/shim/ohnrscript-runtime.c" -lm $MBED_LDFLAGS; then"""

content = content.replace(clang_old, clang_new)

with open(build_path, "w") as f:
    f.write(content)
