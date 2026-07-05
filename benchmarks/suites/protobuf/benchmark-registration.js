const { performance } = require('perf_hooks');
const cbor = require('cbor');
const babel = require('@babel/core');
const cborPlugin = require('../core/src/plugins/babel-plugin-cbor-aot');
const fs = require('fs');

function transpile(code) {
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

const input = fs.readFileSync(__dirname + '/../examples/RegistrationPayload.ohn', 'utf-8');
const output = transpile(input);

const RegistrationPayload = eval(`
  (function() {
    var module = { exports: {} };
    ${output}
    return module.exports;
  })();
`);

const payload = require('../mock-payload.json');

const ITERATIONS = 100000;

console.log("Warming up Registration Payload benchmark...");
const ohnrPayload = new RegistrationPayload(
  payload._v, payload._t, payload.title, payload.artist, payload.duration_ms, 
  payload.isrc, payload.upc, payload.p_line, payload.c_line, payload.primary_genre, 
  payload.secondary_genre, payload.language, payload.bitrate, payload.sample_rate, 
  payload.channels, payload.format, payload.album_title, payload.track_number, 
  payload.release_date, payload.original_release_date, payload.label, 
  payload.catalog_number, payload.version, payload.parental_advisory, 
  payload.featured_artists, payload.composers, payload.lyricists, payload.writers, 
  payload.producers, payload.remixer, payload.recording_location, payload.recording_year, 
  payload.iswc, payload.territories, payload.preview_start_ms, payload.owner_id, 
  payload.origin_platform, payload.origin_timestamp, payload.fingerprint_hash, 
  payload.fingerprint_raw
);

for (let i = 0; i < 100; i++) {
  cbor.encode(payload);
  ohnrPayload.toCBOR();
}

console.log(`Running benchmarks for ${ITERATIONS} iterations on 40-field payload...`);

global.gc && global.gc();
const startCbor = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  cbor.encode(payload);
}
const endCbor = performance.now();
console.log(`Standard CBOR library: ${(endCbor - startCbor).toFixed(2)} ms`);

global.gc && global.gc();
const startOhnr = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  ohnrPayload.toCBOR();
}
const endOhnr = performance.now();
console.log(`Ohnrscript AOT CBOR: ${(endOhnr - startOhnr).toFixed(2)} ms`);

const speedup = (endCbor - startCbor) / (endOhnr - startOhnr);
console.log(`Speedup: ${speedup.toFixed(2)}x faster!`);
