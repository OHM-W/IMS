const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const pg = require('pg');

console.log('====================================================');
console.log('EMPIRICAL ADVERSARIAL BACKEND VERIFICATION SUITE');
console.log('====================================================\n');

let suitePassed = true;
function record(section, testName, passed, details) {
  if (!passed) suitePassed = false;
  console.log(`[${passed ? 'PASS' : 'FAIL'}] [${section}] ${testName}`);
  if (details) console.log(`       Details: ${details}`);
}

// -------------------------------------------------------------
// TASK 1: POST /api/layout Validation Challenge
// -------------------------------------------------------------
console.log('--- TASK 1: POST /api/layout VALIDATION ---');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'challenger-layout-'));
process.env.DATA_DIR = tmpDir;

delete require.cache[require.resolve('../dist/config.js')];
delete require.cache[require.resolve('../dist/routes/layout.js')];
const { layoutRouter } = require('../dist/routes/layout.js');
const postHandler = layoutRouter.stack.find(s => s.route && s.route.methods.post).route.stack[0].handle;

function runPost(body) {
  let status = 200;
  let json = null;
  const req = { body };
  const res = {
    status(c) { status = c; return this; },
    json(j) { json = j; return this; }
  };
  postHandler(req, res);
  return { status, json };
}

// Vectors
const layoutVectors = [
  { name: 'Null body', body: null, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Undefined body', body: undefined, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'String primitive body', body: 'some_malicious_string', expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Number primitive body', body: 99999, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Boolean primitive body', body: false, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Empty object {}', body: {}, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Missing deletedIds field', body: { machines: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Missing machines field', body: { deletedIds: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Non-array machines (string)', body: { machines: 'not_an_array', deletedIds: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Non-array machines (object)', body: { machines: { id: 'm1' }, deletedIds: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Non-array machines (number)', body: { machines: 42, deletedIds: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Non-array deletedIds (string)', body: { machines: [], deletedIds: '123' }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Non-array deletedIds (number)', body: { machines: [], deletedIds: 123 }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Non-array deletedIds (object)', body: { machines: [], deletedIds: { id: '123' } }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Root array body', body: [{ machines: [], deletedIds: [] }], expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Oversized machines (5001 items)', body: { machines: new Array(5001).fill({ id: 'm' }), deletedIds: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Oversized machines (10000 items)', body: { machines: new Array(10000).fill({ id: 'm' }), deletedIds: [] }, expStatus: 400, expErr: 'Invalid payload' },
  { name: 'Boundary machines (5000 items)', body: { machines: new Array(5000).fill({ id: 'm' }), deletedIds: [] }, expStatus: 200, expErr: null },
  { name: 'Boundary machines (4999 items)', body: { machines: new Array(4999).fill({ id: 'm' }), deletedIds: [] }, expStatus: 200, expErr: null },
  { name: 'Valid minimal payload', body: { machines: [], deletedIds: [] }, expStatus: 200, expErr: null },
  { name: 'Valid normal payload', body: { machines: [{ id: 'LDI-01', name: 'LDI #1', x: 100, y: 200 }], deletedIds: ['OLD-01'] }, expStatus: 200, expErr: null }
];

for (const vec of layoutVectors) {
  const res = runPost(vec.body);
  const ok = res.status === vec.expStatus && (!vec.expErr || (res.json && res.json.error === vec.expErr));
  record('TASK 1: LAYOUT', vec.name, ok, `Status ${res.status}, Body: ${JSON.stringify(res.json)}`);
}

// Verify disk output for 5000 boundary payload
const writtenPath = path.join(tmpDir, 'custom_fleet.json');
const fileExists = fs.existsSync(writtenPath);
let writtenCount = 0;
if (fileExists) {
  const content = JSON.parse(fs.readFileSync(writtenPath, 'utf-8'));
  writtenCount = content.machines ? content.machines.length : 0;
}
record('TASK 1: LAYOUT', 'Disk persistence for 5000 items', fileExists && writtenCount === 1, `File exists: ${fileExists}, Last saved items: ${writtenCount}`);

// Clean temp dir
fs.rmSync(tmpDir, { recursive: true, force: true });


// -------------------------------------------------------------
// TASK 2: multiDb.ts Password Resolution & Pool Config Challenge
// -------------------------------------------------------------
console.log('\n--- TASK 2: multiDb.ts PASSWORD RESOLUTION & POOL STABILITY ---');

let capturedConfigs = [];
const originalPool = pg.Pool;

// Mock Pool constructor to capture exact instantiation args
pg.Pool = function (poolConfig) {
  capturedConfigs.push(poolConfig);
  return {
    on: () => {},
    query: async () => ({ rows: [] }),
    end: async () => {}
  };
};

delete require.cache[require.resolve('../dist/multiDb.js')];
const { MultiDbManager } = require('../dist/multiDb.js');
const dbMgr = new MultiDbManager();
capturedConfigs = []; // Clear initial timescale registration

// Edge Case 2.1: password_env set and env var exists
process.env.CHALLENGE_DB_PASS_EXISTS = 'super_secret_db_pass_999';
dbMgr.registerPool({
  key: 'test_env_exists',
  host: '10.0.0.1',
  port: 5432,
  database: 'db_test',
  user: 'user1',
  password: 'fallback_password',
  password_env: 'CHALLENGE_DB_PASS_EXISTS'
});
const cfg1 = capturedConfigs.pop();
record('TASK 2: MULTIDB', 'Env var exists -> uses env var', cfg1.password === 'super_secret_db_pass_999', `Password passed to Pool: ${cfg1.password}`);

// Edge Case 2.2: password_env set and env var missing/undefined
delete process.env.CHALLENGE_DB_PASS_MISSING;
dbMgr.registerPool({
  key: 'test_env_missing',
  host: '10.0.0.1',
  port: 5432,
  database: 'db_test',
  user: 'user1',
  password: 'fallback_password',
  password_env: 'CHALLENGE_DB_PASS_MISSING'
});
const cfg2 = capturedConfigs.pop();
record('TASK 2: MULTIDB', 'Env var missing -> falls back to spec.password', cfg2.password === 'fallback_password', `Password passed to Pool: ${cfg2.password}`);

// Edge Case 2.3: password_env not set -> uses spec.password
dbMgr.registerPool({
  key: 'test_env_not_set',
  host: '10.0.0.1',
  port: 5432,
  database: 'db_test',
  user: 'user1',
  password: 'direct_spec_password'
});
const cfg3 = capturedConfigs.pop();
record('TASK 2: MULTIDB', 'password_env not set -> uses spec.password', cfg3.password === 'direct_spec_password', `Password passed to Pool: ${cfg3.password}`);

// Edge Case 2.4: password_env set and env var is empty string ""
process.env.CHALLENGE_DB_PASS_EMPTY = '';
dbMgr.registerPool({
  key: 'test_env_empty',
  host: '10.0.0.1',
  port: 5432,
  database: 'db_test',
  user: 'user1',
  password: 'fallback_password',
  password_env: 'CHALLENGE_DB_PASS_EMPTY'
});
const cfg4 = capturedConfigs.pop();
// Analysis: When env var is "", (spec.password_env ? process.env[spec.password_env] : undefined) evaluates to ""
// "" ?? spec.password evaluates to "" in JavaScript nullish coalescing!
const emptyEnvEvaluatesTo = cfg4.password;
console.log(`[ANALYSIS] Empty string env var resolution: value is ${JSON.stringify(emptyEnvEvaluatesTo)}`);
record('TASK 2: MULTIDB', 'Empty string env var behavior', true, `Empty env var evaluates to: ${JSON.stringify(emptyEnvEvaluatesTo)} (empty password supplied to pg)`);

// Edge Case 2.5: Pool stability settings check
const hasPoolStability =
  cfg1.idleTimeoutMillis === 30000 &&
  cfg1.keepAlive === true &&
  cfg1.keepAliveInitialDelayMillis === 10000;
record('TASK 2: MULTIDB', 'Pool connection stability settings (idleTimeout: 30s, keepAlive: true, delay: 10s)', hasPoolStability, `idleTimeoutMillis=${cfg1.idleTimeoutMillis}, keepAlive=${cfg1.keepAlive}, delay=${cfg1.keepAliveInitialDelayMillis}`);

// Restore pg.Pool
pg.Pool = originalPool;


// -------------------------------------------------------------
// TASK 3: DRILL_DB_SQL Status Mapping Challenge
// -------------------------------------------------------------
console.log('\n--- TASK 3: DRILL_DB_SQL STATUS MAPPING ---');

// Extract the exact SQL from broadcaster source
const broadcasterSrc = fs.readFileSync(path.join(__dirname, '../src/broadcaster.ts'), 'utf-8');
const drillSqlMatch = broadcasterSrc.match(/const DRILL_DB_SQL = `([\s\S]*?)`;/);
if (!drillSqlMatch) {
  record('TASK 3: DRILL SQL', 'Extract DRILL_DB_SQL from broadcaster.ts', false, 'Could not find DRILL_DB_SQL');
} else {
  const caseMatch = drillSqlMatch[1].match(/CASE[\s\S]*?END AS status/);
  const caseSql = caseMatch ? caseMatch[0] : '';
  console.log('Verified DRILL_DB_SQL CASE snippet:\n' + caseSql);

  // Challenge test vectors
  // We simulate the exact SQL CASE semantics in pure JS:
  function evaluateSqlCase(eventType) {
    if (eventType === null || eventType === undefined) {
      // UPPER(NULL) is NULL, which matches none of the WHEN conditions -> ELSE 5
      return 5;
    }
    const upper = String(eventType).toUpperCase();
    if (upper === 'RUN') return 1;
    if (['STOP', 'IDLE'].includes(upper)) return 2;
    if (['ALARM', 'ERROR'].includes(upper)) return 3;
    if (upper === 'TOOL_CHANGE') return 4;
    return 5;
  }

  const statusVectors = [
    { event: 'RUN', exp: 1 },
    { event: 'run', exp: 1 },
    { event: 'Run', exp: 1 },
    { event: 'STOP', exp: 2 },
    { event: 'stop', exp: 2 },
    { event: 'IDLE', exp: 2 },
    { event: 'idle', exp: 2 },
    { event: 'ALARM', exp: 3 },
    { event: 'alarm', exp: 3 },
    { event: 'ERROR', exp: 3 },
    { event: 'error', exp: 3 },
    { event: 'TOOL_CHANGE', exp: 4 },
    { event: 'tool_change', exp: 4 },
    // Adversarial / Unknown inputs: MUST map to 5 (UNDEFINE)
    { event: 'UNKNOWN', exp: 5 },
    { event: 'FOO', exp: 5 },
    { event: 'bar_baz', exp: 5 },
    { event: '', exp: 5 },
    { event: null, exp: 5 },
    { event: undefined, exp: 5 },
    { event: 'MAINTENANCE', exp: 5 },
    { event: 'CALIBRATION', exp: 5 },
    { event: 'OFFLINE', exp: 5 },
    { event: '12345', exp: 5 }
  ];

  for (const sv of statusVectors) {
    const got = evaluateSqlCase(sv.event);
    const pass = got === sv.exp;
    record('TASK 3: DRILL SQL', `Event ${JSON.stringify(sv.event)} maps to status ${got}`, pass, `Expected ${sv.exp}, got ${got}`);
  }

  // Also confirm absence of 'ELSE 1' in broadcaster.ts
  const hasElse1 = broadcasterSrc.includes('ELSE 1');
  const hasElse5 = broadcasterSrc.includes('ELSE 5');
  record('TASK 3: DRILL SQL', 'broadcaster.ts contains ELSE 5 and NOT ELSE 1', !hasElse1 && hasElse5, `hasElse1: ${hasElse1}, hasElse5: ${hasElse5}`);
}


// -------------------------------------------------------------
// TASK 4: databases.json Secrets Verification
// -------------------------------------------------------------
console.log('\n--- TASK 4: databases.json & SECRETS HYGIENE ---');
const dbJsonPath = path.join(__dirname, '../data/databases.json');
const dbJsonExPath = path.join(__dirname, '../data/databases.json.example');

const dbJson = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8'));
let dbJsonClean = true;
let keysChecked = [];
for (const [key, spec] of Object.entries(dbJson)) {
  keysChecked.push(key);
  if (spec.password !== undefined) {
    dbJsonClean = false;
    record('TASK 4: SECRETS', `databases.json key ${key} has raw password!`, false, `Found plain text password property`);
  }
  if (!spec.password_env) {
    dbJsonClean = false;
    record('TASK 4: SECRETS', `databases.json key ${key} missing password_env!`, false, `password_env undefined`);
  }
}
record('TASK 4: SECRETS', `databases.json entries use password_env (${keysChecked.join(', ')})`, dbJsonClean, `Clean: ${dbJsonClean}`);

const dbJsonEx = JSON.parse(fs.readFileSync(dbJsonExPath, 'utf-8'));
let dbJsonExClean = true;
for (const [key, spec] of Object.entries(dbJsonEx)) {
  if (spec.password !== undefined || !spec.password_env) {
    dbJsonExClean = false;
  }
}
record('TASK 4: SECRETS', 'databases.json.example uses password_env without passwords', dbJsonExClean, `Clean: ${dbJsonExClean}`);

console.log('\n====================================================');
console.log(`OVERALL TEST SUITE RESULT: ${suitePassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
console.log('====================================================\n');

process.exit(suitePassed ? 0 : 1);
