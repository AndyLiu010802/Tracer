'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SUITES = Object.freeze({ root: 'test', desktop: 'desktop/test' });

function within(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

function createSuiteEnvironment(base, suite, inherited = process.env) {
  if (!Object.hasOwn(SUITES, suite)) throw new Error('Unknown test suite');
  const root = path.join(base, suite);
  fs.mkdirSync(root);
  const dirs = Object.fromEntries(['tmp', 'data', 'home', 'appdata', 'localappdata', 'codex-home', 'desktop-profile', 'music']
    .map(name => [name, path.join(root, name)]));
  for (const directory of Object.values(dirs)) fs.mkdirSync(directory);
  const configFile = path.join(root, 'config.json');
  const stateFile = path.join(root, 'bookmarks.json');
  fs.writeFileSync(configFile, JSON.stringify({ skin: 'tracer', host: '127.0.0.1', port: 0 }) + '\n');
  fs.writeFileSync(stateFile, '{}\n');

  const env = { ...inherited };
  for (const name of Object.keys(env)) {
    // No inherited app paths, providers, credentials, or preloaded code. Values
    // are neither inspected nor included in the report.
    if (/^(?:DOCS_PORTAL_|TRACER_|CODEX_|OPENAI_|ANTHROPIC_|GEMINI_|AZURE_|GOOGLE_|AI_API_|AI_PROVIDER_|AWS_|GH_|GITHUB_|NPM_|INVITE_CODE(?:_|$))/i.test(name)
      || /(?:^|_)(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS?|CONNECTION_STRING)(?:_|$)/i.test(name)
      || /^(?:NODE_OPTIONS|NODE_PATH|NODE_TEST_CONTEXT)$/i.test(name)) delete env[name];
  }
  Object.assign(env, {
    TEMP: dirs.tmp, TMP: dirs.tmp, TMPDIR: dirs.tmp,
    HOME: dirs.home, USERPROFILE: dirs.home,
    APPDATA: dirs.appdata, LOCALAPPDATA: dirs.localappdata,
    CODEX_HOME: dirs['codex-home'],
    TRACER_USER_DATA_DIR: dirs['desktop-profile'], TRACER_DISABLE_INPUT_HOOK: '1',
    DOCS_PORTAL_DATA_DIR: dirs.data, DOCS_PORTAL_STATE_FILE: stateFile,
    DOCS_PORTAL_CONFIG_FILE: configFile, DOCS_PORTAL_MUSIC_DIR: dirs.music,
    DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_PORT: '0',
  });
  return { root, env, configFile, stateFile, dirs };
}

function testFiles(repoRoot, suite, selected) {
  const directory = path.resolve(repoRoot, SUITES[suite]);
  const files = selected || fs.readdirSync(directory).filter(name => name.endsWith('.test.js')).sort().map(name => path.join(directory, name));
  if (!files.length) throw new Error('No test files selected');
  return files.map(file => {
    const absolute = path.resolve(repoRoot, file);
    if (!within(directory, absolute) || !absolute.endsWith('.test.js') || !fs.statSync(absolute).isFile()) {
      throw new Error('Tests must be .test.js files inside the selected suite');
    }
    return absolute;
  });
}

function tapCounts(log) {
  const counts = {};
  for (const name of ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    const values = [...log.matchAll(new RegExp('^# ' + name + ' (\\d+)\\s*$', 'gm'))];
    counts[name] = values.length ? Number(values.at(-1)[1]) : null;
  }
  return counts;
}

async function runSuite({ repoRoot = REPO_ROOT, base, suite, files, inherited = process.env, notify = () => {} }) {
  if (!Object.hasOwn(SUITES, suite)) throw new Error('Unknown test suite');
  const selected = testFiles(repoRoot, suite, files);
  const isolated = createSuiteEnvironment(base, suite, inherited);
  const stdoutLog = path.join(isolated.root, 'stdout.tap');
  const stderrLog = path.join(isolated.root, 'stderr.log');
  const stdout = fs.openSync(stdoutLog, 'wx');
  const stderr = fs.openSync(stderrLog, 'wx');
  const startedAt = new Date().toISOString();
  let child;
  try {
    child = spawn(process.execPath, ['--test', '--test-reporter=tap', ...selected], {
      cwd: repoRoot, env: isolated.env, stdio: ['ignore', stdout, stderr], windowsHide: true,
    });
  } finally {
    fs.closeSync(stdout); fs.closeSync(stderr);
  }
  const statusFile = path.join(isolated.root, 'process.json');
  fs.writeFileSync(statusFile, JSON.stringify({ suite, pid: child.pid || null, startedAt, state: 'running', testFiles: selected.length }, null, 2) + '\n');
  notify({ suite, pid: child.pid || null, state: 'running', testFiles: selected.length });
  const completion = await new Promise(resolve => {
    let spawnError;
    child.once('error', error => { spawnError = { code: error.code || 'SPAWN_ERROR', message: error.message }; });
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal, ...(spawnError ? { spawnError } : {}) }));
  });
  const counts = tapCounts(fs.readFileSync(stdoutLog, 'utf8'));
  const result = { suite, pid: child.pid || null, startedAt, finishedAt: new Date().toISOString(), state: 'completed',
    testFiles: selected.length, ...completion, counts, stdoutLog, stderrLog, isolationRoot: isolated.root };
  fs.writeFileSync(statusFile, JSON.stringify(result, null, 2) + '\n');
  notify(result);
  return result;
}

function sourceHashes(repoRoot) {
  return Object.fromEntries(['server.js', 'dev/test-isolated.cjs', 'dev/test-server-fixture.cjs'].filter(file => fs.existsSync(path.join(repoRoot, file)))
    .map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, file))).digest('hex')]));
}

async function main(args = process.argv.slice(2)) {
  let suite = 'all', output;
  const files = [];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i], value = args[++i];
    if (value === undefined) throw new Error('Missing option value');
    if (flag === '--suite') suite = value;
    else if (flag === '--output') output = path.resolve(value);
    else if (flag === '--file') files.push(value);
    else throw new Error('Unknown option');
  }
  if (suite !== 'all' && !Object.hasOwn(SUITES, suite)) throw new Error('Unknown test suite');
  if (suite === 'all' && files.length) throw new Error('--file requires one explicit suite');
  if (output) fs.mkdirSync(output); // Existing output, including any user profile, is rejected.
  else output = fs.mkdtempSync(path.join(os.tmpdir(), 'tracer-isolated-tests-'));
  const hashesBefore = sourceHashes(REPO_ROOT);
  const suites = suite === 'all' ? Object.keys(SUITES) : [suite];
  const results = await Promise.all(suites.map(name => runSuite({ base: output, suite: name, files: files.length ? files : undefined,
    notify: value => process.stdout.write(JSON.stringify({ suite: value.suite, pid: value.pid, state: value.state, ...(value.counts ? { counts: value.counts, exitCode: value.exitCode } : {}) }) + '\n') })));
  const report = { output, hashesBefore, hashesAfter: sourceHashes(REPO_ROOT), results,
    limits: ['Synthetic isolation covers explicit paths and inherited credentials; it is not an operating-system sandbox.', 'No QA scripts, installer, or user application are launched.'] };
  fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write('Report: ' + path.join(output, 'result.json') + '\n');
  if (results.some(result => result.exitCode !== 0 || result.counts.fail !== 0 || result.counts.tests === null)) process.exitCode = 1;
  return report;
}

module.exports = { createSuiteEnvironment, testFiles, tapCounts, runSuite, main };
if (require.main === module) main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
