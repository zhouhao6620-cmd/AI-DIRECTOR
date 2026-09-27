import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  createDevelopmentControlCenterView,
  statusFromMilestone,
  validateDevelopmentControlCenterState,
} from '../../src/development-control-center/project-state-view.mjs';

const state = JSON.parse(await readFile(new URL('../../PROJECT_STATE.json', import.meta.url), 'utf8'));

test('roadmap projection preserves the fixed 13 packages and derives their states from PROJECT_STATE', () => {
  assert.deepEqual(validateDevelopmentControlCenterState(state), []);
  const { dcc } = createDevelopmentControlCenterView(state);

  assert.equal(dcc.stateSource, 'PROJECT_STATE.json');
  assert.equal(dcc.packageCount, 13);
  assert.deepEqual(dcc.workPackages.map((item) => item.id), ['P0', 'M0-A', 'M0-B', 'M0-C', 'M0-D', 'M0-E', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7']);
  assert.equal(dcc.workPackages.find((item) => item.id === 'M0-B').state, statusFromMilestone(state.milestone_control.m0_b.status));
  assert.equal(dcc.workPackages.find((item) => item.id === 'M0-C').state, statusFromMilestone(state.milestone_control.m0_c.status));
  assert.ok(dcc.workPackages.every((item) => item.tasks.length > 0 && item.dependencies.every((dependency) => dependency.name)));
});

test('top progress is calculated only from leaf tasks', () => {
  const { dcc } = createDevelopmentControlCenterView(state);
  const counts = dcc.allTasks.reduce((result, task) => ({ ...result, [task.state]: (result[task.state] ?? 0) + 1 }), {});

  assert.deepEqual(dcc.taskSummary, {
    total: dcc.allTasks.length,
    inProgress: counts.in_progress ?? 0,
    pendingAcceptance: counts.pending_acceptance ?? 0,
    completed: counts.completed ?? 0,
    notStarted: counts.not_started ?? 0,
    blocked: counts.blocked ?? 0,
  });
  assert.equal(dcc.workPackages.reduce((sum, item) => sum + item.totalTasks, 0), dcc.taskSummary.total);
  assert.equal(dcc.workPackages.reduce((sum, item) => sum + item.completedTasks, 0), dcc.taskSummary.completed);
});

test('product skills remain visible without being added to task totals', () => {
  const { dcc } = createDevelopmentControlCenterView(state);
  assert.equal(dcc.productSkills.length, 2);
  assert.ok(dcc.productSkills.every((skill) => skill.purpose && skill.input && skill.output && skill.owner.id && skill.consumers.length));
  assert.equal(dcc.taskSummary.total, dcc.allTasks.length);
});

test('DCC is an independent read-only page with full-width details and no inspector', async () => {
  const [source, projection, entry] = await Promise.all([
    readFile(new URL('../../src/development-control-center/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/development-control-center/project-state-view.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../development-control-center.html', import.meta.url), 'utf8'),
  ]);
  assert.match(source, /import projectState from ['"]\.\.\/\.\.\/PROJECT_STATE\.json['"]/);
  assert.match(source, /产品技能资产/);
  assert.match(source, /id="detail"/);
  assert.doesNotMatch(source, /dcc-inspector|renderInspector|development-state\.json|scrollIntoView/);
  assert.doesNotMatch(projection, /development-state\.json|workbench-v0|workbench-src|hf-runtime/);
  assert.match(entry, /src="\/src\/development-control-center\/main\.js"/);
});

test('the product application remains free of DCC implementation', async () => {
  const [productSource, productStyles] = await Promise.all([
    readFile(new URL('../../src/application-shell/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/application-shell/shell.css', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(productSource, /Development Control Center|研发控制中心|研发总览/);
  assert.doesNotMatch(productStyles, /dcc-/);
});
