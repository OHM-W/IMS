const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- TEST: Dynamic Multi-DB Query Ingestion ---');

const { multiDb } = require('../dist/multiDb.js');
const { broadcaster } = require('../dist/broadcaster.js');

// Test 1: getQuery for drill_db via query_file
const drillQuery = multiDb.getQuery('drill_db');
assert(drillQuery, 'drill_db query must be loaded from query_file');
assert(drillQuery.includes('tbl_dr_event'), 'drillQuery must contain tbl_dr_event');
console.log('[PASS] query_file loaded successfully for drill_db');

// Test 2: inline query registration
multiDb.registerPool({
  key: 'test_inline_db',
  type: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  database: 'test_db',
  user: 'postgres',
  process_type: 'CUSTOM_LINE',
  query: 'SELECT unit_id AS eqp_id, 1 AS status, now() AS last_seen, 45.5 AS custom_metric FROM tbl_test',
  enabled: true
});

const inlineQuery = multiDb.getQuery('test_inline_db');
assert.strictEqual(inlineQuery, 'SELECT unit_id AS eqp_id, 1 AS status, now() AS last_seen, 45.5 AS custom_metric FROM tbl_test');
console.log('[PASS] inline query retrieved successfully');

// Test 3: disabled database returns null query
multiDb.registerPool({
  key: 'test_disabled_db',
  type: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  database: 'test_db',
  user: 'postgres',
  query: 'SELECT 1',
  enabled: false
});
assert.strictEqual(multiDb.getQuery('test_disabled_db'), null, 'Disabled DB must return null query');
console.log('[PASS] disabled database query handled properly');

// Test 4: formatRow preserves dynamic custom columns
const sampleRow = {
  eqp_id: 'UNIT-001',
  status: 1,
  process_type: 'CUSTOM_LINE',
  custom_metric: 45.5,
  pressure: '2.4 bar'
};

const payload = broadcaster.buildPayload([sampleRow]);
assert(payload.machines['UNIT-001'], 'UNIT-001 must exist in machines map');
assert.strictEqual(payload.machines['UNIT-001'].custom_metric, 45.5, 'custom_metric must be preserved');
assert.strictEqual(payload.machines['UNIT-001'].pressure, '2.4 bar', 'pressure must be preserved');
console.log('[PASS] custom dynamic columns preserved in telemetry payload');

console.log('--- ALL DYNAMIC QUERY INGESTION TESTS PASSED ---');
