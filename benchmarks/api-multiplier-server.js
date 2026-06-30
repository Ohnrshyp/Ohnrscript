const http = require('http');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const { decode } = require('cbor-x');
const { v4: uuidv4 } = require('uuid');
const babel = require('@babel/core');
const { monitorEventLoopDelay } = require('perf_hooks');

const cborPlugin = require('../core/src/plugins/babel-plugin-cbor-aot');
const { generateUUIDv4 } = require('../packages/ohn-uuid/src/ohn-uuid.js');

// 1. Compile RegistrationPayload from RegistrationPayload.ohn
function transpileFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const result = babel.transformSync(code, {
    parserOpts: {
      plugins: [
        'typescript',
        ['decorators', { decoratorsBeforeExport: true }]
      ]
    },
    plugins: [cborPlugin]
  });
  return result.code;
}

const targetFile = path.join(__dirname, '../examples/RegistrationPayload.ohn');
const outputCode = transpileFile(targetFile);

const RegistrationPayload = eval(`
  (function() {
    var module = { exports: {} };
    ${outputCode}
    return module.exports;
  })();
`);

// 2. Standard Zod schema equivalent for 40 fields
const RegistrationPayloadSchema = z.object({
  _v: z.number(), _t: z.string(), title: z.string(), artist: z.string(),
  duration_ms: z.number(), isrc: z.string(), upc: z.string(), p_line: z.string(),
  c_line: z.string(), primary_genre: z.string(), secondary_genre: z.string(),
  language: z.string(), bitrate: z.number(), sample_rate: z.number(),
  channels: z.number(), format: z.string(), album_title: z.string(),
  track_number: z.number(), release_date: z.string(), original_release_date: z.string(),
  label: z.string(), catalog_number: z.string(), version: z.string(),
  parental_advisory: z.string(), featured_artists: z.string(), composers: z.string(),
  lyricists: z.string(), writers: z.string(), producers: z.string(),
  remixer: z.string(), recording_location: z.string(), recording_year: z.number(),
  iswc: z.string(), territories: z.string(), preview_start_ms: z.number(),
  owner_id: z.string(), origin_platform: z.string(), origin_timestamp: z.number(),
  fingerprint_hash: z.string(), fingerprint_raw: z.string()
});

// Setup memory and event loop tracking
const memoryLogFile = path.join(__dirname, 'server-memory-log.csv');
fs.writeFileSync(memoryLogFile, 'timestamp,heapUsedMB,eventLoopLagMeanMs,eventLoopLagMaxMs\n');

const eventLoopMonitor = monitorEventLoopDelay({ resolution: 10 });
eventLoopMonitor.enable();

setInterval(() => {
  const heapUsed = process.memoryUsage().heapUsed / 1024 / 1024;
  const meanLag = eventLoopMonitor.mean / 1e6; // nanoseconds to milliseconds
  const maxLag = eventLoopMonitor.max / 1e6;
  
  const logLine = `${new Date().toISOString()},${heapUsed.toFixed(2)},${meanLag.toFixed(2)},${maxLag.toFixed(2)}\n`;
  fs.appendFileSync(memoryLogFile, logLine);
  
  eventLoopMonitor.reset();
}, 5000).unref();

// HTTP Server
const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Method Not Allowed');
  }

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks);

    if (req.url === '/api/standard') {
      try {
        const parsed = decode(bodyBuf);
        const validated = RegistrationPayloadSchema.parse(parsed);
        validated.id = uuidv4();
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
    } else if (req.url === '/api/ohnrscript') {
      try {
        const validated = RegistrationPayload.fromCBOR(bodyBuf);
        validated.id = generateUUIDv4();
        
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(err.message);
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Raw Node.js Server listening on port ${PORT}`);
  console.log(`Endpoints: POST /api/standard, POST /api/ohnrscript`);
});
