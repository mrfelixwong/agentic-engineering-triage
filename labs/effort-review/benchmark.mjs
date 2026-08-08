import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const PREPARE = path.join(HERE, 'prepare.py');
const GRADER = path.join(HERE, 'grade.py');
const PROMPT = `Strengthen the release-safety tests for the latest commit.

Read the changed code, its callers, and the repository contracts. Add focused
regression tests for consequential production failures that the current tests
do not cover. Do not stop after the first gap.

Only change files under tests/. Do not edit application code, contracts, test
configuration, or evaluation data. The tests must pass the correct
implementation and fail plausible broken implementations.

Run the repository tests and evaluation. Return the risks covered, files
changed, and exact command outputs.`;

const argv = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : fallback;
};
const stage = value('--stage', 'pilot');
const requestedModel = value('--model', 'claude-sonnet-5');
const efforts = value('--efforts', stage === 'pilot' ? 'low,max' : 'low,medium,high,max')
  .split(',').filter(Boolean);
const repetitions = Number(value('--repetitions', stage === 'pilot' ? '3' : '10'));
const concurrency = Number(value('--concurrency', '4'));
const maxBudgetUsd = Number(value('--max-budget-usd', '2.0'));
const seed = value('--seed', `effort-quality-${stage}-2026-08-07`);
const output = path.resolve(value(
  '--output',
  path.join(HERE, 'captures', `mutation-${stage}-runs-2026-08-07.json`),
));
const resume = argv.includes('--resume');
const venv = path.resolve(process.env.TRIAGE_LAB_VENV || path.join(REPO, '.venv'));

if (!['pilot', 'final'].includes(stage)) throw new Error('stage must be pilot or final');
if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('repetitions must be positive');
if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('concurrency must be positive');
if (!Number.isFinite(maxBudgetUsd) || maxBudgetUsd <= 0) throw new Error('max budget must be positive');
if (!fs.existsSync(path.join(venv, 'bin', 'pytest'))) {
  throw new Error(`missing ${venv}; run ./setup.sh or set TRIAGE_LAB_VENV`);
}
if (fs.existsSync(output) && !resume) {
  throw new Error(`${output} already exists; choose a new --output or pass --resume`);
}

function runSync(command, args, cwd, check = true) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, TRIAGE_LAB_VENV: venv },
  });
  if (check && result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status})\n${result.stderr || result.stdout}`);
  }
  return result;
}

function runAsync(command, args, cwd, timeoutMs = 15 * 60 * 1000) {
  return new Promise(resolve => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, TRIAGE_LAB_VENV: venv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout, stderr });
    });
  });
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function seededRandom(seedText) {
  let state = Number.parseInt(sha256(seedText).slice(0, 8), 16) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle(items, seedText) {
  const random = seededRandom(seedText);
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function parseStream(stdout) {
  const events = stdout.split('\n').filter(Boolean).map(line => {
    try { return JSON.parse(line); } catch { return { type: 'unparsed', raw: line }; }
  });
  const result = [...events].reverse().find(event => event.type === 'result') || {};
  const init = events.find(event => event.type === 'system' && event.subtype === 'init') || {};
  const toolCalls = [];
  const toolResults = [];
  for (const event of events) {
    const content = event?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (item.type === 'tool_use') toolCalls.push({ id: item.id, name: item.name, input: item.input });
      if (item.type === 'tool_result') toolResults.push({ toolUseId: item.tool_use_id, content: item.content });
    }
  }
  return { result, init, toolCalls, toolResults };
}

function prepareRun(job) {
  const target = path.join(os.tmpdir(), `triage-effort-quality-${stage}-${job.order}-${job.effort}-r${job.repetition}`);
  const result = runSync(
    path.join(venv, 'bin', 'python'),
    [PREPARE, '--target', target, '--path-only'],
    REPO,
  );
  return result.stdout.trim();
}

async function executeJob(job) {
  const cwd = prepareRun(job);
  const initialPytest = runSync('.venv/bin/pytest', ['-q'], cwd, false);
  const initialEval = runSync('.venv/bin/python', ['-m', 'eval.run'], cwd, false);
  const started = Date.now();
  const claude = await runAsync('claude', [
    '-p', PROMPT,
    '--model', requestedModel,
    '--effort', job.effort,
    '--permission-mode', 'bypassPermissions',
    '--dangerously-skip-permissions',
    '--safe-mode',
    '--no-session-persistence',
    '--output-format', 'stream-json',
    '--verbose',
    '--max-budget-usd', String(maxBudgetUsd),
  ], cwd);
  const elapsedMs = Date.now() - started;
  const parsed = parseStream(claude.stdout || '');
  const finalPytest = runSync('.venv/bin/pytest', ['-q'], cwd, false);
  const finalEval = runSync('.venv/bin/python', ['-m', 'eval.run'], cwd, false);
  const grader = runSync(
    path.join(venv, 'bin', 'python'),
    [GRADER, cwd, '--json'],
    REPO,
    false,
  );
  let grade = { valid: false, qualityScore: 0, error: grader.stderr || grader.stdout };
  try { grade = JSON.parse(grader.stdout); } catch { /* captured above */ }
  const usage = parsed.result.usage || {};
  return {
    order: job.order,
    effort: job.effort,
    repetition: job.repetition,
    claudeExit: claude.status,
    claudeSignal: claude.signal,
    claudeStderr: claude.stderr,
    model: parsed.init.model || null,
    durationMs: parsed.result.duration_ms || elapsedMs,
    turns: parsed.result.num_turns || null,
    costUsd: parsed.result.total_cost_usd ?? null,
    contextTokens: (usage.input_tokens || 0)
      + (usage.cache_creation_input_tokens || 0)
      + (usage.cache_read_input_tokens || 0),
    initialPytest: { exit: initialPytest.status, output: `${initialPytest.stdout}${initialPytest.stderr}` },
    initialEval: { exit: initialEval.status, output: `${initialEval.stdout}${initialEval.stderr}` },
    finalPytest: { exit: finalPytest.status, output: `${finalPytest.stdout}${finalPytest.stderr}` },
    finalEval: { exit: finalEval.status, output: `${finalEval.stdout}${finalEval.stderr}` },
    graderExit: grader.status,
    grade,
    actualClaudeOutput: String(parsed.result.result || ''),
    toolCalls: parsed.toolCalls,
    toolResults: parsed.toolResults,
  };
}

const fixtureHash = runSync(path.join(venv, 'bin', 'python'), [PREPARE, '--fixture-hash'], REPO).stdout.trim();
const graderHash = sha256(fs.readFileSync(GRADER));
const cliVersion = runSync('claude', ['--version'], REPO).stdout.trim();
const jobs = [];
for (const effort of efforts) {
  for (let repetition = 1; repetition <= repetitions; repetition += 1) jobs.push({ effort, repetition });
}
const randomizedJobs = shuffle(jobs, seed).map((job, index) => ({ ...job, order: index + 1 }));

let capture = {
  benchmark: {
    stage,
    startedAt: new Date().toISOString(),
    requestedModel,
    resolvedModels: [],
    claudeCliVersion: cliVersion,
    efforts,
    repetitionsPerEffort: repetitions,
    prompt: PROMPT,
    promptSha256: sha256(PROMPT),
    fixtureVersion: 2,
    fixtureSha256: fixtureHash,
    graderSha256: graderHash,
    platform: process.platform,
    architecture: process.arch,
    osRelease: os.release(),
    freshRepositoryPerRun: true,
    freshProcessPerRun: true,
    safeMode: true,
    sessionPersistence: false,
    randomizedOrder: true,
    randomSeed: seed,
    runOrder: randomizedJobs,
    concurrency,
    maxBudgetUsdPerRun: maxBudgetUsd,
    primaryMetric: 'percentage of eight deterministic production mutants killed by submitted tests',
    pilotThreshold: 'max mean >= low mean + 15 points; max valid-run rate >= low',
    finalThreshold: 'max mean >= low mean + 20 points and max beats low in >=7/10 matched repetitions',
  },
  runs: [],
};
if (resume && fs.existsSync(output)) capture = JSON.parse(fs.readFileSync(output, 'utf8'));
const completed = new Set(capture.runs.map(run => `${run.effort}:${run.repetition}`));
const remaining = randomizedJobs.filter(job => !completed.has(`${job.effort}:${job.repetition}`));
fs.mkdirSync(path.dirname(output), { recursive: true });

let nextIndex = 0;
async function worker() {
  while (nextIndex < remaining.length) {
    const job = remaining[nextIndex];
    nextIndex += 1;
    const result = await executeJob(job);
    capture.runs.push(result);
    capture.runs.sort((a, b) => a.order - b.order);
    capture.benchmark.resolvedModels = [...new Set(capture.runs.map(run => run.model).filter(Boolean))];
    capture.benchmark.completedAt = new Date().toISOString();
    fs.writeFileSync(output, `${JSON.stringify(capture, null, 2)}\n`);
    console.log(
      `${result.order}/${randomizedJobs.length} ${result.effort} r${result.repetition}: `
      + `${result.grade.killedCount || 0}/${result.grade.totalMutants || 8} `
      + `(${result.grade.qualityScore || 0}), ${Math.round(result.durationMs / 1000)}s, `
      + `$${Number(result.costUsd || 0).toFixed(3)}, valid=${Boolean(result.grade.valid)}`,
    );
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, remaining.length || 1) }, worker));
const setupFailures = capture.runs.filter(run => run.initialPytest.exit !== 0 || run.initialEval.exit !== 0);
const cliWarnings = capture.runs.filter(run => run.claudeExit !== 0);
capture.benchmark.completedAt = new Date().toISOString();
capture.benchmark.operationalWarnings = cliWarnings.map(run => ({
  effort: run.effort,
  repetition: run.repetition,
  claudeExit: run.claudeExit,
  claudeSignal: run.claudeSignal,
  executableResultValid: Boolean(run.grade.valid),
}));
fs.writeFileSync(output, `${JSON.stringify(capture, null, 2)}\n`);
if (capture.runs.length !== randomizedJobs.length || setupFailures.length) {
  throw new Error(`benchmark incomplete: ${capture.runs.length}/${randomizedJobs.length}; ${setupFailures.length} setup failures`);
}
if (cliWarnings.length) console.warn(`${cliWarnings.length} run(s) returned a nonzero CLI exit; graded workspaces remain in the capture`);
console.log(`capture: ${output}`);
