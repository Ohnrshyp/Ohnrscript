const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.argv[2] === 'run-pb') {
  const { performance } = require('perf_hooks');
  const pb = require('./registration_pb.js');
  const mockPayload = require('../mock-payload.json');
  const pbMessage = pb.RegistrationPayload.create(mockPayload);
  const pbBuffer = pb.RegistrationPayload.encode(pbMessage).finish();
  
  const ITERATIONS = 1000000;
  
  // Warmup
  let sumW = 0;
  for (let i = 0; i < 10000; i++) {
    sumW += pb.RegistrationPayload.decode(pbBuffer).duration_ms;
  }
  
  global.gc();
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  let sum = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const obj = pb.RegistrationPayload.decode(pbBuffer);
    sum += obj.duration_ms;
  }
  const end = performance.now();
  global.gc();
  const memAfter = process.memoryUsage().heapUsed;
  
  console.log(JSON.stringify({ time: end - start, mem: Math.max(0, memAfter - memBefore) }));
  process.exit(0);
}

if (process.argv[2] === 'run-ohnr') {
  const { performance } = require('perf_hooks');
  const babel = require('@babel/core');
  const cborPlugin = require('../core/src/plugins/babel-plugin-cbor-aot');
  const targetFile = path.join(__dirname, '../examples/RegistrationPayload.ohn');
  const code = fs.readFileSync(targetFile, 'utf8');
  const result = babel.transformSync(code, {
    parserOpts: { plugins: ['typescript', ['decorators', { decoratorsBeforeExport: true }]] },
    plugins: [cborPlugin]
  });
  const RegistrationPayload = eval(`(function() { var module={exports:{}}; ${result.code} return module.exports; })()`);
  
  const mockPayload = require('../mock-payload.json');
  const ohnrMessage = new RegistrationPayload(
    mockPayload._v, mockPayload._t, mockPayload.title, mockPayload.artist, mockPayload.duration_ms, 
    mockPayload.isrc, mockPayload.upc, mockPayload.p_line, mockPayload.c_line, mockPayload.primary_genre, 
    mockPayload.secondary_genre, mockPayload.language, mockPayload.bitrate, mockPayload.sample_rate, 
    mockPayload.channels, mockPayload.format, mockPayload.album_title, mockPayload.track_number, 
    mockPayload.release_date, mockPayload.original_release_date, mockPayload.label, 
    mockPayload.catalog_number, mockPayload.version, mockPayload.parental_advisory, 
    mockPayload.featured_artists, mockPayload.composers, mockPayload.lyricists, mockPayload.writers, 
    mockPayload.producers, mockPayload.remixer, mockPayload.recording_location, mockPayload.recording_year, 
    mockPayload.iswc, mockPayload.territories, mockPayload.preview_start_ms, mockPayload.owner_id, 
    mockPayload.origin_platform, mockPayload.origin_timestamp, mockPayload.fingerprint_hash, 
    mockPayload.fingerprint_raw
  );
  const ohnrBuffer = ohnrMessage.toCBOR();
  
  const ITERATIONS = 1000000;
  
  // Warmup
  let sumW = 0;
  for (let i = 0; i < 10000; i++) {
    sumW += RegistrationPayload.fromCBOR(ohnrBuffer).duration_ms;
  }
  
  global.gc();
  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  let sum = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    const obj = RegistrationPayload.fromCBOR(ohnrBuffer);
    sum += obj.duration_ms;
  }
  const end = performance.now();
  global.gc();
  const memAfter = process.memoryUsage().heapUsed;
  
  console.log(JSON.stringify({ time: end - start, mem: Math.max(0, memAfter - memBefore) }));
  process.exit(0);
}

if (!process.argv[2]) {
  const pbRes = JSON.parse(spawnSync(process.execPath, ['--expose-gc', __filename, 'run-pb']).stdout.toString());
  const ohnrRes = JSON.parse(spawnSync(process.execPath, ['--expose-gc', __filename, 'run-ohnr']).stdout.toString());
  
  console.log(`Protobuf time: ${pbRes.time.toFixed(2)} ms`);
  console.log(`Protobuf mem: ${(pbRes.mem / 1024 / 1024).toFixed(2)} MB`);
  
  console.log(`Ohnrscript time: ${ohnrRes.time.toFixed(2)} ms`);
  console.log(`Ohnrscript mem: ${(ohnrRes.mem / 1024 / 1024).toFixed(2)} MB`);
}
