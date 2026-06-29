const { generateUUIDv4 } = require('../src/ohn-uuid.js');

function runTest() {
  const buf = generateUUIDv4();
  
  // Convert buffer to string only for testing
  const uuidStr = Buffer.from(buf).toString('utf8');
  
  console.log(`Generated UUID: ${uuidStr}`);

  // Standard UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(uuidStr)) {
    console.log('✅ TEST PASSED: UUID format is perfectly valid.');
    process.exit(0);
  } else {
    console.error('❌ TEST FAILED: UUID format is invalid.');
    process.exit(1);
  }
}

runTest();
