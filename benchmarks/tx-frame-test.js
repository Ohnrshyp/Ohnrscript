const fs = require('fs');
const vm = require('vm');

let context = {
    __extern: function(name) {
        if (name === 'get_authorized_vlan_id') return () => 0;
        if (name === 'http_process_payload') {
            return (rxPtr, len, txPtr) => {
                let resp = Buffer.from("HTTP/1.1 200 OK\r\n\r\nHello!");
                resp.copy(context.txBufferAddr, txPtr);
                return resp.length;
            };
        }
        if (name === 'writeUint16_BE') return context.writeUint16_BE;
        if (name === 'writeUint32_BE') return context.writeUint32_BE;
        if (name === 'calculateChecksum') return context.calculateChecksum;
        return () => {};
    },
    TX_POOL_BASE: 0,
    txPoolIndex: 0,
    tcpState: new Uint32Array([1, 0, 0xC0A80001, 50000, 1000, 12345]),
    buffer: new Uint8Array(2048),
    txBufferAddr: new Uint8Array(2048),
    getBaseOffset: () => 14,
    getVlanId: () => 0,
    readUint16: (buf, off) => buf[off] | (buf[off+1]<<8),
    readUint32: (buf, off) => buf[off] | (buf[off+1]<<8) | (buf[off+2]<<16) | (buf[off+3]<<24),
    hasPayload: () => true
};

let npCode = fs.readFileSync(__dirname + '/../packages-llvm/ohn-kernel/src/network_parser.ohn', 'utf8')
    .replace(/export /g, '')
    .replace(/'use strict';/, '');
vm.runInNewContext(npCode, context);

let tcpCode = fs.readFileSync(__dirname + '/../packages-llvm/ohn-kernel/src/tcp.ohn', 'utf8')
    .replace(/export /g, '')
    .replace(/const writeUint16_BE = __extern.*/g, '')
    .replace(/const writeUint32_BE = __extern.*/g, '')
    .replace(/const calculateChecksum = __extern.*/g, '')
    .replace(/'use strict';/, '')
    .replace(/let tcpState = 0x300000;/, '') 
    .replace(/let txBufferAddr = \(TX_POOL_BASE \+ \(txPoolIndex \* 2048\)\) \| 0;/, 'let txBufferAddr = txBufferAddrArray;')
    .replace(/const TX_POOL_BASE = 0x400000;/, '');
    
context.txBufferAddrArray = context.txBufferAddr;
vm.runInNewContext(tcpCode, context);

// Mock Packet
// Dest MAC: 00:11:22:33:44:55, Src MAC: 66:77:88:99:AA:BB
context.buffer.set([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 
    0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB,
], 14); // eth header

context.buffer.set([0xC0, 0xA8, 0x01, 0x05], 14 + 12); // Src IP
context.buffer.set([0xC0, 0xA8, 0x01, 0x0A], 14 + 16); // Dest IP
context.buffer.set([0xC3, 0x50], 14 + 20); // Src Port (50000)
context.buffer.set([0x00, 0x50], 14 + 22); // Dst Port (80)
context.buffer[14 + 33] = 0x10; // ACK flag

let result = context.handleTcpPacket(context.buffer, 0);

console.log("Tx Buffer Start (VirtIO + Eth + IP + TCP + Payload):");
let hex = "";
for (let i = 0; i < 90; i++) {
    hex += context.txBufferAddr[i].toString(16).padStart(2, '0') + " ";
    if ((i+1)%16 === 0) hex += "\n";
}
console.log(hex);

let ipCsum = (context.txBufferAddr[24] << 8) | context.txBufferAddr[25];
let tcpCsum = (context.txBufferAddr[50] << 8) | context.txBufferAddr[51];
console.log("IP Checksum: 0x" + ipCsum.toString(16));
console.log("TCP Checksum: 0x" + tcpCsum.toString(16));
