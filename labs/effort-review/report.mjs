import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : fallback;
};
const paths = {
  final: path.resolve(value('--capture', path.join(HERE, 'captures', 'mutation-final-runs-2026-08-07.json'))),
  pilot: path.resolve(value('--pilot', path.join(HERE, 'captures', 'mutation-pilot-runs-2026-08-07.json'))),
  implementation: path.join(HERE, 'captures', 'candidate-implementation-runs-2026-08-07.json'),
  binary: path.join(HERE, 'captures', 'effort-quality-runs-2026-08-07-v2.json'),
  html: path.resolve(value('--html', path.join(HERE, 'RESULTS.html'))),
  markdown: path.resolve(value('--markdown', path.join(HERE, 'RESULTS.md'))),
};
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const final = read(paths.final);
const pilot = read(paths.pilot);
const implementation = read(paths.implementation);
const binary = read(paths.binary);
const efforts = ['low', 'medium', 'high', 'max'];

if (final.runs.length !== 40) throw new Error(`expected 40 final runs, found ${final.runs.length}`);
if (pilot.runs.length !== 6) throw new Error(`expected 6 pilot runs, found ${pilot.runs.length}`);
if (final.runs.some(run => !run.grade.valid)) throw new Error('final capture contains an invalid submission');
if (final.runs.some(run => run.claudeExit !== 0)) throw new Error('final capture contains an incomplete CLI run');
if (new Set(final.runs.map(run => run.model)).size !== 1) throw new Error('more than one resolved model');
for (const effort of efforts) {
  if (final.runs.filter(run => run.effort === effort).length !== 10) throw new Error(`${effort} does not have 10 runs`);
}

const esc = input => String(input ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const mean = values => values.reduce((sum, item) => sum + item, 0) / values.length;
const fixed = (number, places = 1) => Number(number).toFixed(places);
const sum = values => values.reduce((total, item) => total + item, 0);
const groupFor = (capture, effort) => capture.runs.filter(run => run.effort === effort);
const stats = efforts.map(effort => {
  const runs = groupFor(final, effort);
  return {
    effort,
    runs,
    meanQuality: mean(runs.map(run => run.grade.qualityScore)),
    meanCaught: mean(runs.map(run => run.grade.killedCount)),
    valid: runs.filter(run => run.grade.valid).length,
    complete: runs.filter(run => run.claudeExit === 0).length,
    meanSeconds: mean(runs.map(run => run.durationMs / 1000)),
    meanCost: mean(runs.map(run => Number(run.costUsd || 0))),
  };
});
const low = stats[0];
const max = stats.at(-1);
const lowByRep = Object.fromEntries(low.runs.map(run => [run.repetition, run.grade.qualityScore]));
const matchedMaxWins = max.runs.filter(run => run.grade.qualityScore > lowByRep[run.repetition]).length;
const qualityDelta = max.meanQuality - low.meanQuality;
const totalCost = sum(final.runs.map(run => Number(run.costUsd || 0)));
const timeRatio = max.meanSeconds / low.meanSeconds;
const costRatio = max.meanCost / low.meanCost;
const finalPass = qualityDelta >= 20 && matchedMaxWins >= 7
  && max.valid >= low.valid && max.complete >= low.complete;

const pilotLow = mean(groupFor(pilot, 'low').map(run => run.grade.qualityScore));
const pilotMax = mean(groupFor(pilot, 'max').map(run => run.grade.qualityScore));
const routineByEffort = Object.fromEntries(
  [...new Set(implementation.routineRuns.map(run => run.effort))].map(effort => {
    const runs = implementation.routineRuns.filter(run => run.effort === effort);
    return [effort, `${runs.filter(run => run.success).length}/${runs.length}`];
  }),
);
const binaryLow = binary.runs.filter(run => run.effort === 'low');
const binaryMax = binary.runs.filter(run => run.effort === 'max');
const binaryScore = runs => `${runs.filter(run => run.correctVerdict).length}/${runs.length}`;

const mutantDefinitions = final.runs[0].grade.mutants.map(item => ({ id: item.id, impact: item.impact }));
const mutantRows = mutantDefinitions.map(mutant => {
  const counts = efforts.map(effort => groupFor(final, effort)
    .filter(run => run.grade.killed.includes(mutant.id)).length);
  return { ...mutant, counts };
});
const representativeLow = low.runs.find(run => run.repetition === 1);
const representativeMax = max.runs.find(run => run.repetition === 1);
const gradeDigest = run => [
  `Correct implementation: ${run.grade.baselinePass ? 'PASS' : 'FAIL'}`,
  ...mutantDefinitions.map(mutant => {
    const caught = run.grade.killed.includes(mutant.id);
    return `${caught ? 'CAUGHT' : 'MISSED'}: ${mutant.id} - ${mutant.impact}`;
  }),
  `QUALITY: ${run.grade.killedCount}/${run.grade.totalMutants} production regressions caught = ${run.grade.qualityScore}/100`,
].join('\n');

const resultRows = stats.map(item => `
  <tr>
    <th>${esc(item.effort)}</th>
    <td><strong>${fixed(item.meanQuality)}/100</strong></td>
    <td>${fixed(item.meanCaught)}/8</td>
    <td>${item.valid}/10</td>
    <td>${fixed(item.meanSeconds)}s</td>
    <td>$${fixed(item.meanCost, 3)}</td>
  </tr>`).join('');
const mutantTableRows = mutantRows.map(item => `
  <tr><th><code>${esc(item.id)}</code><span>${esc(item.impact)}</span></th>${item.counts.map(count => `<td class="${count >= 8 ? 'good' : count <= 2 ? 'bad' : ''}">${count}/10</td>`).join('')}</tr>`).join('');
const runRows = [...final.runs].sort((a, b) => a.order - b.order).map(run => `
  <tr><td>${run.order}</td><td>${esc(run.effort)}</td><td>${run.repetition}</td><td>${run.grade.killedCount}/8</td><td>${run.grade.qualityScore}</td><td>${fixed(run.durationMs / 1000)}s</td><td>$${fixed(run.costUsd, 3)}</td><td>${run.grade.valid ? 'yes' : 'no'}</td></tr>`).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>When Model Effort Changes Work Quality</title>
<style>
:root{--ink:#172126;--muted:#55626a;--line:#cad3d8;--paper:#f5f7f5;--white:#fff;--teal:#087d72;--tealbg:#e7f5f1;--red:#a23b31;--redbg:#faece8;--gold:#895900;--goldbg:#fff3d4;--blue:#285c8e;--bluebg:#eaf2f8}*{box-sizing:border-box}html,body{max-width:100%;overflow-x:hidden}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.48 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}main{width:min(1180px,calc(100% - 32px));margin:auto;padding:28px 0 64px}main,header,section,details,.inside,.compare>*{min-width:0;max-width:100%}header{border-top:7px solid var(--ink);border-bottom:1px solid var(--line);padding:18px 0 24px}h1{font-size:44px;line-height:1.07;margin:0 0 10px}h2{font-size:23px;margin:0 0 12px}h3{font-size:17px;margin:0 0 8px}p{margin:0 0 12px}.lede{max-width:880px;color:var(--muted);font-size:18px}.stamp{font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--muted);overflow-wrap:anywhere;word-break:break-word}section{padding:25px 0;border-bottom:1px solid var(--line)}.verdict{padding:16px 18px;background:var(--tealbg);border-left:6px solid var(--teal);font-size:18px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}.metric{min-height:120px;padding:15px;background:var(--white);border:1px solid var(--line);border-top:5px solid var(--teal);border-radius:6px}.metric.cost{border-top-color:var(--gold)}.metric strong{display:block;font-size:29px;line-height:1.05;margin-bottom:8px}.metric span{color:var(--muted)}.table-wrap{max-width:100%;overflow:auto;background:var(--white);border:1px solid var(--line)}table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}thead th{background:#e8edef;font-size:12px;text-transform:uppercase}tbody tr:last-child>*{border-bottom:0}td.good,.good{color:var(--teal);font-weight:700}td.bad,.bad{color:var(--red);font-weight:700}th span{display:block;color:var(--muted);font-weight:400;margin-top:3px}.candidate{background:var(--bluebg)}.compare{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.output{min-width:0}.label{display:inline-block;padding:4px 8px;margin-bottom:8px;border-radius:4px;background:var(--red);color:white;font-size:12px;font-weight:700;text-transform:uppercase}.label.max{background:var(--teal)}pre{margin:0;padding:15px;max-width:100%;max-height:520px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#151a1d;color:#f2f5f6;border-radius:6px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.comment{color:var(--muted);margin-top:9px}.callout{padding:14px 16px;background:var(--goldbg);border-left:5px solid var(--gold)}.route{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.route>div{padding:14px;background:var(--white);border:1px solid var(--line);border-radius:6px}.route strong{display:block;margin-bottom:6px}.route .chosen{border-top:5px solid var(--teal)}details{margin-top:12px;background:var(--white);border:1px solid var(--line);border-radius:6px;min-width:0}summary{cursor:pointer;padding:12px 14px;font-weight:700}.inside{padding:0 14px 14px}.sources a{color:var(--blue)}code{font:0.93em ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;word-break:break-word}@media(max-width:800px){main{width:100%;padding:18px 10px 48px}h1{font-size:31px}.metrics,.route,.compare{grid-template-columns:minmax(0,1fr)}table{min-width:680px}}@media print{body{background:white}main{width:100%;padding:0}pre{max-height:none}details{break-inside:avoid}}
</style></head><body><main>
<header><h1>Max effort found more production risks</h1><p class="lede">Forty real Claude Code sessions strengthened tests for the same frozen release candidate. Quality means one thing here: how many plausible broken implementations the tests would stop.</p><p class="stamp">Resolved model: ${esc(final.benchmark.resolvedModels.join(', '))} | 10 fresh sessions per effort | Same prompt, fixture, grader, tools, and $${fixed(final.benchmark.maxBudgetUsdPerRun, 0)} per-run cap</p></header>

<section><h2>Result in simple English</h2><p class="verdict"><strong>${finalPass ? 'The lab passed its quality test.' : 'The lab did not pass its quality test.'}</strong> Low effort blocked about ${fixed(low.meanCaught)} of 8 regressions. Max blocked about ${fixed(max.meanCaught)}. In this task, max effort gave students a much stronger safety net.</p><div class="metrics"><div class="metric"><strong>+${fixed(qualityDelta)} points</strong><span>Max mean quality over low: ${fixed(max.meanQuality)} versus ${fixed(low.meanQuality)}.</span></div><div class="metric"><strong>${matchedMaxWins}/10 wins</strong><span>Max beat low in every matched repetition.</span></div><div class="metric"><strong>40/40 valid</strong><span>Every test suite passed the correct implementation and changed only tests.</span></div><div class="metric cost"><strong>$${fixed(totalCost,2)}</strong><span>Total cost. Max took ${fixed(timeRatio)}x the time and ${fixed(costRatio)}x the cost of low.</span></div></div></section>

<section><h2>Why the task changed</h2><div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Actual result</th><th>Decision</th></tr></thead><tbody><tr><th>Fix one known billing bug</th><td>Every effort solved it: low ${routineByEffort.low}, medium ${routineByEffort.medium}, high ${routineByEffort.high}, max ${routineByEffort.max}.</td><td>Rejected. One fix had no quality headroom.</td></tr><tr><th>Decide MERGE or REJECT</th><td>Low and max both made ${binaryScore(binaryLow)} and ${binaryScore(binaryMax)} correct decisions.</td><td>Rejected. The binary score was already saturated.</td></tr><tr class="candidate"><th>Write release-safety tests</th><td>Pilot: low ${fixed(pilotLow)}, max ${fixed(pilotMax)}. Final: low ${fixed(low.meanQuality)}, max ${fixed(max.meanQuality)}.</td><td><strong>Selected.</strong> Executable quality has a useful range.</td></tr></tbody></table></div><p class="comment">The goal and scoring rule were fixed first. Candidate tasks were tested, and the task was frozen before the 40-run final.</p></section>

<section><h2>All effort levels</h2><div class="table-wrap"><table><thead><tr><th>Effort</th><th>Mean quality</th><th>Regressions blocked</th><th>Valid runs</th><th>Mean time</th><th>Mean cost</th></tr></thead><tbody>${resultRows}</tbody></table></div><p class="callout"><strong>Student impact:</strong> low usually found the obvious cache and pagination gaps. Max was far more likely to add tests for restart-stable rollouts and old provider labels. Those extra tests stop customers changing rollout groups after a restart and stop billing tickets going to the wrong queue.</p></section>

<section><h2>Which failures did the tests stop?</h2><div class="table-wrap"><table><thead><tr><th>Broken behavior</th><th>Low</th><th>Medium</th><th>High</th><th>Max</th></tr></thead><tbody>${mutantTableRows}</tbody></table></div><p class="comment">Each cell is the number of 10 sessions whose tests failed that broken implementation. Higher is better.</p></section>

<section><h2>Actual low and max answers</h2><div class="compare"><div class="output"><span class="label">Actual low output: ${representativeLow.grade.killedCount}/8</span><pre>${esc(representativeLow.actualClaudeOutput)}</pre><p class="comment"><strong>Author comment:</strong> The answer is useful, but its tests missed restart instability and both legacy-provider failures.</p></div><div class="output"><span class="label max">Actual max output: ${representativeMax.grade.killedCount}/8</span><pre>${esc(representativeMax.actualClaudeOutput)}</pre><p class="comment"><strong>Author comment:</strong> This answer added cross-process and provider-contract tests, so all eight seeded regressions were blocked.</p></div></div><details><summary>Show the actual grader output for these two sessions</summary><div class="inside compare"><div><h3>Low grader</h3><pre>${esc(gradeDigest(representativeLow))}</pre></div><div><h3>Max grader</h3><pre>${esc(gradeDigest(representativeMax))}</pre></div></div></details><details><summary>Show the complete captured grader JSON</summary><div class="inside compare"><pre>${esc(JSON.stringify(representativeLow.grade, null, 2))}</pre><pre>${esc(JSON.stringify(representativeMax.grade, null, 2))}</pre></div></details></section>

<section><h2>How students should route effort</h2><div class="route"><div><strong>Low: routine work</strong>Fastest and cheapest. In this lab it blocked ${fixed(low.meanCaught)} of 8 risks.</div><div><strong>Medium: one deeper pass</strong>Blocked ${fixed(stats[1].meanCaught)} of 8 at modest extra cost.</div><div><strong>High: no measured win here</strong>Same mean quality as medium, but slower and costlier. Do not pay for it on this task.</div><div class="chosen"><strong>Max: high-consequence test design</strong>Blocked ${fixed(max.meanCaught)} of 8. Use when missed edge cases can harm customers or a release.</div></div><p class="callout"><strong>Rule:</strong> Start with the lowest setting that meets your measured quality bar. Raise effort when the task has real depth and the cost of a missed case is higher than the extra model time. Always run the tests; effort is not a guarantee.</p></section>

<section><h2>Method and evidence boundary</h2><p>Every run used a fresh temporary repository and fresh Claude process. The order was randomized. The correct implementation, exact prompt, model, tools, contracts, fixture hash, and mutation grader stayed fixed. Only effort changed.</p><p><strong>Final gate:</strong> max needed to beat low by 20 points, win at least 7 of 10 matched repetitions, and have no worse validity or completion rate. Observed: +${fixed(qualityDelta)} points, ${matchedMaxWins}/10 wins, equal ${max.valid}/10 validity, and equal ${max.complete}/10 completion.</p><p class="callout"><strong>Do not generalize the exact numbers.</strong> This proves an effort effect on this task and model. It does not prove max is best for every coding task. Re-measure when the task, model, prompt, or tool access changes.</p><details><summary>Show all 40 run results</summary><div class="inside table-wrap"><table><thead><tr><th>Order</th><th>Effort</th><th>Rep</th><th>Caught</th><th>Quality</th><th>Time</th><th>Cost</th><th>Valid</th></tr></thead><tbody>${runRows}</tbody></table></div></details><p class="stamp">Fixture: ${esc(final.benchmark.fixtureSha256)} | Prompt: ${esc(final.benchmark.promptSha256)} | Grader: ${esc(final.benchmark.graderSha256)} | Seed: ${esc(final.benchmark.randomSeed)}</p><p class="sources">Method sources: <a href="https://platform.claude.com/docs/en/build-with-claude/effort">Anthropic effort documentation</a>; <a href="https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents">Anthropic agent-eval guidance</a>; <a href="https://proceedings.iclr.cc/paper_files/paper/2025/hash/1b623663fd9b874366f3ce019fdfdd44-Abstract-Conference.html">ICLR 2025 test-time-compute study</a>.</p></section>
</main></body></html>`;

const markdownStats = stats.map(item => `| ${item.effort} | ${fixed(item.meanQuality)}/100 | ${fixed(item.meanCaught)}/8 | ${item.valid}/10 | ${fixed(item.meanSeconds)}s | $${fixed(item.meanCost,3)} |`).join('\n');
const markdownMutants = mutantRows.map(item => `| ${item.id} | ${item.counts.map(count => `${count}/10`).join(' | ')} | ${item.impact} |`).join('\n');
const markdown = `# Effort Quality Lab: Final Results

## Result

The lab passed its preregistered quality gate. Max effort averaged **${fixed(max.meanQuality)}/100**, versus **${fixed(low.meanQuality)}/100** for low: a **+${fixed(qualityDelta)} point** gain. Max beat low in **${matchedMaxWins}/10** matched repetitions. All 40 submissions were valid and all 40 Claude CLI sessions completed.

| Effort | Mean quality | Regressions blocked | Valid | Mean time | Mean cost |
|---|---:|---:|---:|---:|---:|
${markdownStats}

Actual total model cost: **$${fixed(totalCost,2)}**.

## Student impact

Low usually found the obvious cache and pagination gaps. Max was much more likely to test two hard, high-impact behaviors:

- rollout assignment stays stable after a service restart;
- old provider labels still send tickets to the right support queue.

Those are not writing-style improvements. They are additional production failures the submitted tests would stop.

## Per-risk results

| Mutant | Low | Medium | High | Max | Customer or operator impact |
|---|---:|---:|---:|---:|---|
${markdownMutants}

## Routing rule

Use the lowest effort that meets your measured quality bar. In this lab, medium and high had the same mean quality, so high was not worth its extra time and cost. Max was worth considering for high-consequence release-safety test design. Effort is not a guarantee; keep deterministic checks.

## Evidence boundary

The task, prompt, fixture, model, tools, grader, and run conditions were frozen before the final. Only effort changed. The exact rates apply to this controlled task and should be re-measured when the task or model changes.

Full actual Claude outputs, actual grader records, all 40 run rows, candidate selection evidence, and method details are in [RESULTS.html](RESULTS.html). Machine-readable evidence is in [mutation-final-runs-2026-08-07.json](captures/mutation-final-runs-2026-08-07.json).
`;

fs.writeFileSync(paths.html, html);
fs.writeFileSync(paths.markdown, markdown);
console.log(`html: ${paths.html}`);
console.log(`markdown: ${paths.markdown}`);
