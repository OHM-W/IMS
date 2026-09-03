const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- TEST: multiDb.ts .env Multi-Candidate Resolution ---');

// Test 1: Verify candidate paths exist and resolve correctly
const cwdCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../../.env'),
];

const existing = cwdCandidates.filter(p => fs.existsSync(p));
console.log(`Found ${existing.length} existing .env candidate(s)`);
assert(existing.length > 0, 'At least one .env candidate must exist');

// Test 2: Clean env and load multiDb
delete process.env.DRILL_DB_PASSWORD;
delete process.env.CHEM_DB_PASSWORD;
delete process.env.CUT_DB_PASSWORD;

// Capture console logs to ensure passwords are NEVER logged
const logs = [];
const origLog = console.log;
console.log = (...args) => {
  logs.push(args.join(' '));
  origLog.apply(console, args);
};

delete require.cache[require.resolve('../dist/multiDb.js')];
const { multiDb } = require('../dist/multiDb.js');

console.log = origLog;

// Verify process.env[spec.password_env] was populated
assert.strictEqual(typeof process.env.DRILL_DB_PASSWORD, 'string', 'DRILL_DB_PASSWORD must be a string');
assert(process.env.DRILL_DB_PASSWORD.length > 0, 'DRILL_DB_PASSWORD must be non-empty');

assert.strictEqual(typeof process.env.CHEM_DB_PASSWORD, 'string', 'CHEM_DB_PASSWORD must be a string');
assert(process.env.CHEM_DB_PASSWORD.length > 0, 'CHEM_DB_PASSWORD must be non-empty');

assert.strictEqual(typeof process.env.CUT_DB_PASSWORD, 'string', 'CUT_DB_PASSWORD must be a string');
assert(process.env.CUT_DB_PASSWORD.length > 0, 'CUT_DB_PASSWORD must be non-empty');

// Verify secret hygiene: No logs contain the actual password values
for (const logLine of logs) {
  assert(!logLine.includes(process.env.DRILL_DB_PASSWORD), 'Log must NOT contain DRILL_DB_PASSWORD');
  assert(!logLine.includes(process.env.CHEM_DB_PASSWORD), 'Log must NOT contain CHEM_DB_PASSWORD');
  assert(!logLine.includes(process.env.CUT_DB_PASSWORD), 'Log must NOT contain CUT_DB_PASSWORD');
}

console.log('[PASS] .env multi-candidate resolution verified successfully (no secrets leaked)');
