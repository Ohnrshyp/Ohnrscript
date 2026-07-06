const vm = require('vm');
const fs = require('fs');

const context = {
    memory: new Uint8Array(1024 * 1024),
    
    // Mocks for Ohnrscript Externs
    ohn_mem_read_i8: (bufPtr, i) => {
        return context.memory[bufPtr + i];
    },
    ohn_mem_read_i32: (bufPtr, i) => {
        let mem = context.memory;
        // Read Little-Endian 32-bit integer
        return mem[bufPtr + i] | 
              (mem[bufPtr + i + 1] << 8) | 
              (mem[bufPtr + i + 2] << 16) | 
              (mem[bufPtr + i + 3] << 24);
    },
    ohn_fill_response: (txBufferAddr, code) => {
        // Just mock what sys_fill_response does: writes a fake string response to memory
        let str = "";
        if (code === 2001) str = "HTTP/1.1 200 OK\r\n\r\nHello World!";
        else if (code === 2002) str = "HTTP/1.1 200 OK\r\n\r\nUsers Route!";
        else if (code === 404) str = "HTTP/1.1 404 Not Found\r\n\r\n404";
        else str = "HTTP/1.1 " + code + "\r\n\r\nError";

        for (let i = 0; i < str.length; i++) {
            context.memory[txBufferAddr + i] = str.charCodeAt(i);
        }
    }
};

context.__extern = (name) => context[name];

vm.createContext(context);

// Load the node.ohn router and http modules
let routerCode = fs.readFileSync(__dirname + '/../packages-llvm/node.ohn/src/router.ohn', 'utf8')
    .replace(/export /g, '')
    .replace(/const ohn_fill_response = __extern.*/g, '');
    
let httpCode = fs.readFileSync(__dirname + '/../packages-llvm/node.ohn/src/http.ohn', 'utf8')
    .replace(/export /g, '')
    .replace(/const ohn_mem_read_i8 = __extern.*/g, '')
    .replace(/const ohn_mem_read_i32 = __extern.*/g, '');

// Run in context
vm.runInNewContext(routerCode, context);
vm.runInNewContext(httpCode, context);

// ---------------------------------------------------------
// TEST: Simulate an incoming GET / HTTP/1.1 request
// ---------------------------------------------------------

let requestStr = "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n";
let rxBufferAddr = 0x1000;
let txBufferAddr = 0x2000;

for (let i = 0; i < requestStr.length; i++) {
    context.memory[rxBufferAddr + i] = requestStr.charCodeAt(i);
}

console.log("Simulating Incoming HTTP Request:");
console.log(requestStr);

// Run http_process_payload
let responseLen = context.http_process_payload(rxBufferAddr, requestStr.length, txBufferAddr);

console.log("Response Length returned:", responseLen);

if (responseLen > 0) {
    let responseStr = "";
    for (let i = 0; i < responseLen; i++) {
        responseStr += String.fromCharCode(context.memory[txBufferAddr + i]);
    }
    console.log("Generated HTTP Response:");
    console.log(responseStr);
} else {
    console.log("Error: Router returned 0 length response.");
}

// ---------------------------------------------------------
// TEST: Simulate GET /users HTTP/1.1 request
// ---------------------------------------------------------

let usersReq = "GET /users HTTP/1.1\r\nHost: localhost\r\n\r\n";
for (let i = 0; i < usersReq.length; i++) {
    context.memory[rxBufferAddr + i] = usersReq.charCodeAt(i);
}

console.log("\nSimulating GET /users:");
responseLen = context.http_process_payload(rxBufferAddr, usersReq.length, txBufferAddr);

if (responseLen > 0) {
    let responseStr = "";
    for (let i = 0; i < responseLen; i++) {
        responseStr += String.fromCharCode(context.memory[txBufferAddr + i]);
    }
    console.log(responseStr);
}
