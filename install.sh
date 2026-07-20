#!/usr/bin/env bash
# install.sh — Ohnrscript Installer
# curl -fsSL https://ohnrshyp.com/install.sh | bash
#
# This script installs the Ohnrscript compiler toolchain by:
#   1. Detecting the OS and architecture
#   2. Checking prerequisites (Node.js >= 20, Git)
#   3. Cloning the Ohnrscript repository
#   4. Installing dependencies
#   5. Linking `ohnc` to your PATH
#
# Licensed under BUSL-1.1 — see LICENSE.md for details.

set -euo pipefail

# ── Colors ──
BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

INSTALL_DIR="${OHNRSCRIPT_INSTALL_DIR:-$HOME/.ohnrscript}"
BIN_DIR="${OHNRSCRIPT_BIN_DIR:-$HOME/.local/bin}"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}${BOLD}║              Ohnrscript Installer v0.8.2                ║${RESET}"
echo -e "${CYAN}${BOLD}║     Web-Native Syntax At Bare Metal Speed               ║${RESET}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Detect Platform ──
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="macos" ;;
    *)
        echo -e "${RED}Error: Unsupported operating system: $OS${RESET}"
        echo "Ohnrscript currently supports Linux and macOS."
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64|amd64)   ARCH_NAME="x86_64" ;;
    arm64|aarch64)  ARCH_NAME="arm64" ;;
    *)
        echo -e "${RED}Error: Unsupported architecture: $ARCH${RESET}"
        exit 1
        ;;
esac

echo -e "  Platform: ${BOLD}${PLATFORM}-${ARCH_NAME}${RESET}"

# ── 2. Check Prerequisites ──
echo -e "  Checking prerequisites..."

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ Node.js is required but not installed.${RESET}"
    echo "    Install Node.js 20+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}  ✗ Node.js 20+ is required (found v${NODE_VERSION}).${RESET}"
    echo "    Update Node.js from https://nodejs.org"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} Node.js v$(node -v | sed 's/v//')"

# Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}  ✗ Git is required but not installed.${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} Git $(git --version | awk '{print $3}')"

# ── 3. Clone or Update ──
echo ""
if [ -d "$INSTALL_DIR" ]; then
    echo -e "  ${YELLOW}Existing installation found. Updating...${RESET}"
    cd "$INSTALL_DIR"
    git pull --quiet origin main
else
    echo -e "  Cloning Ohnrscript to ${BOLD}${INSTALL_DIR}${RESET}..."
    git clone --depth 1 https://github.com/ohnrshyp/ohnrscript.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# ── 4. Install Dependencies ──
echo -e "  Installing dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

# ── 5. Link CLI ──
mkdir -p "$BIN_DIR"

# Create the ohnc wrapper script
cat > "$BIN_DIR/ohnc" << 'WRAPPER'
#!/usr/bin/env bash
OHNRSCRIPT_DIR="${OHNRSCRIPT_INSTALL_DIR:-$HOME/.ohnrscript}"
exec node "$OHNRSCRIPT_DIR/core/bin/ohnc.js" "$@"
WRAPPER
chmod +x "$BIN_DIR/ohnc"

# Create the ohnrscript-lsp wrapper
cat > "$BIN_DIR/ohnrscript-lsp" << 'WRAPPER'
#!/usr/bin/env bash
OHNRSCRIPT_DIR="${OHNRSCRIPT_INSTALL_DIR:-$HOME/.ohnrscript}"
exec node "$OHNRSCRIPT_DIR/lsp/server.js" --stdio "$@"
WRAPPER
chmod +x "$BIN_DIR/ohnrscript-lsp"

# ── 6. PATH Setup ──
echo ""

# Check if BIN_DIR is already in PATH
if echo "$PATH" | grep -q "$BIN_DIR"; then
    echo -e "  ${GREEN}✓${RESET} $BIN_DIR is already in your PATH"
else
    echo -e "  ${YELLOW}Adding $BIN_DIR to your PATH...${RESET}"

    SHELL_NAME="$(basename "$SHELL")"
    case "$SHELL_NAME" in
        zsh)  RC_FILE="$HOME/.zshrc" ;;
        bash) RC_FILE="$HOME/.bashrc" ;;
        fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
        *)    RC_FILE="$HOME/.profile" ;;
    esac

    if [ "$SHELL_NAME" = "fish" ]; then
        echo "set -gx PATH $BIN_DIR \$PATH" >> "$RC_FILE"
    else
        echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$RC_FILE"
    fi

    echo -e "  ${GREEN}✓${RESET} Added to ${BOLD}${RC_FILE}${RESET}"
    echo -e "  ${YELLOW}Run: source $RC_FILE  (or restart your terminal)${RESET}"
fi

# ── 7. Verify ──
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  ✓ Ohnrscript installed successfully!                   ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Quick Start:${RESET}"
echo -e "    ${CYAN}ohnc hello.ohn${RESET}        Compile an .ohn file"
echo -e "    ${CYAN}ohnc --version${RESET}        Show compiler version"
echo ""
echo -e "  ${BOLD}Documentation:${RESET}  https://ohnrshyp.com"
echo -e "  ${BOLD}VS Code:${RESET}        Search \"Ohnrscript\" in the Extensions Marketplace"
echo ""
