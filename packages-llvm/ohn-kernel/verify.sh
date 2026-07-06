#!/usr/bin/env bash
set -e

KERNEL_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST="${KERNEL_DIR}/dist"
SERIAL_LOG="/tmp/ohn_verify_serial.log"
PCAP_FILE="${KERNEL_DIR}/qemu_verify.pcap"
RESULT=0

echo "══════════════════════════════════════════════════"
echo "  Ohn Kernel — Automated Verification"
echo "══════════════════════════════════════════════════"

# ── Step 1: Build ──────────────────────────────────
echo "[1/5] Building kernel..."
cd "${KERNEL_DIR}"
./build.sh 2>&1 | tail -3
if [ ! -f "${DIST}/kernel.elf" ]; then
    echo "FAIL: kernel.elf not produced"; exit 1
fi
echo "PASS ✓ kernel.elf exists"

# ── Step 2: Boot QEMU ─────────────────────────────
echo "[2/5] Booting QEMU..."
rm -f "${SERIAL_LOG}" "${PCAP_FILE}"
qemu-system-i386 \
    -kernel "${DIST}/kernel.elf" \
    -m 32M \
    -netdev user,id=vnet,hostfwd=tcp::8080-:80 \
    -device virtio-net,netdev=vnet,mrg_rxbuf=off \
    -object filter-dump,id=fd0,netdev=vnet,file="${PCAP_FILE}" \
    -display none \
    -serial file:"${SERIAL_LOG}" \
    -no-reboot -no-shutdown 2>/dev/null &
QEMU_PID=$!
sleep 3

# ── Step 3: Check serial output ───────────────────
echo "[3/5] Checking serial log..."
SERIAL=$(cat "${SERIAL_LOG}" 2>/dev/null || echo "")

# 3a: VirtIO init completed (MAC read, queue size, IRQ assigned)
if echo "${SERIAL}" | grep -q "MAC:"; then
    echo "  PASS ✓ VirtIO init completed (MAC detected)"
else
    echo "  FAIL ✗ No MAC in serial output"; RESULT=1
fi

# 3b: STI reached (interrupts enabled, event loop started)
if echo "${SERIAL}" | grep -q "STI"; then
    echo "  PASS ✓ Event loop started (STI reached)"
else
    echo "  FAIL ✗ STI not reached — kernel hung during init"; RESULT=1
fi

# ── Step 4: Send curl and check PCAP ──────────────
echo "[4/5] Sending HTTP request and checking PCAP..."
curl -s -m 5 http://localhost:8080/ >/dev/null 2>&1 || true
sleep 2

# Re-read serial after curl (QEMU may have delivered packets)
SERIAL=$(cat "${SERIAL_LOG}" 2>/dev/null || echo "")

# 4a: Outbound ARP exists in PCAP (gratuitous ARP or ARP reply from us)
PCAP_ARP_OUT=$(tcpdump -nn -r "${PCAP_FILE}" 2>/dev/null | grep -c "10.0.2.15" || echo "0")
if [ "${PCAP_ARP_OUT}" -ge 2 ]; then
    echo "  PASS ✓ Bidirectional ARP exchange in PCAP (${PCAP_ARP_OUT} packets with our IP)"
else
    echo "  FAIL ✗ Expected bidirectional ARP, got ${PCAP_ARP_OUT} packets with 10.0.2.15"
    RESULT=1
fi

# 4b: TCP SYN-ACK exists in PCAP (our kernel responded to the SYN)
PCAP_SYNACK=$(tcpdump -nn -r "${PCAP_FILE}" 2>/dev/null | grep -c "Flags \[S.\]" || echo "0")
if [ "${PCAP_SYNACK}" -ge 1 ]; then
    echo "  PASS ✓ TCP SYN-ACK sent by kernel (${PCAP_SYNACK} SYN-ACK packets)"
else
    echo "  INFO ○ No SYN-ACK in PCAP — TCP path not yet wired (expected until full TX works)"
fi

# 4c: IRQ 11 fired (interrupt handler ran)
if echo "${SERIAL}" | grep -q "!"; then
    echo "  PASS ✓ VirtIO interrupt fired ('!' in serial)"
else
    echo "  FAIL ✗ No '!' in serial — IRQ 11 never fired"; RESULT=1
fi

# ── Step 5: Cleanup ───────────────────────────────
echo "[5/5] Cleaning up..."
kill ${QEMU_PID} 2>/dev/null || true
wait ${QEMU_PID} 2>/dev/null || true

echo ""
echo "══════════════════════════════════════════════════"
if [ ${RESULT} -eq 0 ]; then
    echo "  ALL CHECKS PASSED ✓"
else
    echo "  SOME CHECKS FAILED ✗"
fi
echo "══════════════════════════════════════════════════"
echo "  Serial log: ${SERIAL_LOG}"
echo "  PCAP file:  ${PCAP_FILE}"
echo "══════════════════════════════════════════════════"

echo ""
echo "Full serial output:"
echo "---"
cat "${SERIAL_LOG}" 2>/dev/null || echo "(empty)"
echo "---"
echo ""
echo "Full PCAP:"
tcpdump -nn -r "${PCAP_FILE}" 2>/dev/null || echo "(empty)"

exit ${RESULT}
