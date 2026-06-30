const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');
const cborPlugin = require('../core/src/plugins/babel-plugin-cbor-aot');

// Compile RegistrationPayload to generate the exact binary layout Ohnrscript expects
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

const payload = require('../mock-payload.json');
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

const cborPayload = Buffer.from(ohnrPayload.toCBOR());

console.log(`Generated CBOR payload size: ${cborPayload.length} bytes`);

const DURATION = 60; // 60 seconds
const CONNECTIONS = 10000; // 10,000 concurrent connections

async function runTest(url, name) {
  console.log(`\nStarting sustained assault on ${name} (${url})`);
  console.log(`Connections: ${CONNECTIONS}, Duration: ${DURATION}s...`);
  
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url,
      connections: CONNECTIONS,
      duration: DURATION,
      method: 'POST',
      body: cborPayload,
      headers: {
        'Content-Type': 'application/cbor'
      }
    }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  try {
    const standardResult = await runTest('http://localhost:3000/api/standard', 'Standard Stack');
    console.log('\n--- Waiting 10 seconds for GC to settle before next test ---\n');
    await new Promise(r => setTimeout(r, 10000));
    
    const ohnrscriptResult = await runTest('http://localhost:3000/api/ohnrscript', 'Ohnrscript Stack');

    console.log('\n=========================================');
    console.log('         LOAD TEST RESULTS SUMMARY       ');
    console.log('=========================================');
    
    function printStats(name, res) {
      console.log(`\n[${name}]`);
      console.log(`Throughput: ${res.requests.average} req/sec`);
      console.log(`Total Requests: ${res.requests.total}`);
      console.log(`Errors (Timeouts/Resets): ${res.errors}`);
      console.log(`1xx/2xx/3xx/4xx/5xx: ${res['1xx']} / ${res['2xx']} / ${res['3xx']} / ${res['4xx']} / ${res['5xx']}`);
      console.log(`Latency (ms):`);
      console.log(`  Average: ${res.latency.average}`);
      console.log(`  p50:     ${res.latency.p50}`);
      console.log(`  p99:     ${res.latency.p99}`);
      console.log(`  p99.9:   ${res.latency.p99_9}`);
      console.log(`  p99.99:  ${res.latency.p99_99}`);
      console.log(`  Max:     ${res.latency.max}`);
    }

    printStats('Standard Stack', standardResult);
    printStats('Ohnrscript Stack', ohnrscriptResult);
    
    fs.writeFileSync('load-test-results.json', JSON.stringify({ standard: standardResult, ohnrscript: ohnrscriptResult }, null, 2));
    console.log('\nResults saved to load-test-results.json');
    
  } catch (err) {
    console.error('Error running load test:', err);
  }
}

main();
